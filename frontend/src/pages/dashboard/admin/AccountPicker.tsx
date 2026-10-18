import { useEffect, useState } from "react";
import api from "../../../services/api";

export default function AccountPicker({
  role,
  label,
  value,
  onChange,
  includeInactive = false,
}: {
  role: "teacher" | "student";
  label: string;
  value: string;
  onChange: (id: string) => void;
  includeInactive?: boolean;
}) {
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<
      { id: string; name: string; email: string; status: string }[]
    >([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const r = await api.get("/admin/accounts", {
          params: {
            role,
            status: includeInactive ? undefined : "active",
            search,
            page,
          },
        });
        if (active) {
          setRows(r.data.data.rows);
          setTotal(r.data.data.total);
          setError("");
        }
      } catch {
        if (active) setError("Accounts could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [role, search, page, revision, includeInactive]);
  const field =
    "mt-1 block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm";
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        Find {role} by name or email
        <input
          className={field}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            if (value) onChange("");
          }}
        />
      </label>
      <label className="block text-sm">
        {label}
        <select
          className={field}
          disabled={loading}
          value={rows.some((r) => r.id === value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">
            {loading ? "Loading accounts…" : `Select a ${role}`}
          </option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.email}
              {includeInactive ? ` · ${r.status}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRevision(revision + 1)}
          >
            Retry
          </button>
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-ink-500">
        <span>
          {total} active {role} accounts · Page {page}
        </span>
        <button
          type="button"
          disabled={loading || page === 1}
          className="underline disabled:opacity-40"
          onClick={() => setPage(page - 1)}
        >
          Previous accounts
        </button>
        <button
          type="button"
          disabled={loading || page * 20 >= total}
          className="underline disabled:opacity-40"
          onClick={() => setPage(page + 1)}
        >
          More accounts
        </button>
      </div>
    </div>
  );
}
