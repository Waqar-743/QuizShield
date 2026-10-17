# WORKFLOW PATTERNS — design rules, safety, triggers

> Read this when designing the LOGIC of a workflow (sync loops, event handlers) and before any live test. Pairs with `references/sandbox.md` (the API contract) and `references/build.md` (build order + widget).

## WORKFLOW DESIGN RULES
- **ONE EXECUTION SHAPE PER WORKFLOW.** A scheduled batch sync (cursor + pagination) and an event-driven single-record handler have different input contracts — build them as SEPARATE workflows. Never `if (ctx.input.id) { single } else { batch }`, and never bind a schedule trigger and an app-event trigger to the same workflow.
- **ALWAYS PAGINATE** list actions until the API says there is no more. One page is never all the data.
- **SKIP-ON-ERROR:** never break a sync loop on one bad record. Catch, push `{ sourceId, reason, errorMessage }`, continue. This means a run that failed every record still returns 2xx, so a test must assert `errors === 0` and a positive outcome on the RETURN VALUE — never just that the workflow returned (BUILD step 6 in `references/build.md`).
- **RETURN SHAPE:** always `{ created, updated, skipped, errors, errorDetails }` (or equivalent counts for the workflow's outcomes). Bare counts hide bugs; named reasons are what operators read.
- **SKIP IS A DIAGNOSTIC, NOT AN OUTCOME.** The end goal is that every record eligible under the user-approved filters SYNCS, based on the data available in the source system. A skip is legitimate ONLY when an approved condition (scope filter, or an approved empty-required policy) excludes the record. A skip for any other reason — a field the mapping should have handled, a matching failure, an unhandled shape, a target rejection — is a DEFECT to root-cause and fix, not a result to report. After every run, **reconcile the counts**: eligible source records = created + updated + filter-attributable skips. If skips or errors dominate, or `created + updated` is 0 against a non-empty source, the integration is broken even though the run returned 2xx — STOP, read the skip reasons / `errorDetails` you logged, fix the cause, re-run. Never hand off a flow whose "success" is records quietly not syncing; the user must never be the one who discovers unsynced records and reports the bug back.
- **CURSOR RULE:** detect manual runs (`ctx.input` has explicit params like `limit`/`maxPages`/`modifiedSince`) vs production runs (empty input). Manual runs use the params but NEVER advance the saved cursor — otherwise a `limit:2` test makes the next scheduled run skip thousands of records.
- **STATE CONTRACT (sync flows) — `fastn.state` holds the `id_map` and the cursor; `fastn.diff` holds the change baseline.** In a flow that re-reads a set to discover changes (CHANGE DETECTION below decides whether yours is one), do NOT hand-roll content hashes, last-seen record copies, or delete detection: `fastn.diff.compare` already stores the last-seen record per source id and returns `created` / `updated` (with field-level old/new diffs) / `deleted` (carrying the last-seen `previous`, which is the record you need to issue the target delete) / `unchanged` — see **CHANGE DETECTION** below. What stays in `fastn.state` is the mapping (`id_map:<sourceId>` -> `target_id`, so an update can address the target record directly) and the flow's cursor. Write the mapping at the SAME point you take the action (see UPSERT ORDER); on a delete, keep the key with the removal recorded rather than dropping it, so the mapping stays auditable. **The second run must be cheaper than the first** — with diff that is automatic (`unchanged` records never reach the target, and cost no state write either). If it is NOT cheaper, the baseline is being forked (a mismatched `scope` — see CHANGE DETECTION) or the comparison includes churn fields the integration does not even map.
- **SELF-HEAL:** never trust a cached `target_id` blindly. On 404/410 during update → search the target by natural key, repair the mapping if found, create fresh if not. One stale mapping never fails the run.
- **MATCH by stable IDs** or a natural key the target indexes (email, SKU, external_id). NEVER by display name.
- **DERIVED natural keys:** when the config fills an empty required field via a derived/default transform (the empty-required policy from `references/mapping.md`), compute the derived value FIRST and use that same value for BOTH the natural-key search and the write — never search by the raw (empty) source field, or the existing record is missed and duplicated. This only works because derivation is deterministic (same record → same value every run); if the recipe isn't deterministic, matching is broken by construction.
- **UPSERT ORDER — never CREATE without first checking the target exists.** This is the single decision every record passes through, in order:
  1. **`fastn.diff` classified it `unchanged`** → the record is not in `created`/`updated` at all, so there is no target call and nothing to write. The baseline is already correct — do NOT re-stamp it.
  2. **`id_map` holds a `target_id`** → **UPDATE** (self-heal: on 404/410, fall to step 3) → keep the mapping.
  3. **Otherwise SEARCH the target by natural key** (SKU / external_id / email via the `searchAction`) → **found → UPDATE + record the mapping**; **not found → CREATE + record the mapping**.

  After the loop, advance the baseline ONCE for the records that ACTUALLY synced: `fastn.diff.applySnapshots({ scope, entity, upserts, deleteIds })` (STATE CONTRACT above). A record whose target write threw is simply left OUT of `upserts` — it keeps its old baseline and reappears as CREATED/UPDATED next run, which is what makes the loop retry-safe without any bookkeeping of your own. A delete — source record gone, target removed — goes in `deleteIds`; the `id_map` key stays, with the removal recorded, so the mapping remains auditable.

  **`created` is a statement about the BASELINE, not about the target.** An empty baseline — first run, a new/typo'd `scope`, a switched workspace database — reports EVERY record as CREATED, including records that already exist in the target. So a `created` record still goes through step 3's natural-key search before it may create; the search is the only thing preventing a full set of duplicates.

  State is only an OPTIMIZATION to skip step 3 — **never a licence to create blindly.** The case that breaks a naïve sync: the record is NOT in `id_map` but already exists in the target (created manually, by another tool, or a non-empty initial load / reset state). It MUST resolve to UPDATE, not a duplicate — which only happens if a missing mapping falls through to the natural-key search instead of straight to CREATE. So `state_mapping` means "trust the map *when it has the answer*"; the **first-time create still goes through the natural-key search.** Skip the search ONLY when the target genuinely has no natural key — then dedup is best-effort on the `id_map` alone, and you must say so to the user.
- **PAYLOADS:** build each create/update body fresh from the source record via per-action helpers (`toCreatePayload` / `toUpdatePayload`). Create and update accept different fields — server-set fields (createdAt, version, id) are accepted on create and rejected on update. Never replay or spread one into the other.
- **NEVER hardcode reference data** (account codes, pipeline stages, tax rates, folder IDs) — fetch it from the connector at runtime.
- **`ctx.input` controls SCOPE only** (limit, maxPages, modifiedSince) — the caller never configures internals. Field mappings, filters, and status translations live in the saved config (`fastn.config.get` + `fastn.evaluator`) for sync workflows, or inside the workflow code for standalone workflows with no config row. Never in `ctx.input`.
- **TESTABILITY:** batch workflows must accept optional `limit` / `maxPages` inputs so they can be tested on a handful of records.

## CHANGE DETECTION — `fastn.diff` (only where a flow must DISCOVER what changed)

`fastn.diff` is the platform's snapshot-based change detector — it owns "what changed since last run", including **field-level** diffs and **delete detection**, against a baseline it stores per org. Full API contract in `references/sandbox.md`; this section is the DESIGN rules.

### WHEN to use it — one question

**Does this flow have to work out what changed by RE-READING a set it has seen before?**

- **Yes → use `fastn.diff`.** A scheduled batch sync or reconcile over a source collection, and a backfill. These re-read the same set every run and would otherwise rewrite unchanged records to the target forever, and would never notice a deletion. This is what the engine is for, and hand-rolling content hashes in `fastn.state` instead is the exception, not the pattern.
- **No → do NOT use it.** Specifically:
  - **An app-event / webhook flow handling one record.** The trigger already tells you exactly what changed — that IS the change signal. A baseline adds a snapshot write per event, forces `detectDeletes: false` on every call, and buys nothing.
  - **A single-system automation** (an order comes in, switch its warehouse). Nothing is being compared against a previous state.
  - **A notification, a webhook passthrough, a callable API, a read-only or reporting flow.** No target set to keep in step.
  - **A flow whose whole output is a small derived value** (a status summary, a rolled-up count) that is cheaper to rewrite unconditionally than to diff.

**Adding it where it isn't needed is not free**: one snapshot row per record in the customer's own workspace database, a full baseline reload on every `compare` call, and the `detectDeletes` footgun below now live in a flow that gained nothing. Do not reach for it reflexively because a flow writes data — reach for it when the flow must *discover* what to write.

**The one deliberate exception on the event side:** when an entity's schedule flow already keeps a baseline, having its event flow apply to the **same scope** means the reconcile sees the event's write as already-applied and reports it `unchanged` instead of rewriting it. That is a real benefit, and it is a choice — not a requirement. If you take it, the event flow still passes `detectDeletes: false` on every call.

### The batch-sync loop

For a flow that passed the gate above:

```js
const SCOPE = "hubspot-cin7-products";          // one literal, shared by every flow of this pair
// Hoisted: compare AND applySnapshots must use the SAME config (sandbox.md).
const comparison = { mode: "PARTIAL", fields: mappedSourceFields };   // only the fields you actually map
const page = await fastn.connector.hubspot.listProducts({ limit, after });

const d = await fastn.diff.compare({
  scope: SCOPE, entity: "products",
  records: page.output.results, keyField: "id",
  comparison,
  lifecycle: { detectDeletes: isFullScan },                      // read the FOOTGUN below before you set this
  output: { includeSnapshots: false },                           // ids + changedFields only; skip record bodies
});

// `current` is the PROJECTED record in PARTIAL mode (see references/sandbox.md),
// so keep the originals and write the target from THOSE.
const source = {};
for (const r of page.output.results) source[String(r.id)] = r;

const upserts = [], deleteIds = [], errorDetails = [];
for (const rec of [...d.created, ...d.updated]) {
  try {
    const targetId = await upsertIntoTarget(source[rec.externalId]);   // UPSERT ORDER above
    await fastn.state.set(`id_map:${rec.externalId}`, targetId);
    upserts.push({ externalId: rec.externalId, data: source[rec.externalId] });  // the ORIGINAL, not rec.current
  } catch (e) {
    errorDetails.push({ sourceId: rec.externalId, reason: "target_write", errorMessage: e.message });
  }                                                              // NOT pushed to upserts → retried next run
}
for (const rec of d.deleted) {                    // drop includeSnapshots:false to get rec.previous here
  try { await removeFromTarget(rec.externalId); deleteIds.push(rec.externalId); }
  catch (e) { errorDetails.push({ sourceId: rec.externalId, reason: "target_delete", errorMessage: e.message }); }
}

// SAME comparison config as compare, or the stored hash won't match next run.
await fastn.diff.applySnapshots({ scope: SCOPE, entity: "products", comparison, upserts, deleteIds });

return { created: d.stats.created, updated: d.stats.updated, deleted: deleteIds.length,
         skipped: d.stats.unchanged, errors: errorDetails.length, errorDetails, reportId: d.reportId };
```

`d.unchanged` never reaches the target — that IS the "second run is cheaper" property, for free and with no per-record state write.

### THE FOOTGUN — `detectDeletes` defaults to TRUE

It means *"every id in the baseline that is not in THIS batch is gone from the source."* That is only true when `records` is the COMPLETE source set. On a partial batch with the default, the flow reports the customer's whole target as deleted and — if you act on `d.deleted` — wipes it. Set it deliberately, every time:

- **Delta / cursored run** (only records modified since the cursor) → `lifecycle: { detectDeletes: false }`. Deletes come from the source's own delete event, or from a periodic full-scan reconcile pass.
- **Single-record event flow** → `lifecycle: { detectDeletes: false }`. Always. One record in the batch would otherwise "delete" the entire baseline.
- **Paged full scan** → pass the SAME `runId` on every page with `detectDeletes: false`, pass that `runId` to `applySnapshots` as well, then call `fastn.diff.finishRun({ scope, entity, runId, apply: true })` exactly once after the LAST page — that is what surfaces cross-page deletes. **`applySnapshots` without the `runId` leaves newly-created snapshots unstamped, and `finishRun` then reports them as deleted.** Never call `finishRun` after a run that ended early (an error, a `maxPages` bound, a `limit` test) — the records it never reached look deleted.
- Only an unbounded full scan that completed inside ONE `compare` call may leave `detectDeletes` at its default.

### Volume: pick the tier before you pick the page size

Measured against the real engine and Postgres, and all three of these bite at scale:

- **The per-call cap is 10,000 records** (`DIFF_MAX_RECORDS_PER_CALL`), so 1M records is at least 100 `compare` calls.
- **`compare` reloads the WHOLE baseline on every call.** So a paged full scan is quadratic in the record count: 1M in 100 pages re-reads the baseline 100 times (~50M hash rows). Delta runs are unaffected — they only ever hold one small batch — but a **backfill** pays this in full. Fewer, larger pages are strictly better for a full scan; many tiny pages are the worst case.
- **The tier ceiling is a hard cap that `timeoutMs` cannot raise.** `instant` is capped at **30 s**, `standard` at 15 min, `long` at 48 h. Anything paging a large baseline is a `long`-tier workflow — declaring `timeoutMs: 21600000` on an instant flow does NOT buy you six hours, it still dies at 30 s.

**A volume test cannot run on a local stack.** `standard` and `long` user code executes in a Cloud Run job, so on docker-compose/CI those tiers cannot run at all, and `instant` — the only tier that works there — caps at 30 s. Validate correctness locally at a few tens of thousands of records; run the real volume test on a deployed environment.

**After resetting a baseline, VACUUM.** A large `DELETE` on `fastn_diff_snapshots` leaves that many dead tuples, and until they are reclaimed the next run's hash loads are dramatically slower (measured: a load page going from ~28 ms to ~5 s on a bloated table). Also size the database's cache for the snapshots table plus its indexes — once the table outgrows the buffer cache, every baseline reload starts paying disk.

### SCOPE is a shared baseline key, not a workflow id

The schedule flow and the event flow of one entity pair MUST pass the **same literal `scope` string** (and the same `entity`), or each keeps its own baseline and reports the other's writes as changes forever. Omitting `scope` defaults it to the executing workflow's id — which silently forks the baseline the moment there is more than one flow, so **always pass it explicitly**. Separate entity pairs and directions get separate `entity` values under a shared scope (or their own scope) so their external ids cannot collide.

**Adding an entity needs NO setup** — no table to create, no registration, no migration. The snapshot table is created lazily in the org's schema on first use and the baseline's identity is `(scope, entity, external_id)`, so a new `entity` string simply IS a new baseline. Two entities under one scope are fully isolated: colliding external ids do not interfere, and a full-scan delete sweep on one never touches the other. But `entity` carries no schema knowledge, so **`keyField` and `comparison.fields` must move with it** — leaving `fields` pointed at the previous entity's paths is a silent failure, since none of them exist on the new record and every record then hashes identically and reports `unchanged` forever. Prefer ONE scope per use case with an `entity` per collection (`scope: "acme-hubspot-cin7"`, `entity: "products"` / `"customers"`) over a scope per entity — the integration's baselines then live under one key you can inspect and clean up together. Omitting `entity` means `""`, which is its own namespace, not a wildcard.

### Compare only the fields you MAP

`mode: "PARTIAL"` with `fields` = the mapped source fields, plus `ignoreFields` for churn columns (`updatedAt`, `lastModified`, `*.timestamp`, sync metadata the source stamps on its own writes). Full-record mode re-syncs every record whenever the provider touches a field this integration does not even use — the classic "why is every run updating everything" bug. Add `normalization` (`trimStrings`, `caseInsensitive`, `normalizeDates`) so cosmetic differences do not register as changes.

### Reports and retention

Every `compare` / `finishRun` persists a run report (stats + per-record changed fields, capped) stamped with the execution id, so a scheduled run stays inspectable long after it ran: `fastn.diff.getReports({ scope, entity, limit })` from code, `GET /api/v1/workflows/diff-reports`, or the dashboard (**Activity → Sync Reports**, and the Sync Reports tab on a workflow). Return `d.reportId` from the flow so a run can be traced to its report. **Nothing auto-deletes.**

`fastn.diff.cleanup({ scope, entity, olderThanDays })` is the retention tool, and it is **sharper than it looks: it deletes run reports AND SNAPSHOTS older than the cutoff.** A snapshot's timestamp only advances when `applySnapshots` rewrites that record, so a record that has been stable for the whole window is exactly the one cleanup drops — and it then comes back as CREATED and gets rewritten to the target on the next run. So: pick `olderThanDays` longer than the longest plausible quiet period for a record (not "30 days" on a catalogue that changes yearly), scope the call to the `scope`/`entity` you mean, and never point it at a live baseline just to trim reports.

### Resetting a baseline

To force a full re-sync, delete the scope's snapshots — `fastn.diff.cleanup` with a fractional `olderThanDays` (it must be POSITIVE; `0` throws), or a `fastn.db` DELETE against `fastn_diff_snapshots` scoped to that `scope`/`entity` in the org schema. Expect the next run to report every record as CREATED — which is exactly why `created` still goes through the natural-key search (UPSERT ORDER above) instead of creating blindly. A per-org database switch has the same effect: nothing migrates, so the baseline starts empty on the new database.

## SYNC TOPOLOGY — schedule + event flow PER ENTITY (ongoing syncs)
For an ongoing sync, build TWO flows per entity pair and direction. They are SEPARATE workflows (the one-execution-shape rule), and BOTH read the same single `configId`:

- **Schedule flow (batch — completeness + reconcile).** A cursored paginate-everything loop bound with `bind_schedule_trigger`. It is the source of completeness AND the safety net that catches whatever the event flow missed (dropped webhook, provider downtime, rate-limited or pre-connection events). It handles BOTH full and delta from ONE shape, driven by the cursor — never an `if (full) {…} else {…}` branch:
  - **First run** — no saved cursor → unbounded scan = **FULL sync** (the backfill, folded in).
  - **Every run after** — cursor present → fetch only records changed since it (a `modifiedSince` / `updated_after` param, or the connector's delta token) = **DELTA sync**.
- **Event flow (single record — latency).** A single-record handler bound with `bind_app_event_trigger` on the entity's create/update (and delete) events. Near-real-time; a missed event is acceptable because the schedule flow reconciles it on its next run.

**CURSOR — never advance on a manual/test run.** The schedule flow advances the saved cursor (to the newest `updated_at` it processed) ONLY on a production run with empty `ctx.input`. When `ctx.input` carries explicit scope (`limit` / `maxPages` / `modifiedSince`) — i.e. you are running it by hand to test on a few records — use those bounds but **do NOT write the cursor back**. Otherwise a `{limit:2}` test makes the next scheduled run resume past thousands of un-synced records. (Same rule, full statement: CURSOR RULE above.)

**The schedule flow keeps the diff baseline; the event flow may share it.** The schedule flow needs one — it re-reads the whole set to find changes. The event flow does not: its trigger already names the changed record. Sharing the baseline (same literal `scope` and `entity`, applying the record it just wrote) is worth it for one reason — the reconcile then sees that write as already-applied and reports it `unchanged` instead of rewriting it. If you don't share it, the event flow simply writes the target and the next reconcile picks the record up as `updated` once. Both are correct; pick deliberately. Delete detection belongs to the schedule flow's FULL scan only: the event flow and every delta run pass `detectDeletes: false` (CHANGE DETECTION above). If the source has no delete event, the full scan (first run, or a periodic full reconcile you schedule less often than the delta) is the only thing that will ever notice a deletion — say so to the user rather than implying deletes propagate in real time.

**Per entity pair AND direction = one schedule flow + one event flow.** Multi-entity (e.g. Products AND Customers) → repeat the pair per entity. Two-way → a schedule+event pair per direction. Either way it stays **ONE config and ONE widget** for the whole use case.

**Split the backfill into its own `long`-tier workflow ONLY when the first full run won't fit one scheduled run's `timeoutMs`** (very large initial volume) — then let the schedule flow run delta-only. Otherwise the schedule flow's first run IS the backfill.

## EVENT-TRIGGERED WORKFLOWS
- The `payloadSchema` from `get_connector_events` **IS** `ctx.input`. Exactly. No wrapper. If the schema is an array, `ctx.input[0].field`; if an object, `ctx.input.field`. NEVER invent `ctx.input.data` / `.payload` / `.event` / `.body` — workflows that do pass every synthetic test and silently no-op in production.
- Bindings and code branches must be a **bijection**: every input shape the code handles has a bound trigger, and every bound trigger has a handler. Anything else is dead code or silently dropped events.
- `bind_app_event_trigger` results can carry `manualRegistrationRequired: true` — the provider was NOT auto-subscribed; the user must register `data.webhookUrl` in the provider's webhook settings or events never arrive. `get_connector_events` shows the `autoSubscription` flag per event up front. Not a failure — surface it to the user.
- **LIVE-TESTING an event flow — PRODUCE the trigger yourself, never wait for real traffic.** An event source only fires when an event arrives; the topic/queue is often empty, and a quiet connection is NOT proof it's listen-only. Generate the event:
  - **Message brokers** (Kafka / PubSub / SQS / MQTT / …): create a DEDICATED test consumer/subscription with a **catch-all (wildcard) rule** so your synthetic message is delivered regardless of routing, then **publish a synthetic event** via the connector's publish/produce action. Most broker connections can publish as well as consume — confirm with a probe instead of assuming listen-only.
  - **Webhook sources**: POST the provider's sample payload (or use its "send test event" feature) to the workflow's webhook URL.
  - The synthetic event MUST match the `payloadSchema` exactly (it IS `ctx.input` — see above). Assert the `pass` condition, then **clean up** the test consumer/subscription and any published messages (REAL-EXECUTION SAFETY below).

## REAL-EXECUTION SAFETY — `run_code`, `test_workflow`, and `execute_workflow` hit LIVE systems
They run LIVE by default — every connector call reads from or writes to the customer's real third-party accounts, and `execute_workflow` additionally counts against the org's execution quota. `run_code` and `test_workflow` accept `mockMode: true`, which serves every `fastn.connector.*` call from stored mock stubs instead — deterministic and side-effect-free (`execute_workflow` has no mock mode).

- **USE `mockMode: true`** to validate workflow LOGIC when there is no ACTIVE connection yet, when a test would write records you cannot clean up, or for fast deterministic iteration. `mockScenarios` (`{ "connectorSlug.actionSlug": "scenario substring" }`) forces specific cases like "not found" or "rate limited"; unlisted actions use the happy-path stub. A mock pass proves logic only — NOT that the live call works, so always do at least one live probe before shipping. Mock is blind to the real-API boundary: a field the target rejects, a dropped value, or a record actually landing (only a live run + target read-back catches those). And a mock run is not automatically green — if its return carries `errors > 0` or a `mock failed: Missing required input fields …` message, the code called an action with a bad/missing arg; that's a real bug to fix, not test noise (BUILD step 6).
- **NEVER run a batch workflow with empty input** — empty input means "production run, paginate everything" and can write hundreds of real records. Always pass the smallest bounds the workflow accepts, e.g. `{ "limit": 2, "maxPages": 1 }`.
- **The live/mock split is YOUR decision — never ask the user to choose live vs sandbox/mock.** Probe writes, write tests, and live runs all create/modify REAL records, and testing is **live by default, without asking**. Never surface "is this account sandbox or production?" or "live or mock?" as a question. Instead, always treat the connected account as production and minimize the blast radius yourself: keep live execution to the minimal happy-path anchors with the SMALLEST input (one record), run every other case in mock, and clean up what you write (below). Only an explicit user request for mock-only testing changes the default.
- **ASK THE USER** before any test that writes more than a couple of records to a live system, and before binding a schedule trigger that will start writing on a cadence.
- **CLEAN UP** everything a test wrote: delete the connector records it created, `fastn.state` keys it set, `fastn.db` rows it inserted. Verify with one final `run_code` that nothing remains. Leftover test state corrupts the next real run.
- **ORPHANS — track what you couldn't delete and report it at the END.** When a test record has no delete action or otherwise can't be removed, keep such writes to the bare minimum (one record; prefer a sandbox account to avoid them entirely — above), record each `{ connector, entity, id, why-undeletable }`, and **report them ALL in the final hand-off summary** (`references/build.md` Step 9) as leftover test data — e.g. *"While testing I created these records and couldn't delete them: …"*. Never leave the user unaware of test data sitting in their system. Don't do a LARGE un-cleanable end-to-end run — for an action with no delete, probe it in isolation with ONE minimal record rather than a full run.

## CODE UPDATES — full body, never a diff, and never done until the suite re-passes
`create_workflow` and `update_workflow` take the COMPLETE module — never truncate, never use placeholders like `// ...rest unchanged`. Verify every brace/bracket/paren is balanced before calling. For small fixes (typo, wrong field name, missing await) prefer `edit_workflow_code` — exact string replacement, far cheaper than re-sending the file.

**RE-TEST AFTER EVERY CHANGE — an update SAVES a change; it does not VALIDATE one.** ANY change to a saved workflow's code (`edit_workflow_code`, `update_workflow`, or a `create_workflow` slug upsert) — and any config/connector change a flow depends on — is unverified until the flow's attached test cases are re-run, no matter how small or "obviously safe" the edit looks. `update_workflow` preserves the attached `testCases` but never runs them, so `lastValidation` keeps pointing at the pre-edit version:
- **Re-run ALL of the flow's attached cases, not just the one the change was for.** A fix that makes its target case pass can silently break a neighboring one (a renamed field, a changed guard, a shifted return shape) — the full re-run is what catches the regression; eyeballing the diff does not. Two silent killers it catches: an edit that changed behavior a case asserts on (a converted read-only flow that still writes, a reworded error message), and old residue code fighting the new path (a leftover default-override clobbering a freshly-mapped field).
- **Mock cases always** (free, deterministic); **plus the affected live anchor** when the change touches a live-write path — smallest input, cleanup per REAL-EXECUTION SAFETY above.
- **Assert each case's exact `pass` condition on the returned value**, not just a 2xx — same bar as the original validation (BUILD ORDER step 6); live cases: read the target back.
- **Persist the re-run with `save_validation`** so the dashboard's validation panel reflects the code that's actually deployed, not a stale earlier pass.
- **Read the workflow back** (`get_workflow`) after the update call and confirm the intended change is actually in the saved code — "updated" claims made from the call alone have shipped description-only edits while the bug lived on.
- **Never hand off an edited workflow on "the edit looks right."** An untested edit is a shipped bug with a delay on it. (See THE SUITE IS A REGRESSION GATE in `references/test-cases.md`.)

## REFERENCE (misc)
- `get_workflow` accepts the workflow id (`wf_*`) only — resolve names/slugs via `list_workflows` first.
- `list_workflows` returns slim rows; `get_workflow` returns the full code.
- **SLUGS UPSERT:** `create_workflow` with an existing slug UPDATES (overwrites) that workflow instead of failing. ALWAYS `list_workflows` before creating. If a workflow related to THIS integration already exists (same slug, or one already handling this entity pair/direction), **STOP and ASK** the user whether to update it in place, build alongside under a new slug, or leave it untouched — never silently overwrite a pre-existing related flow. Default to a fresh, uniquely-slugged workflow. (Stated as a non-negotiable in `SKILL.md` and BUILD step 5 in `references/build.md`.)
- Run lifecycle: `test_workflow` = development smoke test (sandbox, synchronous). `execute_workflow` = real production run (quota-counted; standard/long return an executionId). `list_executions` / `get_execution` = inspect results, errors, and logs of real runs.
- **Field-name trust order:** real probe response → action `outputContract` → your own knowledge. Never guess.
- Connector creation/editing and connection management belong to the connector toolset (see the PREREQUISITES gate in `SKILL.md` and the **connector-builder** skill). If a needed connector, action, event, or connection is missing, build/connect it there first and then resume — never ship a workflow that silently works around the gap.