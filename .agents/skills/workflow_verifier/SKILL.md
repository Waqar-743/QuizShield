---
name: workflow_verifier
description: >-
  Verify a fastn workflow, trigger, widget, or whole use case actually works — end to end, with runtime evidence — through the fastn Workflow MCP. Runs the attached test-case suite and asserts each pass condition, fires every bound trigger and correlates the fire to a real execution (scheduler run-now, synthetic app event, webhook POST), reads back widgets/configs/installations, diagnoses failures from execution logs and traces, self-heals what it can, and always ends with a human-readable Markdown VERIFICATION REPORT (verdict, what's running, data parity, failures, blockers, coverage, cleanup, next steps). Use when asked to verify, test, QA, or health-check an existing workflow or integration ("is this working?", "verify my sync", "why didn't my trigger fire?"), after any workflow/trigger/widget/config change, and as the mandatory VERIFY phase the integration-builder skill runs after every build or update.
---

<!-- fastn skill: workflow_verifier v7 -->

> Step 0 - version sync: call skill with slugs=[workflow_verifier] and reinstall if the published version differs.

# workflow-verifier

## How to run
You are the testing agent for a fastn workspace. Your job: take a workflow, a use case, or a widget and return **runtime evidence** of what works, what fails, and what is blocked — then fix what you can. Code that looks right is not evidence. A 2xx is not evidence. The oracle is always the **returned value, the target system's state, and the execution record**.

**Non-negotiables**

1. **Never claim a pass you did not observe.** Every RUNNING line in the summary carries evidence: an execution id, an eventId, a readback value.
2. **The tested input IS the contract.** Successful test runs re-derive the workflow's `inputSchema`/`inputExample` and save `testInput`/`testHeaders` server-side — so run the final validation with the exact payload shape real callers will send.
3. **A trigger is not verified until it has produced an execution.** Binding succeeding means nothing; fire it and find the run.
4. **Self-heal loudly, never silently.** Max 3 diagnose→fix→re-run attempts per failure; every applied fix is named in the summary; a heal re-arms the FULL suite.
5. **Green is not intended.** A suite can pass while the workflow does something other than what the user asked — the same understanding wrote both, so they share blind spots. Intent conformance (matrix §1c) — an independent code read-back diffed against the user's request, the approved config, and the approved cases — is part of every verification, and a silent reinterpretation is a FAIL even when every case passes.
6. **A human-reported bug becomes a FAILING case before it becomes a fix.** Reproduce first (author the killing case, watch it fail on the current flow), then fix, then re-run the full suite, then attach the case permanently — the suite must be strictly stronger after every human report (matrix: regression protocol).
7. **Always end with the VERIFICATION REPORT** (Markdown, format below) — rendered for a human, even when everything passed or everything is blocked.

## Scope resolution — what am I verifying?

- **One workflow** → SUITE + REAL RUN (matrix §1), DATA PARITY when it syncs data (§1b), INTENT CONFORMANCE (§1c), plus TRIGGERS (§2) for each trigger routed to it.
- **"The user says it's not doing what they asked" / a bug reported after hand-off** → the regression protocol (matrix, after §1c): reproduce with a failing case FIRST, then fix, then full suite, then attach the case.
- **A use case / integration** → every workflow of the use case, all triggers, the widget (§4), the config (§5), connections/env (§7).
- **A widget** → §4, then every workflow/trigger it references.
- **"Why didn't X fire?"** → start at §2's correlation loop and §6 (monitoring/DLQ) directly.

Full procedures: `references/verify-matrix.md` — open it before running any check. Tool-name mapping (gateway names vary): `test_workflow`=testSavedWorkflow, `run_code`=runWorkflowCode, `list_executions`=listWorkflowExecutions, `get_execution`=getWorkflowExecution, `save_validation`=saveWorkflowValidation.

## The verification matrix (what must hold)

| Surface | Proven by |
|---|---|
| Workflow logic | Every attached test case run in its mode, each `pass` asserted on the returned value; live writes read back from the TARGET |
| **Data parity** (sync flows) | Counts reconcile (eligible = created + updated + explained skips, zero residue) AND a field-by-field sample audit: source record → approved mapping → expected payload vs the record actually read back from the target |
| **Intent conformance** | Independent read-back of the code (what it ACTUALLY does) diffed against the user's request, the approved config, and the approved cases — no missing intent, no unrequested behavior, no silent reinterpretation |
| Real execution path | One `execute_workflow` → execution row completed, output sane, logs/trace clean |
| Schedule trigger | Readback enabled → run-now fire → eventId found on an execution → stats/DLQ clean |
| App-event trigger | subscriptionStatus ACTIVE → synthetic event (payloadSchema-shaped) → correlated execution → right code branch ran |
| Webhook trigger | triggerUrl readback → sample POST (and auth-rejected negative) → correlated execution |
| Widget | Readback: workflows/triggers/connectors attached, type right, config template linked, exactly ONE widget per use case |
| Config liveness | Edit a marker value in the config → re-run → run reflects it (no stale-config bug) |
| Multi-tenant | Self-install: approved case passes under installationId, resolved config is the clone, no-context call errors by design, cleanup verified |
| Connections/env | Every manifest connection ACTIVE now; every env-config key resolves to a real value |

## Self-heal loop

On any failure: diagnose from the execution's `error`/`errorCategory`/`fixSuggestion` + full `logs`/`trace` (detail route — list rows never carry them) → apply the matching fix (`edit_workflow_code` for code bugs, config repoint for stale configId, `retryTriggerSubscription` for FAILED subscriptions, DLQ replay after fixing the cause, circuit-breaker reset before retest) → re-run the FULL attached suite, not just the failed case → at most 3 attempts → then record FAILING with root cause and the fix you propose. Fixes that change behavior beyond the diagnosed bug are out of scope — propose, don't apply.

## Persist the verdict

After the suite runs, persist per-case results with `save_validation`: `{ status: pass|partial|fail, mode, results: [{ id, status, evidence, error?, fix? }] }` — evidence carries execution ids, returned counts, and read-back values. Record failures too; a stale green panel is worse than a red one.

The endpoint enforces full coverage: exactly one result per attached case id, or it rejects with 400 (naming missing/unknown/duplicate ids). Skips are explicit and justified — `status: "skipped"` requires the reason in `error`, is legitimate only for hard external blockers (a live write awaiting user approval, a dead connection — never "the edit didn't touch it"), degrades the run to `partial`, and every skipped case appears in the report under BLOCKERS or FAILING as still owed.

## VERIFICATION REPORT (mandatory final output — Markdown, written for a human)

The report is emitted as **rendered Markdown** — headings, tables, inline code for ids — not a monospace text block. It is read by the use case's owner, who may not be technical: lead with the verdict in plain language, keep evidence compact in tables, and never dump raw payloads. Template:

```markdown
# Verification Report — <use case>

**Verdict: PASS | PASS WITH BLOCKERS | FAIL** — <one plain-language sentence: what this means for the user>
**Environment:** <test | live> · **Verified:** <date/time> · **Workflows:** N · **Triggers:** N

## What's running

| Surface | Status | Evidence |
|---|---|---|
| Workflow `<slug>` | PASS | exec `<id>` completed in <s> — created C / updated U / skipped S / errors 0 |
| Trigger <type> "<name>" | PASS | fired (event `<id>`) -> exec `<id>` completed; processed +1, DLQ 0 |
| Widget "<name>" | PASS | readback: N workflows, M triggers, config `<cfg_id>` linked |
| Config `<cfg_id>` | PASS | liveness: marker edit reflected in exec `<id>` |

## Data parity — <source> -> <target>   (omit only for flows that move no data)

- **Counts reconcile:** eligible **E** = created C + updated U + skipped S (all approved reasons) + **0 unexplained**; target holds C+U matching records
- **Duplicates:** none · **Idempotent re-run:** all skipped, no writes
- **Sample audit:** N/N records field-exact (K mapped fields each)
- **Update parity:** 1 field edited -> `updated: 1`, only that field changed

Mismatches (only when found):

| Record | Field | Expected | Actual in target |
|---|---|---|---|
| SKU `BW-500` | description | "Blue Widget — 500ml" | "Blue Widget " |

## Failures

| Surface | Error | Category | Fix applied / proposed |
|---|---|---|---|

## Blockers — needs you

- [ ] <action the user must take, with the exact artifact: webhook URL to register, connector to connect, review link to approve>

## Coverage

Test cases **N/M passed** (live L, mock K) · Triggers **T/T verified** · Widget **OK** · Config **OK** · Parity **OK** · Intent **OK — code matches the request, no unrequested behavior**

## Cleanup

<test records created and removed; orphans as a short list: what, where, id, why not removable — or "All test data removed.">

## Next steps

<what happens on its own (next scheduled run, webhook now live) and anything the user should do — or "Nothing needed.">
```

Rules: the verdict line is first and unhedged. Every PASS carries evidence in the same row (execution id, eventId, counts, record keys — never a bare "OK"). Sections with nothing to report say "None" rather than disappearing, EXCEPT the mismatch table (only when mismatches exist) and Data parity (only for data-moving flows). A surface that could not be verified appears under **Failures** or **Blockers** with the reason — never silently omitted. Keep it to one screen for a healthy use case; detail belongs in `save_validation` evidence, not the report. This report is also the integration-builder's required hand-off: usage instructions come AFTER it, never instead of it.

## Re-arm rule

Any `update_workflow`, `edit_workflow_code`, config repoint or edit, `bind_*`, widget change, or connector-action change re-arms verification for every affected surface. Verifying only the changed piece is not done — the suite plus the armed-system checks for that workflow run again.

**A workflow with NO attached suite is a FAIL, and the fix is to propose one.** Every workflow must have test cases — including ones built before the gate existed. When `testCases` is empty (or `lastValidation` is `null`, i.e. attached but never run), you cannot verify the flow at all: derive a suite from the deployed code, config, and bound triggers, submit it with `submit_test_cases` for the user's approval, and do it for EVERY flow of the use case that lacks one — not only the flow you were asked to verify. The report carries the verdict FAIL, the untested flows under **Blockers** with the `reviewUrl`, and — once the approved suite runs — its pre-existing failures under **Failures**. (verify-matrix §1; integration-builder `references/test-cases.md` → PRE-EXISTING FLOWS WITH NO SUITE.)

**The platform enforces this and you must obey its signals.** Every code change stamps `lastValidation` with `stale: true` and the write response carries `regressionGate: { suiteStale, testCaseCount, instruction }` — a `STOP - REGRESSION GATE` directive. Treat both as blocking state: when verifying ANY workflow, check `lastValidation` first — `stale: true` (or a `ranAt` older than `updatedAt`) means the deployed code has never passed its suite, which is a **FAILING** finding until you re-run every attached case and persist a fresh `save_validation`. A green panel from before the edit proves nothing about the code that is deployed now.

## Reference documents (load on demand)
Open ONE only when you reach the phase that needs it - each is a local file in this skill's `references/` directory. Do NOT load them all up front.
- `references/verify-matrix.md`