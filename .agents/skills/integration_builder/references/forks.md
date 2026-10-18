# FORKS — customising an integration you inherited

> Read this when the caller wants to change something their provider built: `whoami` → `actingAsTenant: true` and the widget, workflow or trigger they want changed has an `orgId` that is not `whoami.org.id`. Also when a partner previewing a tenant (`?endOrgId=`) asks to customise that tenant's copy.

## The rule

A child org can **never** change its provider's integration — every write on it is refused (widget `PUT`/`DELETE` → 403 `WIDGET_NOT_IN_ACCOUNT`, workflow `PUT`/`publish` → 404 `Workflow not found`). That is by design, and it protects every other customer of the provider. What the child CAN do is **fork**: copy the integration into its own workspace and change the copy. So:

- **Never tell the customer the change cannot be made.** It can — on their own copy.
- **Never try to edit the provider's rows** and then report the 403/404 as the answer. A 403 carrying `fix` / `forkPath` is the platform telling you to fork.
- **Say it first, unprompted.** Check ownership before any other discovery on a change request, and open your first reply with it. The customer should never have to ask "is this mine or my provider's?" — if they do, you waited too long. Shape: *"HP Incidents was set up by Saman, so it can't be changed directly — that keeps it the same for everyone else who uses it. I can make you your own copy that you can change freely; the original stays as it is. Shall I?"*
- **Ask first**, in one sentence: the original stays as it is, the copy is theirs to change. The approval card on the fork call, or an explicit yes, is their consent.

- **HARD GATE — after a fork, mapping and test-case review with the customer is MANDATORY, never optional.** A fork exists because the customer is changing the use case or the logic, so the provider's mapping and test cases no longer define "working" for them. Before ANY write to a copy (`update_workflow`, `edit_workflow_code`, `publish_workflow`, config edits, trigger or widget changes) you MUST have BOTH:
  1. an **approved mapping** for the copy — `propose_configuration` → `reviewUrl` → approved in the browser (`check_config_status`), and
  2. an **approved test-case set** for every forked workflow — `submit_test_cases` → `reviewUrl` → approved in the browser.
  No exceptions: not for a "small" change, a threshold, a schedule, a one-line code fix, a change the customer described precisely, or a customer in a hurry. The consent to fork is NOT approval of the mapping or the tests. A "yes" in chat is NOT approval — approval only comes back from the tools. Never reuse the provider's approvals, never self-approve, never fabricate a `configId` or an approved set. If you have not got both approvals, you are not allowed to build — stop and ask for the review.

## Spotting an inherited resource

- `listWidgets` / `getWidget` → `orgId`. Not `whoami.org.id` → inherited. `forkedFromWidgetId` set → it is already a copy (theirs).
- **Already customised?** In the customer's `listWidgets`, a customised integration comes back as TWO rows sharing `version.groupId`: `version.kind = "custom"` (their copy) and `"original"`, exactly one with `version.active = true`. If a copy exists, **change the copy** — do not fork again (it would only return the same copy) and never touch the original. `getForkLineage { ids }` tells you what any of their resources was copied from.
- Workflows: `getWorkflow` on an inherited one returns no `code` (stripped for tenants), and any write 404s.
- The fork response's `items[].type` + `sourceId` → `forkId` is the authoritative map from the provider's ids to the copies.

## The tools

All are POST, so the agent shows an approval card. All are idempotent: forking again returns the existing copy (`reused: true`, HTTP 200), and a fork that failed part-way resumes when repeated.

| Tool | Copies | Use when |
|---|---|---|
| `fastnPlatform__forkIntegration` `{ id: <provider widget id>, name? }` | **Everything** — see below | The default. The customer wants to change anything about an integration |
| `fastnPlatform__forkWorkflow` `{ id, name? }` | One workflow + every sub-flow it calls | Only a standalone workflow (not on a widget) is inherited |
| `fastnPlatform__forkTrigger` `{ id, name? }` | A trigger template + the workflows it routes to | Only a trigger |
| `fastnPlatform__forkConfig` `{ id, widgetId? }` | A config template | Only a config (attach it to one of their widgets with `widgetId`) |
| `fastnPlatform__forkWidget` `{ id, name? }` | The widget + its config template only (still points at the provider's workflows) | Rarely — prefer `forkIntegration` |
| `fastnPlatform__forkConnector` `{ id }` | A provider's CUSTOM connector: actions, auth methods, OAuth providers **including client secrets**, entities, mock stubs, webhook configs, app registrations | A tenant admin/developer wants their own copy of the connector. Needs `connectors.create` — an `end_user` cannot |

Prefer `forkIntegration`: the item tools exist for surgical cases, and `forkIntegration` reuses anything they already copied.

### What `forkIntegration` copies

The widget (named like the original unless you pass `name`), its config template, every workflow it runs (lifecycle hooks, trigger targets, config option sources, and every sub-flow they call — slugs are kept because sub-flows are called by slug), published and deployed wherever the original is live; everything those workflows read by org at run time (env-config values, secrets, configs they name, the environments they run in, `live` included); category, labels, documentation, validation; the trigger templates (webhook, schedule, app-event — with the webhook configs and app registrations app events need); and, for a caller with `connectors.create`, the provider's custom connectors. Every id is rewritten so the copy points at the copies.

**Not copied:** catalog and public community connectors (shared by everyone; `sharedConnectorIds` lists them), and for an `end_user` ALL connectors (they cannot author connectors; the fork keeps using the provider's). Unified API entities (they resolve up the org chain already), the provider's alert rules, and runtime/tenant data (runs, events, connections, installations, stored state/files/db) stay behind.

## After the fork — the procedure

**Steps 2-4 are a blocking gate (see HARD GATE above). Do not start step 5 until the mapping AND the test cases are both approved by the customer in the browser.**

A fork copies the provider's use case, not the customer's. The customer forked because theirs is different — a field they map elsewhere, a filter the provider does not have, an extra entity, a different target. So the copied mapping and the copied test cases are a **starting point to review with them, not an approved contract**. Re-run MAP and the GATE on the copy before you build; never carry the provider's approvals over as if the customer had given them.

1. **Change ONLY the copies** — the `forkId`s in `items` (type `workflow` → `update_workflow` / `edit_workflow_code`, type `config` → the copied config). Never the original ids.
2. **Understand the change first.** Read the copy (`get_workflow` on each forked workflow, the copied config's mappings, conditions and matching strategy, the bound triggers) and restate, in business terms, what the integration does today and what the customer wants different. Ask about anything the request leaves open before proposing.
3. **Suggest the mapping again — MAP (`references/mapping.md`) on the copy.** Re-probe both sides with the customer's own connections (Step 2 — their data, not the provider's, decides which fields exist and are filled), then call `propose_configuration` seeded with the copied config's mappings, conditions and matching strategy **plus** the changes the new use case needs: new or re-pointed fields, new or changed filters, any new entity pair or direction. Share the `reviewUrl`, say plainly which mappings changed from the provider's and why, and wait for approval. Do this even when the request sounds code-only (a threshold, a schedule): the customer confirms the mapping they are now responsible for. When approved, repoint every copied workflow and the forked widget to the new `configId` — never the provider's config, never a clone.
4. **Suggest the test cases again — the GATE (`references/test-cases.md`) on the copy.** The copy carries the provider's `testCases`; they describe the provider's use case. Walk every copied case and keep, update or drop it against the new mapping, then ADD cases for everything the change introduced — per new or changed mapping field, transform branch, condition (pass + skip), entity pair and direction — plus the three always-in classes (data parity, config-liveness against the NEW `configId`, trigger-fire). Submit the full set per forked workflow via `submit_test_cases`, tell the customer which cases are new, changed or removed versus the provider's, and build only after they approve it in the browser. Attach the APPROVED set to each copy with `update_workflow`.
**Gate check before step 5 — answer all four, or stop:** Do I hold the `configId` the customer approved for THIS copy (not the provider's)? Do I hold an approved test-case set for EVERY forked workflow? Did both approvals come from the tools, not from chat? Did I tell the customer what changed from the provider's mapping and cases? Any "no" → go back to step 3 or 4; do not edit the copy.

5. **Build, then re-run the whole approved suite.** Make the change on the copies, run every case in its `mode`, assert each `pass`, and persist with `save_validation` — failures included. The regression gate (`regressionGate`, `stale: true`) applies to the copy exactly as to any flow.
6. **Publish** the copy (`publish_workflow`; `edit_workflow_code` publishes itself) and **run it** — show the result as for any build.
7. **Live.** If the original was deployed to `live`, the copy was too — at the version it was forked at. Publishing changes what runs in `test`; live traffic keeps the previous version until the copy is deployed again. Say so, or deploy it.
8. **Relay what the fork returned:** `sharedConnectorIds` (connectors still provided by the provider) and `warnings` (a secret or sub-flow named by a computed value, a category or label that could not be created, a deploy that needs review, ...).
9. **Which version runs.** The customer sees ONE integration with two versions, their copy and the original, and exactly one runs. After a fork the copy is the active version, UNLESS they already had a running setup on the original — then the original stays active until they switch. Say which is active.
   - To make the copy run: `setWidgetActiveVersion { id: <original widget id>, activeWidgetId: <copy id> }`. Ask first. It pauses their setup on the original and, where the copy has no setup yet, recreates it on the copy with the same connected accounts (`data.carried`); switching back resumes the original's setup. Relay `paused` / `resumed` / `carried`, and any `failed` entry.
   - Never create or resume a setup on the inactive version — the platform refuses it (409 `VERSION_INACTIVE`); switch instead.
   - They can switch back to the original at any time, from the card in their catalog or through you.
10. **When the provider takes the original away** (deletes, disables, archives it, or stops offering it to them), their copy is untouched and becomes their only version (`version.originalAvailable = false`). Customers running the original are moved onto their copy first. If the copy is tagged `version.stranded = true`, their setup may still be on the vanished original: offer `setWidgetActiveVersion` to the copy, which moves it.

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `FORK_SLUG_CONFLICT` (409) | Their workspace already has its OWN workflow (or connector) with a slug the copy must keep. Nothing was copied | Name it (`conflicts`), ask whether to rename or delete theirs, then fork again |
| `FORK_NOT_CHILD` (403) | Not inherited from their parent | It is not theirs to fork — another provider's, or unrelated |
| `FORK_OWN_RESOURCE` (400) | Already theirs | Edit it directly |
| `FORK_NO_PARENT` (400) | The org has no parent | Partner staff: edit your own integration directly |
| `FORK_CONNECTOR_CATALOG` (400) | Catalog connector | Nothing to fork; everyone shares it |
| 403 `required: workflows.create` / `events.create` | The caller's role, tier or API key cannot create workflows/triggers | Say what is missing; do not retry |
| `partial` + `hint` on an error | Copies made before the failure are kept | Send the same fork again to finish it |
| `VERSION_INACTIVE` (409) | A setup was created or resumed on the version they are not running | Offer `setWidgetActiveVersion` instead |
| `VERSION_PAUSE_FAILED` (409) | A setup on their current version could not be paused (e.g. its deactivation hook refused), so nothing was switched | Relay the reason; nothing changed |
| `VERSION_SWITCH_IN_PROGRESS` (409) | Another switch of the same integration is running | Wait a moment and retry once |
| `VERSION_ORIGINAL_UNAVAILABLE` (409) | Switching to an original the provider no longer offers | The copy is their only version; nothing to switch |
| `VERSION_MOVE_FAILED` (409, partner side) | A disable, archive, delete or narrowed allow-list was refused because a customer running the original could not be moved onto its own version | Relay `failed[]` (which customers and why); resolve those, then retry |
| `FORK_NOT_CHILD` on a grandparent's integration | An org forks only from its DIRECT parent; a grandparent's integration reaches it as its parent's version | Fork the parent's version (the one in their catalog) |

## Verify

Run the workflow-verifier checks on the COPY, not the original — `workflow-verifier/references/verify-matrix.md` §9 (forked integration).