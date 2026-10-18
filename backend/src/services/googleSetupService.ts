import { supabase } from "../config/supabase";
import { checked, fail, audit } from "./adminService";

const ROUTING_BLOCKER =
  "Google authorization alone does not provision a working route. The Fastn operator must allow this teacher in the widget, verify the teacher-owned installation and Google destinations, and provision/test its Google webhook route. Existing installation fan-out omits the Google trigger. Never copy another teacher’s route or credentials.";
async function platform(path: string, body?: any) {
  const key = process.env.FASTN_PLATFORM_API_KEY;
  if (!key)
    fail(
      "Administrator setup required: configure FASTN_PLATFORM_API_KEY in the staging server environment with setup-link and installation read permissions.",
      503,
    );
  const response = await fetch(`https://api.fastn.dev/api/v1/${path}`, {
    method: body ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(key.startsWith("fsk_test_") ? { "X-fastn-Test-Mode": "true" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    fail(
      `Fastn setup request failed (HTTP ${response.status}). Ask the operator to verify API-key permissions, the teacher widget allowlist and installation routing.`,
      502,
    );
  const result: any = await response.json();
  return result.data ?? result;
}
async function teacherAllowed(id: string) {
  const user = checked(
    await supabase
      .from("users")
      .select("id,name,role,status")
      .eq("id", id)
      .maybeSingle(),
  );
  const grant = checked(
    await supabase
      .from("automation_grants")
      .select("status,capabilities")
      .eq("teacher_id", id)
      .maybeSingle(),
  );
  if (
    user?.role !== "teacher" ||
    user.status !== "active" ||
    grant?.status !== "active" ||
    !grant.capabilities.some((k: string) =>
      ["calendar_sync", "sheets_sync"].includes(k),
    )
  )
    fail("An active teacher with assigned Google automation is required", 409);
  return user;
}
export async function connectionView(id: string) {
  const bound = checked(
    await supabase
      .from("automation_connections")
      .select(
        "calendar_connected,sheets_connected,verified_at,verified_calendar_id,verified_spreadsheet_id,installation_id,google_webhook_url,revoked_at",
      )
      .eq("teacher_id", id)
      .maybeSingle(),
  );
  const setup = checked(
    await supabase
      .from("google_setup_requests")
      .select("status,blocker,expires_at,updated_at")
      .eq("teacher_id", id)
      .maybeSingle(),
  );
  const ready = Boolean(
    bound?.verified_at &&
      bound.installation_id &&
      bound.google_webhook_url &&
      !bound.revoked_at,
  );
  // Never expose provider credentials, tenant IDs, installation IDs or callback URLs.
  return {
    status: ready ? "verified" : setup?.status || "required",
    calendar_connected: ready && bound.calendar_connected,
    sheets_connected: ready && bound.sheets_connected,
    calendar_id: ready ? bound.verified_calendar_id : null,
    spreadsheet_id: ready ? bound.verified_spreadsheet_id : null,
    verified_at: ready ? bound.verified_at : null,
    blocker: ready ? null : setup?.blocker || ROUTING_BLOCKER,
    expires_at: setup?.expires_at,
  };
}
export async function createGoogleSetup(id: string, actor: string) {
  const teacher = await teacherAllowed(id);
  const widgetId = process.env.FASTN_GOOGLE_WIDGET_ID;
  if (!widgetId)
    return {
      status: "blocked",
      blocker:
        "Administrator setup required: set FASTN_GOOGLE_WIDGET_ID and FASTN_PLATFORM_API_KEY on the staging server. " +
        ROUTING_BLOCKER,
    };
  try {
    const existing = checked(
      await supabase
        .from("automation_connections")
        .select("tenant_id")
        .eq("teacher_id", id)
        .maybeSingle(),
    );
    const result = await platform("setup-links", {
      widgetId,
      expiresInMinutes: 15,
      label: `QuizShield — ${teacher.name}`,
      connectionName: `QuizShield ${teacher.name}`,
      ...(existing?.tenant_id
        ? { endOrgId: existing.tenant_id }
        : { externalRef: `quizshield:${id}`, createIfMissing: true }),
      metadata: { teacherId: id },
      allowAdditionalConnection: true,
    });
    const link = result.url || result.setupUrl;
    const setupId = result.setupId || result.id;
    if (
      typeof link !== "string" ||
      !/^https:\/\/(?:[a-z0-9-]+\.)*fastn\.(?:dev|ai)\//i.test(link) ||
      !setupId
    )
      fail("Fastn did not return a valid teacher setup link", 502);
    // Reconnect must never silently keep dispatching through the previous account.
    // Preserve the old binding for investigation, but require fresh verification.
    await revokeGoogle(id, actor);
    checked(
      await supabase
        .from("google_setup_requests")
        .upsert({
          teacher_id: id,
          setup_id: setupId,
          tenant_id: result.endOrgId || existing?.tenant_id || null,
          status: "authorizing",
          blocker: null,
          expires_at: result.expiresAt,
          updated_at: new Date().toISOString(),
        }),
    );
    await audit(actor, "google_setup_created", id);
    return {
      status: "authorizing",
      url: link,
      expires_at: result.expiresAt,
      instructions:
        "The selected teacher must open this short-lived link and authorize their own Google account. Return here and verify. Connection remains unavailable until ownership, approved destinations and routing pass.",
    };
  } catch (error: any) {
    const blocker = error.statusCode
      ? error.message
      : "Fastn setup is temporarily unavailable. Check the server configuration.";
    checked(
      await supabase
        .from("google_setup_requests")
        .upsert({
          teacher_id: id,
          status: "blocked",
          blocker,
          updated_at: new Date().toISOString(),
        }),
    );
    return { status: "blocked", blocker };
  }
}
export async function refreshGoogleSetup(
  id: string,
  actor: string,
  input: any = {},
) {
  await teacherAllowed(id);
  if (input.calendar_id !== undefined || input.spreadsheet_id !== undefined) {
    // Only operator-verified destinations can be approved through the UI.
    const view = await connectionView(id);
    if (
      view.status !== "verified" ||
      (input.calendar_id && input.calendar_id !== view.calendar_id) ||
      (input.spreadsheet_id && input.spreadsheet_id !== view.spreadsheet_id)
    )
      fail("Destination ownership has not been verified for this teacher", 409);
    checked(
      await supabase
        .from("automation_settings")
        .update({
          calendar_id: view.calendar_id || "",
          spreadsheet_id: view.spreadsheet_id || "",
        })
        .eq("teacher_id", id),
    );
    await audit(actor, "google_destinations_approved", id, {
      calendar_id: view.calendar_id,
      spreadsheet_id: view.spreadsheet_id,
    });
  }
  const current = await connectionView(id);
  const request = checked(
    await supabase
      .from("google_setup_requests")
      .select("setup_id,tenant_id")
      .eq("teacher_id", id)
      .maybeSingle(),
  );
  if (!request?.setup_id) return current;
  const setup = await platform(
    `setup-links/${encodeURIComponent(request.setup_id)}`,
  );
  if (
    setup.metadata?.teacherId !== id ||
    (request.tenant_id && setup.endOrgId !== request.tenant_id)
  )
    fail("Setup ownership mismatch", 403);
  // Callback query parameters are never accepted as proof of successful authorization.
  if (setup.status !== "completed")
    return {
      status: "authorizing",
      blocker:
        "Teacher authorization has not completed. Reopen setup or generate a fresh link.",
    };
  if (current.status === "verified") return current;
  checked(
    await supabase
      .from("google_setup_requests")
      .update({
        status: "blocked",
        blocker: ROUTING_BLOCKER,
        updated_at: new Date().toISOString(),
      })
      .eq("teacher_id", id),
  );
  await audit(actor, "google_routing_verification_blocked", id);
  return { status: "blocked", blocker: ROUTING_BLOCKER };
}
export async function revokeGoogle(id: string, actor: string) {
  checked(
    await supabase
      .from("automation_connections")
      .update({
        calendar_connected: false,
        sheets_connected: false,
        verified_at: null,
        revoked_at: new Date().toISOString(),
      })
      .eq("teacher_id", id),
  );
  checked(
    await supabase
      .from("google_setup_requests")
      .upsert({
        teacher_id: id,
        status: "revoked",
        blocker:
          "Application access revoked. The teacher can also remove Fastn access in their Google account security settings.",
        updated_at: new Date().toISOString(),
      }),
  );
  const jobs = checked(
    await supabase
      .from("automation_jobs")
      .select("id,status")
      .eq("teacher_id", id)
      .eq("channel", "fastn")
      .in("status", ["pending", "failed", "running", "awaiting"]),
  );
  for (const status of ["pending", "failed", "running", "awaiting"]) {
    const ids = jobs
      .filter((j: any) => j.status === status)
      .map((j: any) => j.id);
    if (!ids.length) continue;
    checked(
      await supabase
        .from("automation_jobs")
        .update({
          status: ["running", "awaiting"].includes(status)
            ? "uncertain"
            : "cancelled",
          last_error:
            "Google access revoked; reconcile any in-progress provider action",
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("status", status),
    );
  }
  await audit(actor, "google_access_revoked", id);
  return await connectionView(id);
}
