# Provider-specific quirks (verified live)

Facts that cost a rebuild when missed. Add an entry only when it was verified against the live API.

## HubSpot
- `{{auth.accessToken}}` in URL paths (not `{{auth.token}}`). Token introspection `GET /oauth/v1/access-tokens/{{auth.accessToken}}` → `hub_id` is the `portalId` for `requiredActions`.
- Webhooks = APP type; activation is manual in developer.hubspot.com (paste the fastn URL + create subscriptions). `mappedTo: portalId`.
- `batchUpsert` requires a unique `idProperty` on the object — does not work if no unique property exists in the portal.
- `email` reads need the `crm.objects.emails.read` scope — not granted by default OAuth.

## Slack
- HTTP is **always 200** — pass/fail is `ok: true` in the body. `testStatus==passed` alone is meaningless.
- `admin.*` methods require Enterprise Grid.
- `user_scope` is stripped from fastn's OAuth authorize URL — user-token-only scopes (`reminders`, `search`, `stars`) are effectively unrequestable via fastn.
- `calls.*` scopes must be added explicitly in the Slack App Console.
- Events = APP; `url_verification` challenge echo; `authTest → team_id` is the `mappedTo`.

## GitHub
- Full-repo responses (~6KB) hit the 4KB tool truncation — confirm success via the execution record / `lastTestEvidence`, not the tool result.
- `deleteRepo` needs the `delete_repo` scope — not granted by default GitHub OAuth.
- Webhooks = EVENT_WEBHOOK, `x-hub-signature-256` with `sha256=` prefix.

## Jira / Atlassian
- `cloudId` is a required input on every action (from `getAccessibleResources`).
- Atlassian strips `audience=api.atlassian.com` from the OAuth authorize URL — hand-construct the link.
- All webhook-management actions must be promoted to `stage:live` before subscriptions work (live-only resolver).

## Notion
- All actions must pin the `Notion-Version: 2022-06-28` header.
- Notion has no hard-delete API — cleanup = archive (`archived: true`).
- Webhook verification token = the `verification_token` Notion POSTs once when the URL is pasted in the integration's Webhooks tab; it is the HMAC key for `X-Notion-Signature`.

## Dropbox
- No-arg RPC endpoints: `bodyType: "raw"` + `body: "null"`.
- Content-host (`content.dropboxapi.com`) downloads are permanently blocked in fastn — use `getTemporaryLink`.
- Bearer is force-injected on every action — no-auth endpoints (longpoll) are blocked.
- Paper-content API is sunset → 404.
- Webhook setup = paste URL in the App Console; validation = GET `?challenge=` echo.

## Microsoft Graph (OneDrive, SharePoint, Teams, Outlook)
- `validationToken` echo = permanently blocked. No Graph change-notification subscriptions.
- Binary / 302-redirect downloads → 502. Read `@microsoft.graph.downloadUrl` from getItem and download out-of-band.
- Auth variable: `{{auth.accessToken}}` (not `{{auth.token}}`).
- D365 CRM: must use the `/organizations/` tenant endpoint (not `/common/`) for `dynamics.microsoft.com` scopes. Hybrid events via Dataverse `serviceendpoint` + `sdkmessageprocessingsteps` (see `events-webhooks.md` § 3).
- D365 F&O: the client app must also be registered in F&O under System Administration → Microsoft Entra Applications (otherwise a valid token still gets OData 401). Business Events are APP-type.

## Salesforce
- Unfilled optional placeholders used to reach Salesforce as literal `"{{input.X}}"` and error on date/ref fields. JSON templates now drop them (`build.md` § Bodies); the auto-body is still the preferred shape.
- A Base Edition trial (orgfarm-*) is production-type: Tooling API refuses Apex create (ENTITY_IS_LOCKED) and executeAnonymous (403). Events need a Developer Edition org.
- Passing an undeclared `q` input to a fixed-SOQL GET list action replaces the SOQL on the wire.
- Hybrid events via Apex class + trigger (single-line, single quotes). Webhook-management actions (`createApexClass`, `createApexTrigger`, …) must be `stage:live` for the resolver.
- Remote Site Settings authorize by **exact host** — `live.gcp.fastn.ai` must have its own entry.

## ServiceNow
- Typed UPDATE used to send every templated field and blank untouched columns. JSON templates now drop unresolved fields (`build.md` § Bodies), but a caller sending `""` still blanks the column; a generic `updateTableRecord` remains the safest partial update.
- `change_request` UPDATE must carry a valid `state` — the business rule returns 403 on an empty state.
- Generic create/update: pass `fields` as a JSON string with `bodyType: raw` + `bodyTemplate: "{{input.fields}}"`.
- Hybrid events via a `sys_script` business rule (when=after) POSTing with `sn_ws.RESTMessageV2`.
- UI gotcha: opening the auth section in the fastn builder and saving regenerates the auth method. Use INPUT type with all 3 fields (instance, username, password) — never edit it in the UI.

## Akeneo
- Writes are PATCH = UPSERT. Single-resource PATCH `/{code}` = normal JSON. Collection PATCH = NDJSON → fastn 502.
- The live `GET /api/rest/v1` routes map is ground truth for path disputes — prefer it over the OpenAPI spec.
- Host = `https://{{auth.storeCode}}.cloud.akeneo.com`. Apache rejects `%2F` in paths — split slash-bearing params.
- `execute_action` can fail with "Unterminated string" on big bodies — the call succeeded; check the execution record.
- Webhook signature: `x-akeneo-request-signature`, stripe-style `timestamp.body`.

## BigCommerce
- Multi-field credentials (storeHash + apiKey) → use INPUT auth type, NOT API_KEY.
- Webhook `createSubscription` requires a resolvable HTTPS `destination` URL.
- Resolver envelope in subscription code: `res.output.data` (one extra nesting vs most providers).

## Cin7 Core / DEAR Inventory
- get-by-id always uses a query param (`?ID=`), never a path segment.
- Webhook subscription code: `ctx.input.event` (not `eventId`).
- Tasks module is disabled by default — all `/crm/task*` return 400 until enabled in Settings.
- DELETE is unsupported for the production module (405) and some other resources (502).

## Miro
- Webhooks were **permanently discontinued on 2025-12-05** — webhook-management actions all return 500. No replacement; state poll-only.
- SCIM requires an Enterprise provisioning token (OAuth token insufficient).
- Mindmap nodes have no update endpoint (PATCH and PUT both 405).
- `getAuditLogs`: both `createdAfter` AND `createdBefore` are required (format `YYYY-MM-DD`).
- List `limit` must be ≥ 10 — `limit < 10` returns 400.

## Mailgun
- Auth = BASIC: username `api`, password = API key.
- Form-urlencoded bodyTemplates: fastn sends all unset `{{input.xxx}}` keys as literal strings. For actions with optional fields use `bodyType: "raw"` + explicit `Content-Type: application/x-www-form-urlencoded`.
- `getMetrics`: date format must be RFC 2822 (e.g. `"Thu, 01 May 2026 00:00:00 -0000"`), NOT ISO 8601.
- Webhook verification = body HMAC (`signature.token/timestamp/signature`), not a header → `eventsVerification.method: "NONE"`.
- Webhook URL must resolve over HTTPS (Mailgun validates DNS).

## Supabase (two-connector pattern)
- Two connectors: one for the data-plane (PostgREST / Storage / Auth Admin), one for the Management API.
- Management API: `projectRef` is a required input on every ref-scoped action (one PAT targets any project); it is URL-consumed so the auto-body excludes it.
- `region_selection` object is required on `createAProject` (not the deprecated `region` string).
- `getEdgeFunctionBody` = permanently blocked (`application/octet-stream` 502).
- `getAuthServiceConfig` GET response exceeds 4KB → classified blocked for executor output size.
- SQL bodies: omit `bodyTemplate` so newlines/quotes are escaped by the auto-body.

## Fireflies (GraphQL)
- BEARER auth with the field named `token` — fine here because every action explicitly sets `Authorization: Bearer {{auth.token}}`, so the auto-injected header is identical and does not conflict.
- 50 GraphQL requests/day on the free plan — resets midnight UTC. Count calls before a full pass.
- `analytics` needs Business+; `auditEvents` needs Enterprise.
- Webhooks = APP; `x-hub-signature` with `sha256=` prefix.

## Google Drive
- Watch channels (not event webhooks). Channel ID must be hash-based (no `Date.now()` in connector code). Event key = `resourceState`.
- `stopChannel` for unsubscription (channelId + resourceId from the subscribe output).
- `listApps` / `getApp` require the `drive.apps.readonly` scope — add after the initial OAuth connect (requires a reconnect).
- Its OAuth auth method (empty inputContract) did not rotate on batch builds — the rotation bug seems limited to INPUT-type methods.

## Apollo
- `/api/v1` and legacy `/v1` both work. Sequence actions need a linked mailbox (`send_email_from_email_account_id`).
- No delete API for contacts, accounts, deals, lists or fields: prove creates with validation 4xx, or report residue.

## Data / enrichment APIs (learned 2026-09)
- **NetHunt**: no outgoing webhooks; `Filter Records` needs an explicit `{}` body when no filter is given; timeline `types=call` returns 502 vendor-side.
- **Zixflow**: send endpoints queue asynchronously unless `submissionStatus:true` — use it to get synchronous validation errors on fake targets so nothing is queued; `Update List Entry` needs flat keys despite the docs.
- **ChartMogul**: `listOpportunities` `forecast_category`/`type` filters are silently ignored (phantom); tasks return `task_uuid`; CSV import is multipart (engine gap).
- **Baremetrics**: Cancellation Insights is a paid add-on (402 gate); `getMetricCustomers` returns a 200-carrying-error for value metrics.
- **NamSor**: Japanese match endpoints 500 when the vendor's internal service is down; 5 admin writes are deprecated (401); `corridor` output keys differ from the spec.
- **AccuWeather / CarsXE**: docs sample VIN/keys return canned 200s even with a bad key on some vendors (CarsXE `/specs`) — prove on non-sample inputs; the self-service OpenAPI lives in the portal's JS bundle.
- **ipdata**: documented `/v1/` routes are paid-only; unversioned routes serve the free plan. **ipregistry** batch `fields` need a `results.` prefix (vendor example is wrong). **IPLocate** `Get Current IP` needs `Accept: text/plain` to avoid a Cloudflare 1101.
- **KoboToolbox**: v1 API is removed (410); REST Services emit only `submission`; imports are multipart-only.
- **Flatfile**: live host is `platform.flatfile.com`, not the spec's; events via a deployed agent that POSTs topics (no callback-registration API); environment-scoped keys cannot create environments.
- **Peaka**: EU host is `eu.partner.peaka.studio` (docs wrong); agent endpoints echo the caller's API key — redact evidence.
- **WhoisFreaks / Chartly**: block the fastn egress IP while the same key works locally — vendor allow-list needed.
- **Wolfram|Alpha**: Conversational API retired; Fast Query Recognizer and Show Steps are AppID entitlements.
- **Xata**: `api.xata.io` no longer resolves; the current API is the Postgres control plane on `api.xata.tech`.
- **Moosend**: always-200 envelope, status in `Code` (`0` = ok, `-1` = failure). **LiveChat**: `batch_*` endpoints wrap per-item errors in a 200. **Hygraph**: migrations return `200 {status: "QUEUED"}` — poll the migration id for the real result.
- **Standard-Webhooks / Svix signers** (ShipBob, Parallel, Olostep, OpenRegister) and **per-subscription secrets** (Lumify, Zigpoll, Apiframe): verification not expressible in fastn — document, leave unset.
