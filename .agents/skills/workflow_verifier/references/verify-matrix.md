# VERIFY MATRIX — per-surface procedures

> Every procedure ends in an assertion on observed state. Tool availability varies by gateway rollout: each correlation step names the deterministic path (server-side filter / dedicated tool) and a fallback that works on every deployment. When a named tool is missing from your gateway, use the fallback — never skip the check.

## The correlation primitive (used by every trigger check)

The event pipeline stamps `x-fastn-trigger-id` and `x-fastn-event-id` on every dispatch, and both survive into the execution row's `requestHeaders`.

1. **Fire** the trigger (per-type below) and capture the `eventId` when the fire returns one.
2. **Find the execution** — deterministic: `list_executions { eventId }` (or `{ triggerId }`). Fallback where those filters aren't live yet: `list_executions { workflowId, dateFrom: <fire time - 1min> }` and match `requestHeaders["x-fastn-event-id"]` client-side; page deeper if busy.
3. **Assert** the row: `status === "completed"`, output sane for the payload sent. Poll up to ~30s — dispatch is async (BullMQ).
4. **No row?** The delivery died before the workflow: check the trigger's monitoring (per-route stats, DLQ entries, circuit-breaker state — `getTriggerMonitoring` or the dashboard's trigger monitoring). A DLQ entry's `error` is the diagnosis; fix the cause, then replay the entry and re-correlate.
5. **Diagnose a failed row** via the execution DETAIL (`get_execution`) — the only surface with full `logs` + `trace`; list rows carry `hasTrace` only.

## 1. Workflow logic — the suite is the oracle

0. **Staleness check first.** `get_workflow` → `lastValidation`: `stale: true`, or a `ranAt` older than the workflow's `updatedAt`, means the deployed code has never passed its suite — a FAILING finding on its own. The platform stamps this on every code change/config repoint (and the write response carried a `STOP - REGRESSION GATE` instruction); only a fresh `save_validation` after a full re-run clears it.
1. `get_workflow` → the attached `testCases`. They are REQUIRED: **a workflow with no suite fails verification outright** — there is nothing to verify against, and "it has been running" is not evidence. This includes flows built before the gate existed and flows whose cases were attached but never run (`lastValidation: null`). **Do not stop at reporting the gap — PROPOSE the suite.** Derive the cases from what is DEPLOYED (code branches/filters/thresholds, the saved config's mappings + conditions, the bound triggers' `payloadSchema`/schedule, the connector actions called), run the integration-builder generator over it (per-flow scenario matrix + data-parity/config-liveness/trigger-fire + CASE POWER kill matrix + an executable fixture per case), and `submit_test_cases` → share the `reviewUrl` → attach the APPROVED set via `update_workflow`. Do this for **every** flow of the use case that lacks a suite, not only the one you were asked to verify; list the untested flows and the proposed set under **Blockers** in the report. Expect the first run to go red — those are pre-existing bugs you surfaced, and they belong in **Failures** with evidence, never trimmed away.
2. Run EVERY case in its `mode`: `test_workflow { id, input: case.input, headers: case.headers, mockMode: case.mode === "mock", mockScenarios: case.mockScenarios }`. Cases without executable fixtures (`input`/`headers`): derive the payload from the scenario prose once, then write it back onto the case so the next run is deterministic.
3. Assert each case's exact `pass` condition on the returned value. `errors > 0`, `created+updated === 0` against a non-empty source, or mostly-skipped records = FAIL even on a 200. A mock run with `mock failed: Missing required input fields` is a real bug the mock caught.
4. **Live cases assert the TARGET**: read the written record back by id/natural key and check the mapped fields — never trust the run summary.
5. **Real execution path** (the sandbox is not production): `execute_workflow { id, input: <happy-path fixture> }` → 202 `executionId` → poll `list_executions { workflowId }` for that id → completed; inspect detail logs/trace for warnings. This also exercises quota, dispatch, and tier behavior the test panel skips.
6. Persist all results with `save_validation` (evidence: execution ids, counts, read-back values).

Cleanup: delete records your live cases created where a delete action exists; anything undeletable goes in the summary's CLEANUP line with connector + entity + id.

## 1b. DATA PARITY (sync flows) — prove the SAME data landed in the other system

Counts prove the sync RAN; parity proves it moved the RIGHT data. A run can report `created: 25, errors: 0` while every product landed with a truncated name, a price coerced to 0, or an enum silently passed through that the target defaulted — the run summary is the workflow's own claim, so parity is always measured **against the two systems directly**, through the same connectors the workflow uses. Worked example throughout: **HubSpot products → Cin7 products**, matched on SKU.

### 1b.1 Count reconciliation — nothing unexplained

1. **Eligible set** — via `run_code`, list the SOURCE with the exact approved filters from the config (`fastn.config.get(configId)` → that flow's `conditions`), fully paginated: e.g. every HubSpot product passing the approved category filter → `E` records with their match keys (SKUs).
2. **Run accounting** — from the run's returned counts: `E === created + updated + skipped + errors`, with `errors === 0` and every `skipped` carrying an APPROVED reason (a config condition), never a coping skip. Any residue (`E` minus the accounted total) is a defect — records the sync never even considered (pagination bug, filter mismatch, cursor skipping).
3. **Target-side count** — count the target records carrying the sync's match keys (e.g. Cin7 products whose SKU is in the eligible set): must equal `created + updated` (pre-existing matches included). Fewer = writes that claimed success but didn't land; more = duplicates (see 1b.3).
4. **Corroborate with the diff report** — only when the flow actually uses `fastn.diff` (a batch sync / reconcile / backfill; an event-driven or single-system flow legitimately has none, and its absence is not a finding): `list_diff_reports { workflow_id }` (or `fastn.diff.getReports({ scope, entity, limit })` from `run_code`). The newest report's created/updated/deleted/unchanged stats must agree with the run's counts; disagreement means the run summary and the diff engine saw different data. **`deleted` on a delta or event run is a red flag, not a statistic** — it means `detectDeletes` was left at its default against a partial batch, and the flow is one `applySnapshots`/target-delete away from wiping the customer's target (CHANGE DETECTION in the integration-builder's `references/workflow-patterns.md`). A first run legitimately reports everything as `created`, including records already present in the target — confirm the natural-key search still resolved them to updates rather than duplicates (1b.3).

### 1b.2 Field-by-field sample audit — same values, not just same records

Pick a **deliberate sample** (not random-only): ~5-10 records covering the risky shapes — longest name, special characters/unicode, empty optional fields, price 0 and price with >2 decimals, every branch of each value-mapping/transform, one record per approved-condition boundary. For each sampled record, in ONE `run_code`:

1. Read the SOURCE record (`fastn.connector.hubspot.getProduct` / search by SKU).
2. Compute the EXPECTED target payload by applying the approved mapping exactly as the workflow does — `fastn.config.get(configId)` → `fastn.evaluator.applyMappings(record, dir.mappings)` (or the flow's own mapping fn, copied verbatim).
3. Read the TARGET record back (`fastn.connector.cin7.getProduct` by the match key, or by the `id_map` entry).
4. Diff expected vs actual **per mapped field**, with the target's normalizations applied knowingly (trim, number formatting, date format, enum translations from the config's value-mappings) — a difference you cannot attribute to a documented normalization is a FAIL naming the field, expected, and actual.

```js
// parity audit skeleton (run_code)
const config = await fastn.config.get(CONFIG_ID);
const dir = (config.entities ?? config.directions ?? []).find(d =>
  (d.source?.entity ?? d.sourceEntity) === "product");
const report = [];
for (const sku of SAMPLE_SKUS) {
  const src = await fastn.connector.hubspot.searchProducts({ sku });   // 1. source
  const expected = fastn.evaluator.applyMappings(src.results[0], dir.mappings); // 2. expected
  const tgt = await fastn.connector.cin7.getProductBySku({ sku });     // 3. target
  const diffs = Object.entries(expected)
    .filter(([k, v]) => String(tgt[k] ?? "") !== String(v ?? ""))
    .map(([k, v]) => ({ field: k, expected: v, actual: tgt[k] ?? null }));
  report.push({ sku, fields: Object.keys(expected).length, mismatches: diffs });
}
return { audited: report.length, clean: report.filter(r => !r.mismatches.length).length, report };
```

The audit result goes in the report's **Data parity** section verbatim (`sample 8/8 field-exact` or the mismatch table) and into `save_validation` evidence.

### 1b.3 Identity, duplicates, idempotency

- **No duplicates**: for each sampled key, searching the target by match key returns EXACTLY ONE record (two Cin7 products with the same SKU = the matching step is broken even though every run "succeeded").
- **Idempotent re-run**: immediately re-run the flow unchanged → the sampled records report `skipped` (for a `fastn.diff` flow: `stats.unchanged` equals the batch size and `created + updated === 0`), target `modifiedAt` untouched, and the target count from 1b.1 does not grow. A second run that re-writes everything means the diff baseline is not advancing — `applySnapshots` was never called, was called without the records that synced, or the two flows of the pair are using different `scope` strings.

### 1b.4 Update parity — changes propagate, exactly

Edit ONE field on ONE source record (e.g. bump a HubSpot product price) → run the delta → assert: run reports `updated: 1` (not created), the target record shows the new value on that field AND unchanged values on every other mapped field (an update that rewrites the whole record from a stale read shows up here), and the run's `fastn.diff` report records exactly that field change and nothing else — `stats.updated === 1`, and the report's `changedFields` for that record names ONLY the edited path with the right `oldValue`/`newValue` (read it back with `fastn.diff.getReports({ scope, entity, limit: 1 })`, the `GET /api/v1/workflows/diff-reports` endpoint, or Activity → Sync Reports). Extra changed fields on an untouched record mean the comparison includes churn columns the integration does not map — narrow `comparison.fields` / `ignoreFields`. Revert the edit afterward (or use a `fastn-probe-test` record) and note it under CLEANUP.

Parity failures route to the standard self-heal loop, with the usual suspects in order: a mapping/transform bug (fix the config or code, not the record), a silently-forwarded unmapped enum value the provider defaulted, a bodyTemplate/wrapper issue, or a matching-key collision.

## 1c. INTENT CONFORMANCE — was it built as INTENDED, not just built green?

The costliest bugs are not crashes: they are workflows that run green while doing something other than what the user asked — the class a human catches days after hand-off. The mechanism is self-confirmation: the same understanding wrote the code AND the cases, so both share the blind spot and pass together. Break it with an independent read-back:

1. **Fresh read.** `get_workflow` and read the CODE as a reviewer who has never seen this build. Write down what it ACTUALLY does — not what it was supposed to do: the trigger(s) and cadence, the source and the filters actually applied (which property, which operator), the fields actually written and where each value comes from, the direction(s), the match key, skip/error behavior, every config/env key read, every connector action called.
2. **Diff against the three intent artifacts:** the user's request in their own words, the approved config, and the approved test cases. Three failure shapes, all real:
   - **Intent without behavior** — an asked-for filter, field, direction, or edge rule that the code never implements → FAIL.
   - **Behavior without intent** — writes, directions, side effects, or hardcoded values nobody asked for (a hardcoded threshold that belongs in the config, an extra status update, a delete path) → FAIL.
   - **Silent reinterpretation** — the user said "products in category X" and the code filters on `product_type`; the user said "sync changes" and the code full-scans and rewrites everything → FAIL when the config settles it, a QUESTION to the user when the request was genuinely ambiguous. Never ship a reinterpretation silently.
3. **Bijection checks:** every behavior on the list has a test case and every case maps to a behavior (an unkillable case is decoration); for event flows, every bound event has a handler branch and vice versa (§3.4).
4. Divergences with an unambiguous answer get fixed (then the FULL suite re-runs); ambiguous ones go to the user as a question with your recommendation — that pause is legitimate, shipping the guess is not.

### The FIRST REAL run is part of done

Synthetic verification proves the machinery; the first production run proves it against real data breadth (probe records are always cleaner than the live corpus — longer names, missing optionals, locale numbers, enum values nobody probed). For scheduled flows, the run-now fire already IS a real run over real data — run the §1b parity audit on exactly that run. For event flows whose first real event only the provider can send, the report's **Next steps** must name the watch explicitly: after the first real event, correlate it to its execution, re-run the sample audit on the record it carried, and check `get_widget_insights` — and the FAILING/dead-workflow signals there are the ongoing alarm for the runs nobody watched.

## When a human reports a bug after hand-off — the regression protocol

Every human-caught bug is proof the suite was underpowered. The fix is never just the fix:

1. **Reproduce FIRST.** Author the killing case (with its executable fixture), run it against the CURRENT flow, and watch it FAIL. A case that does not reproduce the report means you have not found the bug — do not "fix" anything yet; read the execution detail (logs/trace) for the run the human is describing and iterate on the case until it fails for their reason.
2. **Fix**, then re-run the FULL attached suite — the regression gate, not just the new case.
3. **Attach the killing case permanently** (`update_workflow` testCases) and persist the run with `save_validation`. The suite must be strictly stronger after every human report.
4. **Root-cause the miss:** which kill-matrix class (test-cases.md CASE POWER) was uncovered, or which intent divergence (§1c) was never diffed? File it with `capture_feedback` so case generation itself improves — the goal is that this bug CLASS, not just this bug, can never ship silently again.

## 2. Schedule trigger

1. Readback after bind: `get_scheduler` (fallback: `list_schedulers` and find it) — status ACTIVE, cron/rate + timezone exactly as the user approved, route points at the right workflow id.
2. Fire: `trigger_scheduler_now { id }` → 202 `{ eventId }`. No run-now tool on your gateway → BLOCKER line ("schedule bound and enabled, first fire unverified — verify after <next cadence>"), do NOT silently pass.
3. Correlate the eventId → execution (primitive above). Warn in the summary that run-now is a REAL run: cursors advance exactly as on a scheduled fire — that is the point, but say it.
4. Stats: the trigger's processed counter incremented, DLQ empty for this trigger.

## 3. App-event trigger

1. Readback after `bind_app_trigger`: `get_app_event_trigger` (fallback: `list_app_event_triggers`) — `subscriptionStatus`:
   - `ACTIVE` → proceed.
   - `FAILED`/`NONE` → `retry_trigger_subscription` once; still failed → FAILING with the subscription error.
   - `manualRegistrationRequired: true` on the bind result → BLOCKER with the exact `webhookUrl` the user must register in the provider; re-verify when they confirm.
2. Fire a synthetic event: `send_test_app_event { orgId, connectorId, payload, triggerId }` with a payload shaped EXACTLY like the event's `payloadSchema` — the schema IS `ctx.input`, no wrapper (`.data`/`.payload`/`.event` wrappers pass synthetic tests and silently no-op in production). Fallback without the tool: fire a real event from the provider or via the connector's own publish/create action.
   - Signature caveat: synthetic ingest is only accepted when the connector has no webhook secret configured. Secret set → use the provider/publish-action route; neither possible → BLOCKER.
3. Correlate → execution; assert the code branch for THIS event ran (check trace/logs for the branch's steps, not just completion).
4. **Bijection check**: every bound event has a handler branch and every handler branch has a bound event — list the trigger's events against the code's input shapes; orphans on either side are FAILING (dead code or silently dropped events).

## 4. Widget

1. `get_widget` readback and assert: `workflowIds` contains every flow of the use case; `triggerIds` matches the bound triggers; `connectorIds` correct (org-domain connector excluded); `type` is UNIFIED when unified refs were passed; `formSchema`/`configForm` persisted.
2. Config linkage: the widget's config template exists (`list_configs` scoped to the widget — the widget row itself does not carry configId) and its `configId` is the one every flow reads. "The create call said so" is not linkage — the readback is.
3. Exactly ONE widget for the use case: `list_widgets` and check no sibling covers the same flows.
4. Publish fan-out: assert the returned `sync.installationsTouched`/`endOrgsCovered` matches expectation (0 touched when customers exist and should have been bound = FAILING).
5. Per-tenant (when installations exist): `get_installation_triggers` — every widget trigger template has a live instance for the tenant; missing instances = FAILING.
6. Ongoing health (existing use cases): `get_widget_insights { range: "7d" }` — failedRuns and dead workflows (silent 30d) are findings, not background noise.

## 5. Config liveness (kills "I changed the config but the sync ignores it")

1. `get_config` → note a marker value (a mapping label, a filter threshold).
2. Edit the marker (or have the flow read it), `test_workflow` the flow, assert the run reflects the CURRENT config — a flow reading a stale/hardcoded configId fails here.
3. Multi-tenant: `get_installation_resolved_config { id }` → assert `mergedConfig` carries every key the code reads, and that the resolution is the tenant's CLONE (Path B flows must read `getByTemplate(templateId)`; a flow reading `.get(configId)` serves the partner's template to every customer — silent cross-tenant bug).
4. After any config REPLACEMENT (new configId minted): verify every flow repointed + widget readback carries the new id + full suite re-run. One flow left on the old id = FAILING.

## 6. When a fire produced no execution

Order of evidence: trigger monitoring (per-route stats: did dispatch even attempt?) → DLQ entries for the trigger (`error` field is the diagnosis; replay after fixing) → circuit breaker (open = deliveries paused; reset before retest) → org-wide pipeline monitoring (consumer running? queue depth?). An execution that exists but failed → §1 step 5 (detail logs/trace).

## 7. Connections and env-config (re-check at verify time, not just at build time)

1. Every connector in each workflow's manifest has an ACTIVE connection NOW (`list_connections` / `get_connector_connection_status`) — a build that ran partly in mock mode ships with this check or ships with a BLOCKER line.
2. Every `fastn.envConfig.get(key)` the code reads resolves to a real value in the runtime env (`list_env_configs`) — a missing key surfaces as `"[object Promise]"`-class silent bugs only a real run catches.

## 8. Multi-tenant self-install (Path B flows)

`create_installation { endOrgId: <your own org>, connections: {...} }` → run at least one APPROVED case via `test_workflow { installationId }` and assert its `pass` → `get_installation_resolved_config` proves clone resolution (§5.3) → negative: the flow with NO tenant context errors by design (a pass here means the manifest scope is wrong) → SAAS-scoped connectors bypassed the installation's connections map → `delete_installation`, then readback 404 confirms cleanup.
