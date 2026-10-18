import { useEffect, useState, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../../services/api";

import AccountPicker from "./AccountPicker";

type Row = Record<string, any>;
const input =
  "mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500";
const button =
  "rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50";
const secondary =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm hover:bg-ink-50 disabled:opacity-50";
const message = (e: any) =>
  e.response?.data?.error?.message ||
  "The request could not be completed. Try again.";
const date = (v: any) => (v ? new Date(v).toLocaleString() : "—");
const labels: Row = {
  announcement: "Quiz announcements",
  deadline_reminder: "Deadline reminder",
  results_email: "Released results email",
  schedule_email: "Schedule and cancellation email",
  welcome_email: "Course welcome",
  calendar_sync: "Google Calendar",
  sheets_sync: "Google Sheets",
};
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}
function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span>
        {total} records · Page {page}
      </span>
      <div className="flex gap-2">
        <button
          className={secondary}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className={secondary}
          disabled={page * 20 >= total}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
function Records({
  rows,
  columns,
  action,
}: {
  rows: Row[];
  columns: string[];
  action?: (r: Row) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                className="border-b border-ink-200 px-2 py-3 font-medium capitalize text-ink-500"
                key={c}
              >
                {c.replace(/_/g, " ")}
              </th>
            ))}
            {action && <th className="border-b p-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr className="border-b border-ink-100" key={r.id || i}>
              {columns.map((c) => (
                <td className="max-w-xs break-words px-2 py-3" key={c}>
                  {r[c] == null
                    ? "—"
                    : typeof r[c] === "object"
                      ? JSON.stringify(r[c])
                      : String(r[c])}
                </td>
              ))}
              {action && <td className="p-2">{action(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="py-8 text-sm text-ink-500">No records match this view.</p>
      )}
    </div>
  );
}
function Health({ health }: { health: Row }) {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          [
            "Hosted scheduler",
            health.scheduler === "recent_success"
              ? "Recent successful run"
              : "Needs attention",
          ],
          ["Last successful run", date(health.heartbeat?.last_completed_at)],
          [
            "Fastn relay",
            health.fastnConfigured ? "Configured" : "Server setup required",
          ],
          [
            "Email service",
            health.emailConfigured ? "Configured" : "Server setup required",
          ],
          ["Delivery", health.deliveryEnabled ? "Enabled" : "Disabled"],
          [
            "Recipient policy",
            health.controlledRecipients
              ? "Approved test addresses only"
              : "Unrestricted",
          ],
        ].map(([k, v]) => (
          <div className="rounded-lg bg-ink-50 p-3" key={k}>
            <dt className="text-ink-500">{k}</dt>
            <dd className="mt-1 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-ink-500">{health.instructions}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const section = useLocation().pathname.split("/")[3] || "overview";
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [searchTerm, setSearchTerm] = useState(""),
    [status, setStatus] = useState("");
  const [detail, setDetail] = useState<Row | null>(null),
    [draft, setDraft] = useState<Row>({}),
    [confirmRemoval, setConfirmRemoval] = useState(false);
  const [invite, setInvite] = useState({
      name: "",
      email: "",
      role: "teacher",
    }),
    [showInvite, setShowInvite] = useState(false);
  const [teacherId, setTeacherId] = useState(""),
    [grant, setGrant] = useState<Row>({
      status: "paused",
      capabilities: [],
      editable_keys: [],
      defaults: {},
    }),
    [connection, setConnection] = useState<Row | null>(null),
    [setupLink, setSetupLink] = useState("");
  const [jobs, setJobs] = useState<Row>({ rows: [], total: 0 }),
    [jobPage, setJobPage] = useState(1),
    [jobStatus, setJobStatus] = useState(""),
    [jobKind, setJobKind] = useState(""),
    [assessmentId, setAssessmentId] = useState("");
  const [courseAction, setCourseAction] = useState({
      course_id: "",
      teacher_id: "",
      student_id: "",
      enrolled: true,
    }),
    [transferConfirm, setTransferConfirm] = useState(false);
  const [reconcile, setReconcile] = useState<Row | null>(null);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint = ["teachers", "students", "accounts"].includes(section)
        ? "/admin/accounts"
        : section === "automations"
          ? "/admin/automations"
          : `/admin/${section}`;
      const response = await api.get(endpoint, {
        params: {
          page,
          search: searchTerm,
          status: status || undefined,
          role:
            section === "teachers"
              ? "teacher"
              : section === "students"
                ? "student"
                : undefined,
        },
      });
      setData(response.data.data);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setPage(1);
    setDetail(null);
    setNotice("");
    setSearch("");
    setSearchTerm("");
    setStatus("");
    setData(null);
  }, [section]);
  useEffect(() => {
    void load();
  }, [section, page, searchTerm, status]);
  const act = async (fn: () => Promise<any>, success: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await fn();
      setNotice(result?.message || success);
      return result;
    } catch (e) {
      setError(message(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const openAccount = async (id: string) => {
    const result = await act(
      async () => (await api.get(`/admin/accounts/${id}`)).data.data,
      "",
    );
    if (result) {
      setDetail(result);
      setDraft({
        name: result.account.name,
        bio: result.account.bio || "",
        role: result.account.role,
        status: result.account.status,
      });
      setConfirmRemoval(false);
    }
  };
  const saveAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const patch = Object.fromEntries(
      Object.entries(draft).filter(
        ([k, v]) =>
          v !== detail.account[k] &&
          !(k === "bio" && !v && !detail.account.bio),
      ),
    );
    if (!Object.keys(patch).length) {
      setNotice("No changes to save.");
      return;
    }
    const result = await act(
      async () =>
        (
          await api.patch(`/admin/accounts/${detail.account.id}`, patch, {
            headers: {
              "x-confirm-account": confirmRemoval ? detail.account.id : "",
            },
          })
        ).data.data,
      "Account updated. Existing sessions revoked when access changes.",
    );
    if (result) {
      setDetail(result);
      await load();
    }
  };
  const selectTeacher = async (id: string) => {
    setTeacherId(id);
    setJobPage(1);
    if (!id) {
      setConnection(null);
      setSetupLink("");
      return;
    }
    setSetupLink("");
    setConnection(null);
    const result = await act(
      async () =>
        (await api.get(`/automations/teacher-settings/${id}`)).data.data,
      "",
    );
    setGrant({
      ...(result?.grant || {
        status: "paused",
        capabilities: [],
        editable_keys: ["timezone", "reminder_hours"],
      }),
      defaults: result?.settings || {
        timezone: "Asia/Karachi",
        reminder_hours: 24,
      },
    });
    const conn = await act(
      async () =>
        (await api.get(`/admin/automations/${id}/connection`)).data.data,
      "",
    );
    if (conn) setConnection(conn);
  };
  const loadJobs = async () => {
    try {
      const r = await api.get("/admin/jobs", {
        params: {
          page: jobPage,
          teacher_id: teacherId || undefined,
          status: jobStatus || undefined,
          kind: jobKind || undefined,
          quiz_id: assessmentId || undefined,
        },
      });
      setJobs(r.data.data);
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    if (section === "automations") void loadJobs();
  }, [section, jobPage, teacherId, jobStatus, jobKind, assessmentId]);
  const field = (key: string, label: string, type = "text") => (
    <label className="block text-sm" key={key}>
      {label}
      <input
        className={input}
        type={type}
        value={draft[key] || ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12 text-ink-800">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-700">
            Administration
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-950">
            {section === "overview"
              ? "QuizShield control room"
              : section === "automations"
                ? "Automation operations"
                : section === "audit"
                  ? "Audit history"
                  : section.charAt(0).toUpperCase() + section.slice(1)}
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Manage access, support teachers and keep assessment history intact.
          </p>
        </div>
        <button
          className={secondary}
          onClick={() => {
            void load();
            if (section === "automations") void loadJobs();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          {error}
          <button className="ml-4 underline" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-primary-50 p-4 text-sm text-primary-800"
        >
          {notice}
        </p>
      )}
      {loading && (
        <p role="status" className="animate-pulse rounded-xl bg-ink-100 p-6">
          Loading current application data…
        </p>
      )}
      {data && section === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Object.entries(data.counts).map(([key, count]) => (
              <div
                className="rounded-xl border border-ink-200 bg-white p-5"
                key={key}
              >
                <p className="text-sm capitalize text-ink-500">{key}</p>
                <p className="mt-2 font-display text-3xl">{String(count)}</p>
              </div>
            ))}
          </div>
          <Panel title="Automation operations">
            <p className="mb-4 text-sm text-ink-500">
              Assign teacher capabilities, check Google setup and investigate
              failed deliveries.
            </p>
            <Link className={button} to="/dashboard/admin/automations">
              Open automation operations
            </Link>
          </Panel>
          <Panel title="Service health">
            <Health health={data.health} />
          </Panel>
        </>
      )}
      {data && ["teachers", "students", "accounts"].includes(section) && (
        <>
          <Panel title="Account directory">
            <form
              className="mb-5 flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearchTerm(search);
              }}
            >
              <label className="min-w-0 flex-1 text-sm">
                Search name or email
                <input
                  className={input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Status
                <select
                  className={input}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {["active", "invited", "suspended", "deactivated"].map(
                    (s) => (
                      <option key={s}>{s}</option>
                    ),
                  )}
                </select>
              </label>
              <button className={secondary}>Search</button>
              <button
                type="button"
                className={button}
                onClick={() => setShowInvite(!showInvite)}
              >
                Invite account
              </button>
            </form>
            <Records
              rows={data.rows}
              columns={["name", "email", "role", "status"]}
              action={(r) => (
                <button
                  className="font-medium text-primary-700 underline"
                  onClick={() => openAccount(r.id)}
                >
                  View account
                </button>
              )}
            />
            <Pager page={page} total={data.total} onPage={setPage} />
          </Panel>
          {showInvite && (
            <Panel title="Secure account invitation">
              <p className="mb-4 text-sm text-ink-500">
                The recipient creates their own password using an expiring,
                single-use email link. Staging sends only to approved test
                addresses.
              </p>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await act(
                    async () =>
                      (await api.post("/admin/accounts", invite)).data.data,
                    "Invitation created",
                  );
                  if (r) {
                    setNotice(r.delivery);
                    setShowInvite(false);
                    await load();
                  }
                }}
              >
                <label className="text-sm">
                  Name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    className={input}
                    value={invite.name}
                    onChange={(e) =>
                      setInvite({ ...invite, name: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  Email
                  <input
                    required
                    type="email"
                    className={input}
                    value={invite.email}
                    onChange={(e) =>
                      setInvite({ ...invite, email: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  Role
                  <select
                    className={input}
                    value={invite.role}
                    onChange={(e) =>
                      setInvite({ ...invite, role: e.target.value })
                    }
                  >
                    <option value="teacher">Teacher</option>
                    <option value="student">Student</option>
                  </select>
                </label>
                <button className={button} disabled={busy}>
                  Create invitation
                </button>
              </form>
            </Panel>
          )}
          {detail && (
            <Panel title={`Account: ${detail.account.name}`}>
              <p className="mb-5 break-all text-sm text-ink-500">
                {detail.account.email} · ID {detail.account.id} · Created{" "}
                {date(detail.account.created_at)}
              </p>
              <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={saveAccount}
              >
                {field("name", "Name")}
                {field("bio", "Bio")}
                <label className="text-sm">
                  Role
                  <select
                    className={input}
                    value={draft.role}
                    onChange={(e) =>
                      setDraft({ ...draft, role: e.target.value })
                    }
                  >
                    {["student", "teacher", "admin"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Access
                  <select
                    className={input}
                    value={draft.status}
                    onChange={(e) => {
                      setDraft({ ...draft, status: e.target.value });
                      setConfirmRemoval(false);
                    }}
                  >
                    {["active", "invited", "suspended", "deactivated"].map(
                      (s) => (
                        <option disabled={s === "invited"} key={s}>
                          {s}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <div className="space-y-3 rounded-lg bg-ink-50 p-4 text-sm sm:col-span-2">
                  <h3 className="font-semibold">Removal impact</h3>
                  <p>{detail.impact}</p>
                  <p>
                    {detail.courses.length} owned courses ·{" "}
                    {detail.quizzes.length} authored quizzes ·{" "}
                    {detail.assessmentCount} assessment records ·{" "}
                    {detail.automationCount} automation records
                  </p>
                  {draft.status === "deactivated" && (
                    <label className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={confirmRemoval}
                        onChange={(e) => setConfirmRemoval(e.target.checked)}
                      />
                      I reviewed the affected records. Deactivate access and
                      preserve history.
                    </label>
                  )}
                  <Link
                    className="text-primary-700 underline"
                    to="/dashboard/admin/courses"
                  >
                    Transfer course ownership or manage enrolment
                  </Link>
                </div>
                <div className="flex flex-wrap gap-3 sm:col-span-2">
                  <button
                    className={button}
                    disabled={
                      busy ||
                      (draft.status === "deactivated" && !confirmRemoval)
                    }
                  >
                    Save account
                  </button>
                  <button
                    type="button"
                    className={secondary}
                    disabled={busy}
                    onClick={() =>
                      act(
                        async () =>
                          (
                            await api.post(
                              `/admin/accounts/${detail.account.id}/recovery`,
                            )
                          ).data.data,
                        "Recovery requested",
                      )
                    }
                  >
                    Send password recovery
                  </button>
                  <button
                    className={secondary}
                    type="button"
                    onClick={() => setDetail(null)}
                  >
                    Close details
                  </button>
                </div>
              </form>
              <h3 className="mb-2 mt-6 font-semibold">Associated courses</h3>
              <Records
                rows={[
                  ...detail.courses,
                  ...detail.enrolments
                    .map((e: Row) => e.courses)
                    .filter(Boolean),
                ]}
                columns={["title", "id"]}
              />
              <h3 className="mb-2 mt-6 font-semibold">Authored assessments</h3>
              <Records
                rows={detail.quizzes}
                columns={["title", "lifecycle", "scheduled_start", "closes_at"]}
              />
              <h3 className="mb-2 mt-6 font-semibold">
                Assessment records (latest 50)
              </h3>
              <Records
                rows={detail.assessments}
                columns={[
                  "id",
                  "quiz_id",
                  "status",
                  "teacher_grade",
                  "results_released_at",
                ]}
              />
              <h3 className="mb-2 mt-6 font-semibold">
                Affected automations (latest 50)
              </h3>
              <Records
                rows={detail.automations}
                columns={["kind", "status", "last_error"]}
              />
            </Panel>
          )}
        </>
      )}
      {data && section === "courses" && (
        <>
          <Panel title="Courses">
            <Records
              rows={data.rows}
              columns={["title", "created_by", "max_students"]}
              action={(r) => (
                <button
                  className="text-primary-700 underline"
                  onClick={() => {
                    setCourseAction({ ...courseAction, course_id: r.id });
                    setTransferConfirm(false);
                  }}
                >
                  Manage
                </button>
              )}
            />
            <Pager page={page} total={data.total} onPage={setPage} />
          </Panel>
          {courseAction.course_id && (
            <Panel title="Ownership and enrolment">
              <p className="mb-4 text-sm">
                Course {courseAction.course_id}. Transfers retain quizzes and
                submissions, move course assessment ownership and invalidate old
                pending work. In-progress work needs reconciliation; existing
                Google records stay in their original destination.
              </p>
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await act(
                    async () =>
                      (
                        await api.post(
                          `/admin/courses/${courseAction.course_id}/transfer`,
                          {
                            teacher_id: courseAction.teacher_id,
                            confirm: transferConfirm
                              ? courseAction.course_id
                              : "",
                          },
                        )
                      ).data.data,
                    "Course transferred",
                  );
                  await load();
                }}
              >
                <AccountPicker
                  role="teacher"
                  label="Successor teacher"
                  value={courseAction.teacher_id}
                  onChange={(id) =>
                    setCourseAction({ ...courseAction, teacher_id: id })
                  }
                />
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={transferConfirm}
                    onChange={(e) => setTransferConfirm(e.target.checked)}
                  />
                  I reviewed the transfer and automation impact.
                </label>
                <button
                  className={button}
                  disabled={
                    busy || !transferConfirm || !courseAction.teacher_id
                  }
                >
                  Transfer ownership
                </button>
              </form>
              <form
                className="mt-6 space-y-4 border-t pt-6"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await act(
                    async () =>
                      (
                        await api.post(
                          `/admin/courses/${courseAction.course_id}/enrolment`,
                          {
                            student_id: courseAction.student_id,
                            enrolled: courseAction.enrolled,
                          },
                        )
                      ).data.data,
                    "Enrolment updated",
                  );
                }}
              >
                <AccountPicker
                  role="student"
                  label="Student"
                  value={courseAction.student_id}
                  onChange={(id) =>
                    setCourseAction({ ...courseAction, student_id: id })
                  }
                />
                <label className="block text-sm">
                  Change
                  <select
                    className={input}
                    value={String(courseAction.enrolled)}
                    onChange={(e) =>
                      setCourseAction({
                        ...courseAction,
                        enrolled: e.target.value === "true",
                      })
                    }
                  >
                    <option value="true">Enrol in course</option>
                    <option value="false">
                      Remove enrolment; retain assessment history
                    </option>
                  </select>
                </label>
                <button className={secondary} disabled={busy}>
                  Update enrolment
                </button>
              </form>
            </Panel>
          )}
        </>
      )}
      {data && section === "automations" && (
        <>
          <Panel title="Scheduler and delivery health">
            <Health health={data.health} />
          </Panel>
          <Panel title="Teacher assignments">
            <AccountPicker
              role="teacher"
              label="Choose teacher"
              includeInactive
              value={teacherId}
              onChange={(id) => void selectTeacher(id)}
            />
            {teacherId && (
              <div className="mt-5 space-y-5">
                <label className="block text-sm">
                  Automation access
                  <select
                    className={input}
                    value={grant.status}
                    onChange={(e) =>
                      setGrant({ ...grant, status: e.target.value })
                    }
                  >
                    {["active", "paused", "revoked"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-ink-500">
                  Assign capabilities, enable defaults and choose which settings
                  the teacher may change. Pausing or revoking stops queued
                  external dispatches.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="py-2">Capability</th>
                        <th>Assigned</th>
                        <th>Default on</th>
                        <th>Teacher can edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(labels).map(([key, label]) => (
                        <tr key={key} className="border-t border-ink-100">
                          <td className="py-3 pr-4">{label}</td>
                          <td>
                            <input
                              aria-label={`Assign ${label}`}
                              type="checkbox"
                              checked={grant.capabilities.includes(key)}
                              onChange={(e) =>
                                setGrant({
                                  ...grant,
                                  capabilities: e.target.checked
                                    ? [...grant.capabilities, key]
                                    : grant.capabilities.filter(
                                        (k: string) => k !== key,
                                      ),
                                  defaults: { ...grant.defaults, [key]: false },
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Default ${label}`}
                              type="checkbox"
                              disabled={!grant.capabilities.includes(key)}
                              checked={
                                grant.capabilities.includes(key) &&
                                !!grant.defaults[key]
                              }
                              onChange={(e) =>
                                setGrant({
                                  ...grant,
                                  defaults: {
                                    ...grant.defaults,
                                    [key]: e.target.checked,
                                  },
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              aria-label={`Allow teacher to edit ${label}`}
                              type="checkbox"
                              checked={grant.editable_keys.includes(key)}
                              onChange={(e) =>
                                setGrant({
                                  ...grant,
                                  editable_keys: e.target.checked
                                    ? [...grant.editable_keys, key]
                                    : grant.editable_keys.filter(
                                        (k: string) => k !== key,
                                      ),
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm">
                    Default timezone
                    <input
                      className={input}
                      value={grant.defaults.timezone || "Asia/Karachi"}
                      onChange={(e) =>
                        setGrant({
                          ...grant,
                          defaults: {
                            ...grant.defaults,
                            timezone: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Reminder hours before close
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={168}
                      value={grant.defaults.reminder_hours || 24}
                      onChange={(e) =>
                        setGrant({
                          ...grant,
                          defaults: {
                            ...grant.defaults,
                            reminder_hours: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  className={button}
                  disabled={busy}
                  onClick={async () => {
                    const defaults = Object.fromEntries(
                      Object.entries(grant.defaults)
                        .filter(([k]) =>
                          [
                            "timezone",
                            "reminder_hours",
                            ...Object.keys(labels),
                          ].includes(k),
                        )
                        .map(([k, v]) => [
                          k,
                          Object.keys(labels).includes(k) &&
                          !grant.capabilities.includes(k)
                            ? false
                            : v,
                        ]),
                    );
                    await act(
                      async () =>
                        (
                          await api.put(
                            `/admin/automations/${teacherId}/grant`,
                            { ...grant, defaults },
                          )
                        ).data.data,
                      "Assignment saved",
                    );
                    await load();
                  }}
                >
                  Save assignment
                </button>
                {connection && (
                  <div className="space-y-3 rounded-xl bg-ink-50 p-4 text-sm">
                    <h3 className="font-semibold">
                      Teacher Google connection: {connection.status}
                    </h3>
                    <p>
                      Calendar:{" "}
                      {connection.calendar_connected
                        ? "Verified destination"
                        : "Not ready"}{" "}
                      · Sheets:{" "}
                      {connection.sheets_connected
                        ? "Verified destination"
                        : "Not ready"}
                    </p>
                    {connection.blocker && <p>{connection.blocker}</p>}
                    {connection.calendar_id && (
                      <p className="break-all">
                        Approved Calendar: {connection.calendar_id}
                      </p>
                    )}
                    {connection.spreadsheet_id && (
                      <p className="break-all">
                        Approved Sheet: {connection.spreadsheet_id}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={async () => {
                          const r = await act(
                            async () =>
                              (
                                await api.post(
                                  `/admin/automations/${teacherId}/setup`,
                                )
                              ).data.data,
                            "Setup requested",
                          );
                          if (r) {
                            setConnection(r);
                            setSetupLink(r.url || "");
                          }
                        }}
                      >
                        Generate teacher authorization link
                      </button>
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={async () => {
                          const r = await act(
                            async () =>
                              (
                                await api.post(
                                  `/admin/automations/${teacherId}/verify`,
                                )
                              ).data.data,
                            "Connection checked",
                          );
                          if (r) setConnection(r);
                        }}
                      >
                        Verify setup
                      </button>
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={async () => {
                          const r = await act(
                            async () =>
                              (
                                await api.post(
                                  `/admin/automations/${teacherId}/revoke`,
                                )
                              ).data.data,
                            "Application Google access revoked",
                          );
                          if (r) setConnection(r);
                        }}
                      >
                        Revoke Google access
                      </button>
                    </div>
                    {setupLink && (
                      <a
                        className="block font-medium text-primary-700 underline"
                        href={setupLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open this teacher’s Google setup
                      </a>
                    )}
                    <p className="text-ink-500">
                      The teacher authorizes their own Google account. A
                      completed consent screen does not prove installation
                      routing or destination ownership. Never share one
                      teacher’s connection with another.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Panel>
          <Panel title="Execution history">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Status
                <select
                  className={input}
                  value={jobStatus}
                  onChange={(e) => {
                    setJobStatus(e.target.value);
                    setJobPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {[
                    "pending",
                    "running",
                    "awaiting",
                    "succeeded",
                    "failed",
                    "uncertain",
                    "cancelled",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Action
                <select
                  className={input}
                  value={jobKind}
                  onChange={(e) => {
                    setJobKind(e.target.value);
                    setJobPage(1);
                  }}
                >
                  <option value="">All actions</option>
                  {[
                    "announcement",
                    "reminder",
                    "schedule",
                    "cancellation",
                    "welcome",
                    "results",
                    "calendar",
                    "sheets",
                    "followup",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Assessment ID
                <input
                  className={input}
                  value={assessmentId}
                  onChange={(e) => {
                    setAssessmentId(e.target.value);
                    setJobPage(1);
                  }}
                />
              </label>
            </div>
            <p className="mb-3 text-sm text-ink-500">
              History follows the selected teacher above. Clear the teacher to
              inspect all jobs. Uncertain outcomes must be investigated at the
              provider before recording a receipt; they cannot be blindly
              retried.
            </p>
            <Records
              rows={jobs.rows}
              columns={[
                "kind",
                "teacher_id",
                "quiz_id",
                "status",
                "last_error",
                "provider_id",
              ]}
              action={(r) => (
                <>
                  {r.status === "failed" && (
                    <button
                      className="text-primary-700 underline"
                      disabled={busy}
                      onClick={async () => {
                        await act(
                          async () =>
                            (await api.post(`/admin/jobs/${r.id}/retry`)).data
                              .data,
                          "Retry queued",
                        );
                        await loadJobs();
                      }}
                    >
                      Retry safely
                    </button>
                  )}
                  {r.status === "uncertain" && (
                    <button
                      className="text-primary-700 underline"
                      onClick={() =>
                        setReconcile({ ...r, evidence: "", receipt: "" })
                      }
                    >
                      Investigate
                    </button>
                  )}
                </>
              )}
            />
            <Pager page={jobPage} total={jobs.total} onPage={setJobPage} />
            {reconcile && (
              <form
                className="mt-5 space-y-3 rounded-xl bg-ink-50 p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await act(
                    async () =>
                      (
                        await api.post(
                          `/admin/jobs/${reconcile.id}/reconcile`,
                          {
                            provider_id: reconcile.receipt,
                            evidence: reconcile.evidence,
                          },
                        )
                      ).data.data,
                    "Reconciled",
                  );
                  if (r) {
                    setReconcile(null);
                    await loadJobs();
                  }
                }}
              >
                <h3 className="font-semibold">
                  Investigate delivery {reconcile.id}
                </h3>
                <p className="text-sm">
                  Check the provider using the job’s original delivery and
                  receipt identifiers. Record a delivery only after confirming
                  it exists. If the outcome remains unknown, leave it uncertain.
                </p>
                <label className="block text-sm">
                  Confirmed provider receipt
                  <input
                    required
                    className={input}
                    value={reconcile.receipt}
                    onChange={(e) =>
                      setReconcile({ ...reconcile, receipt: e.target.value })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Investigation evidence (no credentials)
                  <textarea
                    required
                    minLength={15}
                    maxLength={1000}
                    className={input}
                    value={reconcile.evidence}
                    onChange={(e) =>
                      setReconcile({ ...reconcile, evidence: e.target.value })
                    }
                  />
                </label>
                <button className={button} disabled={busy}>
                  Record confirmed delivery
                </button>
                <button
                  type="button"
                  className={`${secondary} ml-3`}
                  onClick={() => setReconcile(null)}
                >
                  Leave uncertain
                </button>
              </form>
            )}
          </Panel>
        </>
      )}
      {data && section === "audit" && (
        <Panel title="Administrative changes">
          <Records
            rows={data.rows}
            columns={[
              "created_at",
              "actor_id",
              "action",
              "target_id",
              "details",
            ]}
          />
          <Pager page={page} total={data.total} onPage={setPage} />
        </Panel>
      )}
    </div>
  );
}
