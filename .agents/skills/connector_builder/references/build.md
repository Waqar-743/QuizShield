# Building actions

Author, wire, execute, reconcile, in that order. The schema you author is not the request on the wire:
read the execution's `requestUrl`, `requestHeaders` and `requestBody` before concluding anything.

## 1. Authoring

### Naming (customer-facing)
- Connector name = real product name ("Zendesk Support"). Action name = Title Case verb-noun ("Create Contact").
- Description = full sentence: what, on which resource, key constraints (scope, plan gate, "partial
  update: only sent fields change"). No TODOs, test artifacts or real account ids.
- Field titles/descriptions are specific ("File name including extension").
- Slugs are camelCase `^[a-z][a-zA-Z0-9]*$`.

### Coverage
Every endpoint, including webhook management (create / list / delete subscription) so subscription
code can call them. Prove a route exists (resource-level error on a fake id) before shipping it.
Polymorphic endpoints = one action with a `type` enum plus typed per-variant blocks.

### inputContract
- One typed, titled, described property per API field; `enum` where values are documented, `default` where applicable.
- No opaque object/string passthrough (`{{input.body}}` + `bodyType: raw`): the programmatic
  `fastn.connector.<slug>.<action>()` caller cannot use it and it describes nothing.
- **`required[]` mirrors the backend.** Execute a minimal create and add every field the 4xx names.
  Docs are wrong in both directions. Recover enum values from live 400s. A required boolean sent as
  `false` can read as missing on some serializers; test with `true`.
- **`required[]` also drives cascading dropdowns.** For a list action that depends on a parent
  (`listBranches` needs `owner` + `repo`), every required param must be declared; the config-proposal
  probe matches required param names against other fields and turns them into `paramDeps`. A wrong
  `required[]` breaks the dashboard pickers.
- List actions return one page. Dashboard pickers page via `per_page`/`page` when the spec opts in
  (`autoPaginate`), and leave paging alone when the action exposes its own keys (`page_size`,
  `cursor`, `pageToken`, `offset`, `maxResults`, ...).

### The 1:1 rule
Every advertised field reaches the request; every param the API demands is present. A field the
request never sends means the caller "saves" data that vanishes: remove it. A filter that returns
identical results with and without it is a phantom: remove it. Check where params belong (some
search endpoints want them in the POST body).

### outputContract
- Model from the real 2xx after a live execute, keys verbatim (NamSor `corridor` and ChartMogul
  `task_uuid` differ from their specs). If action B consumes A's id, read A's real output key.
- Root must be `type: object` with `properties`; wrap bare arrays/strings (`{items: [...]}`).
- Model envelope status fields (`ok`, `Code`) so callers can assert them.
- Binary and any `+json` media type arrive as a FileRef `{name, mime, size, data}`; model that.

## 2. Wiring the request

### Placeholders
- `{{input.x}}` resolves in URL, headers, query params and body.
- `{{auth.x}}` resolves in the URL, headers and the body template, but **not** in a separate
  `httpConfig.queryParams` object. Put it in the URL: `?app_id={{auth.appId}}`.
- In URL paths use `{{auth.accessToken}}`; `{{auth.token}}` renders empty there (works in headers).
- Single-brace `{x}` rides into the URL literally. `{{x|default}}` and Handlebars helpers are unsupported.
- Never append `#{{input.x}}` fragments to mark inputs consumed.

### URL and query params
- `url` = host, `path` = suffix. A full `url` plus a `path` repeating segments, or a stale `path` key
  surviving an update, doubles the path. Set `url` = base explicitly.
- A blanked path param collapses `/orgs//users/` and 404s on a valid id.
- Slashes inside a param become `%2F`. If the vendor rejects that (Akeneo), split into per-segment inputs.
- **GET** auto-appends every input the URL does not consume. Declare query params in the inputContract
  only; listing them again in `queryParams` breaks on optional empties. Keep GET inputs scalar (objects
  become `[object Object]`); flatten to the wire key (`filter[status]`).
- **POST/PUT/DELETE** never auto-append: set explicit `httpConfig.queryParams`.
- Arrays serialize `a,b`; repeated keys (`ids=1&ids=2`) are not expressible.
- get-by-id is often a query param (`?ID=`), not a path segment. Check the spec (Cin7 always).
- Never model a secret as a per-action header input: optional header inputs leak into the GET query string.

### Bodies
**Default: `bodyType: "json"` and no `bodyTemplate`** (or `bodyTemplate: null`). The auto-body
serializes exactly what the caller passed, escapes correctly (SQL, HTML, newlines), and skips fields
the URL consumed.

**JSON bodyTemplates** (`packages/connector-engine/src/resolve.ts`, ported verbatim to UCL) resolve
structurally: every placeholder is tokenised, the template is parsed as JSON, and a key whose value
is exactly one placeholder that resolved to nothing is **dropped** (array items too). That value keeps
the input's type whether quoted or bare: `"limit":"{{limit}}"` with input `10` sends the number 10 (no
coercion, so a string input stays a string). Consequences:
- Optional fields may sit in a JSON template; they need not be in `required[]`.
- Placeholders interpolated into longer text (`"Bearer {{x}}"`) become empty strings when unresolved.
- Do not describe optional fields with sentinel values ("pass an empty string to leave unset"): the
  empty string is sent and overwrites stored data on partial-update APIs.
- A template must still cover every advertised field (a subset silently drops data).

**Non-JSON templates** (form-urlencoded, raw text) take the plain-text path: unresolved placeholders
become empty strings (or literals). There, template only required fields, and for optional form fields
use `bodyType: "raw"` with an explicit `Content-Type: application/x-www-form-urlencoded` (Mailgun).

Special cases:
- **Query-only or header-only params on POST/PUT/DELETE leak into the auto-body.** Give the action an
  explicit template of only its body fields.
- **Top-level JSON array body**: accept a `string` input, `bodyType: "raw"`, `bodyTemplate: "{{input.items}}"`.
- **Envelope bodies** (`{"customer": {...}}`): one required, fully typed object property, built field by field.
- **No-arg RPC that needs a body** (Dropbox): `bodyType: "raw"`, `body: "null"`.
- **Deliberately generic create/update** beside typed ones (ServiceNow): `bodyType: raw` +
  `bodyTemplate: "{{input.fields}}"`, `fields` a required string.
- **DELETE on strict servers**: the engine always sends `Content-Type: application/json`;
  `bodyType: "none"` does not stop it. Set `bodyTemplate: "{}"` (`FST_ERR_CTP_EMPTY_JSON_BODY`).
- `language: "JS"` with empty `code` sends no body.
- A vendor rejecting `Content-Type: application/json` on GET needs `text/plain` set (IPLocate: `Accept: text/plain`).

### GraphQL
One POST per action, `bodyType: "json"`. Declare variables in the query and pass a `variables` object;
respect introspected scalar types (Float vs Int, enum vs String). Introspect one type family at a time;
responses truncate around 4KB.

## 3. Driving the MCP tools

Creating and updating:
- **Single `create_action` only** (batch drops `bodyTemplate`/`headers`, coerces `raw`, rotates auth).
  If a batch already ran, finish all builds before the user connects and recover ids by grepping the
  spilled result file for `"id": "` and `"slug":`.
- **`update_action` replaces the whole httpConfig**: `get_action` first and send the full object back.
  `null` deletes a key; `bodyTemplate` needs explicit `null` to remove; `queryParams` keys cannot be
  deleted (point stale ones at placeholders no input defines, or send `queryParams: {}` on the raw API).
- The real update verb is `PUT`; `PATCH` returns 200 and persists nothing.
- `update_action` with `authMethodId` returns 500: one auth method per connector.
- **A write can answer 502 after it persisted.** `get_action` / re-list before retrying, or you get duplicates.
- **After create/update the executor serves the old definition for 15 to 90 s** ("Action not found" or
  the stale body). Wait and re-run once before calling a change failed.
- `breaking: true` on an output-only `update_action` is a false positive.
- Any inputContract / httpConfig / outputContract edit resets `testStatus`: re-execute last.
- In Claude Code auto mode the permission classifier blocks `updateConnector`, `updateAuthProvider` and
  `updateWebhookConfig` as shared-resource edits. Plan those as explicit user approvals.

Measuring:
- **`list_actions` under-reports**: default projection shows `inputContract`/`outputContract` as `null`
  and a lagging `stage`/`httpConfig`. Audit with `view=full` or `get_action`.
- List caps at 200 rows; page with `offset` (`page` is a no-op); `search`/`stage` filters are unreliable,
  filter client-side. `list_connections` caps at 500 and ignores `connectorId`.

Executing:
- **Never run `execute_action` concurrently**; parallel executes crash the MCP session for minutes.
- `execute_action` needs `connectionName` explicitly.
- `testStatus` / `lastTestEvidence` are not stamped by MCP executes. Your scratch log is the evidence.
- Tool results truncate at ~4KB; the call still succeeded.
- `requestUrl` echoes query-param API keys, and some vendors echo the key in the body. Redact evidence.
- Explore with curl, not by repeatedly executing a passing action.

Gateway:
- `404 Session not found` / "Server not found" from the claude.ai MCP: retries inside the session do
  nothing; the user must reconnect the connector on claude.ai. `503 no healthy upstream` is an outage: back off.

Parallel work: one sub-agent per connector, flat fan-out, never two agents executing against the same
connector, each writing evidence incrementally.

## 4. Reconciliation checklist (after every live test)

1. Accepted? If 4xx, fix until a real 2xx or classify with evidence.
2. Read the request actually sent: every advertised field present, no leaked `{{...}}`, no blanked
   segment, the expected auth header.
3. Update outputContract keys verbatim from the real response.
4. Add 4xx-demanded fields to `required[]`; remove fields and filters the endpoint ignores.
5. Re-execute as the final operation, with fresh ids for create-style writes.

## 5. Promotion (only when the owner asks)

- `stage: "live"` on `create_action` / `update_action` is silently ignored; `update_connector {stage}`
  answers "No valid fields".
- Working paths: the dashboard Promote button, or the raw API `POST /api/v1/actions/{id}/promote` with
  `{}` per action, then `update_connector {visibility: "public"}`. The claude.ai MCP does not expose promote.
- Any content edit demotes back to `test`: promote last, then confirm with `get_action` / `get_connector`.
- To revert a false promotion, PUT the action with its full httpConfig and `stage: "test"`.
- Subscription code only resolves `stage:live` actions (`events-webhooks.md` § 3).
