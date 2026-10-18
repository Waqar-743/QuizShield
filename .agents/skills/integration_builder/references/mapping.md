# PHASE 2 — MAP  (the mapping sub-skill)

> Read this in the MAP phase. Goal: probe the REAL fields, author plain **1:1** mappings + suggested filter conditions + (for ongoing) a matching strategy, then call `propose_configuration` ONCE. It returns a **`reviewUrl`** where the user reviews / edits / approves in the browser; poll **`check_config_status`** until approved to get the **`configId`**. That `configId` is the dynamic contract PHASE 3's workflows read (`fastn.config.get`) and the widget binds to — editing it later needs no code change. **You do NOT build the review UI — the tool hosts it.**

Prerequisite: PHASE 1 — PLAN done (connectors discovered, entities analyzed, the user's entities / direction / scope confirmed).

**Two ways in.** A data-movement integration arrives here from PLAN and maps fields across systems — the full document below. A **single-system automation that carries business rules** (a category filter, a threshold, a warehouse/status it selects) arrives here without PLAN and uses the same tools on a smaller surface: one connector on both sides, one probe reused for source and target, the rule's filter as `conditions` and its chosen value as a fixed-value mapping, no `matchingStrategy`. See SCOPED MAP in the main SKILL.md. Everything below about probing, condition quality, dropdown-over-free-text, and the `reviewUrl` loop applies unchanged to both — the point in either case is that the user can retune the rule later without an engineer.

## What `propose_configuration` does for you — don't duplicate it
The tool auto-corrects misspelled field names against probed fields, drops hallucinated mappings, detects and auto-adds required target fields, generates default-value decisions for required-unmapped enum/lookup fields, builds the smart-action buttons, attaches type/lookup metadata, and enriches matching keys. So **focus on good semantic 1:1 mappings + sensible suggested conditions + matching keys** — leave the mechanics (and the UI) to the tool.

### Cascading field dependency auto-detection
`probe_connector` now detects cascading field dependencies automatically. At probe time, `detectFieldLookups()` inspects each lookup action's `inputContract.required` — if a required param name-matches another probed field, it stamps `optionsLookupParams` on the `ProbeField`. When `propose_configuration` is called, it emits `sourceFieldLookupParams` and `targetFieldLookupParams` in the enrichment block. These become `paramDeps` on the final config's `EnrichSpec` when the user accepts the proposal.

**Identify hierarchical resources** during planning and ensure the corresponding list actions have accurate `inputContract.required` declarations so auto-detection works:
- org → repo → branch (GitHub, GitLab)
- workspace → project → task (Asana, Monday, Jira)
- account → opportunity → contact (Salesforce, HubSpot)
- folder → file / subfolder (Google Drive, Dropbox, SharePoint)

For drill-down patterns (file browsers, folder trees), use self-referencing `paramDeps` — e.g. `{ "path": "path" }` where the field's own selected value feeds back as the parameter for the next lookup, enabling progressive directory navigation.

If the auto-detection misses a dependency (because `inputContract.required` is incomplete), fix it at the connector level — update the action's `inputContract.required` array via `update_action` so future probes pick it up automatically.

## Step 1 — Inspect entities
`get_connector_methods` on each connector, then `get_action_schema` on the key actions — especially the target's **CREATE** action (its input contract defines the required + writable fields).

## Step 2 — Probe real data (capture probeId + connector slug + action slug per side)
**Bound every probe by default — never probe wide.** One record is enough for field discovery, and unbounded probes on big ERP/CRM entities overflow the token budget and dump to a file. In `probe_connector`'s `params`, ALWAYS pass the action's own narrowing params: the smallest page (`limit`/`$top`/`pageSize` = 1) AND, where the API supports it, a field projection (`$select`/`fields`/`select`) so the response carries a few fields, not the whole record. (When probing via `run_code`, these go **directly in the action's args object, never nested under `input`** — nesting silently drops them; see `references/sandbox.md`.) This is the default, not a recovery step. Prefer the **properties/metadata action** (below) over a list action precisely because it returns the compact field catalog instead of full record bodies.
1. **Priority 1 — a properties/metadata action** (slug contains `properties` / `fields` / `describe` / `schema`). Call `get_action_schema` on it FIRST to learn the real param name (`objectType` / `resourceName` / `module` / `sObjectType` …) — don't hardcode `objectType`. These return ALL fields, not just those in a sample record.
2. **Priority 2 — the entity's own list/get action**, matched to the entity (`listCustomer` for customers, not another entity's list).
3. **Nested arrays with standalone actions** (e.g. Addresses, Contacts) — probe them too and fold in with `merge_probes`.
- **Target side:** probe in the context of its **CREATE** action.
- **Community connectors** (`scope === "community"`): probe via `run_code` with `new Fastn({ connectors: { alias: { orgId: "managed" } } })` (see `references/sandbox.md`).

**RECORD for each side** the `probeId` AND the `connectorSlug` + `actionSlug` you probed — `propose_configuration` needs all three (Step 6). Tell the user in one line how many fields were found; surface probe failures.

## Step 3 — Author the mappings (plain 1:1 only)
Quality rules — these are what make the proposal correct:
- **Match by semantic meaning, not field name** (Email → `Contacts.Email` if that's the real target field, not `Email` → `Email`).
- **Never map a parent/container/array field** (Addresses, Contacts, Properties, Tags) — always the **leaf** inside it.
- **Field-path notation for nested fields**, with the **root** entity as `sourceEntity` / `targetEntity`:
  - top-level → `targetField: "Name"`, `targetLabel: "Name"`
  - nested → `targetField: "Contacts.Email"`, `targetLabel: "Contacts Email"`; `targetField: "Addresses.Line1"`
  - `targetEntity: "Cin7 Customer"` — never `"Cin7 Customer Contact"` or a path.
- **1:1 only** — never one source → several targets, never several sources → one target. If a source could feed two, pick the single best and leave the other unmapped (the user splits/transforms at `reviewUrl`).
- **Omit fields with no good match** — UNLESS the target field is a **required scalar leaf**, then include it with `confidence: "low"` and a reason like `"Required field — needs mapping"`. **Exception — a required target that is an array/object built by a reshape** (many source rows → one array/object, e.g. line-items → a `products` array): do NOT emit a mapping for it, not even at `confidence: "low"`. `propose_configuration` can't express the reshape, and a placeholder mapping locks its review row and blocks approval. **Omit it from `mappings[]` and build it in workflow code (PHASE 3)**, noting it to the user in chat. The "include required-unmapped at low confidence" rule is for **scalar leaf fields only**.
- **Prefer the DROPDOWN over free text.** Whenever a field offers a constrained option set — an enum, a lookup/`enrich` dropdown, a picklist — the value must come from that option list (probed via `probe_connector_values` / the lookup action), never a typed literal; a hand-typed string that isn't a real option silently fails at write time. Applies to mapping values, condition values, and the handling you recommend for empty required fields.
- **Every mapping needs a clear `reason`** (shown to the user); `confidence` is `high | medium | low`.
- **Plain field pairs ONLY** — do NOT bake combine / fallback / split / conditional / fixed-value logic into the initial mappings. The user applies those at `reviewUrl` (there is no chat round-trip — the browser is where edits happen).

## Step 4 — Suggested filter conditions
Base every suggestion on **real values seen in the probed sample**, each with a `reason`:

| Field seen | Suggest |
|---|---|
| `status` / `state` / `active` | sync only where status = the active value seen |
| empty value in a target field | **optional** field → offer an empty-skip filter only if the user wants it; **required** field → do NOT auto-skip, surface the skip-vs-fill choice (see *Empty required fields* below) |
| `test` / `sandbox` / `demo` | exclude test/demo records |
| `is_deleted` / `archived` | exclude deleted/archived |
| date (`created_at` / `updated_at`) | optional date-range filter |
| `type` / `category` with few values | let the user pick which to include |

Consolidate multiple values on ONE field with `in` / `not_in` — never separate `equals` rows for the same field (`status in "active,trial"`, not two rows).

## Empty required fields — never silently skip; surface the choice
A **required** target field that is empty on some source records is a data-quality decision, not something to drop silently. When the probed sample shows a required target field empty on a meaningful share of records, do NOT quietly propose a skip-filter that discards them — losing records without telling the user is the wrong default. Flag it and recommend a handling; the user applies the choice at `reviewUrl` (where fixed / combine / conditional / fallback live) or confirms in chat. Three handlings, each with its trade-off:

- **Skip the record** — the safe default when the field must hold a *real, valid / deliverable* value (an email that receives mail, a code the target validates, a unique key). A fake value would bounce, fail validation, or collide on a unique constraint. Recommend when correctness beats completeness.
- **Derive a placeholder** — synthesize the value from other probed fields via a `conditional` + `combine` / `fallback` (e.g. *if the required field is empty → build it from a name/id field plus a constant suffix*). Recommend when the target only needs a *syntactically valid, unique* value rather than a real one — it keeps the record instead of dropping it. **The derived value MUST be deterministic and probe-grounded — this data is what the live sync runs on:**
  - **Deterministic per record** — the same source record must produce the SAME derived value on every run. Build it only from stable source fields (a record id, a code, a name) — NEVER from anything random, run-scoped, or time-based. A value that changes between runs breaks natural-key matching: the next run can't recognize the record it already synced and creates a duplicate.
  - **Grounded in probed data from BOTH sides** — pick source fields you actually saw populated in the probe (verify the fields the recipe uses are non-empty on the affected records), and shape the value to match the format real target records carry (probe a target sample if needed — length limits, allowed characters, email/code pattern). Never invent field names or formats.
  - **Safe as a matching value** — if the derived field is (or feeds) a natural key / dedup key, the recipe must be collision-free across records (include a unique id component, not just a name). State in your recommendation whether the derived value participates in matching.
- **Fixed default** — one constant fallback. Recommend only when a single shared value is acceptable (rare for unique fields).

**Rules:** keep the initial mappings plain 1:1 — don't bake the transform in (the user applies it at `reviewUrl`) — but you MUST (a) name every empty-required target field in the message that accompanies the `reviewUrl`, (b) state your recommended handling and why, and (c) never default to a silent skip. This applies to **required** targets only; an empty **optional** field is fine to leave unmapped. The chosen policy rides in the saved config (as a transform/default or a condition), so the running workflow applies it every run with no code change.

## Step 5 — Matching strategy (ongoing syncs only)
For `ongoing` / `initial_plus_ongoing`, pass `matchingStrategy` with `sourceProbeId` / `targetProbeId` and one `entityPairs` entry per pair:
- `primaryKey { field, label }` — usually `id`.
- `naturalKeys[]` — dedup keys (email, code, SKU) as `{ field, label, uniqueness, searchAction? }`.
- `recommendedStrategy` (`state_mapping` | `natural_key`), optionally `recommendedKey` / `recommendedTargetKey`.
- `targetPrimaryKey` / `targetNaturalKeys` if the target's keys differ.

**Always provide at least one `naturalKey` with a `searchAction` — even when `recommendedStrategy` is `state_mapping`.** The strategy only decides whether the runtime *trusts the id-map first*; the natural key is still required as the **first-create existence guard**, so a record already present in the target (empty or reset state, or a non-empty initial load) is UPDATED, not duplicated. Without it, a `state_mapping` sync with no cached mapping creates a duplicate. (Full decision order: **UPSERT ORDER** in `references/workflow-patterns.md`.) Omit the natural key only when the target genuinely has none — then dedup is best-effort and you must tell the user.

One-time imports don't need a matching strategy.

## Step 6 — Call `propose_configuration` → review → approve → `configId`
Call it **ONCE**, with ALL directions bundled in `directions` (bidirectional = two entries; multi-entity = one per pair). ONE config for the whole use case, never one per entity. For EACH direction you MUST pass:
- **`sourceProbeId` + `targetProbeId`** (from Step 2) — without them the field lists, condition options, and matching keys come back empty.
- **`sourceConnectorSlug` + `sourceActionSlug`** — the list/properties action you probed; drives source enrichment metadata.
- **`targetConnectorSlug` + `targetActionSlug`** — `targetActionSlug` MUST be the target's **CREATE** action; the tool reads its input contract to detect required fields. Wrong/missing slug → required fields not detected.
- **`integrationScope`** — EXACTLY `"<Source> <Entity> -> <Target> <Entity>"` with **singular** entity nouns and nothing else (e.g. `"Shopify Order -> ShipBob Order"`). The platform derives each side's entity slug from the **last word** of each half, so any trailing qualifier poisons it: **no** sync/cardinality parentheticals (`(ongoing, one-way)`), quantifiers (`All`), plurals (`Orders`), or prose. `"All Shopify orders -> ShipBob orders (ongoing, one-way)"` parses the target entity as `"one-way)"` and saves a corrupt config. Sync mode lives in `matchingStrategy` / `settings`, never in this string.
- **`mappings`** (Step 3).
- **`conditions`**: `{ sourceConnector, sourceEntity, targetConnector, targetEntity, suggestedConditions }` (Step 4).
- **`matchingStrategy`** (Step 5) — ongoing syncs only.
- **Do NOT pass `configurationDecisions`** — omit the field. The tool derives required-field default decisions from the target CREATE contract itself (that's why `targetProbeId` + the CREATE `targetActionSlug` are mandatory above). Hand-authored decisions duplicate that work, and any you write for something that isn't a writable body leaf on the target entity — a header like `channelId`, a query param — is silently dropped. Your payload is `mappings` + `conditions` + `matchingStrategy` only.

`propose_configuration` returns a **`reviewUrl`** — **share it with the user.** They review and edit there (fixed values, combine, conditional, AI, value mappings, custom properties, filters) and approve **in the browser**; there is no chat/agent edit round-trip. **Poll `check_config_status` until approved**, then use the returned **`configId`**. NEVER fabricate a `configId`.

That `configId` is the dynamic contract for the whole use case: PHASE 3's workflows read its mappings via `fastn.config.get(configId)` and the ONE widget binds to it. With it in hand, go to the **test-case gate** (`references/test-cases.md`) — get sign-off on the acceptance test cases, THEN build.

**Template vs clone (multi-tenant / Path B):** the `configId` you approve here is the **template** — the developer's default mapping. When this ships in a widget, the embed mints a per-customer **clone** the first time each customer configures, so the template is never edited in place. **You author the template only — never a clone.** That's why a multi-tenant flow's code reads `fastn.config.getByTemplate(templateId)` (resolves the caller's clone) rather than `fastn.config.get(configId)` (always the template). Single-tenant Path A flows use `.get(configId)` directly. Full model: `references/multi-tenancy.md` §10.

## What the review page (`reviewUrl`) lets the user do — so you propose well
You don't build this UI, but knowing it helps you keep the initial proposal plain (the user refines here):
- Per mapping, a **"Change"** control offers: **Set a fixed value**, **Combine fields** (2+ fields + separator), **Conditional value** (if-then-else), **Select an enum option**, pick from source/target fields, or **Use AI:** a free-text transform. Enum↔enum shows a value-mapping table.
- **Required fields** are locked and sorted to the top (auto-detected from the CREATE action's `inputContract.required[]`).
- **"+ Create custom property"** lets the user add a new target field when none fits (the target connector must support it; ensure it exists at BUILD — see `references/build.md`).
- A **Filter Source Records** panel with type-aware operators and a sample-data toggle; conditions are AND-combined.

## Reshapes / aggregations (many rows → few fields)
`propose_configuration` is 1:1 field mappings only — it cannot express an aggregation (e.g. thousands of stock rows → a per-product "in stock / low / out" field). Handle those in workflow code (PHASE 3); discuss the rule (group-by key, thresholds, buckets) with the user in plain language, and keep its parameters in the config where possible so they stay editable without a code change.

**NEVER represent the reshaped/aggregated field as a mapping with `sourceField: ""`** (or any placeholder source) to force it into the proposal — an empty-source mapping **locks that review row and blocks approval of the whole config**. Leave the reshaped field OUT of `mappings[]` entirely; it never appears in the proposal. Instead, **note it to the user in chat** — what you'll build in workflow code and the rule's parameters (group-by key, thresholds, buckets).

## MAPPING RULES (checklist)
- NEVER propose before probing. Per direction pass `sourceProbeId` / `targetProbeId` + `sourceConnectorSlug` / `sourceActionSlug` + `targetConnectorSlug` / `targetActionSlug` (target = its **CREATE** action).
- **`integrationScope` = `"<Source> <Entity> -> <Target> <Entity>"`** — singular entity nouns, no qualifiers / plurals / parentheticals. The platform parses the entity slug from the last word; extra words corrupt the saved config (`(ongoing, one-way)` → entity `"one-way)"`).
- **Never hand-author `configurationDecisions`** — the tool generates them from the target CREATE contract; send `mappings` + `conditions` + `matchingStrategy` only.
- Semantic 1:1 mappings only — leaf fields in field-path notation, root entity names, every mapping with a `reason` + `confidence`.
- Required **scalar leaf** target with no match → include at `confidence: "low"`, never silently drop.
- **Array/reshape target fields are NEVER in `mappings[]`** (e.g. line-items → a `products` array, aggregations, many-rows-into-one) — no low-confidence placeholder, no `sourceField: ""`. Omit them and build the reshape in workflow code (see **Reshapes / aggregations** above).
- **Empty required target field at source → never silently skip.** Surface the skip-vs-derive-placeholder-vs-fixed-default choice with a recommendation (see **Empty required fields** above); flag it in the `reviewUrl` message. Empty optional fields may be left unmapped.
- **Enum / lookup / picklist field → take the value from its DROPDOWN options, never free text.**
- NO transforms baked into the initial mappings — the user adds combine/conditional/fixed/AI at `reviewUrl`.
- Suggested conditions from REAL probed sample values; consolidate one field with `in` / `not_in`.
- `matchingStrategy` for ongoing syncs only.
- ONE `propose_configuration` call for the whole use case (all directions) → ONE `configId`. Never a config per entity or direction.
- Share `reviewUrl`, poll `check_config_status`, use the returned `configId`. NEVER fabricate it. **Do NOT hand-build a mapping UI — the tool hosts it.**
- Properties/metadata action FIRST, then list fallback; `merge_probes` for nested arrays; probe the target via its CREATE action.

Output of PHASE 2 → an approved `configId`. Proceed to the **test-case gate** (`references/test-cases.md`), then **PHASE 3 — BUILD** (`references/build.md`).
