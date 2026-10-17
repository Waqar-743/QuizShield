# PHASE 1 — PLAN

> Read this when you are in the PLAN phase of a data-movement integration. Goal: turn a vague request ("sync HubSpot to Salesforce") into a confirmed, business-approved plan — WHAT entities move, WHICH direction, WHAT scope, and a technical design you decided yourself. No field-level mapping yet (that is PHASE 2 — MAP). No code (PHASE 3 — BUILD).
>
> **Work in this order: UNDERSTAND first, then RECOMMEND, then ASK only what's open.** Discover and understand the whole use case from what's actually available (entities, actions, events, what's missing), form a *recommended* plan with smart suggestions, and only then go to the user — confirming your recommendation and asking only the genuine open questions. Never ask from a blank slate.

Where a step says "both connectors," read it as "every connector in the flow": a three-connector integration discovers and analyzes all three (e.g. the source of record, the enrichment source, and the target).

## Step 1 — Discover connectors
`list_connectors` → find EVERY connector in the flow (2 or 3). Confirm you found them all. Note each connector's **scope** (`community` vs `custom`) — it changes how workflow code must call it in PHASE 3. If any connector is missing or has no ACTIVE connection, **STOP** and resolve it per the PREREQUISITES gate in `SKILL.md` before going further.

## Step 2 — Understand what's possible (analyze + feasibility, cheaply)
Build the full picture BEFORE recommending anything. On EVERY connector in the flow:
- **`analyze_entities`** → entity names, actions, keys, field **counts** (a summary, not field dumps). For a 3-connector flow, analyze all three. It takes only `connectorId` and can't be bounded, so for a large ERP read it selectively (names + counts) and **don't echo it back**.
- **Check feasibility** on the obvious entities with the cheap, no-record tools: `get_connector_methods` / `get_action_schema` (is there a CREATE on the write side? an update action — needed for two-way? a list action for pagination?) and `get_connector_events` (which create/update/delete events exist → trigger topology). **Real-time REQUIRES an event trigger:** when the use case is ongoing/real-time, confirm the source actually exposes the needed events; if it exposes **none**, real-time is impossible and the sync can only run as **schedule-only polling** — a **latency tradeoff to surface to the user in Step 4 (name the poll interval), NEVER a silent downgrade.** **Note what's MISSING up front** — a gap changes what you can recommend, or routes to the PREREQUISITES gate.
- **Optional recon read — prefer `run_code`:** when a real sample would sharpen a suggestion, do ONE bounded read, and **prefer `run_code` over `probe_connector`** — `run_code` can call the action AND apply light logic, so you return a **compact computed summary** (the distinct `status`/`type` values, a record count, whether the matching key is populated/unique) instead of raw rows. That's both more flexible and more token-light. Keep the underlying read bounded (`limit:1`/`$top:1` + field projection — the bounded-probe rule in `references/mapping.md` Step 2) and **never fan out**. Use `probe_connector` instead when you specifically want a reusable `probeId` for MAP's `propose_configuration` — full field discovery (and that `probeId`) is MAP's job, not PLAN's.

**Verify each candidate entity by its DATA, not its name.** An entity existing in the schema is NOT proof it holds usable records — confirm it actually has data (the recon read above) before you build the plan on it. Treat an **empty / zero-count result as a red flag to investigate, never as proof the data doesn't exist**:
- **Cross-check against business logic** — if records *must* exist by how the business works ("Invoiced" orders were shipped → packing slips exist *somewhere*; active customers → there are recent orders), an empty entity means you're looking in the wrong place, not that there's no data.
- **Search sibling / alternate entities before concluding** — the records often live under a differently-named entity, a sub-resource, a different status filter, or another connector entirely. Check those first.
- Only if it's still genuinely empty after that, surface it to the user — stating what you checked and where you looked, not just "it's empty."

**ALWAYS understand before asking** — you'll propose matched entity pairs and a recommended plan in the user's language; they only confirm.

## Step 3 — Form a recommended plan + smart suggestions
Cross-reference everything you discovered into a concrete **RECOMMENDED plan** the user can confirm or adjust — don't come to them empty-handed. Decide every technical choice yourself; surface only the business-affecting ones, each with a one-line reason:
- **Matched entity pairs** in the user's terms (Customers↔Contacts, Orders↔Deals).
- **Recommended direction / source of truth** — which system naturally owns each entity.
- **Recommended scope filters** drawn from real or structural fields (active-only, exclude test/demo, a date range).
- **Topology & keys you'll use** — trigger choice (event for latency + schedule for completeness) and the matching key (email / SKU / external_id).
- **Recommended tenancy (single- vs multi-tenant)** — inferred from the request's framing: *"sync MY X to MY Y" / internal* → **single-tenant (Path A)**; *"let MY CUSTOMERS sync THEIR accounts" / "embed" / "widget for my customers"* → **multi-tenant (Path B)**. **Default to single-tenant when unstated.** This becomes a confirm question in Step 4 (recommendation as the default). Full model: `references/multi-tenancy.md`.
- **Smart suggestions & opportunities** the user didn't ask for but that fit (an entity that naturally pairs, a safer conflict rule), plus **risks / gaps with the fix** (e.g. "B has no update action → two-way isn't possible yet; I'd add it, or go one-way").

This recommended plan is what you present next — so the questions become **confirm-or-adjust**, not fill-in-the-blank.

## Step 4 — Confirm the plan & ask ONLY the open questions — ONE message, business language only
Present the recommended plan, then ask — in a **SINGLE** message via the `AskUserQuestion` tool (up to 4 questions, structured options) — **ONLY** what you genuinely can't infer or that materially changes behavior, with **your recommendation as the default option**. If everything is confidently inferable, don't manufacture questions — present the plan for a single confirmation and move on. Never re-ask what they already stated, and never ask a technical question. **The `AskUserQuestion` tool caps at 4 questions per call** — when more than four candidates below are genuinely open, ask the most behavior-defining four and state your inferred default for the rest in the recap.

**Skip Q5 entirely for a tenant caller** (`whoami` → `actingAsTenant: true` — STEP 0 in `SKILL.md`): they are connecting their own accounts in their own workspace, so it is Path A and asking them about "your customers" is meaningless. For everyone else:

**One hard exception — tenancy (Q5) is ALWAYS asked, never inferred.** Unlike the others, it does NOT drop out when it "looks obvious": it always appears as an explicit question with your recommended path pre-selected as the default, and it always claims one of the four slots. A wrong silent tenancy guess ships the wrong manifest scope (and, on Path B, cross-tenant config bugs), so it's cheap to ask and costly to assume.

When a business answer IS genuinely open, it's one of these — ask the open ones (plus Q5, always):

1. **What to sync (entities)** — present matched pairs as options in the user's terms:
   - Customers / Contacts
   - Products / Items
   - Orders / Deals
   - Invoices
   - Something else
2. **Direction** — "Should data flow one way ([A] → [B]), the other way ([B] → [A]), or both ways? In other words: which system is the source of truth, or do people edit records in both?"
3. **Initial load vs ongoing** — "Do you want a one-time import of the existing records, an ongoing sync that keeps the systems in step from now on, or both (import history first, then keep them in sync)?"
4. **Scope** — "Should everything sync, or only a subset (e.g. only active customers, only orders from this year)?" Frame as business filters, never as field conditions.
5. **Who it's for (tenancy) — ALWAYS ask this, never infer it** (except a tenant caller, above)**.** "Is this for **your own accounts / internal use**, or a product your **customers** will use to connect **their own** accounts (embedded widget)?" Present your inferred path (Step 3) as the **pre-selected default option**, the other as the alternative — so the user one-clicks to accept or flips it. Ask it even when the framing seems obvious. Default the recommendation to **your own / single-tenant** when there's no "customers / embed / widget" signal. This sets **Path A vs Path B** (`references/multi-tenancy.md`) — Path B additionally flips per-customer connectors to `MULTI_TENANT`; the widget is built either way.

**If the source has no events and the user wants ongoing/real-time, TELL them in this same message** — state plainly that real-time isn't available for this connector and the sync will run as schedule-only polling at the interval you recommend (e.g. every 15 min), so they can accept the latency or rethink the approach. Never let a real-time expectation silently become polling.

Wait for the answers before moving to PHASE 2.

## BUSINESS QUESTIONS ONLY — decide everything technical yourself
Ask only questions a business owner can answer. **Decide every technical choice yourself** (trigger *type*, polling vs webhooks, pagination, matching keys, type transforms, conflict rules) — never surface them as questions. **The lone exception: a schedule flow's cadence/run-time is a business input you ASK when you arm the schedule (BUILD step 7)** — how fresh the data must be, and the run time/timezone for a daily/weekly job. Translate the business answers into a concrete design:

| Business answer | Technical design |
|---|---|
| one-way | that system is the source of truth → **ONE** sync workflow |
| two-way | external-ID mapping both ways, latest-write-wins → **ONE workflow per direction** |
| initial load | folded into the schedule flow's first run (no cursor → full scan); a SEPARATE long-tier backfill only for very large catalogs |
| ongoing | per entity/direction: an **event flow** (latency) **PLUS** a **schedule flow** (completeness + reconcile) that does full-then-delta via a cursor, never advancing the cursor on manual/test runs |
| both | the schedule flow's first run loads history, then deltas — split a backfill out only for volume |
| own accounts / internal | **single-tenant (Path A)** → manifest stays all-`SAAS`, no `set_connector_scope`; still build the widget |
| customers / embed / widget | **multi-tenant (Path B)** → flip per-customer connectors to `MULTI_TENANT` (`set_connector_scope`), self-install test, then widget |

If a technical choice changes business behavior (e.g. the conflict rule when both sides edit), **state your decision in plain language** instead of asking.

## Output of PHASE 1 → hand off to MAP
End the phase with a short, plain-language recap the user confirms: the entities, direction, initial/ongoing/both, scope, **who it's for (single- vs multi-tenant)**, and the workflows you intend to build. That confirmation is the green light to start **PHASE 2 — MAP** (`references/mapping.md`), where you probe real fields and propose the mappings.
