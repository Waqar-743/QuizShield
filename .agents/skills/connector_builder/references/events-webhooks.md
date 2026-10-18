# Events & Webhooks Reference (connector-builder)

A connector's event surface is a **separate artifact from its actions**. `createWebhook` / `listWebhooks` / `deleteWebhook` actions give you three REST actions and **zero bindable events** until a webhook config exists. Build the config in the same pass as the actions. This file holds the complete model: the two webhook-config types, the full config contract, subscription code, hybrid script-object events, the APP inbound routing pipeline, `requiredActions` account mapping, verification schemes, the mandatory verification loop and the events definition of done. Read this whole file before creating or editing any webhook config.

---

## 1. The two types — decision rule

Every connector event setup is exactly one of two types. Decide FIRST, from the provider's API surface:

| | `EVENT_WEBHOOK` | `APP` |
|---|---|---|
| Provider has a REST webhook-registration API | yes (`POST /webhooks` etc.) | no |
| Who registers the webhook URL | fastn, via subscription code calling the connector's own createWebhook action | **the user, manually** — pastes the fastn webhook URL into the provider's app/developer portal |
| Webhook URL scope | per-trigger URL → routing is inherent | ONE shared URL for the whole app → fastn must route inbound events itself |
| `subscription` / `unsubscription` code | **required** | not needed |
| `eventKey` | not needed | **required in practice** (see §4) |
| `requiredActions` with `mappedTo` | not needed | **required whenever payloads carry an account identifier** (see §5) |
| Examples | GitHub, Jira, BigCommerce, Mailgun, Cin7, Apify, TomTom, Kobo, Chameleon, Salesforce/ServiceNow/Dataverse (hybrid, via script objects) | HubSpot, Slack, Notion, Dropbox, Fireflies, Zixflow, Retently, D365 F&O Business Events |

If the provider has both (rare), prefer `EVENT_WEBHOOK` — automated registration beats manual setup. If a provider has no registration API but lets you create script objects or agents via REST (Salesforce Apex, ServiceNow business rules, Dataverse service endpoints, Flatfile agents), build a **hybrid EVENT_WEBHOOK** whose subscription code creates that object (§3). Per-job callback URLs (`webhookUrl` on a create-job call) are an APP-style setup: state that the customer passes the trigger URL per job.

---

## 2. Webhook config contract (full)

`create_webhook_config` / `update_webhook_config` fields:

| Field | Applies to | Meaning |
|---|---|---|
| `type` | both | `"APP"` or `"EVENT_WEBHOOK"` |
| `events[]` | both | `{id, label, description?, payloadSchema?}`. `id` = the provider's **native event slug, verbatim** (`contact.creation`, `Sale/OrderAuthorised`). `payloadSchema` = a real example of the delivered body — it becomes `ctx.input` for app-event-triggered workflows (array delivery → array example; single → object). Populate it from a captured real payload, not docs; say in the description when a schema is modelled from the vendor's documented sample instead. |
| `eventKey` | APP | Dotted path into the inbound payload that names the event type (e.g. `type`, `subscriptionType`, `resourceState`). Drives routing — see §4. |
| `requiredActions[]` | APP | `{actionId, label, value, mappedTo?}` — the account-mapping mechanism. See §5. |
| `subscription` / `unsubscription` / `resubscription` | EVENT_WEBHOOK | Sandbox JS that registers/removes the webhook upstream via `fastn.connector.<slug>.<action>()`. See §3. |
| `inputs[]` | EVENT_WEBHOOK | `{key, value, hidden}` — extra static/per-setup inputs surfaced to subscription code (passed as `additionalInputs` on execute-subscription). |
| `verification` | both | `eventsVerification` (HMAC / challenge / token) — see §6. |
| `verificationSecret` | both | The signing secret; stored server-side, never read back (only `hasVerificationSecret`). |
| `authProviderId` | both | OAuth connectors: the auth provider that authorizes registration/verification. |
| `registeredEvents[]` | platform-managed | `{eventId, triggerId, subscribedAt, subscriptionId}` — written when triggers bind; used by ingest routing (§4). Do not author by hand. |

**Tool-layer notes:** some builder MCPs expose create/get/list/delete but **no update** for webhook configs — design the events and code before creating, and if a config must change, delete and recreate only a config you created. Some gateways refuse updates to platform-org configs (403 read-only). The claude.ai MCP's `updateWebhookConfig` has no `verificationSecret` parameter and the API refuses `method: HMAC` without one, so HMAC is turned on from the dashboard; a per-trigger `secret` returned by subscription code is captured automatically. Every event `description` must carry the exact click-path the customer follows in the vendor portal (and, where the vendor sends no discriminator, the literal field the admin must inject).

---

## 3. EVENT_WEBHOOK — subscription code rules

- Build (and test) the connector's own webhook-management actions FIRST: `createWebhook`, `deleteWebhook`, usually `listWebhooks`.
- **Live-only resolver:** `fastn.connector.<slug>.<action>()` inside subscription code only sees `stage:live` actions (verified on Jira, Salesforce, ServiceNow). Promote the webhook-management actions to live before exercising subscriptions; `stage:test` actions → subscription execution fails, typically `execute-subscription` returning 400 with nothing registered upstream. Where promotion is not yet allowed, verify the same upstream call through the actions directly and say the subscription hop itself was not exercised.
- **The event key gotcha:** inside subscription code the event type arrives as **`ctx.input.event`**, NOT `ctx.input.eventId`. Verified on Cin7 Core, ServiceNow, Salesforce, Dynamics 365 CRM, BigCommerce, Mailgun.
- The fastn webhook URL to register arrives as `ctx.input.webhookUrl`; `inputs[]` entries and execute-time `additionalInputs` are also on `ctx.input`.
- **Resolver envelope:** the programmatic call returns `{id:'exec_*', output:{...}, success, status}`. Most providers: payload at `res.output`. BigCommerce: `res.output.data` (extra nesting). Always use a safe chain: `res?.output?.data ?? res?.output ?? res`.
- **Return the provider's subscription id** (`subscriptionId` / `webhookId`) so unsubscription can target it (`subscriptionId` lands on `registeredEvents`); unsubscription code must read it back. A subscribe that returns no id leaves hooks behind forever.
- Verify with `execute_subscription` (webhookConfigId + connectionId + eventId) against a live connection, then confirm upstream (listWebhooks) that the hook exists.
- No `Date.now()` / randomness in connector-side code where determinism matters (e.g. Google Drive channel IDs must be hash-based).
- Auth headers templated in `authConfig.headers` may not be applied in the subscription sandbox — an INPUT-type key that works for executeAction can 401 there. Switch to the native API_KEY type with `headerName` if so.
- The webhook `destination`/`url` must be a resolvable public HTTPS URL — some vendors validate DNS at registration (BigCommerce, Mailgun).

```js
export default async function (ctx) {
  const res = await fastn.connector.<slug>.createWebhook({ url: ctx.input.webhookUrl, events: [ctx.input.event] });
  const out = res?.output?.data ?? res?.output ?? res;
  if (!res || res.success === false) return { success: false, registered: false, error: res?.error || "createWebhook failed" };
  return { success: true, registered: true, subscriptionId: String(out?.id), secret: out?.secret };
}
```

### No registration API but scriptable platform (hybrid EVENT_WEBHOOK)
Some providers have no webhook API but let you create script objects via REST — subscription code creates those instead:
- **Salesforce**: create Apex Class + Trigger via API (`createApexClass`, `createApexTrigger` must be `stage:live` for the resolver). Remote Site Settings authorize by **exact host** — `live.gcp.fastn.ai` must have its own entry. Class script single-line, single-quotes only.
- **ServiceNow**: create a Business Rule (`sys_script`, when=after) whose script POSTs via `sn_ws.RESTMessageV2`. Script single-line, single-quotes only.
- **Dynamics 365 CRM (Dataverse)**: register `serviceendpoint` + up to 3 `sdkmessageprocessingsteps` per subscription; `subscriptionId = endpointId|stepId1|stepId2|stepId3`. sdkmessagefilter OData: `_sdkmessageid_value eq <guid> and primaryobjecttypecode eq '<entity>'` — no quotes around the GUID.
- **Google Drive**: no classic webhooks — watch channels (`watchChanges`, `watchFile`), event key = `resourceState` (X-Goog-Resource-State), unsubscribe via `stopChannel` (needs channelId + resourceId from the subscribe output).
- **Flatfile**: events via a deployed agent that POSTs topics; there is no callback-registration API.

---

## 4. APP — the inbound routing pipeline

With APP type there is ONE shared webhook URL for the whole app, receiving every event type for every account that installed it. fastn routes each inbound POST to triggers in this order (implemented in the event service's ingest dispatcher):

1. **Event-type match via `eventKey`.** The dispatcher reads the payload value at the `eventKey` dotted path (arrays of events are handled: each element is read). The detected event id(s) are matched against triggers' subscribed events (via `registeredEvents` first, falling back to the triggers' own events arrays).
   - `eventKey` **missing from the config** → legacy fan-out: EVERY active trigger on the connector receives EVERY event (logged as a warning). Never ship an APP config without `eventKey` unless the provider genuinely has a single event type.
   - `eventKey` set but the path **does not resolve in a given payload** → that event is **dropped** (202 accepted, dispatched 0). So the eventKey path must hold for every event type the config declares — verify against real payloads of each type.
2. **Account match via `requiredActions[].mappedTo`** (§5). If any required action declares `mappedTo`, the dispatcher extracts `payload[mappedTo]` (dotted path, array payloads supported) and keeps only triggers whose stamped `accountId` equals it.
   - Triggers with a NULL `accountId` are **dropped and logged as permanently unroutable**.
   - If `mappedTo` is configured but the field is absent from a payload, the account filter is skipped for that event (fan-out proceeds) — so choose a `mappedTo` field present in every event type.
3. Remaining matched triggers dispatch to their bound routes/workflows. Binding a trigger needs `routes: [{routeId, routeType: "API"}]` — without routes ingest answers `202 {dispatched: 0}`.

**Setup flow for the user:** paste the fastn webhook URL into the provider's portal (developer app settings, Business Events endpoint, integration webhooks tab, ...), select/enable the event types there, and complete any provider validation handshake (challenge echo, verification token POST — see §6). An APP config alone never receives anything — say so, and put the click-path in every event description.

---

## 5. `requiredActions` — the account mapping (REQUIRED for APP)

This is the piece that makes APP-type routing multi-tenant-safe, and the most commonly omitted one. In the dashboard this is the "Get User Account Action" on the webhook config (`webhookConfigRequiredActions` in the UI).

### Why it exists
The provider posts all accounts' events to one shared URL. fastn must know **which trigger belongs to which upstream account** (HubSpot portal, Slack workspace, ...). `requiredActions` declares:
- how to discover a user's account id at trigger-creation time (execute an action against THEIR connection), and
- which payload field carries that account id at ingest time.

### Shape
```json
{
  "requiredActions": [
    {
      "actionId": "<uuid of a connector action, e.g. getAccountInfo>",
      "label": "data.response.portalId",
      "value": "data.response.portalId",
      "mappedTo": "portalId"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `actionId` | UUID of a connector action that returns the connection's account identity (a "me" / "account info" / "auth introspection" style GET). |
| `label` | Dotted path into the action response used as the human-readable label in the account dropdown (e.g. `data.response.user`). |
| `value` | Dotted path into the action response holding the account id — this exact value is stamped onto the trigger as `accountId`. |
| `mappedTo` | The field in the **inbound webhook payload** (dotted path) that must equal the stamped `accountId` for an event to route to this trigger (e.g. `portalId` for HubSpot, `team_id` for Slack). Omitting `mappedTo` disables account routing — only do that if the provider genuinely posts per-account URLs. |

### Path envelope gotcha (critical)
`label`/`value` paths are authored against the **v1 execute envelope**: `{ data: { response: <body> } }` — so a body field `portalId` is `data.response.portalId`, NOT `output.portalId` or bare `portalId`. Path resolution flattens arrays along the way (a path may address a per-item field to yield a multi-account dropdown). The server-side resolver presents both `data.response.*` and `data.output.*`; author against `data.response.*` — that is what the dashboard resolves.

### Requirements on the chosen action
- Must execute successfully with **empty inputs `{}`** — the resolver and the dashboard both call it with no arguments. An action with required inputs breaks account resolution.
- Must be built and **tested** on the connector before the webhook config references it (it is executed against real connections).
- Its real response must contain the account id at the `value` path — reconcile against the real execution body, not docs.
- Good candidates: `getAccountInfo`, `authTest` (Slack), OAuth token introspection (HubSpot `GET /oauth/v1/access-tokens/{{auth.accessToken}}` → `portalId` = `hub_id`).

### How the stamping happens
- **Dashboard trigger form**: executes the action against the user's connection, shows a dropdown built from `label`/`value` paths, stores the picked value as the trigger's `accountId`.
- **Programmatic callers** (widget activation, agent `bind_app_trigger`, API): the platform resolves it server-side by executing the action against the trigger's **pinned connection**. No pinned connection → resolution is skipped with a warning and the trigger is created with NULL accountId.

### Failure mode to check for FIRST when "the trigger never fires"
A trigger on an APP connector with `mappedTo` configured but a NULL `accountId` is created ACTIVE, reports a healthy subscription, and **silently receives nothing** — the ingest filter can never match it. Symptoms: provider shows deliveries succeeding (or ingest logs a 404 "No matching triggers"), trigger looks fine in the UI, zero executions. Fix: recreate/patch the trigger with a pinned connection so accountId resolves, or stamp accountId directly.

### mappedTo per provider (verified)
| Provider | `mappedTo` payload field | account id source |
|---|---|---|
| HubSpot | `portalId` | token introspection `hub_id` |
| Slack | `team_id` | `authTest` → `team_id` |

For a new provider: capture one real webhook payload, find the field that identifies the installing account, and confirm the same value is readable from an action on the connection.

---

## 6. Verification config

`verification.eventsVerification.method`: `HMAC` | `CHALLENGE_RESPONSE` | `NONE` | `VERIFICATION_TOKEN`.

HMAC options: `signatureHeader`, `algorithm`, `signaturePrefix`, `signatureFormat` (`hex`|`stripe`), `timestampHeader` + `maxTimestampAgeMs`, `signingPayload` (`body`|`hubspot_v1..v3`|`slack_v0`|`stripe_v1`). Challenge: `challengeDetection: {field, value, responseField}`. Token: `tokenHandshake: {field}`. The secret goes in `verificationSecret` (write-only).

### Schemes by provider
| Provider | Header | Prefix / notes |
|---|---|---|
| GitHub | `x-hub-signature-256` | `sha256=` |
| Fireflies | `x-hub-signature` | `sha256=` |
| Akeneo | `x-akeneo-request-signature` | stripe-style `timestamp.body` |
| Notion | `X-Notion-Signature` | `sha256=`; the HMAC key is the one-time `verification_token` Notion POSTs when the URL is pasted in the integration's Webhooks tab (VERIFICATION_TOKEN handshake) |
| HubSpot | `X-HubSpot-Signature-v3` | + timestamp header |
| Mailgun | — | signature lives in body fields (`signature.token/timestamp/signature`) → use `method: "NONE"` |
| Slack | — | `url_verification` challenge: `challengeDetection: {field: "type", value: "url_verification", responseField: "challenge"}`; no HMAC (signing secret not stored separately) |
| Dropbox | — | validation = GET `?challenge=` echo |
| Microsoft Graph | — | requires synchronous `validationToken` plaintext echo within 10s — fastn does not echo it → **all Graph change-notification subscriptions (OneDrive, SharePoint, Teams, Outlook) are permanently blocked** |

**Not expressible today — leave unset and document:** Standard Webhooks / Svix (`webhook-id`/`-timestamp`/`-signature` over `{id}.{timestamp}.{body}`, base64) used by ShipBob, Parallel, Olostep, OpenRegister; per-subscription or per-account secrets that only the vendor's create response returns (Lumify, Zigpoll, Apiframe — the engine resolves HMAC secrets only from the auth provider's client secret and **fails open** when missing, so a successful dispatch never proves verification); and Microsoft Graph's synchronous `validationToken` echo.

If the vendor genuinely does not sign, set `NONE` honestly rather than copying another connector's HMAC block.

---

## 7. MANDATORY verification — after EVERY create AND EVERY update

A saved webhook config proves nothing. **Every `create_webhook_config` and every `update_webhook_config` is immediately followed by the verification loop below — no exceptions, including "small" patches** (a changed `eventKey` path, an edited `value` path, a re-pointed `actionId` can each silently kill routing while the config still saves fine). Never report an event setup as working from the save response alone, and never carry verification evidence forward across an update — evidence from before the latest save proves nothing about the current config.

### EVENT_WEBHOOK verification loop
1. `execute_subscription` (webhookConfigId + connectionId + eventId) for **each event you added or whose subscription code you touched** — a non-error result alone is not enough; read the returned output for the provider's subscription id.
2. Confirm upstream: call the connector's `listWebhooks` (or the vendor's own list endpoint) and verify the hook exists with the fastn URL and the right event types.
3. Fire one real provider event (create/update a record upstream) and confirm it arrives: a matching trigger execution exists, with the payload as `ctx.input` — or a capture endpoint when no workflow can be bound; say which.
4. If you changed `unsubscription`: exercise it too (by the returned id), confirm upstream that the hook is gone — then re-subscribe if the config should stay armed.

### APP verification loop
1. **eventKey**: for each declared event type, resolve the `eventKey` path against that event's real payload (the captured `payloadSchema`) and confirm it yields the event's `id` verbatim. One event type where it doesn't resolve = those events get silently dropped.
2. **requiredActions**: `execute_action` on the configured `actionId` with inputs `{}` against a real connection — must succeed — then resolve the `value` (and `label`) paths against the actual response under the `{data: {response: <body>}}` envelope and confirm a non-empty account id comes back. Confirm the payloads carry `mappedTo` with that same value.
3. **End-to-end routing**: create (or reuse) a trigger bound to one of the events, confirm it has a **non-NULL `accountId`**, then inject a synthetic event through the real ingest pipeline with `send_test_app_event` (payload shaped exactly like the `payloadSchema`, including the `eventKey` and `mappedTo` fields). Verify the response reports `matched >= 1, dispatched >= 1` and correlate to a real execution via `listWorkflowExecutions({triggerId, dateFrom})`. `matched: 0` means your routing is broken — diagnose eventKey vs accountId before touching anything else.
   - Caveat: `send_test_app_event` bypasses signature verification only when the connector has **no webhook secret** configured. With a secret set, fire the event from the provider instead.
4. **Negative check** (routing must also exclude): send a second synthetic event with a different `mappedTo` value (or an unsubscribed event id) and confirm `matched: 0` / the trigger did NOT fire. A config that matches everything is as broken as one that matches nothing.

If any step fails: fix the config, and **re-run the full loop from step 1** — a fix to one field can regress another (e.g. changing `eventKey` can break the negative check).

---

## 8. Definition of done — events

An event setup is complete only when ALL hold:

1. Every declared event has a real `payloadSchema` captured from an actual delivery (or the provider's verbatim sample, explicitly labelled as such), not invented.
2. **EVENT_WEBHOOK**: subscription AND unsubscription code exist, return/consume the subscription id, webhook-management actions are live, and the §7 verification loop passed on the latest saved version of the config.
3. **APP**: `eventKey` is set; setup instructions (where in the provider portal to paste the URL — the click-path) are recorded in the config/event descriptions; the §7 verification loop — including the negative check — passed on the latest saved version of the config — or, where the last hop is UI-only, the report says plainly that delivery was not proven.
4. **APP with account-scoped payloads**: `requiredActions` is configured with a tested zero-input action, `value` path verified against the action's real response (`data.response.*` envelope), `mappedTo` verified present in real payloads, and a test trigger confirmed to carry a non-NULL `accountId`.
5. Verification configured per the provider's scheme (§6) and the handshake (challenge/token) completed where applicable — or the inexpressible scheme documented.
6. End-to-end: one real provider event fired → ingest matched exactly the intended trigger (not fan-out) → workflow executed with the payload as `ctx.input`.
7. Poll-only vendors (NetHunt has no outgoing webhooks; Miro webhooks discontinued 2025-12-05): stated with a doc citation, no config invented.

"On the latest saved version" is load-bearing: verification evidence from before the most recent create/update proves nothing about the current config.
