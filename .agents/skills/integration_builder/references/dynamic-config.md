# DYNAMIC CONFIG & ENV-CONFIG — the runtime configuration contract

> Read this alongside `references/build.md` (PHASE 3). It defines the two runtime configuration surfaces every build leans on: the **dynamic config** (the approved `configId` the widget edits and workflows read every run) and **env-configs** (static per-environment key/values). The build steps themselves live in `references/build.md`.

## ⭐ DYNAMIC CONFIG — the contract between the widget and the flow
This is the core idea that makes a fastn integration editable without redeploying code:

```
propose_configuration → reviewUrl → user approves → check_config_status → configId
                                   ↑                                                     │
                  workflow reads it at runtime via fastn.config.get(configId)           │
                                   └──────────  user edits in the widget / dashboard  ←─┘
```

- **ONE config holds the whole use case.** Every entity pair and both directions live in one approved config (the `entities[]` array — the shape the widget reads/writes). All flows read the SAME `configId`; the ONE widget (`references/build.md` step 8) binds to it. Never a config or widget per entity/flow.
- The approved mappings, filters, conditions, value-translations, and transform PARAMETERS (group-by key, thresholds, bucket labels, which source fields combine) ALL live in the approved config — **never** baked into workflow code as literals, and **never** read from `ctx.input`.
- Workflows fetch the config every run with `fastn.config.get(CONFIG_ID)` and apply it with `fastn.evaluator`. When the user changes a mapping or filter in the widget, the very next run picks it up — **no code change, no redeploy**.
- `ctx.input` controls **SCOPE only** (limit, maxPages, modifiedSince). The caller never configures mappings or business logic.
- **A REPLACED config is a repoint-everything event.** A new `propose_configuration` approval mints a **NEW `configId`** — it does not update the old one. The moment that happens, every flow still hardcoding the old id reads stale mappings while the widget edits the new config, and *none of the user's widget edits ever reach the target* — the classic "I changed the config but the sync ignores it" bug. On any config replacement: repoint EVERY flow of the use case to the new id, verify the widget's readback carries that `configId` (a widget without it is not linked, whatever the create call said), and re-run each flow's attached suite including a live case with target read-back (regression gate in `references/test-cases.md`).

### `get(configId)` vs `getByTemplate(templateId)` — which read for which path
- **Path A (single-tenant)** — the flow runs against the developer's own data and binds to one developer-owned config → `fastn.config.get(configId)`.
- **Path B (multi-tenant)** — the flow ships to customers, each of whom gets a per-customer **clone** of the template at configure time → `fastn.config.getByTemplate(templateId)`. This resolves the caller's clone at runtime (installation → its clone; else end-org → its clone; else the template in dev). Using `.get(configId)` in a multi-tenant flow makes **every customer read the partner's template instead of their own clone** — a silent cross-tenant bug. The agent authors the **template** only; the embed mints clones. Full model: `references/multi-tenancy.md` §10.

### How the config comes back in the flow
`fastn.config.get(configId)` returns the object EXACTLY as saved (nested `entities[]` shape). Read `config.entities`, with `config.directions` only as a legacy fallback (multi-tenant flows substitute `getByTemplate(templateId)` for the same shape):

```js
const config = await fastn.config.get(CONFIG_ID);
const flows = config.entities ?? config.directions ?? [];   // entities = canonical; directions = legacy
// each flow: { source:{connector,entity}, target:{connector,entity}, integrationScope,
//              mappings:[{ id, sourceField, sourceLabel, targetField, targetLabel, required, reason }],
//              conditions:[{ field, operator, value, reason }], actions:[...] }
const matching = config.matching ?? config.matchingStrategy; // matching = canonical

// Pick the flow THIS workflow handles by source/target entity (works for both shapes):
const dir = flows.find(d =>
  (d.source?.entity ?? d.sourceEntity) === SOURCE_ENTITY &&
  (d.target?.entity ?? d.targetEntity) === TARGET_ENTITY);

for (const record of sourceRecords) {
  if (!fastn.evaluator.evaluateConditions(record, dir.conditions).pass) { skipped++; continue; }
  const target = fastn.evaluator.applyMappings(record, dir.mappings);   // or your own mapping fn
  // ...write `target` to the destination
}
```

Single-system workflows that carry no editable business rules (a fixed notification, a parameterless job) have no `configId` — for those, the logic lives in the workflow code, and the widget binds by `workflowIds`/`connectorIds` instead (see `references/build.md` step 8). **A single-system automation whose logic names values a user would want to change — a category filter, a threshold, a warehouse/status/owner it selects — is NOT one of these:** it ran the scoped MAP and arrives at BUILD with a `configId`, and its rules must be read via `fastn.config.get(configId)`, never hardcoded. One connector is not a reason to hardcode a business rule. **Having no config does NOT skip the test-case GATE:** these flows still derive cases from their own logic and get them user-approved via `submit_test_cases` BEFORE `create_workflow` (BUILD ORDER step 4½ in `references/build.md`; `references/test-cases.md` → SINGLE-SYSTEM AUTOMATIONS). Author-and-self-validate is never allowed, config or none.

### EnrichSpec — cascading dependent fields and drill-down dropdowns

Config conditions and mapping fields can have an `enrich` spec that turns the value input into a live dropdown populated from a connector action. The full `EnrichSpec` shape:

```ts
interface EnrichSpec {
  action: string;       // connector action slug to call
  connector: string;    // connector slug
  valueKey: string;     // response field used as the option value
  labelKey: string;     // response field used as the display label
  params?: Record<string, unknown>;     // static params passed to the action
  paramDeps?: Record<string, string>;   // cascading dependencies (action param → sibling field key)
  autoPaginate?: boolean;               // opt-out only (default: true)
}
```

**`paramDeps`** maps action input parameter names (keys) to sibling field keys (values) whose current selected values supply them at render time. This enables cascading dropdowns where selecting a value in one field populates the options of dependent fields.

Example — GitHub org → repo → branch → path:
```json
{
  "conditions": [
    {
      "field": "organization",
      "operator": "equals",
      "value": "",
      "enrich": {
        "action": "listUserOrgs",
        "connector": "github",
        "valueKey": "login",
        "labelKey": "login"
      }
    },
    {
      "field": "repository",
      "operator": "equals",
      "value": "",
      "enrich": {
        "action": "listOrgRepos",
        "connector": "github",
        "valueKey": "name",
        "labelKey": "full_name",
        "paramDeps": { "org": "organization" }
      }
    },
    {
      "field": "branch",
      "operator": "equals",
      "value": "",
      "enrich": {
        "action": "listBranches",
        "connector": "github",
        "valueKey": "name",
        "labelKey": "name",
        "paramDeps": { "owner": "organization", "repo": "repository" }
      }
    },
    {
      "field": "path",
      "operator": "equals",
      "value": "",
      "enrich": {
        "action": "getContent",
        "connector": "github",
        "valueKey": "path",
        "labelKey": "name",
        "paramDeps": { "owner": "organization", "repo": "repository", "path": "path" }
      }
    }
  ]
}
```

**Self-referencing `paramDeps` (drill-down pattern):** A field can reference itself in `paramDeps` for drill-down navigation (e.g., directory browsing). In the example above, `path` has `"path": "path"` — the selected path value is passed back as the `path` param to `getContent` to load subdirectory contents. Self-references are skipped in dependency resolution — the field starts enabled (empty value = root), and each selection drills deeper. The UI adds a `/ (root)` option at the top of the dropdown when a self-referencing field has a value, allowing navigation back to root. Cascade-clearing also skips the field that just changed, preventing self-referencing fields from clearing themselves.

**`autoPaginate`** defaults to `true`. Every enrich dropdown call sends `per_page=100` and fetches successive pages until a page returns fewer than 100 items (capped at 20 pages / 2000 items). Set `autoPaginate: false` to disable (rarely needed).

**Rules for `paramDeps`:**
- Keys = the action's input parameter names (what the API expects)
- Values = sibling field keys in the same entity (condition field names or form field keys)
- Chains are supported: A → B → C (changing A clears B and C)
- Self-references are supported for drill-down: `{ "path": "path" }`
- Static `params` and `paramDeps` coexist — `paramDeps` values override matching keys at render time
- Omit `paramDeps` entirely when the lookup action has no dependencies
- `propose_configuration` auto-detects these from `inputContract.required` (see MAP phase)
- The UI disables dependent fields until all non-self-referencing deps have values
- Changing a parent field cascade-clears all downstream dependents (but not itself)

**Where `paramDeps` appears in the config JSON:**
- `entities[].conditions[].enrich.paramDeps` — filter value dropdowns
- `entities[].mappings[].enrich.source.paramDeps` / `.target.paramDeps` — mapping value dropdowns
- `enrichment.sourceFieldLookupParams` / `targetFieldLookupParams` — probe-derived dependency metadata

**Config persistence:** The `SyncConfigModal` save logic preserves `enrich` specs when saving conditions — dropdowns with `paramDeps` survive save/reload cycles.

**Reading config condition values from workflows:** Workflows can access user selections from config conditions:
```js
const config = await fastn.config.get(CONFIG_ID);
const entity = config.entities[0];
// Each condition has { field, operator, value } — value holds the user's selection
const org = entity.conditions.find(c => c.field === 'organization')?.value;
const repo = entity.conditions.find(c => c.field === 'repository')?.value;
```

**Helper functions** (in the dashboard codebase):
- `resolveEnrichParams(spec, formValues)` — substitutes `paramDeps` values from sibling fields
- `hasDepsResolved(spec, formValues, selfField?)` — checks all deps have values, skips selfField

## ⭐ ENV-CONFIG — static per-environment values workflows read and write at runtime

Static per-env key/value pairs (API base URLs, retry limits, feature flags, environment-specific endpoints, derived caches, etc.) live in the org's `env_configs` table, one row per `(env_slug, key)`. Workflow code reads them with `.get` and writes them with `.set`:

```js
// Read — resolves against ctx.env. Pass an env_slug as the second arg to read a specific env.
const apiBase = await fastn.envConfig.get("apiBaseUrl");

// Write / upsert — creates the row if missing, updates if present. Idempotent.
// Requires the executing JWT to carry the `workflows.update` role.
await fastn.envConfig.set("mappingSheet", mapping);
```

**Always `await`** both calls. A missing `await` silently passes a Promise downstream — the workflow then reads `"[object Promise]"` (on `.get`) or skips the write (on `.set`); the compiler won't catch it, only a `test_workflow` run with a real value will.

**Not a secret store.** Tokens, API keys, OAuth client secrets, and signing keys go in `fastn.secrets`, NOT env-configs. Env-configs are plain JSONB readable by every executing workflow.

**`fastn.config.get(configId)` vs `fastn.envConfig.get(key)` — keep them straight:**

| | `fastn.config.get(configId)` | `fastn.envConfig.get(key, env?)` |
|---|---|---|
| What it holds | Integration mappings, conditions, transforms (the widget output) | Per-env scalar/JSON values (URLs, limits, flags) |
| Rows per use case | ONE `configId` row | Many `(env_slug, key)` rows |
| Who edits it | The customer via the widget | The operator via the dashboard's Configurations tab |
| Used by | Sync flows from PHASE 2 | Any workflow that needs an env-scoped value |
