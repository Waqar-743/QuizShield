---
name: connector_builder
description: >-
  Build, test and debug fastn connectors through the fastn Connector MCP: REST, GraphQL, MCP-protocol,
  DB/FTP/Redis, auth methods (OAuth2, API key, Basic, Bearer, JWT, INPUT, AWS), actions and their
  input/output contracts, bodyTemplates, and webhook/event configs (EVENT_WEBHOOK subscription code,
  APP eventKey + requiredActions routing). Use when creating a connector or action, wiring auth,
  setting up events, or chasing a failing execute, a suspicious 200, or a trigger that never fires.
---

# connector-builder

You build fastn connectors. When integration-builder hits a missing connector, action, event or
connection, build and verify that piece here, then return to the integration flow.

Every rule below exists because a real connector shipped broken without it.

## Definition of done

**Per action**, all four hold:

1. **built**: `httpConfig` correct (`url` = host, `path` = suffix, method, headers, body per `references/build.md`).
2. **tested**: a live execute returned a real 2xx and you **asserted the body** (see Classifying results).
3. **input reconciled**: `inputContract` is field-by-field, typed, titled, described, and carries every
   key the working request sent. `required[]` mirrors what the backend demanded, not the docs.
4. **output reconciled**: `outputContract` modelled from the real response, keys verbatim.

**Per connector**, all hold. Say plainly which one fails:

1. **Full coverage.** Every endpoint in fresh official docs is an action. 13 actions for a 90-endpoint API is a failure.
2. **Customer-facing schemas.** Real product name, Title Case verb-noun action names, full-sentence
   descriptions, every field typed/titled/described with enums and defaults. No opaque `body` input.
3. **Every action executed live, one at a time.** Writes tested on minimal AND full input and confirmed
   by a follow-up read. Filters proven with a matching and a non-matching value.
4. **Zero defects on our side** (route, auth wiring, body, schema, dropped field, phantom filter). Fix them; do not record them.
5. **Events covered** whenever the vendor emits events, verified on the latest saved config
   (`references/events-webhooks.md`). Poll-only vendors stated with a doc citation.
6. **Blockers evidenced**, with the exact error body and the enable path.
7. **Verified against live platform state after the final edit**, not against notes.
8. **Promotion is owner-gated.** Set `stage=live` / `visibility=public` only when asked (`references/build.md` § Promotion).

## Order of work

1. **Inventory from fresh official docs.** Fetch them each time; follow every sub-page; cite URLs.
   Summarizers over JS-rendered portals invent paths, so `curl` raw HTML / `llms.txt` / `.md` variants
   when a page looks thin. Cross-check an OpenAPI spec against the docs both ways; a live routes map
   (Akeneo `GET /api/rest/v1`) beats both. With no usable spec, try in order: a self-describing metadata
endpoint, `llms.txt`, a generated SDK, the ReadMe/Stoplight data API behind the portal, the vendor's
JS bundle, CData `.apip` profiles. Look for: mandatory headers the spec omits
   (`Notion-Version`), per-operation `servers[]` and dead documented hosts, retired endpoints (410),
   multi-product vendors (one connector per product), tiny daily quotas (count calls first), modules
   disabled by default. ERP developer credentials are often tenant-gated: prove token-plus-one-call
   before planning a build.
2. **Gateway identity.** Before the first write, `get_connector` on a known connector and assert the
   `org_id` is the one you expect. Abort otherwise.
3. **Probe auth with one live call** and capture three **signatures** on the same host: a garbage
   route (router 404), a bad credential (bad-auth), and a good call. Every later classification
   depends on them. Credential labels are wrong constantly (`references/auth.md`).
4. **Validate one simple GET** ("me" / "list") to confirm auth injection and the response envelope.
5. **Build actions one `create_action` at a time.** `create_actions_batch` drops `bodyTemplate` and
   `headers`, coerces `raw` to `json`, and rotates the auth method (orphaning connections).
6. **Execute sequentially**, never in parallel. Log execution id + status + asserted body to a
   scratch file as you go; that log is your only evidence (`testStatus` is never stamped).
7. **Build and verify events in the same pass** (`references/events-webhooks.md`).
8. **Reconcile contracts from real bodies, then re-execute.** Any contract or httpConfig edit resets test state.
9. **Self-audit against the docs**: route, method, auth, body fields 1:1, query params, `required[]`
   vs live 4xx, output keys verbatim.
10. **Clean up** every fixture by recorded id.

## Classifying results

Report every action as exactly one class. "Untested" is not a class.

| Class | Meaning |
| :--- | :--- |
| **data-pass** | real 2xx with real entity data, body asserted |
| **wiring-pass** | real 2xx, empty because the account has no data and none can be seeded (seed via the API first) |
| **PASS-GATED** | plan / quota / scope / account-state gate on a proven-correct request: the vendor's explicit gate body is captured and differs from both the bad-auth and garbage-route signatures |
| **evidenced non-2xx** | resource-level 404/422 on a real route (fake id) proving wiring for actions unsafe to run for real |
| **vendor-blocker** | 5xx or broken behaviour on a correct request, reproduced with curl outside fastn |
| **engine-blocker** | fastn cannot express it (`references/limits.md`), proven with curl |

A 404/422 with `configHealthy: true` means wiring is right and data is missing; only 401/403/network
errors mean broken auth or URL.

### False passes: a 200 is a pass only after the body is asserted

- **Always-200 envelopes**: Slack `ok`, Moosend `Code`, `{success:false}`, batch endpoints wrapping
  per-item errors (LiveChat). Model the status field in the outputContract and assert it.
- **Empty or placeholder body** (`[]`, `{"code":"string"}`): at best a wiring-pass.
- **Expired token on an ACTIVE connection**: outer 200 wrapping an inner `401 Token expired`.
- **Onboarding-incomplete account**: every call 302s to a health root returning a tiny
  `{"success": true}`. Force the real error (`X-Requested-With: XMLHttpRequest`, read `Location`),
  then **stop executing** and report an account-state blocker.
- **Async queueing**: `200 {status: "QUEUED"}` (Hygraph). Poll for the real result.
- **Silently unfiltered results**: a filter serialized as `[object Object]` or a wrong key still 200s.
- **Canned samples**: some vendors return a fixed 200 for the docs' sample input even with a bad key. Test non-sample inputs.
- **~4KB tool truncation** ("Unterminated string in JSON") is neither pass nor fail; an HTML 404 looks
  identical. Read the execution record.

### 404: phantom route or your bug?

First read `requestUrl`: a blanked param (`/orgs//users/`), a doubled path, a literal `{id}`, or a
rejected `%2F`. On one connector 51 of 57 "phantom" routes were a blanked param. Then compare to the
garbage-route signature: byte-identical / HTML / "Endpoint not found" means the route does not exist
(remove the action); a JSON "Could not find X" means the route is real (keep it).

### Gates: the account's problem, not yours

A gate is proven only when the real action returns the vendor's explicit message (`upgrade your plan`,
`scope X required`, `feature not enabled`) that differs from the bad-auth signature, on a request whose
route/method/body match the docs. A 401 byte-identical to a bad key proves nothing: read the key's
scope list or tokeninfo. Kinds: plan/credit gates, key-scope gates (fix = reconnect with more scopes),
account state (unverified, trial expired, zero data), modules switched off, vendor IP allowlists
blocking fastn egress, UI-only resources with no create API, features that switch on minutes after
an activate call (retry dependents). Unblock self-inflictable ones via the API;
never spend money to clear a gate.

## Safe testing

- **Deliver nothing to a real person**: sends, SMS, calls, invites, signature requests. Prove those
  routes against fake ids or a sync-validation flag (Zixflow `submissionStatus:true`).
- **Move no money.** Use the vendor's test mode or invalid amounts.
- **Member/role/access actions target a throwaway user or fake id**, never the connected owner.
- **Create only what you can delete.** No delete endpoint means prove the create with a validation 4xx,
  or archive and report residue with ids. Delete side-effect objects too.
- **A truncation error or gateway 502 usually means the write succeeded.** Read the execution record
  before re-running a DELETE or create.
- **Clean up only your own fixtures, by recorded id**, including webhook subscriptions (confirm upstream
  they are gone). Leave pre-existing data and connections untouched.

## Honesty

- Say when a schema or event payload is modelled from docs rather than captured.
- Record blockers with the exact error body; stop re-trying auth configs once a blocker is evidenced.
- Name what is unfinished, per action.

## References (open one when you reach its phase)

| File | Open when |
| :--- | :--- |
| `references/build.md` | Authoring an action, building its request (placeholders, query params, bodies, bodyTemplate), driving the MCP tools, reconciling, promoting |
| `references/auth.md` | Choosing an auth type, credential field names, OAuth setup, connections, host-as-config |
| `references/events-webhooks.md` | Any webhook/event config: EVENT_WEBHOOK vs APP, subscription code, eventKey, requiredActions, verification, the mandatory verification loop |
| `references/limits.md` | Something fastn cannot express; DB/FTP/Redis/MCP-protocol/AWS connectors; known platform bugs |
| `references/provider-quirks.md` | Building or debugging a connector for a vendor listed there |
