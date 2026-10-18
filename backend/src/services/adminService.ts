import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase";
import { authService } from "./authService";
import { config } from "../config/environment";
import { validateTimezone } from "./automationPolicy";

export const ACCOUNT_FIELDS =
  "id,name,email,role,status,bio,created_at,updated_at";
export const JOB_FIELDS =
  "id,teacher_id,quiz_id,course_id,student_id,attempt_id,kind,channel,status,attempts,run_at,last_error,provider_id,created_at,updated_at,first_delivery_at";
export function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}
export function checked(result: any): any {
  if (result.error) {
    if (result.error.code === "42501")
      fail("Administrator access required", 403);
    if (result.error.code === "P0001") fail(result.error.message, 409);
    if (result.error.code === "23505") fail("This record already exists", 409);
    throw Object.assign(
      new Error("The requested operation could not be completed"),
      { statusCode: 500 },
    );
  }
  return result.data;
}
export function pageParams(query: any) {
  const page = Math.max(1, Math.min(100000, Number(query.page) || 1));
  const size = Math.max(1, Math.min(50, Number(query.size) || 20));
  if (!Number.isInteger(page) || !Number.isInteger(size))
    fail("Invalid pagination");
  return { page, size, from: (page - 1) * size, to: page * size - 1 };
}
export async function audit(
  actor: string,
  action: string,
  target: string,
  details: any = {},
) {
  checked(
    await supabase
      .from("admin_audit")
      .insert({ actor_id: actor, action, target_id: target, details }),
  );
}
export async function accountDetail(id: string) {
  const account = checked(
    await supabase
      .from("users")
      .select(ACCOUNT_FIELDS)
      .eq("id", id)
      .maybeSingle(),
  );
  if (!account) fail("Account not found", 404);
  const owned = checked(
    await supabase
      .from("courses")
      .select("id,title,created_by")
      .eq("created_by", id),
  );
  const enrolments = checked(
    await supabase
      .from("enrollments")
      .select("id,course_id,courses(id,title)")
      .eq("user_id", id),
  );
  const quizzes = checked(
    await supabase
      .from("teacher_quizzes")
      .select("id,title,course_id,lifecycle,scheduled_start,closes_at")
      .eq("teacher_id", id),
  );
  const quizIds = quizzes.map((q: any) => q.id);
  let attemptsQuery = supabase
    .from("quiz_attempts")
    .select(
      "id,quiz_id,user_id,status,teacher_grade,results_released_at,started_at,completed_at",
      { count: "exact" },
    );
  attemptsQuery = quizIds.length
    ? attemptsQuery.or(`user_id.eq.${id},quiz_id.in.(${quizIds.join(",")})`)
    : attemptsQuery.eq("user_id", id);
  const attemptsResult = await attemptsQuery
    .order("started_at", { ascending: false })
    .limit(50);
  const attempts = checked(attemptsResult);
  const jobResult = await supabase
    .from("automation_jobs")
    .select(JOB_FIELDS, { count: "exact" })
    .or(`teacher_id.eq.${id},student_id.eq.${id}`)
    .order("created_at", { ascending: false })
    .limit(50);
  const jobs = checked(jobResult);
  return {
    account,
    courses: owned,
    enrolments,
    quizzes,
    assessments: attempts,
    automations: jobs,
    assessmentCount: attemptsResult.count,
    automationCount: jobResult.count,
    impact:
      "Deactivation revokes sign-in and queued automation. Courses, quizzes, submissions and grades remain. In-progress deliveries require provider reconciliation. Transfer course ownership explicitly before a successor resumes work.",
  };
}
export async function inviteAccount(actor: string, input: any) {
  const { name, email, role } = input;
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80)
    fail("Name must be 2–80 characters");
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    fail("Valid email is required");
  if (!["student", "teacher"].includes(role))
    fail("Invitations are for teachers and students");
  if (Object.keys(input).some((k) => !["name", "email", "role"].includes(k)))
    fail("Only name, email and role are accepted");
  // No operator-chosen or returnable password. Recipient sets their own via a single-use link.
  const password = await bcrypt.hash(
    crypto.randomBytes(48).toString("hex"),
    12,
  );
  const account = checked(
    await supabase
      .from("users")
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        status: "invited",
        password,
      })
      .select(ACCOUNT_FIELDS)
      .single(),
  );
  await audit(actor, "account_invited", account.id, { role });
  const allowed =
    config.automationAllowAll ||
    config.automationRecipients.includes(account.email);
  if (allowed) await authService.requestPasswordReset(account.email);
  return {
    account,
    delivery: allowed
      ? "Account setup email requested"
      : "Setup email blocked by the approved staging recipient restriction. No access until setup completes.",
  };
}
export async function automationHealth() {
  const heartbeat = checked(
    await supabase
      .from("automation_health")
      .select("last_started_at,last_completed_at,processed,last_error")
      .eq("id", true)
      .maybeSingle(),
  );
  const recent =
    heartbeat?.last_completed_at &&
    Date.now() - Date.parse(heartbeat.last_completed_at) < 5 * 60_000;
  return {
    scheduler: recent ? "recent_success" : "needs_attention",
    heartbeat,
    emailConfigured: Boolean(config.resendApiKey),
    fastnConfigured: Boolean(
      config.fastnWebhookUrl &&
        config.fastnAccessKey &&
        config.backendPublicUrl,
    ),
    googleEnabled: config.automationGoogleEnabled,
    deliveryEnabled: config.automationLive,
    controlledRecipients: !config.automationAllowAll,
    instructions:
      "Hosted Supabase cron calls the existing worker every minute. If no successful heartbeat within five minutes, inspect cron.job_run_details and net._http_response, then verify the backend URL and worker secret in Vault.",
  };
}
export const CAPABILITIES = [
  "announcement",
  "deadline_reminder",
  "results_email",
  "schedule_email",
  "welcome_email",
  "calendar_sync",
  "sheets_sync",
];
export function validateGrant(body: any) {
  if (
    !["active", "paused", "revoked"].includes(body.status) ||
    !Array.isArray(body.capabilities) ||
    body.capabilities.some((k: any) => !CAPABILITIES.includes(k))
  )
    fail("Invalid automation assignment");
  const editable = [...CAPABILITIES, "timezone", "reminder_hours"];
  if (
    !Array.isArray(body.editable_keys) ||
    body.editable_keys.some((k: any) => !editable.includes(k))
  )
    fail("Invalid teacher permissions");
  const defaults = body.defaults || {};
  for (const [key, value] of Object.entries(defaults)) {
    if (!editable.includes(key)) fail("Unsupported default");
    if (
      CAPABILITIES.includes(key) &&
      (typeof value !== "boolean" ||
        (value && !body.capabilities.includes(key)))
    )
      fail("Default requires an assigned capability");
  }
  if (defaults.timezone !== undefined) validateTimezone(defaults.timezone);
  if (
    defaults.reminder_hours !== undefined &&
    (!Number.isInteger(defaults.reminder_hours) ||
      defaults.reminder_hours < 1 ||
      defaults.reminder_hours > 168)
  )
    fail("Reminder must be 1–168 hours");
  return defaults;
}
