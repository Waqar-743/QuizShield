import crypto from "crypto";
import { supabase } from "../config/supabase";
import { config } from "../config/environment";
import {
  defaultAutomationSettings,
  emailPreference,
  isAssigned,
  practiceSuggestions,
} from "./automationPolicy";
import { emailService } from "./emailService";

function checked<T extends { error: any; data: any }>(result: T): T["data"] {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export async function settingsFor(teacherId: string) {
  const row = checked(
    await supabase
      .from("automation_settings")
      .select("*")
      .eq("teacher_id", teacherId)
      .maybeSingle(),
  );
  return { ...defaultAutomationSettings, ...row };
}
const grantKey = (kind: string) =>
  ({
    reminder: "deadline_reminder",
    results: "results_email",
    schedule: "schedule_email",
    cancellation: "schedule_email",
    welcome: "welcome_email",
    calendar: "calendar_sync",
    sheets: "sheets_sync",
  })[kind] || kind;
export async function grantFor(teacherId: string) {
  return (
    checked(
      await supabase
        .from("automation_grants")
        .select("status,capabilities,editable_keys")
        .eq("teacher_id", teacherId)
        .maybeSingle(),
    ) || { status: "revoked", capabilities: [], editable_keys: [] }
  );
}
export async function retryAutomationJob(id: string, teacherId?: string) {
  let query = supabase
    .from("automation_jobs")
    .select("*")
    .eq("id", id)
    .eq("status", "failed");
  if (teacherId) query = query.eq("teacher_id", teacherId);
  const job = checked(await query.maybeSingle());
  if (
    !job ||
    job.provider_id ||
    (job.first_delivery_at &&
      Date.now() - Date.parse(job.first_delivery_at) > 23 * 3600_000)
  )
    throw Object.assign(
      new Error("This job requires provider reconciliation before retry"),
      { statusCode: 409 },
    );
  if (!(await prepareAutomation(job)))
    throw Object.assign(
      new Error(
        "Automation is no longer eligible. Check account access and assignment.",
      ),
      { statusCode: 409 },
    );
  const rows = checked(
    await supabase
      .from("automation_jobs")
      .update({
        status: "pending",
        run_at: new Date().toISOString(),
        last_error: null,
        execution_token: null,
        lease_until: null,
      })
      .eq("id", id)
      .eq("status", "failed")
      .is("provider_id", null)
      .select("id"),
  );
  if (!rows?.length)
    throw Object.assign(new Error("Job status changed; refresh before retry"), {
      statusCode: 409,
    });
}
export async function jobUpdate(job: any, patch: any) {
  const rows = checked(
    await supabase
      .from("automation_jobs")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("execution_token", job.execution_token)
      .in("status", ["running", "awaiting"])
      .select("id"),
  );
  return Boolean(rows?.length);
}

// Always called again by Fastn just before the actual side effect.
export async function prepareAutomation(job: any): Promise<any | null> {
  const teacher = checked(
    await supabase
      .from("users")
      .select("role,status")
      .eq("id", job.teacher_id)
      .maybeSingle(),
  );
  if (teacher?.role !== "teacher" || teacher.status !== "active") return null;
  if (["email", "fastn"].includes(job.channel)) {
    const grant = await grantFor(job.teacher_id);
    if (
      grant.status !== "active" ||
      !grant.capabilities.includes(grantKey(job.kind))
    )
      return null;
  }
  if (job.channel === "fastn" && !config.automationGoogleEnabled) return null;
  const settings = await settingsFor(job.teacher_id);
  const course = job.course_id
    ? checked(
        await supabase
          .from("courses")
          .select("id,title,created_by")
          .eq("id", job.course_id)
          .maybeSingle(),
      )
    : null;
  if (!course || course.created_by !== job.teacher_id) return null;
  const quiz = job.quiz_id
    ? checked(
        await supabase
          .from("teacher_quizzes")
          .select("*")
          .eq("id", job.quiz_id)
          .maybeSingle(),
      )
    : null;
  if (
    job.quiz_id &&
    (!quiz ||
      quiz.teacher_id !== job.teacher_id ||
      quiz.course_id !== course.id)
  )
    return null;
  if (quiz && job.version != null && quiz.schedule_version !== job.version)
    return null;
  if (
    quiz &&
    job.kind !== "cancellation" &&
    job.kind !== "calendar" &&
    quiz.lifecycle !== "published"
  )
    return null;
  if (job.kind === "cancellation" && quiz?.lifecycle !== "cancelled")
    return null;
  if (
    quiz?.is_active === false &&
    !["cancellation", "calendar"].includes(job.kind)
  )
    return null;
  if (job.kind === "calendar" && quiz?.lifecycle === "draft") return null;
  if (job.channel === "email" && !emailPreference(job.kind, settings))
    return null;
  let student: any = null,
    attempt: any = null;
  if (job.student_id) {
    const enrolled = checked(
      await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", course.id)
        .eq("user_id", job.student_id)
        .maybeSingle(),
    );
    if (!enrolled || (quiz && !isAssigned(quiz, job.student_id))) return null;
    student = checked(
      await supabase
        .from("users")
        .select("id,email,name,role,status")
        .eq("id", job.student_id)
        .maybeSingle(),
    );
    if (!student || student.role !== "student" || student.status !== "active")
      return null;
  }
  if (job.kind === "reminder") {
    if (!quiz.closes_at || Date.now() >= Date.parse(quiz.closes_at))
      return null;
    const completed = checked(
      await supabase
        .from("quiz_attempts")
        .select("id")
        .eq("quiz_id", quiz.id)
        .eq("user_id", job.student_id)
        .eq("status", "completed")
        .limit(1),
    );
    if (completed?.length) return null;
  }
  if (
    job.kind === "announcement" &&
    quiz.closes_at &&
    Date.now() >= Date.parse(quiz.closes_at)
  )
    return null;
  if (job.attempt_id) {
    attempt = checked(
      await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("id", job.attempt_id)
        .eq("user_id", job.student_id)
        .maybeSingle(),
    );
    if (
      !attempt?.results_released_at ||
      attempt.teacher_grade == null ||
      attempt.status !== "completed"
    )
      return null;
  }
  const title = quiz?.title || course.title;
  const link = job.attempt_id
    ? `${config.frontendAppUrl}/quiz/teacher-results/${job.attempt_id}`
    : `${config.frontendAppUrl}/dashboard/student/join-quiz`;
  const times = quiz
    ? [
        quiz.scheduled_start &&
          `Starts ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: quiz.timezone }).format(new Date(quiz.scheduled_start))}`,
        quiz.closes_at &&
          `Closes ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: quiz.timezone }).format(new Date(quiz.closes_at))}`,
      ]
        .filter(Boolean)
        .join(". ") + ` (${quiz.timezone}).`
    : "";
  const messages: Record<string, string> = {
    announcement: `Your teacher published “${title}”. ${times} Quiz code: ${quiz?.access_code}.`,
    reminder: `“${title}” is closing soon and you have not submitted. ${times}`,
    schedule: `The schedule or assignment for “${title}” changed. ${times} Check QuizShield for the latest details.`,
    cancellation: `Your teacher cancelled “${title}”.`,
    welcome: `You are enrolled in “${course.title}”. Welcome to the course.`,
    results: `Your teacher released your reviewed results for “${title}”. Sign in to view your private results.`,
  };
  if (job.channel === "inapp")
    return { title, message: messages[job.kind], quiz };
  if (job.channel === "internal")
    return { suggestions: practiceSuggestions(attempt, quiz) };
  if (job.channel === "email")
    return {
      to: student.email,
      subject: `QuizShield: ${job.kind === "results" ? "Results released" : job.kind} — ${title}`,
      text: `${messages[job.kind]}\n\n${link}`,
    };
  if (
    (job.kind === "calendar" && !settings.calendar_sync) ||
    (job.kind === "sheets" && !settings.sheets_sync)
  )
    return null;
  const connection = checked(
    await supabase
      .from("automation_connections")
      .select("*")
      .eq("teacher_id", job.teacher_id)
      .maybeSingle(),
  );
  if (
    !connection?.verified_at ||
    connection.revoked_at ||
    !connection.installation_id ||
    !connection.google_webhook_url
  )
    throw new Error("Google connection ownership has not been verified");
  if (job.kind === "calendar") {
    if (!settings.calendar_sync) return null;
    if (!settings.calendar_id || !connection?.calendar_connected)
      throw new Error("Calendar connection or destination missing");
    if (settings.calendar_id !== connection.verified_calendar_id)
      throw new Error(
        "Calendar destination has not been verified for this teacher",
      );
    if (!quiz.scheduled_start || !quiz.closes_at) return null;
    const binding = checked(
      await supabase.rpc("bind_automation_record", {
        p_teacher: job.teacher_id,
        p_key: `calendar:${quiz.id}`,
        p_destination: settings.calendar_id,
        p_tab: "",
      }),
    );
    if (binding.destination !== connection.verified_calendar_id)
      throw new Error("Original Calendar destination requires verification");
    return {
      tenantId: connection.tenant_id,
      installationId: connection.installation_id,
      calendarId: binding.destination,
      eventId: crypto.createHash("sha256").update(quiz.id).digest("hex"),
      revision: quiz.schedule_version,
      operation: quiz.lifecycle === "cancelled" ? "cancel" : "upsert",
      summary: quiz.title,
      start: { dateTime: quiz.scheduled_start, timeZone: quiz.timezone },
      end: { dateTime: quiz.closes_at, timeZone: quiz.timezone },
      description:
        "Assessment schedule. Open QuizShield for access and instructions.",
      sendUpdates: "none",
    };
  }
  if (!settings.sheets_sync) return null;
  if (!settings.spreadsheet_id || !connection?.sheets_connected)
    throw new Error("Sheets connection or destination missing");
  if (settings.spreadsheet_id !== connection.verified_spreadsheet_id)
    throw new Error(
      "Sheets destination has not been verified for this teacher",
    );
  const binding = checked(
    await supabase.rpc("bind_automation_record", {
      p_teacher: job.teacher_id,
      p_key: `sheets:${attempt.id}`,
      p_destination: settings.spreadsheet_id,
      p_tab: settings.sheet_tab,
    }),
  );
  if (binding.destination !== connection.verified_spreadsheet_id)
    throw new Error("Original Sheets destination requires verification");
  return {
    tenantId: connection.tenant_id,
    installationId: connection.installation_id,
    spreadsheetId: binding.destination,
    range: `'${binding.tab.replace(/'/g, "''")}'!A${binding.row_number}:F${binding.row_number}`,
    valueInputOption: "RAW",
    values: [
      [
        attempt.id,
        quiz.title,
        student.name,
        student.email,
        attempt.teacher_grade,
        attempt.results_released_at,
      ],
    ],
  };
}

export async function completeAutomation(job: any, providerId: string) {
  await jobUpdate(job, {
    status: "succeeded",
    provider_id: providerId.slice(0, 500),
    last_error: null,
    lease_until: null,
  });
}

export async function deliverAutomationEmail(job: any) {
  if (job.channel !== "email")
    throw Object.assign(new Error("This job does not send email"), {
      statusCode: 400,
    });
  const payload = await prepareAutomation(job);
  if (!payload) {
    await jobUpdate(job, {
      status: "cancelled",
      last_error: "No longer eligible",
    });
    return { skipped: true };
  }
  if (!config.automationLive || !allowedRecipient(payload.to))
    throw new Error(
      "Delivery is disabled or recipient is outside the allowlist",
    );
  // A first provider call older than Resend's 24h deduplication window cannot safely be replayed.
  if (
    job.first_delivery_at &&
    Date.now() - Date.parse(job.first_delivery_at) > 23 * 3600_000
  ) {
    await jobUpdate(job, {
      status: "uncertain",
      last_error:
        "Email deduplication window expired; reconcile provider record",
    });
    return { skipped: true };
  }
  const stillLeased = await jobUpdate(job, {
    first_delivery_at: job.first_delivery_at || new Date().toISOString(),
  });
  if (!stillLeased) return { skipped: true };
  const providerId = await emailService.sendAutomationEmail(
    payload,
    job.dedupe_key,
  );
  await completeAutomation(job, providerId);
  return { delivered: true, providerId };
}

export async function automationWebhookFor(job: any): Promise<string> {
  if (job.channel === "email") return config.fastnWebhookUrl;
  if (job.channel !== "fastn") return "";
  const connection = checked(
    await supabase
      .from("automation_connections")
      .select("*")
      .eq("teacher_id", job.teacher_id)
      .maybeSingle(),
  );
  if (
    !connection?.verified_at ||
    !connection.installation_id ||
    !/^https:\/\/webhooks\.fastn\.dev\/prod\/triggers\/[A-Za-z0-9_-]+\/webhooks\/[0-9a-f-]{36}$/.test(
      connection.google_webhook_url || "",
    )
  )
    return "";
  return connection.google_webhook_url;
}

export async function runAutomationWorker() {
  checked(
    await supabase
      .from("automation_health")
      .upsert({ id: true, last_started_at: new Date().toISOString() }),
  );
  const started = Date.now();
  let processed = 0;
  while (processed < 10 && Date.now() - started < 20_000) {
    const jobs = checked(await supabase.rpc("claim_automation_job"));
    const job = jobs?.[0];
    if (!job) break;
    processed++;
    let dispatched = false;
    try {
      const payload = await prepareAutomation(job);
      if (!payload) {
        await jobUpdate(job, {
          status: "cancelled",
          last_error: "Disabled or no longer eligible",
        });
        continue;
      }
      if (job.channel === "inapp") {
        checked(
          await supabase
            .from("notifications")
            .upsert(
              {
                user_id: job.student_id,
                title: payload.title,
                message: payload.message,
                type: job.kind === "results" ? "grade" : "quiz",
                quiz_id: job.quiz_id,
                automation_key: job.dedupe_key,
              },
              { onConflict: "automation_key", ignoreDuplicates: true },
            ),
        );
        await completeAutomation(job, job.dedupe_key);
      } else if (job.channel === "internal") {
        checked(
          await supabase
            .from("learning_followups")
            .upsert(
              {
                attempt_id: job.attempt_id,
                student_id: job.student_id,
                suggestions: payload.suggestions,
              },
              { onConflict: "attempt_id" },
            ),
        );
        await completeAutomation(job, job.dedupe_key);
      } else {
        const webhookUrl = await automationWebhookFor(job);
        if (
          !config.automationLive ||
          !webhookUrl ||
          !config.fastnAccessKey ||
          !config.backendPublicUrl
        ) {
          await jobUpdate(job, {
            status: "failed",
            last_error: "Live Fastn delivery is not configured",
          });
          continue;
        }
        // Controlled recipients are enforced on every path, including callbacks.
        if (job.channel === "email" && !allowedRecipient(payload.to)) {
          await jobUpdate(job, {
            status: "failed",
            last_error:
              "Recipient is outside the controlled delivery allowlist",
          });
          continue;
        }
        if (!await jobUpdate(job, { status: "awaiting" })) continue;
        dispatched = true;
        const base = `${config.backendPublicUrl}/api/automations/delivery/${job.id}`;
        const response = await fetch(webhookUrl, {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(8000),
          headers: {
            "Content-Type": "application/json",
            "x-fastn-access-key": config.fastnAccessKey,
            ...(payload.tenantId
              ? {
                  "x-end-org-id": payload.tenantId,
                  "x-installation-id": payload.installationId,
                }
              : {}),
          },
          body: JSON.stringify({
            deliveryId: `${job.id}:${job.attempts}`,
            idempotencyKey: job.dedupe_key,
            kind: job.kind,
            channel: job.channel,
            executionToken: job.execution_token,
            ...(payload.tenantId
              ? {
                  tenantId: payload.tenantId,
                  installationId: payload.installationId,
                }
              : {}),
            preflightUrl: `${base}/preflight`,
            completeUrl: `${base}/complete`,
            emailDeliveryUrl: `${base}/email`,
          }),
        });
        // 2xx is dispatch acceptance only. A callback with a provider ID completes the job.
        if (!response.ok)
          await jobUpdate(job, {
            status:
              response.status === 401 ||
              response.status === 403 ||
              response.status === 429
                ? "failed"
                : "uncertain",
            last_error: `Fastn dispatch HTTP ${response.status}`,
          });
      }
    } catch (error: any) {
      await jobUpdate(job, {
        status: dispatched ? "uncertain" : "failed",
        last_error: dispatched
          ? "Dispatch outcome unknown; reconcile delivery"
          : "Preparation failed; check connection, destinations and database",
      });
    }
  }
  checked(
    await supabase
      .from("automation_health")
      .upsert({
        id: true,
        last_completed_at: new Date().toISOString(),
        processed,
        last_error: null,
      }),
  );
  return { processed };
}

export function allowedRecipient(email: string) {
  return (
    config.automationAllowAll ||
    config.automationRecipients.includes(email.toLowerCase())
  );
}
