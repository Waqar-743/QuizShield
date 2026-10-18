import express from "express";
import crypto from "crypto";
import { protect, authorize } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { supabase } from "../config/supabase";
import { config } from "../config/environment";
import {
  allowedRecipient,
  automationWebhookFor,
  completeAutomation,
  deliverAutomationEmail,
  grantFor,
  jobUpdate,
  prepareAutomation,
  retryAutomationJob,
  runAutomationWorker,
  settingsFor,
} from "../services/automationService";
import {
  defaultAutomationSettings,
  validateTimezone,
} from "../services/automationPolicy";
import {
  connectionView,
  createGoogleSetup,
  refreshGoogleSetup,
} from "../services/googleSetupService";

const router = express.Router();
function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
function check(result: any) {
  if (result.error) fail(result.error.message, 500);
  return result.data;
}
function matches(a: string, b: string) {
  return Boolean(
    a &&
      b &&
      a.length === b.length &&
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)),
  );
}
function requireWorker(req: express.Request) {
  if (
    config.automationWorkerSecret.length < 32 ||
    !matches(
      req.headers.authorization || "",
      `Bearer ${config.automationWorkerSecret}`,
    )
  )
    fail("Worker authorization failed", 401);
}

router.post(
  "/worker",
  asyncHandler(async (req, res) => {
    requireWorker(req);
    res.json({ success: true, data: await runAutomationWorker() });
  }),
);

router.post(
  "/diagnostics",
  asyncHandler(async (req, res) => {
    requireWorker(req);
    const key = config.fastnAccessKey;
    const data: any = {
      keyPresent: Boolean(key),
      keyMode: key.startsWith("fsk_live_")
        ? "live"
        : key.startsWith("fsk_test_")
          ? "test"
          : "unrecognized",
      keyHasWhitespace: key !== key.trim(),
      keyIsMasked: key.includes("...") || key.includes("…"),
      webhookConfigured: Boolean(config.fastnWebhookUrl),
      controlledRecipients: !config.automationAllowAll,
      googleEnabled: config.automationGoogleEnabled,
    };
    if (req.body.probe === true) {
      if (
        !config.automationLive ||
        config.automationAllowAll ||
        !config.automationRecipients.length
      )
        fail("Probe requires controlled delivery", 409);
      // A completed job returns before any email side effect, even if its lease expired.
      const channel = req.body.channel === "fastn" ? "fastn" : "email";
      if (channel === "fastn" && !config.automationGoogleEnabled)
        fail("Google delivery is disabled", 409);
      let query = supabase
        .from("automation_jobs")
        .select("*")
        .eq("status", "succeeded")
        .eq("channel", channel);
      if (typeof req.body.completedJobId === "string")
        query = query.eq("id", req.body.completedJobId);
      const jobs = check(await query.limit(1));
      const job = jobs[0];
      const webhookUrl = job ? await automationWebhookFor(job) : "";
      if (
        !job?.execution_token ||
        !config.backendPublicUrl ||
        !key ||
        !webhookUrl
      )
        fail("No completed fixture or missing configuration", 409);
      const connection =
        channel === "fastn"
          ? check(
              await supabase
                .from("automation_connections")
                .select("*")
                .eq("teacher_id", job.teacher_id)
                .single(),
            )
          : null;
      const base = `${config.backendPublicUrl}/api/automations/delivery/${job.id}`;
      const header =
        req.body.header === "api" ? "x-api-key" : "x-fastn-access-key";
      const response = await fetch(webhookUrl, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
        headers: {
          "Content-Type": "application/json",
          [header]: key,
          ...(connection
            ? {
                "x-end-org-id": connection.tenant_id,
                "x-installation-id": connection.installation_id,
              }
            : {}),
        },
        body: JSON.stringify({
          deliveryId:
            req.body.replayCompleted === true
              ? `${job.id}:${job.attempts}`
              : `diagnostic:${job.id}:${crypto.randomUUID()}`,
          idempotencyKey: job.dedupe_key,
          channel,
          kind: job.kind,
          executionToken: job.execution_token,
          ...(connection
            ? {
                tenantId: connection.tenant_id,
                installationId: connection.installation_id,
              }
            : {}),
          preflightUrl: `${base}/preflight`,
          emailDeliveryUrl: `${base}/email`,
          completeUrl: `${base}/complete`,
        }),
      });
      data.probeStatus = response.status;
      // Do not return arbitrary upstream bodies: they may echo credentials or inputs.
      const result: any = await response.json().catch(() => ({}));
      const code = result.error?.code;
      if (typeof code === "string" && /^[A-Z_]{1,80}$/.test(code))
        data.probeCode = code;
      if (
        typeof result.eventId === "string" &&
        /^evt_[a-zA-Z0-9_-]{1,100}$/.test(result.eventId)
      )
        data.probeEventId = result.eventId;
      if (typeof result.duplicate === "boolean")
        data.probeDuplicate = result.duplicate;
    }
    res.json({ success: true, data });
  }),
);

router.post(
  "/delivery/:jobId/:action",
  asyncHandler(async (req, res) => {
    const job = check(
      await supabase
        .from("automation_jobs")
        .select("*")
        .eq("id", req.params.jobId)
        .maybeSingle(),
    );
    const token = req.get("x-quizshield-execution-token") || "";
    if (!job || !matches(token, job.execution_token || ""))
      fail("Invalid delivery token", 401);
    if (job.status === "succeeded") {
      res.json({
        success: true,
        alreadyCompleted: true,
        providerId: job.provider_id,
      });
      return;
    }
    if (
      !["running", "awaiting"].includes(job.status) ||
      Date.parse(job.lease_until) < Date.now()
    ) {
      res.json({ success: true, skipped: true });
      return;
    }
    if (req.params.action === "complete") {
      // The flow returns a provider receipt, never merely a Fastn execution/run ID.
      if (job.channel !== "fastn")
        fail("Only external sync jobs accept completion callbacks");
      if (
        req.body.success !== true ||
        typeof req.body.providerId !== "string" ||
        !req.body.providerId.trim()
      ) {
        await jobUpdate(job, {
          status: "uncertain",
          last_error: "External workflow did not confirm a provider receipt",
        });
      } else await completeAutomation(job, req.body.providerId);
      res.json({ success: true });
      return;
    }
    if (!config.automationLive) fail("Live automation is disabled", 503);
    const payload = await prepareAutomation(job);
    if (!payload) {
      await jobUpdate(job, {
        status: "cancelled",
        last_error: "Eligibility changed before delivery",
      });
      res.json({ skipped: true });
      return;
    }
    if (job.channel === "email" && !allowedRecipient(payload.to))
      fail("Recipient is outside the controlled allowlist", 403);
    if (req.params.action === "email") {
      try {
        res.json(await deliverAutomationEmail(job));
      } catch {
        await jobUpdate(job, {
          status: "uncertain",
          last_error:
            "Email provider acknowledgement missing; reconcile before retry",
        });
        fail("Email delivery could not be confirmed", 502);
      }
      return;
    }
    if (req.params.action !== "preflight") fail("Unknown delivery action", 404);
    // Email addresses/content stay inside QuizShield/Resend. Fastn only invokes delivery.
    res.json({
      success: true,
      skipped: false,
      kind: job.kind,
      channel: job.channel,
      idempotencyKey: job.dedupe_key,
      payload:
        job.channel === "email" ? { deliverViaQuizShield: true } : payload,
    });
  }),
);

router.use(protect);
router.get(
  "/followups",
  authorize("student"),
  asyncHandler(async (req, res) => {
    const rows = check(
      await supabase
        .from("learning_followups")
        .select("attempt_id,suggestions,created_at")
        .eq("student_id", req.user!._id)
        .order("created_at", { ascending: false }),
    );
    res.json({ success: true, data: rows });
  }),
);
router.use(authorize("teacher", "admin"));
router.get(
  "/teacher-settings/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        settings: await settingsFor(req.params.id),
        grant: await grantFor(req.params.id),
      },
    });
  }),
);
router.post(
  "/google/setup",
  authorize("teacher"),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await createGoogleSetup(req.user!._id, req.user!._id),
    }),
  ),
);
router.post(
  "/google/verify",
  authorize("teacher"),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await refreshGoogleSetup(req.user!._id, req.user!._id),
    }),
  ),
);
router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = await settingsFor(req.user!._id);
    const connection = await connectionView(req.user!._id);
    const grant = await grantFor(req.user!._id);
    res.json({
      success: true,
      data: {
        settings,
        connection,
        grant,
        deliveryEnabled: config.automationLive,
        fastnConfigured: Boolean(
          config.fastnAccessKey &&
            config.fastnWebhookUrl &&
            config.backendPublicUrl,
        ),
        resendConfigured: Boolean(config.resendApiKey),
        controlledRecipients: !config.automationAllowAll,
      },
    });
  }),
);
router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const grant = await grantFor(req.user!._id);
    if (grant.status !== "active")
      fail("Your administrator has not enabled automation access", 403);
    const current = await settingsFor(req.user!._id);
    const values: any = {};
    for (const [key, fallback] of Object.entries(defaultAutomationSettings)) {
      if (!(key in req.body)) continue;
      if (typeof req.body[key] !== typeof fallback) fail(`Invalid ${key}`);
      if (req.body[key] !== current[key] && !grant.editable_keys.includes(key))
        fail(`Your administrator controls ${key}`, 403);
      if (req.body[key] === true && !grant.capabilities.includes(key))
        fail(`This automation has not been assigned: ${key}`, 403);
      values[key] = req.body[key];
    }
    if (values.timezone) validateTimezone(values.timezone);
    if (
      !config.automationGoogleEnabled &&
      (values.calendar_sync || values.sheets_sync)
    )
      fail("Google integrations are not enabled for this deployment", 409);
    const effective = { ...(await settingsFor(req.user!._id)), ...values };
    if (effective.calendar_sync || effective.sheets_sync) {
      const bound = check(
        await supabase
          .from("automation_connections")
          .select("*")
          .eq("teacher_id", req.user!._id)
          .maybeSingle(),
      );
      if (
        !bound?.verified_at ||
        !bound.installation_id ||
        !bound.google_webhook_url ||
        (effective.calendar_sync &&
          (!bound.calendar_connected ||
            effective.calendar_id !== bound.verified_calendar_id)) ||
        (effective.sheets_sync &&
          (!bound.sheets_connected ||
            effective.spreadsheet_id !== bound.verified_spreadsheet_id))
      ) {
        fail(
          "Connect and verify the selected Google destination for your teacher account first",
          409,
        );
      }
    }
    if (
      values.reminder_hours !== undefined &&
      (!Number.isInteger(values.reminder_hours) ||
        values.reminder_hours < 1 ||
        values.reminder_hours > 168)
    )
      fail("Reminder must be 1–168 hours");
    for (const key of ["calendar_id", "spreadsheet_id", "sheet_tab"])
      if (values[key]?.length > 300) fail("Destination is too long");
    if (
      values.sheet_tab !== undefined &&
      (!values.sheet_tab.trim() || /[\[\]*?:/\\]/.test(values.sheet_tab))
    )
      fail("Invalid sheet tab");
    const settings = check(
      await supabase
        .from("automation_settings")
        .upsert({
          teacher_id: req.user!._id,
          ...(await settingsFor(req.user!._id)),
          ...values,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single(),
    );
    res.json({ success: true, data: settings });
  }),
);
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const jobs = check(
      await supabase
        .from("automation_jobs")
        .select(
          "id,quiz_id,kind,channel,status,attempts,run_at,last_error,provider_id,created_at,updated_at",
        )
        .eq("teacher_id", req.user!._id)
        .order("created_at", { ascending: false })
        .limit(200),
    );
    res.json({ success: true, data: jobs });
  }),
);
router.post(
  "/jobs/:jobId/retry",
  asyncHandler(async (req, res) => {
    await retryAutomationJob(req.params.jobId, req.user!._id);
    res.json({ success: true });
  }),
);
router.get(
  "/courses/:courseId/students",
  asyncHandler(async (req, res) => {
    const course = check(
      await supabase
        .from("courses")
        .select("id")
        .eq("id", req.params.courseId)
        .eq("created_by", req.user!._id)
        .maybeSingle(),
    );
    if (!course) fail("Course not found", 404);
    const enrollments = check(
      await supabase
        .from("enrollments")
        .select("user_id")
        .eq("course_id", course.id),
    );
    const ids = enrollments.map((e: any) => e.user_id);
    const students = ids.length
      ? check(
          await supabase
            .from("users")
            .select("id,name,email")
            .in("id", ids)
            .eq("role", "student"),
        )
      : [];
    res.json({ success: true, data: students });
  }),
);
export default router;
