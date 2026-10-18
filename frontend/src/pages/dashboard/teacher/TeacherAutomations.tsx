import { useEffect, useState } from "react";
import api from "../../../services/api";
import toast from "react-hot-toast";

interface Settings {
  timezone: string;
  announcement: boolean;
  deadline_reminder: boolean;
  reminder_hours: number;
  results_email: boolean;
  schedule_email: boolean;
  welcome_email: boolean;
  calendar_sync: boolean;
  sheets_sync: boolean;
  calendar_id: string;
  spreadsheet_id: string;
  sheet_tab: string;
}
interface Job {
  id: string;
  kind: string;
  channel: string;
  status: string;
  attempts: number;
  run_at: string;
  last_error?: string;
  provider_id?: string;
}
const switches: { key: keyof Settings; label: string; detail: string }[] = [
  {
    key: "announcement",
    label: "Quiz announcement",
    detail: "One email when a quiz is published. Drafts stay quiet.",
  },
  {
    key: "deadline_reminder",
    label: "One deadline reminder",
    detail: "Only assigned, enrolled students who have not submitted.",
  },
  {
    key: "results_email",
    label: "Results released",
    detail: "A private sign-in link after you review and release results.",
  },
  {
    key: "schedule_email",
    label: "Schedule changes and cancellations",
    detail: "Notify affected students when availability or assignment changes.",
  },
  {
    key: "welcome_email",
    label: "Course welcome",
    detail: "Optional message on enrolment. Disabled initially.",
  },
  {
    key: "calendar_sync",
    label: "Mirror schedules to Calendar",
    detail:
      "One event per assessment. No student invitations or extra Calendar emails.",
  },
  {
    key: "sheets_sync",
    label: "Sync released results to Sheets",
    detail: "Reviewed grades only. Each submission keeps a fixed row.",
  },
];
export default function TeacherAutomations() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [state, setState] = useState({
    deliveryEnabled: false,
    fastnConfigured: false,
    resendConfigured: false,
    controlledRecipients: true,
    grant: {
      status: "revoked",
      capabilities: [] as string[],
      editable_keys: [] as string[],
    },
    connection: {
      status: "required",
      blocker: "",
      calendar_connected: false,
      sheets_connected: false,
    },
  });
  const [setupUrl, setSetupUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const load = async () => {
    try {
      const [s, h] = await Promise.all([
        api.get("/automations/settings"),
        api.get("/automations/history"),
      ]);
      setSettings(s.data.data.settings);
      setState(s.data.data);
      setJobs(h.data.data);
      setError("");
    } catch {
      setError(
        "Automation settings could not be loaded. Check the connection and required database migration.",
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const permitted = Object.fromEntries(
        Object.entries(settings || {}).filter(
          ([key]) =>
            state.grant.editable_keys.includes(key) &&
            (!switches.some((s) => s.key === key) ||
              state.grant.capabilities.includes(key)),
        ),
      );
      await api.put("/automations/settings", permitted);
      toast.success("Automation settings saved");
    } catch (e: any) {
      toast.error(
        e.response?.data?.message ||
          "Could not save settings. Check your assigned permissions.",
      );
    } finally {
      setSaving(false);
    }
  };
  const retry = async (id: string) => {
    try {
      await api.post(`/automations/jobs/${id}/retry`);
      toast.success("Action queued for retry");
      await load();
    } catch {
      toast.error("This action cannot be retried safely. Refresh its status.");
    }
  };
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6">
        <p role="alert">{error}</p>
        <button onClick={load} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  if (!settings) return <p aria-live="polite">Loading automations…</p>;
  const canEdit = (key: string) =>
    state.grant.status === "active" && state.grant.editable_keys.includes(key);
  const field = (
    key: "timezone" | "calendar_id" | "spreadsheet_id" | "sheet_tab",
    label: string,
  ) => (
    <label className="block text-sm font-medium text-ink-700">
      {label}
      <input
        disabled={!canEdit(key)}
        className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 disabled:bg-ink-50"
        value={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <header>
        <p className="text-xs uppercase tracking-widest text-primary-700">
          Teacher workspace
        </p>
        <h1 className="mt-2 text-3xl font-display text-ink-950">
          Integrations & automation
        </h1>
        <p className="mt-2 text-sm text-ink-500">
          Publish once. QuizShield keeps the schedule and delivers updates while
          you are away.
        </p>
      </header>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Connections</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Fastn", state.fastnConfigured ? "Configured" : "Setup required"],
            [
              "Google Calendar",
              state.connection.calendar_connected
                ? "Verified for your account"
                : "Not ready",
            ],
            [
              "Google Sheets",
              state.connection.sheets_connected
                ? "Verified for your account"
                : "Not ready",
            ],
          ].map(([name, status]) => (
            <div key={name} className="rounded-xl bg-ink-50 p-4">
              <p className="font-medium">{name}</p>
              <p className="mt-1 text-sm text-ink-500">{status}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-600">
          Delivery: {state.deliveryEnabled ? "enabled" : "disabled for setup"} ·
          Email service: {state.resendConfigured ? "configured" : "needs setup"}{" "}
          · Recipients:{" "}
          {state.controlledRecipients
            ? "controlled test allowlist"
            : "assigned students"}
        </p>
        <p className="text-sm">
          Administrator assignment: <strong>{state.grant.status}</strong>
        </p>
        {state.connection.blocker && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            {state.connection.blocker}
          </p>
        )}
        {state.grant.capabilities.some((k) =>
          ["calendar_sync", "sheets_sync"].includes(k),
        ) && (
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-primary"
              disabled={state.grant.status !== "active" || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const r = (await api.post("/automations/google/setup")).data
                    .data;
                  if (r.url) setSetupUrl(r.url);
                  else toast.error(r.blocker);
                } catch (e: any) {
                  toast.error(
                    e.response?.data?.message || "Google setup unavailable",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              Connect or reconnect my Google account
            </button>
            <button
              className="text-sm text-primary-700"
              onClick={async () => {
                try {
                  const r = (await api.post("/automations/google/verify")).data
                    .data;
                  if (r.blocker) toast.error(r.blocker);
                  await load();
                } catch (e: any) {
                  toast.error(
                    e.response?.data?.message || "Could not verify setup",
                  );
                }
              }}
            >
              Check setup
            </button>
          </div>
        )}
        {setupUrl && (
          <a
            href={setupUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-medium text-primary-700 underline"
          >
            Authorize my Google account
          </a>
        )}
        <p className="text-xs text-ink-500">
          Authorize your own Google account. Your administrator approves
          destinations and verifies routing. Connection readiness is shown only
          after those checks pass.
        </p>
      </section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5 space-y-5">
        <h2 className="text-lg font-semibold">Destinations & timezone</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("timezone", "Default timezone (IANA, e.g. Asia/Karachi)")}
          {field("calendar_id", "Calendar ID")}
          {field("spreadsheet_id", "Spreadsheet ID")}
          {field("sheet_tab", "Results tab")}
        </div>
        <p className="text-xs text-ink-500">
          Destinations must be accessible to your bound Google connections.
          Existing synced assessments retain their original destination. Use a
          dedicated results tab with row 1 reserved for headings.
        </p>
      </section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold">Student notifications</h2>
        <div className="divide-y divide-ink-100">
          {switches.map((item) => (
            <label
              key={item.key}
              className="flex items-start justify-between gap-6 py-4"
            >
              <span>
                <span className="font-medium text-sm">{item.label}</span>
                <span className="ml-2 text-xs text-primary-700">
                  {state.grant.capabilities.includes(item.key)
                    ? "Assigned"
                    : "Not assigned"}
                </span>
                <span className="mt-1 block text-sm text-ink-500">
                  {item.detail}
                  {!canEdit(item.key) && " · Administrator controlled"}
                </span>
              </span>
              <input
                disabled={
                  !canEdit(item.key) ||
                  !state.grant.capabilities.includes(item.key)
                }
                type="checkbox"
                className="mt-1 h-4 w-4 accent-emerald-600"
                checked={
                  state.grant.capabilities.includes(item.key) &&
                  Boolean(settings[item.key])
                }
                onChange={(e) =>
                  setSettings({ ...settings, [item.key]: e.target.checked })
                }
              />
            </label>
          ))}
        </div>
        <label className="block text-sm py-3">
          Reminder hours before closing
          <input
            disabled={!canEdit("reminder_hours")}
            type="number"
            min={1}
            max={168}
            className="ml-3 w-24 rounded-lg border px-3 py-2"
            value={settings.reminder_hours}
            onChange={(e) =>
              setSettings({
                ...settings,
                reminder_hours: Number(e.target.value),
              })
            }
          />
        </label>
        <p className="mb-4 text-xs text-ink-500">
          No automatic emails for edits to questions, proctoring flags,
          submissions, or practice suggestions. New preferences apply to pending
          delivery; reminder timing changes apply to unsent reminders.
        </p>
        <button
          className="btn-primary"
          onClick={save}
          disabled={saving || state.grant.status !== "active"}
        >
          {saving ? "Saving…" : "Save permitted settings"}
        </button>
      </section>
      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Execution history</h2>
          <div className="flex gap-3">
            <select
              aria-label="Filter execution history"
              className="rounded-lg border px-2 py-1"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {[
                "all",
                "pending",
                "awaiting",
                "succeeded",
                "failed",
                "uncertain",
                "cancelled",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button onClick={load} className="text-sm text-primary-700">
              Refresh
            </button>
          </div>
        </div>
        <p className="my-3 text-xs text-ink-500">
          An uncertain action needs delivery reconciliation by your
          administrator before retrying.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3">Action</th>
                <th>Status</th>
                <th>Due</th>
                <th>Details</th>
                <th>
                  <span className="sr-only">Retry</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs
                .filter((j) => filter === "all" || j.status === filter)
                .map((job) => (
                  <tr key={job.id} className="border-b border-ink-100">
                    <td className="py-3 pr-4 capitalize">
                      {job.kind}
                      <span className="block text-xs text-ink-400">
                        {job.channel}
                      </span>
                    </td>
                    <td className="pr-4">{job.status}</td>
                    <td className="pr-4 whitespace-nowrap">
                      {new Date(job.run_at).toLocaleString("en-GB", {
                        timeZone: settings.timezone,
                      })}
                    </td>
                    <td className="max-w-xs py-3 text-xs text-ink-500">
                      {job.last_error ||
                        job.provider_id ||
                        `Attempts: ${job.attempts}`}
                    </td>
                    <td>
                      {job.status === "failed" && (
                        <button
                          className="text-primary-700"
                          onClick={() => retry(job.id)}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!jobs.length && (
          <p className="py-6 text-sm text-ink-500">
            Publish an assessment to see its planned actions here.
          </p>
        )}
        <p className="mt-3 text-xs text-ink-400">
          Latest 200 actions · Times shown in {settings.timezone}
        </p>
      </section>
    </div>
  );
}
