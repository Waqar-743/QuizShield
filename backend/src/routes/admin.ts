import express from "express";
import { protect, authorize } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { supabase } from "../config/supabase";
import { authService } from "../services/authService";
import {
  ACCOUNT_FIELDS,
  JOB_FIELDS,
  checked,
  fail,
  pageParams,
  accountDetail,
  inviteAccount,
  audit,
  automationHealth,
  validateGrant,
  CAPABILITIES,
} from "../services/adminService";
import {
  connectionView,
  createGoogleSetup,
  refreshGoogleSetup,
  revokeGoogle,
} from "../services/googleSetupService";
import { retryAutomationJob } from "../services/automationService";

const router = express.Router();
router.use(protect, authorize("admin"));
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
router.param("id", (req, _res, next, id) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return next(
      Object.assign(new Error("Invalid account identifier"), {
        statusCode: 400,
      }),
    );
  next();
});
const ok = (res: express.Response, data: any) =>
  res.json({ success: true, data });
router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const sources = [
      ["teachers", "users", "teacher"],
      ["students", "users", "student"],
      ["courses", "courses"],
      ["quizzes", "teacher_quizzes"],
      ["submissions", "quiz_attempts"],
    ];
    const entries = await Promise.all(
      sources.map(async ([key, table, role]) => {
        let query = supabase
          .from(table)
          .select("id", { count: "exact", head: true });
        if (role) query = query.eq("role", role);
        if (key === "submissions") query = query.eq("status", "completed");
        const result = await query;
        checked(result);
        return [key, result.count];
      }),
    );
    ok(res, {
      counts: Object.fromEntries(entries),
      health: await automationHealth(),
    });
  }),
);
router.get(
  "/accounts",
  asyncHandler(async (req, res) => {
    const p = pageParams(req.query);
    let query = supabase
      .from("users")
      .select(ACCOUNT_FIELDS, { count: "exact" });
    if (req.query.role) {
      if (!["teacher", "student", "admin"].includes(String(req.query.role)))
        fail("Invalid role");
      query = query.eq("role", req.query.role);
    }
    if (req.query.status) {
      if (
        !["active", "invited", "suspended", "deactivated"].includes(
          String(req.query.status),
        )
      )
        fail("Invalid status");
      query = query.eq("status", req.query.status);
    }
    if (req.query.search) {
      const term = String(req.query.search)
        .slice(0, 100)
        .replace(/[^\p{L}\p{N}@. _-]/gu, "");
      if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(p.from, p.to);
    ok(res, {
      rows: checked(result),
      total: result.count,
      page: p.page,
      size: p.size,
    });
  }),
);
router.post(
  "/accounts",
  asyncHandler(async (req, res) => {
    res.status(201);
    ok(res, await inviteAccount(req.user!._id, req.body));
  }),
);
router.get(
  "/accounts/:id",
  asyncHandler(async (req, res) => ok(res, await accountDetail(req.params.id))),
);
router.patch(
  "/accounts/:id",
  asyncHandler(async (req, res) => {
    if (!req.body || !Object.keys(req.body).length) fail("No changes supplied");
    if (
      req.body.status === "deactivated" &&
      req.get("x-confirm-account") !== req.params.id
    )
      fail(
        "Review the removal impact and confirm this account before deactivation",
        409,
      );
    checked(
      await supabase.rpc("admin_update_account", {
        p_actor: req.user!._id,
        p_target: req.params.id,
        p_patch: req.body,
      }),
    );
    ok(res, await accountDetail(req.params.id));
  }),
);
router.post(
  "/accounts/:id/recovery",
  asyncHandler(async (req, res) => {
    const user = checked(
      await supabase
        .from("users")
        .select("email,status")
        .eq("id", req.params.id)
        .maybeSingle(),
    );
    if (!user) fail("Account not found", 404);
    if (!["active", "invited"].includes(user.status))
      fail("Reactivate the account before recovery", 409);
    await authService.requestPasswordReset(user.email);
    await audit(req.user!._id, "password_recovery_requested", req.params.id);
    ok(res, {
      message:
        "Recovery requested. The approved recipient restriction applies; no password or reset link is exposed.",
    });
  }),
);
router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const p = pageParams(req.query);
    const result = await supabase
      .from("courses")
      .select("id,title,created_by,max_students", { count: "exact" })
      .order("title")
      .range(p.from, p.to);
    ok(res, {
      rows: checked(result),
      total: result.count,
      page: p.page,
      size: p.size,
    });
  }),
);
router.post(
  "/courses/:id/transfer",
  asyncHandler(async (req, res) => {
    if (req.body.confirm !== req.params.id)
      fail("Confirm the course transfer", 409);
    if (typeof req.body.teacher_id !== "string" || !/^[0-9a-f-]{36}$/i.test(req.body.teacher_id)) fail("Choose a successor teacher");
    checked(
      await supabase.rpc("admin_transfer_course", {
        p_actor: req.user!._id,
        p_course: req.params.id,
        p_teacher: req.body.teacher_id,
      }),
    );
    ok(res, {
      message:
        "Ownership transferred. Assessment history retained. Old queued work invalidated; inspect any uncertain deliveries.",
    });
  }),
);
router.post(
  "/courses/:id/enrolment",
  asyncHandler(async (req, res) => {
    if (typeof req.body.enrolled !== "boolean") fail("Choose enrol or unenrol");
    if (typeof req.body.student_id !== "string" || !/^[0-9a-f-]{36}$/i.test(req.body.student_id)) fail("Choose a student");
    checked(
      await supabase.rpc("admin_set_enrolment", {
        p_actor: req.user!._id,
        p_course: req.params.id,
        p_student: req.body.student_id,
        p_enrolled: req.body.enrolled,
      }),
    );
    ok(res, { message: "Enrolment updated; assessment history retained." });
  }),
);
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const p = pageParams(req.query);
    const result = await supabase
      .from("admin_audit")
      .select("id,actor_id,action,target_id,details,created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(p.from, p.to);
    ok(res, {
      rows: checked(result),
      total: result.count,
      page: p.page,
      size: p.size,
    });
  }),
);
router.get(
  "/automations",
  asyncHandler(async (req, res) => {
    const grants = checked(
      await supabase
        .from("automation_grants")
        .select("teacher_id,status,capabilities,editable_keys,updated_at"),
    );
    const teachers = checked(
      await supabase
        .from("users")
        .select(ACCOUNT_FIELDS)
        .eq("role", "teacher")
        .order("name")
        .limit(500),
    );
    ok(res, {
      capabilities: CAPABILITIES,
      grants,
      teachers,
      health: await automationHealth(),
    });
  }),
);
router.put(
  "/automations/:id/grant",
  asyncHandler(async (req, res) => {
    const defaults = validateGrant(req.body);
    checked(
      await supabase.rpc("admin_set_automation_grant", {
        p_actor: req.user!._id,
        p_teacher: req.params.id,
        p_status: req.body.status,
        p_capabilities: req.body.capabilities,
        p_editable: req.body.editable_keys,
        p_defaults: defaults,
      }),
    );
    ok(res, { message: "Automation assignment saved" });
  }),
);
router.get(
  "/automations/:id/connection",
  asyncHandler(async (req, res) =>
    ok(res, await connectionView(req.params.id)),
  ),
);
router.post(
  "/automations/:id/setup",
  asyncHandler(async (req, res) =>
    ok(res, await createGoogleSetup(req.params.id, req.user!._id)),
  ),
);
router.post(
  "/automations/:id/verify",
  asyncHandler(async (req, res) =>
    ok(res, await refreshGoogleSetup(req.params.id, req.user!._id, req.body)),
  ),
);
router.post(
  "/automations/:id/revoke",
  asyncHandler(async (req, res) =>
    ok(res, await revokeGoogle(req.params.id, req.user!._id)),
  ),
);
router.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const p = pageParams(req.query);
    let query = supabase
      .from("automation_jobs")
      .select(JOB_FIELDS, { count: "exact" });
    for (const field of ["teacher_id", "quiz_id"]) {
      if (req.query[field] && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(req.query[field]))) fail("Choose a valid teacher or assessment identifier");
    }
    for (const key of ["teacher_id", "quiz_id", "kind", "status", "channel"])
      if (req.query[key]) query = query.eq(key, String(req.query[key]));
    const result = await query
      .order("created_at", { ascending: false })
      .range(p.from, p.to);
    ok(res, {
      rows: checked(result),
      total: result.count,
      page: p.page,
      size: p.size,
    });
  }),
);
router.post(
  "/jobs/:id/retry",
  asyncHandler(async (req, res) => {
    await retryAutomationJob(req.params.id);
    await audit(req.user!._id, "automation_retry", req.params.id);
    ok(res, {
      message: "Eligible failed job queued with its original deduplication key",
    });
  }),
);
router.post(
  "/jobs/:id/reconcile",
  asyncHandler(async (req, res) => {
    if (
      typeof req.body.provider_id !== "string" ||
      !/^[a-zA-Z0-9_:@./=-]{1,300}$/.test(req.body.provider_id) ||
      typeof req.body.evidence !== "string" ||
      req.body.evidence.trim().length < 15 ||
      req.body.evidence.length > 1000
    )
      fail(
        "Supply the confirmed provider receipt and an investigation note. Never include credentials.",
      );
    const rows = checked(
      await supabase
        .from("automation_jobs")
        .update({
          status: "succeeded",
          provider_id: req.body.provider_id,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.params.id)
        .eq("status", "uncertain")
        .select("id"),
    );
    if (!rows.length) fail("Only uncertain jobs accept reconciliation", 409);
    await audit(
      req.user!._id,
      "automation_delivery_reconciled",
      req.params.id,
      { provider_id: req.body.provider_id, evidence: req.body.evidence },
    );
    ok(res, { message: "Delivery recorded; no new message dispatched" });
  }),
);
export default router;
