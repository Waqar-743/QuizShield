# Auth, connections and hosts

## Probe the scheme first

The credential's stated type was wrong on 4 of 6 platforms in one week (an `api_key` that was Basic,
OAuth2 client_credentials, Bearer). Make one live call. A differing error across schemes (account-specific
401 vs generic `Unauthorized`) proves the token authenticates. Strip a literal `Bearer ` prefix stored
in a credential value. Record the bad-auth signature now.

## Injection is driven by field name, not auth type

| Credential fields | Injected |
| :--- | :--- |
| `token` or `accessToken` | `Authorization: Bearer <value>`, overriding any per-action Authorization header |
| `apiKey` (+ optional `headerName`) | the named API-key header |
| `username` + `password` | HTTP Basic |

This works on INPUT auth too. So:
- **Name fields for the scheme you want.** Basic needs `username`+`password` even when the values are
  `api` + an API key (Mailgun).
- **Use neutral names (`apiToken`, `credential`, `secretKey`) when actions set their own auth header**,
  and set it in `authConfig.headers`. A `token` field clobbers a custom Authorization header (401); an
  `apiKey` field plus your own header sends it twice (`key, key`). Exception: a GraphQL connector whose
  every action sends `Authorization: Bearer {{auth.token}}` gets an identical header (Fireflies).
- `authConfig.headers` templating is not applied on every path (the subscription sandbox ignored it).
  The dependable custom header is `apiKey` + `headerName` on API_KEY type. Check `requestHeaders`.

## The connect form renders only some fields

The dashboard connect modal renders `inputContract` fields only for INPUT, BASIC, DIGEST and
non-interactive OAUTH_2. API_KEY shows one "API key" field and BASIC shows username/password; extra
fields (`instance`, `subdomain`, `storeHash`, `region`) are dropped. Any connector needing extra
credential fields uses **INPUT**; field-name injection still fires (BigCommerce storeHash + apiKey;
ServiceNow instance + username + password).

## Changing an auth method breaks connections

Adding a required field invalidates every stored connection (`{{auth.newField}}` resolves empty, 500s).
Sequence: add the field, re-save each connection, re-validate.

**Auth method rotation (platform bug).** Saving the auth section in the builder UI, and every
`create_actions_batch`, replaces the auth method (new id, titles reset, `required: true` injected) and
orphans connections ("Connection not found"). Seen on INPUT methods; an empty-contract OAuth method
did not rotate (Google Drive).
- Prevent: single `create_action`; never store auth-method ids; `list_auth_methods` before use; never
  edit an INPUT method in the UI; finish builds before the user connects.
- Recover: `list_auth_methods` → `update_auth_method` to re-apply titles → user reconnects.

## OAuth

- Done only when the consent URL loads a real login page (not `invalid_scope`, `invalid_client`, 4xx/5xx).
- Take endpoints, grant types, PKCE and **exact scope strings** from live docs; map minimum scopes per
  action and event. Prefer OAuth when offered.
- **The authorize-URL builder is not configurable per provider**: it space-joins scopes (comma-scope
  providers need one pre-joined element), strips query params embedded in `authorizationUrl`
  (`audience=api.atlassian.com`, Slack `user_scope`) and ignores a proxy URL. Hand-construct the link
  from the one `initiate_oauth_connection` returns. Scopes that depend on a stripped param are
  unrequestable via fastn; say so.
- `oauthVariables` substitute into `authorizationUrl` / `tokenUrl` only, never into `scope`. For
  client_credentials, `authConfig.tokenParams.scope` (e.g. `https://{{auth.orgUrl}}/.default`) does
  template against connection fields and overrides `scope`.
- **Non-interactive grants** (`password`, `client_credentials`) work; `{field}` in `tokenUrl` resolves
  from the submitted credentials; `save_connection` performs the exchange; `expiresAt: null` is not a failure.
  ```json
  "authConfig": { "grantType": "password", "tokenUrl": "{baseUrl}/oauth/token",
                  "clientAuthMethod": "basic", "bodyFormat": "json", "scopes": [] }
  ```
- Interactive `authorization_code` needs a browser; say when that leaves a connector untestable.
- `create_auth_provider` without `connectorId` makes a global provider the connector UI never shows.
  `get_connector` may show a null provider id while linked; verify with `list_auth_methods`.
- Scopes added after first consent need a **reconnect** (`drive.apps.readonly`, GitHub `delete_repo`).
- Device-flow / partner tokens are a separate credential from the API key.

## Connections

- **ACTIVE does not mean the token is live.** Execute one harmless read and assert the inner status.
- Give each connection a distinct name (two `default`s can pick the wrong one); pass `connectionName` on execute.
- PUT on a connection corrupts it (nulls `authMethodId`): delete and recreate one you created.
- One API can split schemes (personal key everywhere except an OAuth-only or Enterprise-token subset,
  Miro SCIM). Evidence the split; per-action auth override is unusable, so split connectors if needed.

## Host is config only when it varies

- Host varies by environment, region or tenant → put a `baseUrl` field or an `environment`/`region` enum
  on the auth method and template it in every action URL and the token/authorize URLs.
- Derive the host from a pattern when one exists: ask for the tenant id only
  (`https://{{auth.storeCode}}.cloud.akeneo.com`). Free-form `baseUrl` only for self-hosted/custom domains.
- One global host (a single `servers[]` entry) → literal host. Per-endpoint version prefixes are not host variance.
- An action using `{{auth.baseUrl}}` on an interactive OAuth connection (which stores no input fields)
  leaves the placeholder literal and 500s.
