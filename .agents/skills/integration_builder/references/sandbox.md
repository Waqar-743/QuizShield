# SANDBOX — the `fastn.*` runtime contract

> Read this when writing or debugging workflow code (`create_workflow`, `update_workflow`, `run_code`). Covers what exists in the sandbox, what doesn't, execution tiers, and direct HTTP execution.

Workflows are JavaScript modules running in an isolated V8 sandbox against real third-party APIs — treat every live call as writing to a customer's production system.

## Module shape
Every code string MUST be a single ES module:
```js
export default async function (ctx) {
  const { input, headers } = ctx;
  // ...
  return { result };
}
```
`ctx` has EXACTLY two fields: `ctx.input` (caller data) and `ctx.headers` (sanitized; auth headers stripped). `ctx.log`, `ctx.env`, `ctx.secrets`, `ctx.connectors` do NOT exist.

## WHAT EXISTS
- `fastn` and `Fastn` are ambient globals. **NEVER write import statements** — not even `import { Fastn } from "@fastn/sdk"`. There is no module loader.
- `fastn.connector.<slug>.<action>(args)` — every call returns `{ output, success, status, error, durationMs }`. **ALWAYS unwrap `.output`** for the data (`result.output.results`, never `result.results`) — forgetting this is the single most common bug. Failed calls throw; use try/catch for graceful fallback.
  - **PASS THE ACTION'S ARGUMENT OBJECT DIRECTLY — NEVER nest it under `input`.** `args` is the action's OWN parameters (`$top`, `$select`, `entitySet`, `limit`, `id`, …) — it is **not** `ctx.input`, and **not** the `run_code` / `probe_connector` tool's `input`/`params` field. Nesting them silently drops every parameter: the connector gets one unknown key `input`, ignores your query params, falls back to a bare list against the service root, and **times out**.
    ```js
    // ✅ RIGHT — the args object is passed directly
    await fastn.connector.d365.listProducts({ entitySet: "products", $top: 1, $select: "id,name" });
    // ❌ WRONG — nested under input; $top/$select/entitySet are ignored → service-root call → timeout
    await fastn.connector.d365.listProducts({ input: { entitySet: "products", $top: 1, $select: "id,name" } });
    ```
  - **CHECK THE ACTION CONTRACT FIRST — `get_action_schema` before the FIRST call.** Before you `run_code` / `probe_connector` / `execute_action` against any action, read `get_action_schema` to learn its exact param names, types, and required set, and pass args that match. A wrong or missing required arg does NOT fail cleanly — the gateway returns a terse, often unhelpful error (a bare timeout, `Missing required input fields: …`, or a silent fall-through to a service-root call), each costing a debug round-trip. The schema tells you WHAT to send; a real 2xx still proves it WORKS (schemas can be wrong — see BUILD step 4), so check the contract, then probe.
- **COMMUNITY connectors** (`scope === "community"` from `list_connectors`) are NOT reachable via the bare form. Declare them:
  ```js
  const fastn = new Fastn({ connectors: { hubspotCrm: { orgId: "managed" } } });
  await fastn.connector.hubspotCrm.listContacts({});
  ```
  If you use `new Fastn({ connectors })` anywhere, declare EVERY connector the workflow calls in that config (custom ones use `orgId: "custom"`). Probes in `run_code` follow the same rule — a community connector probed via the bare form fails with "Connector not found".
  Per-connector options are `{ orgId: "managed"|"custom", connectionId, version }`. A code-level `connectionId` pin forces an EXACT connection (top of the resolution precedence) — use it ONLY for throwaway probes / `run_code`, never in saved workflow code; in a saved workflow, pin a non-default connection on the **manifest** with `set_connector_scope` instead (see `references/multi-tenancy.md` §3–§4).
- `fastn.state` — durable key-value: `.get(key)` / `.set(key, value)` / `.delete(key)`. Default ORG scope persists across runs — correct for **cursors and the `id_map`** (source id → target id); omit the scope option for those. `{ scope: "INVOCATION" }` resets per run. **In a flow that re-reads a set to discover changes, do NOT hand-roll content hashes, last-seen snapshots, or delete detection in here — that is `fastn.diff` (below), which already stores the last-seen record per source id and returns `created` / `updated` / `deleted` / `unchanged` with per-field diffs.** State keeps the mapping; diff keeps the baseline (STATE CONTRACT / CHANGE DETECTION in `references/workflow-patterns.md`).
- `fastn.db` — org-scoped SQL: `await fastn.db.query("SELECT ... WHERE x = $1", [v])` — always `$1` placeholders, never string interpolation. `CREATE TABLE IF NOT EXISTS` allowed; tables persist. This is the **workspace database** (managed Postgres), NOT the DB connector.
- `fastn.diff` — **snapshot-based change detection**, the platform's change/delete detector. Hand it the records you just fetched; it returns which are new, which changed (with **field-level** old/new diffs), which vanished, and which are untouched — comparing against a per-org baseline it stores for you (`fastn_diff_snapshots` in the org's own workspace schema; created lazily, never inside the synced records). Every call also writes a durable run report the dashboard renders under **Activity → Sync Reports**. For a flow that must discover what changed by re-reading a set, use this instead of hashing records by hand — but only such a flow needs it at all (WHEN to use it, `references/workflow-patterns.md`).
  ```js
  const d = await fastn.diff.compare({
    scope: "hubspot-cin7-products",   // SHARED baseline key — the SAME literal in the schedule AND the event flow
    entity: "products",               // sub-namespace inside the scope; ids of different collections cannot collide
    records, keyField: "id",          // dot paths allowed: "properties.hs_object_id"
    comparison: {
      mode: "PARTIAL", fields: ["name", "price", "sku"],   // only these participate in hash + diff
      ignoreFields: ["updatedAt", "*.timestamp"],          // "*" wildcards allowed
      normalization: { trimStrings: true, caseInsensitive: ["email"], normalizeDates: true },
      arrayComparisonStrategy: "BY_KEY", arrayKeyField: "id",   // WHOLE_ARRAY (default) | BY_INDEX | BY_KEY
    },
    lifecycle: { detectDeletes: true },   // DEFAULT TRUE — see the footgun in references/workflow-patterns.md
  });
  // d.created[]   { externalId, current }
  // d.updated[]   { externalId, previous, current, changedFields:[{ path, changeType, oldValue, newValue }], changeSummary }
  // d.deleted[]   { externalId, previous }        d.unchanged[]  (only with output.includeUnchanged)
  // d.stats       { total, created, updated, deleted, unchanged, duplicateKeys, fieldsChanged, durationMs, timings }
  // d.reportId    the persisted run report
  ```
  - **In PARTIAL mode `current` / `previous` are the PROJECTED record, not the source record.** A field you did not list in `comparison.fields` is simply ABSENT from them — including `keyField`. Writing the target from `rec.current` therefore ships a missing/null key and drops every unmapped field. `rec.externalId` always carries the key, so either list the key in `fields` AND accept that only projected fields are available, or (better) keep your own `id -> original record` map for the page and write the target from THAT. Verified: `fields: ["name","price"]` with `keyField: "sku"` yields `current = {"name":...,"price":...}` — no `sku`.
  - **`applySnapshots` must receive the SAME `comparison` config as `compare`.** It re-projects and re-hashes the data you hand it (`prepare()` internally), so a different (or omitted) config stores a snapshot hashed under different rules and the NEXT run reports every record as changed — a silent, permanent re-sync loop.
  - **Trim the bridge payload on big pages.** `output: { includeSnapshots: false }` drops the record bodies from the result while KEEPING `externalId`, `hash`, and `changedFields` — enough to drive the loop, and far cheaper than shipping 10k record bodies back per page. `reporting: { persistDetails: false }` stops each page writing a capped per-record detail array into `fastn_diff_runs`, which matters when a run has 100 pages.
  - **`finishRun` returns EVERY deleted record with its full `previous` body** and has no trim option. On a scope where a large fraction vanished, that is one enormous payload across the bridge. Bound the delete set, and treat a mass-delete run as a real risk rather than a report to read.
  - **`compare` NEVER advances the baseline** unless you pass `lifecycle.autoApply: true`. The retry-safe loop is **compare → write the target → `applySnapshots` for the records that ACTUALLY synced**: `await fastn.diff.applySnapshots({ scope, entity, upserts: [{ externalId, data }], deleteIds })`. A record whose target write failed keeps its old baseline and comes back as CREATED/UPDATED next run — idempotent, no lost updates, no bookkeeping of your own.
  - `fastn.diff.finishRun({ scope, entity, runId, apply: true })` — cross-page delete detection after the LAST page of a paged scan.
  - `fastn.diff.getReports({ scope, entity, limit })` — past run reports (stats + per-record changed fields). Readable from OUTSIDE a workflow too: the `list_diff_reports { workflow_id }` MCP tool, `GET /api/v1/workflows/diff-reports?scope=&entity=&workflow_id=&limit=`, or the dashboard — use it to check what a scheduled run actually did without re-running it.
  - `fastn.diff.cleanup({ scope, entity, olderThanDays })` — retention. Nothing auto-deletes, but note it removes **snapshots as well as run reports** past the cutoff, and a snapshot's timestamp only moves when that record actually changes — so too short a window drops the baseline for stable records and re-syncs them (see Reports and retention in `references/workflow-patterns.md`). `olderThanDays` must be a POSITIVE number — `0` throws — so a deliberate full reset is a fractional value (e.g. `0.0001`) or a `fastn.db` DELETE against `fastn_diff_snapshots`.
  - **Per-call cap 10,000 records** (`DIFF_MAX_RECORDS_PER_CALL`) — beyond that, page and use `runId` + `finishRun`.
  - Only the **declarative** `comparison` options cross the sandbox bridge — custom comparator/normalizer FUNCTIONS do not.
- `fastn.cache` — Redis-backed cache: `.get(key, { scope: "PROJECT" })` / `.set(key, value, { ttl: seconds, scope: "PROJECT" })` / `.invalidate(key, { scope: "PROJECT" })`. PROJECT scope persists across executions within the org. Default TTL 300s. Platform singleton Redis (sub-ms, no connection overhead). Use for caching reference data — NOT the Redis connector.
- `fastn.secrets.get(name)` — vault secrets. Never hardcode credentials.
- `fastn.alerts.send(ruleName, { title, message?, severity?, key?, data? })` — **notify a human** through a named **alert rule**'s channels (email / Slack / webhook / a connected connector, configured on the dashboard's **Alerts** page with "workflow code raises it"). Resolves `{ queued: true, alertId }` once the alert is RECORDED; the platform delivers it within a few seconds. **Always `await` it.**
  ```js
  await fastn.alerts.send("Ops alerts", {
    title: "Large order needs review",          // required, <=200 chars; also the default key
    message: `Order ${o.id} is ${o.total}`,     // <=4000 chars
    severity: "critical",                       // info | warning (default) | critical
    key: "large-order",                         // throttle bucket: one per KIND of problem
    data: { orderId: o.id, total: o.total },    // <=16 KB of JSON; reaches webhooks only
  });
  ```
  - **When it is the answer:** a business exception the run HANDLES and a person must act on (an order over a limit, a price mismatch, a record that keeps failing validation). A run that FAILS is a failure alert rule's job — never `catch` an error just to alert on it: the run then "completes", and failure alerts, retries and metrics never see it.
  - **The rule is looked up by NAME, and a name that matches no rule THROWS** (`UserCodeError: no alert rule named "…"`) and fails the run — deliberately, so a renamed or deleted rule is visible instead of silent. The rule must exist before the flow runs; no tool creates one, so ask the user to create it on the Alerts page. A rule that exists but is **paused** resolves `{ queued: false, reason: "paused" }` without throwing. Every enabled rule with that name in the run's scope receives it (the org's partner-wide rules plus rules scoped to the run's tenant).
  - **Throttled per (rule, workflow, tenant, key).** The first alert of a key sends; repeats within the cooldown (15 minutes) are counted and sent as ONE summary ("raised N more times") at the highest severity counted when the window ends. A HIGHER severity than the one that opened the window is sent at once. A rule with **Notify every time** on skips the cooldown. Every rule also sits inside a per-minute send budget (20 per rule, plus one per org); what it refuses arrives as one summary when the minute rolls over. Repeats inside ONE run update one record (count, latest message/data, highest severity), so a call inside a loop cannot flood anyone.
  - **`key` is a bucket, not an id.** More than 50 distinct alerts in one run throws — counted across the run, inline `fastn.flow.invoke` sub-flows included. One key per kind of problem (`"price-mismatch"`), the record id in `data` — `key: record.id` makes every record its own notification. `data` reaches webhooks only (the structured `event.data`); it is never put into email or Slack text, and the notification names the workflow that raised it.
  - **Test runs DELIVER.** `test_workflow`, `run_code` and the editor's Test button send REAL notifications, marked `[TEST]`, outside the cooldown — **`mockMode` does NOT suppress them** (it only mocks `fastn.connector.*`). An inline `fastn.flow.invoke` child of a test run is `[TEST]` too; an `invokeAsync` / `map` child is a real run, so its alerts are real. Test deliveries have their own small per-minute budget; the rest arrive as one `[TEST]` summary. Only verification runs suppress alerts (`{ queued: false, reason: "verification" }`).
  - **A database outage does not fail the call:** the alert is queued in Redis and still delivered. Only with Postgres AND Redis down does it throw — a `SystemError`, the platform's fault, not the code's.
  - `title`, `key`, `message` and `data` are redacted of any value read through `fastn.secrets` before they are stored.
  - `fastn.alerts.send is not a function` means the environment predates `fastn.alerts` (an unknown `fastn.<name>` falls through to a connector constructor) — do not work around it with a connector call without telling the user.
- `fastn.loki.debug|info|warn|error(message, data?)` (also `fastn.loki.log(level, message, data?)`) — **structured log lines** for the run: a message plus fields, shipped by the platform to Grafana Loki and shown on the run's **Logs** tab (dashboard **Activity** → **Executions** → the run → **Logs**).
  ```js
  fastn.loki.info("order synced", { orderId: o.id, lines: o.lines.length });   // no await needed
  fastn.loki.warn("skipped: no email", { contactId: c.id });
  fastn.loki.error("upsert failed", { orderId: o.id, status: res.status });
  fastn.loki.info({ message: "page done", page, created, errors });             // an object alone is the data
  ```
  - **Synchronous, returns `undefined`, never throws** — logging cannot fail a run, and a down Loki costs the run only its lines. `await` is harmless but unnecessary.
  - **What to log: milestones and exceptions, not every record.** One `info` per page or batch (`{ page, fetched, created, updated, skipped, errors }`) and one `error` / `warn` per record that failed or was skipped, with its id and reason; for an event flow, the event received and its outcome. Never one line per record that synced — it buries the exception someone is looking for and runs into the budget below. Ids go in `data`, not in the message, with one constant message per kind of event (`"order synced"`), so a run is searchable and countable.
  - **Levels mean something:** `error` = a record or step failed, `warn` = skipped or degraded but handled, `info` = milestones, `debug` = detail only worth having while diagnosing.
  - **Logging is not error handling and not alerting.** A failure the run cannot recover from still throws; a per-record failure is still COUNTED in the return value (`errors`, `errorDetails`) — tests assert on the count, a person searches the line. A log line notifies nobody; if someone must act, that is `fastn.alerts`.
  - **`console.log` / `info` / `warn` / `error` are shipped too** (`log` and `info` both land as `info`). Use `fastn.loki` in new code: the level is exact and the fields stay structured under `data`. Existing `console.log` lines need no rewrite.
  - **The labels are the platform's, never yours:** `{fastn_logs="true", env, organization=<owner org id>, level}` — nothing in workflow code can set or add one. Each line also carries `execution_id` (an inline `fastn.flow.invoke` child's own run), `root_execution_id` (the run it executed under), `workflow_id`, `event_id`, `trigger_id`, `tenant_id`, `installation_id`, `attempt`, `trace_id`, `source` (`fastn.loki` | `console`), and your object under `data` — nested, so a field named `execution_id` in it cannot overwrite the real one.
  - **Budget: 5000 lines / 2 MB per run per hour,** counted from the run's start. Past it lines are dropped until the next hour opens, and the run gets one `warn` line `[fastn] N log lines were not shipped in the hour from …` — the sign of a flow that logs per record. A call costs about what `console.log` does; the cost that matters is volume.
  - **Size:** `message` and the serialized `data` are each cut at 8 KB inside the sandbox; a cut `data` arrives as a `data_preview` string, not an object. Log ids and counts, never a whole payload.
  - **Redaction covers `fastn.secrets` values only.** Anything else sensitive — tokens from a response, personal data — is stored as written, so do not log it.
  - **Test runs are NOT shipped.** `test_workflow`, `run_code` and the editor's Test button return the lines inline in the result's `logs`, with every console line; only a real execution (`execute_workflow`, a trigger, a schedule) reaches Loki and the Logs tab. Verification runs ship nothing. So a log line is never a test case's `pass` condition — assert the returned value and the target.
  - **The run keeps its own copy:** every call is also a line in the execution's stored `logs` (`get_execution`), as `message {json data}` with its level — so a failed run is diagnosable even when Loki was unreachable.
  - **Long-running flows:** lines ship every couple of seconds, so the Logs tab shows progress while the run is still going; the tab shows the latest lines and Grafana holds the rest. One progress line per page makes a stuck run visible as a gap.
  - **Searching in Grafana:** `{fastn_logs="true", env="prod", organization="<owner org id>"} |= "<executionId>" | json`. After `| json`, `data` fields are `data_<field>` (`| json | data_orderId="ord_123"`).
  - `fastn.loki.info is not a function` means the environment predates `fastn.loki` (an unknown `fastn.<name>` falls through to a connector constructor) — fall back to `console.log`, which works everywhere, and tell the user.
- `fastn.files` — `.write(path, data)` / `.read(path)` / `.delete(path)` / `.exists(path)`. Text content only.
- `fastn.config.get(configId)` + `fastn.evaluator` (`evaluateConditions` / `applyMappings` / `applyDefaults`) — runtime-editable integration config. Returns the object EXACTLY as saved (nested shape) — `config.entities[]` (each entry has `source:{connector,entity}`, `target:{connector,entity}`, `integrationScope`, `mappings[]`, `conditions[]`, `actions[]`) and top-level `config.matching` — access it directly, no unwrapping (full example, incl. the `config.directions` legacy fallback: "How the config comes back in the flow" in `references/dynamic-config.md`). Sync workflows built from a PHASE 1/2 plan ALWAYS read their single `configId` this way, and so does a single-system automation that carries business rules (its filter and selected value live in the config, not in the code). Only a workflow with nothing a user would retune — a fixed notification, a parameterless job — has no config.
- `fastn.config.getByTemplate(templateId)` — the **multi-tenant** read. Returns the SAME shape as `.get`, but resolves the **caller's per-customer clone** at runtime (installation → its clone; else end-org → its clone; else the developer's template in dev). A multi-tenant (Path B) flow MUST use this, not `.get(configId)` — `.get` always returns the partner's template, so every customer would read the developer's mapping instead of their own (a silent cross-tenant bug). Single-tenant (Path A) flows that bind to one developer-owned config use `.get(configId)`. The agent authors the config **template** only; the embed mints the clones. Path/template model: `references/multi-tenancy.md` §10.
- `fastn.envConfig.get(key, env?)` — read a static per-environment key/value (JSONB). **Always `await`** the call; forgetting the keyword silently passes a Promise downstream so the workflow reads `[object Promise]` instead of the value. Default (no second arg) resolves against `ctx.env`; pass an env slug to read a specific env. NOT a secret store — tokens, API keys, OAuth client secrets belong in `fastn.secrets`. Distinct from `fastn.config.get(cfg_*)`: `config` holds the **integration's mappings** (one row per use case, edited via the widget); `envConfig` holds **static per-env values** like API base URLs, retry limits, feature flags, or derived caches a workflow maintains (separate row per `(env_slug, key)`, edited via the dashboard's Configurations tab, written from skills via `bulk_upsert_env_configs`, or written at runtime by workflow code via `fastn.envConfig.set`).
  ```js
  export default async function (ctx) {
    const apiBase = await fastn.envConfig.get("apiBaseUrl");   // resolves against ctx.env
    return { runningIn: ctx.env, apiBase };
  }
  ```
- `fastn.envConfig.set(key, value, env?)` — **upsert** a static per-env config row from inside workflow code. One call creates OR updates: under the hood it's `INSERT … ON CONFLICT (org_id, env_slug, key) DO UPDATE`. Default `env` is `ctx.env`; pass a slug to target a specific env. Invalidates the per-execution read cache so a subsequent `.get` in the same run returns the fresh value. **Requires the executing JWT to carry the `workflows.update` role** (developer / admin / owner / platform_admin) — end_user, viewer, and operator can read but cannot write, and a missing role throws `UserCodeError` before the DB write. Use this for workflows whose job is to POPULATE env-configs from an external source (e.g. a Google Sheet → mapping config; a remote attribute list → key/value cache; any "fetch external data and store it as named config" pattern). Standard write shape:
  ```js
  export default async function (ctx) {
    const rows = await fastn.connector.googleSheets.getRows({ /* ... */ });
    const mapping = buildMapping(rows.output.rows);

    // create OR update — single call; idempotent.
    await fastn.envConfig.set("mappingSheet", mapping);

    // target a specific env explicitly if not ctx.env:
    await fastn.envConfig.set("mappingSheet", mapping, "live");

    return { ok: true, keys: Object.keys(mapping).length };
  }
  ```
- `fastn.envConfig.delete(key, env?)` — remove a row. Same RBAC as `set`. Subsequent `.get(key)` returns `null`.

**Provisioning vs runtime writes — keep them separate.** This skill does NOT call `bulk_upsert_env_configs` / `upsert_env_config` / `create_environment` during BUILD (see BUILD ORDER step 3 in `references/build.md`) — BUILD-time provisioning is the operator's job (dashboard Configurations tab). RUNTIME writes from workflow code are different: when the workflow's actual purpose is to populate or maintain an env-config (a mapping sheet sync, a cached lookup table, a derived feature-flag set), wire it up with `fastn.envConfig.set` and don't manually pre-create the key — the first run will create it.
- `fetch(url, opts)` and `console.log/warn/error` exist. console output is captured in the execution's logs and shipped to Loki with the run's `fastn.loki` lines (see `fastn.loki` above). `fetch` has a 30s timeout and returns `{ ok, status, statusText, text(), json(), data }` — not a full WHATWG Response. It is a LAST RESORT: it bypasses connector auth, rate limiting, and observability; prefer a connector action whenever one exists.

### Sub-flows — call a flow from a flow (`fastn.flow`)
- `await fastn.flow.invoke(slug, input, opts?)` — **synchronous**: runs the child in-process and returns its return value inline. Use to compose/reuse another flow when you need its result.
- `await fastn.flow.invokeAsync(slug, input, opts?)` — **fire-and-forget**: starts the child as its own execution, returns `{ executionId }` immediately, parent does NOT wait. Use to kick off independent work.
- `input` becomes the child's `ctx.input`. `opts.headers` merges over the parent's `ctx.headers` (caller wins); auth/identity headers are always stripped — you cannot pass credentials into a child. The child inherits the parent's tenant binding and `mockMode`/`mockScenarios`, so sub-flows are mocked in test runs too. Resolve `slug` via `list_workflows`.

**Guards (throw `UserCodeError` — design around them):**
- **Depth** ≤ 5 nested sub-flows (both forms).
- **`invoke` tier rule:** may only invoke a child whose tier ≤ its own (`instant < standard < long`) — the child runs inline in the caller's time budget. To call a higher-tier child, use `invokeAsync` (no tier gate).
- **`invoke` cycle detection:** re-entering a flow already in the call chain throws (`a -> b -> a`). `invokeAsync` has NO cycle detection (the child is a fresh execution) — avoid self-referential async loops yourself.

`invokeAsync` children count against the execution quota and are durable for standard/long (best-effort in-process for instant).

### Calling Redis and DB connectors from workflows
Redis and DB connectors work like any other connector:
```js
// Redis connector — call any of its actions
const result = await fastn.connector.redis.setValue({ key: "user:123", value: JSON.stringify(data), ttl: 3600 });
const cached = await fastn.connector.redis.getValue({ key: "user:123" });

// DB connector — parameterized SQL query
const rows = await fastn.connector.db.query({ sql: "SELECT * FROM orders WHERE customer_id = ?", params: ["cust_123"] });
// rows.output.rows = [{id: 1, ...}, ...]

// For INTERNAL caching (platform Redis, fast, no connector overhead):
const cached = await fastn.cache.get("price:ITEM-123", { scope: "PROJECT" });
if (!cached) {
  const price = await fastn.connector.d365.getPrice({ sku: "ITEM-123" });
  await fastn.cache.set("price:ITEM-123", price.output, { ttl: 86400, scope: "PROJECT" });
}
```
Key distinction: `fastn.cache` = platform Redis (sub-ms, for caching). `fastn.connector.redis.*` = user's external Redis (their own data). `fastn.db` = workspace Postgres (managed). `fastn.connector.db.*` = user's external database.

## WHAT DOES NOT WORK
Calling any of these fails parse or throws at runtime:
- **Timers:** `setTimeout`, `setInterval`, `setImmediate`. There is NO sleep mechanism — `await new Promise(r => setTimeout(r, x))` throws too. Do not write retry-with-backoff sleeps.
- **`require()` / `import`** (static or dynamic) — stripped at parse.
- **Node built-ins:** `fs`, `crypto`, `http`, `Buffer`, `process` (so no `crypto.randomUUID()`, no `Buffer.from()`, no `process.env`).
- **Browser APIs:** `XMLHttpRequest`, `WebSocket`, `URL`, `URLSearchParams`, `TextEncoder`/`TextDecoder`.

## EXECUTION TIERS AND TIMEOUTS
The tier selects the execution ROUTE, not the time limit:
- `instant` — `execute_workflow` runs synchronously and returns the result. Single-record / event-handler logic. (good for flow that take upto 60s)
- `standard` — queues on Temporal, returns 202 + executionId. Loops, pagination, multi-call flows. (good for flow that take upto 15min)
- `long` — same queueing, separate queue. Historical imports, thousands of records.(good for flow that take upto 6h)

Wall-clock is governed by the workflow's `timeoutMs` (default 120s / 2min, max 6h) — the tier does NOT raise it. A standard-tier sync whose loop runs longer than 2 minutes WILL time out unless you set `timeoutMs` on `create_workflow`. Any loop over records is never instant; when in doubt, choose standard and size `timeoutMs` to the realistic worst case.

`test_workflow` always runs the sandbox synchronously regardless of tier — for workflows whose bounded test still takes minutes, prefer `execute_workflow` + `get_execution` polling.

## MANUAL / DIRECT API EXECUTION
A saved workflow is callable over HTTP at `POST {orgId}/api/v1/workflows/{idOrSlug}/execute` (`execute_workflow` wraps this):
- Body `{ "input": { ... } }` becomes `ctx.input` verbatim (defaults to `{}` when omitted); request headers become `ctx.headers` (auth/gateway headers stripped). `input` carries SCOPE only.
- `?env=` query param selects which code runs: omitted or `test` runs the latest published / dev code; a named env (`live`, `qa`, …) runs that environment's active deployment, 404 if none.
- `Idempotency-Key` header dedupes — a repeated key returns the original execution instead of running again.
- Instant tier responds synchronously with `{ data: <return value> }` plus `X-Execution-*` headers; standard / long respond `202 { data: { executionId, status: "queued" } }` — poll `get_execution` for the result.
- Multi-tenant form `POST {ownerOrgId}/api/v1/{resourceOrgId}/workflows/{idOrSlug}/execute` runs the owner's workflow against another org's connections; the `x-fastn-user-id` header scopes to a specific end-user's connection.
- Failures return structured fields (`errorCategory`, `fixSuggestion`) and a non-2xx status; a thrown user-code error surfaces as 422, a timeout as 408.