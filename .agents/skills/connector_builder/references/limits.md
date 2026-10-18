# Engine limits and non-HTTP connectors

An action blocked by one of these is an **engine-blocker**: evidence it with a curl proof that the vendor
side works. It is not a connector defect, and it is not "untested".

## Not expressible today

| Limit | Symptom | What to do |
|---|---|---|
| Multipart / file uploads | `form-data` still sent as `application/json`; binary bytes UTF-8-expanded | Prove with `curl -F`; prefer URL-based upload endpoints (`image_url`); text uploads can pass; remove upload actions that can never work and say why |
| Binary / octet-stream / 302-to-CDN responses | 502 "Body has already been read" | Use a temporary-link endpoint (`@microsoft.graph.downloadUrl`, Dropbox `getTemporaryLink`) |
| Response headers not exposed | id only in `Location` | wiring-pass only |
| Executor output size | correct GET whose body exceeds the limit (Supabase `getAuthServiceConfig`) | blocked for output size, curl proof |
| Unbounded SSE / streaming | ~30 s executor cap | wiring-pass only; bounded streams as raw bodies are fine |
| Long requests | vendor needs more than `timeoutMs` | raise `timeoutMs` if allowed, else document |
| NDJSON collection bodies | 502 (Akeneo collection PATCH) | not buildable; single-resource PATCH works |
| Repeated query keys (`ids=1&ids=2`) | arrays serialize `a,b` | not buildable |
| Per-call host from a prior response | executor percent-encodes `https://` | only `{{auth.x}}` hosts insert verbatim |
| No-auth endpoint on an authed connector | Bearer force-injected; `authMethodId: null` → 500 | blocked (Dropbox longpoll) |
| Content-host download needing an empty body | engine always injects the input object | temporary-link pattern |
| GET with forced `Content-Type: application/json` | signed-URL / GCS endpoints reject it | set `text/plain` where tolerated, else document |
| Per-action auth override | `update_action` with `authMethodId` → 500 | one auth method per connector; split connectors |
| OAuth URL builder | strips embedded params, space-joins scopes | hand-construct the link (`auth.md` § OAuth) |
| Standard Webhooks / Svix signing; per-subscription secrets | HMAC key resolves only from the auth provider's client secret and fails open when missing | leave verification unset, document |
| Microsoft Graph `validationToken` echo | no synchronous echo → 400 on `createSubscription` | all Graph change notifications blocked |
| AWS SigV4 | config stored, requests go unsigned | every SigV4 API unbuildable; prove once and stop |
| MCP-protocol connectors | `authConfig.headers` not stamped on probe/execute (0 tools); `mcpServerUrl` cannot be nulled to convert to REST | report as platform limitation |

## Known bugs, one line each (detail lives where linked)

- Auth method rotation on batch builds and UI saves: `auth.md`.
- `create_actions_batch` drops `bodyTemplate`/`headers`: `build.md` § 3.
- Optional header inputs leak into the GET query; query inputs leak into the POST/PUT/DELETE auto-body: `build.md` § 2.
- DELETE always carries `Content-Type: application/json`: `build.md` § Bodies.
- `stage: live` ignored on create/update: `build.md` § 5.
- Vendor egress-IP blocks (every call 401s from fastn, works locally; WhoisFreaks, Chartly) look like
  engine bugs but are account blockers. Fix = vendor allow-list.

## Native protocol connectors (DB, Redis, FTP/FTPS/SFTP)

Only `@fastn.ai` users can create them.

- **Redis** (`protocol: "REDIS"`): auto-scaffolds 46 actions; credentials host / port / password / tls /
  db (0-15); `{{key}}`/`{{value}}`/`{{field}}`/`{{member}}` resolve in `redisConfig`; numeric params fall
  back to inputs; array params may be a JSON string. Actions are execute-only.
- **DB** (`protocol: "DB"`: postgres, redshift, mysql, mssql, mongodb): one "Query" action; `?`
  placeholders converted per driver (`$1` pg/redshift, `?` mysql, `@p1` mssql), params driver-escaped,
  passed as a JSON array or JSON string; pool of 5 per connection, 5-min idle eviction; SSRF protection
  blocks private/metadata IPs; 10,000-row cap. MongoDB takes collection / filter / limit. Redshift uses
  the pg driver on 5439 with SSL by default.

The prod MCP's create/update tools drop `dbConfig.operation`, and the bundle importer drops
`db_config` / `ftp_config` / `redis_config`. Fallback: build a JSON bundle on a local fastn stack
(auth disabled), where `POST /api/v1/actions` accepts `dbConfig.operation` and
`POST /api/v1/connections` stores credentials; execute every action against real credentials to the
same evidence bar; hand over the validated JSON for prod import and flag the MCP/import gap separately.
Do not build an HTTP shim instead.
