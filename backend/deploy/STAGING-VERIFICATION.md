# Verification Report — QuizShield staging

**Verdict: PASS for controlled staging.** Hosted email, teacher-scoped Google Calendar and released-results Sheets sync passed. Unrestricted student delivery remains disabled. The original production application and database were not changed.

Verified 17 October 2026, 19:49 UTC (18 October, 00:49 Pakistan time), followed by a final queue check with no pending, running, awaiting-callback, failed or uncertain jobs. Detailed read-backs: [email evidence](HOSTED-EMAIL-EVIDENCE.json) and [Google evidence](GOOGLE-LIVE-EVIDENCE.json).

## What's running

| Surface | Actual state |
| --- | --- |
| Implementation | Branch `codex/fastn-email-staging`, based on `b268807`; deployments include uncommitted working-tree changes |
| Isolated database | Supabase `jixzholamkbktzusyqwe`; migrations 001–008 applied; browser access to automation tables revoked |
| Backend | https://quizshield-automation-staging.vercel.app — deployment `dpl_AGJGnCryph8BvYw8gfbbaPbBcKDX` |
| Teacher UI | https://quizshield-automation-ui.vercel.app — deployment `dpl_67H8JoAxeU4SyAFJYM4iG9f6Uatp` |
| Email workflow | `wf_6128a556c8d8`, published `wv_a3e87176bbd9`, Live deployment `wdep_93e2748673db` |
| Google workflow | `wf_85ec71f0f969`, published `wv_bb6373c66c8a`, Live deployment `wdep_1bdcd52121e1` |
| Webhooks | Email `56be579f-f536-48cd-83a1-5c3cf6f80559`; Google `b6db412e-3eb6-442d-accf-9816fa4053bb`. Both authenticated, sequential, Live, delivery-ID deduplication |
| Hosted scheduler | Supabase cron job 1 active, every minute; runs 129, 130, 132 and 134 correlate to real Google executions; SQL succeeded and matching HTTP requests returned 200 |
| Email gate | Live staging enabled; allow-all false; sole allowed inbox `joinwaqarahmed@gmail.com` |
| Google gate | Enabled after authorization, ownership and action verification; teacher settings require an operator-verified tenant, installation and destinations |
| Google setup | Completed `stp_9db655104d21`; installation `inst_e162c34cd402`; active Calendar and Sheets connections for the staging teacher |

Vercel's “Production” environment here belongs to the separate **staging project**. Original production https://quiz-shield.vercel.app and Supabase `nuwugwbjpyovrmvpwyvs` were not migrated or deployed. Secrets remain in host environment settings and Supabase Vault.

## Hosted email acceptance

| Requirement | Live evidence |
| --- | --- |
| Draft sends nothing | Hosted draft `18e41431-9827-44bc-8853-3bad056a6f87` persisted zero jobs |
| Publish once to assigned students | Publishing twice produced one assigned job and no unassigned job. Earlier receipt `01a14a49-2f75-7cf9-8ff7-544cdaed3da0` was delivered |
| Optional reminder excludes submissions | Hosted submitted attempt `e3751dce-7814-407b-b939-8e931fe47d3d` excluded reminder `59b5131e-dcee-4dc7-b2c6-6fb28f7d940c`; real saved workflow and published execution `exec_9939620fa738` skipped it |
| Reschedule/cancel invalidates old reminders | Hosted API reschedule changed reminder revision 2→3; cancellation persisted cancelled status |
| Retry makes no duplicate email | Completed replay skipped before provider call; original delivery-ID webhook replay returned 409 twice, with no additional execution/email |
| Works without browser/local app servers | User confirmed QuizShield tabs closed; local application servers stopped. Hosted cron → Vercel → Fastn → Resend delivered the final announcement and reminder |
| Outside inbox blocked | Hosted callback for fixture `a4c3e0c6-d694-4867-bbff-c3187cd017ec` returned 403 with no first-delivery timestamp or provider receipt |
| Authenticated ingress | Unauthenticated worker and webhook returned 401; operator diagnostics also reject unauthenticated requests |
| Staging links | Provider message read-back confirmed staging frontend links in both final messages |

Final email quiz: `5620c061-a958-4789-b27a-3b4850069fcf`. Provider read-back repeated at 19:47:47 UTC still found exactly **two delivered messages**, both to the approved inbox.

| Kind | Job | Fastn execution | Resend receipt |
| --- | --- | --- | --- |
| Announcement | `fe59c5de-83fe-4481-b59d-6d5c62400b9d` | `exec_4dded96280ca` | `01a14b34-60e2-7ca4-a946-71f4870eb576` |
| Reminder | `b7e8ef71-9472-4a3c-aae5-1fd1eaf9bb64` | `exec_138997c1b035` | `01a14b35-eb9b-79b3-a9b3-dd2478854b09` |

Submission exclusion and reminder invalidation used real hosted API/database operations and real saved Fastn executions. The final two-message run additionally exercised the independent hosted schedule. These are separate forms of live evidence.

## Hosted Google acceptance and data parity

Verified tenant `176c89cb-8a1d-4ca7-82ef-59791f590100` belongs to fixture teacher `6c0dd35f-27da-4e27-96a1-0fb6736b51ad`. Both connectors use MULTI_TENANT scope, matching tenant/installation headers, backend ownership checks and verified destination IDs. Calendar access was read back as **owner** for `waqaruwaqar778@gmail.com`.

Dedicated Calendar: **QuizShield staging assessments**, ID `40635e1bdb149e35f1f678b7f26a202059af6159474e9568e753e95766869835@group.calendar.google.com`. Default reminders and event notification subscriptions are empty; test events have no attendees and use `sendUpdates=none`.

Dedicated [released-results Sheet](https://docs.google.com/spreadsheets/d/1NMfl6P1F0ppqtBt_Lcs4BTFN2sG4yhhx3GLOy7wYD2Y/edit) was created with the teacher-scoped connection. It was not shared by the automation. Writes use RAW values and reserved ranges, never append.

The five private Calendar actions (owned-calendar listing, event get/create/update/cancel) all executed against Google. Create supports a deterministic ID; duplicate insert returned 409. Update preserved that ID. Delete returned 204 and read-back returned `status: cancelled`. The private connector's action versions remain pinned at v1.0 in its test-stage catalog; those same versions executed successfully inside the deployed Live workflow.

Main hosted quiz: `a34932bf-35cb-4353-ac2d-a2f3800dbda6`. Stable Calendar event: `f8b40896b6eadc0b1b166d29205362558e11cb361a6483a95cdd1b974ff76909`.

| Action | Backend job | Fastn event | Completed Live execution |
| --- | --- | --- | --- |
| Publish → create | `f9927b87-3e48-4220-a8d9-229dc5d88a49` | `evt_7b64af44f7ca1e7d1e0ec2534b5a31eb` | `exec_32644c20ebc2` |
| Release → Sheet | `c1b0934e-6917-4fbd-9408-616711a89564` | `evt_353c508fe45ac85606a92aef41320a75` | `exec_e97c3725b949` |
| Reschedule → update | `5e9d12ca-eaf7-477f-abe0-1460df20337e` | `evt_7ca4ae1856340dc72255a384e77dc2ca` | `exec_2c460d14fb89` |
| Cancel → delete | `d4bfa9cb-a0e8-4c68-b79b-0f32586a9816` | `evt_5fdbe10d057f04ad671c8c1ced5e420c` | `exec_d4224024d5e0` |

All four completed successfully using the verified tenant/installation and hosted cron. Create caught an expected missing-event 404 before insertion; it was an intentional branch, not an unhandled failure.

- Reschedule read-back `7e92a4e1-ece6-4e25-8db8-6e4e7a5c6165` matched ID, title, start, end, timezone, revision, no attendees and disabled default reminders. Google truncates subsecond timestamps; comparison normalized to whole seconds.
- Cancellation read-back `92ec27d8-5ebc-490c-afdf-17ab42a489f8` confirmed cancelled status. Final calendar listing found zero active test events.
- Saving a private reviewed grade created zero Sheet jobs. Releasing twice created exactly one job. Attempt `7dede2a0-ec6b-4899-89cd-a68a1666ffe6`, reviewed grade 87, appeared in `Sheet1!A3:F3`.
- Sheet read-back `fb772d36-456c-4ec0-a05e-5da4b7de9ac8` compared all six source fields for the main and saved-suite attempts; each had exactly one row. Raw connector replay also left one row for its separate probe.
- Matching-context Google webhook replays returned 409 twice. An earlier diagnostic omitted tenant headers and entered a separate deduplication scope; its one execution `exec_8164e9bcbb35` completed **skipped**, with no Google writes. Diagnostics now copy the worker's exact tenant/installation headers.

## Saved suite and local coverage

Fastn saved validation: **email 8/8 pass; Google 11/11 pass**. Google cases covered real create, update, cancellation, Sheet write, completed replay and stale revision, plus rejected missing context, wrong tenant, hostile callback URL and backend HTTP failure, and the deployed webhook route. Negative cases fail before connector writes. The saved-suite live fixture is separate from the cron-driven lifecycle above; short-lived execution tokens were replaced with synthetic placeholders after validation.

Local checks: the full backend suite passed **47/47 tests**, including **14 API/delivery tests** and **17 isolated PGlite database tests**; **24/24 workflow unit tests** also passed. API/provider and workflow adapters are mocked locally; PGlite applies actual SQL migrations in an isolated database. The legacy smoke checks tolerate unavailable database responses and are not a production health claim. These checks do not substitute for the hosted/Google/Resend evidence above. Backend TypeScript and deployment builds passed. No live model-generated AI acceptance is claimed; AI remains degraded without its separate model credential.

## Platform limitation and remaining work

**No blocker remains for this teacher's controlled staging flow, and no additional credential is needed from the user.**

Fastn did not attach a newly added widget trigger to an existing installation. Active widget `wgt_2eed06caa23c` lists both workflows/triggers, but the existing installation did not receive a Google trigger clone. After unsuccessful reconciliation attempts, the working Google webhook was explicitly pinned to this verified tenant and installation and stored in its protected backend connection record. This route passed the full hosted lifecycle. Fastn feedback: `01792265909-cb0b4b74`.

Future teachers require explicit verified route provisioning until Fastn fixes installation trigger propagation. Automatic multi-teacher onboarding is not claimed. The earlier provider discovery form problem was bypassed with explicit managed-provider consent; authorization and live actions now work. Feedback `01792264083-6cdfd466` remains useful for improving that setup UI. A custom Google Cloud client ID/secret is not required for the completed staging connection.

Production activation is a separate, intentionally unperformed rollout. Before it, use a verified sender suitable for real recipients, production-specific secrets/migrations/teacher bindings, tenant route provisioning, and hosted queue/failure alerting. Current evidence establishes controlled staging behavior, not unrestricted production capacity or a delivery SLA. A third-party request already in flight cannot be atomically recalled; sequential current-revision processing reconciles subsequent Calendar state.

## Cleanup and handover

All controlled lifecycle quizzes are cancelled; all three test Calendar events are cancelled and the Calendar has zero active events. Three controlled result rows remain in the dedicated Sheet as reviewable evidence. The dedicated Calendar, Sheet, connection binding, active schedule, deployed workflows and logs are intentionally retained for staging use. Teacher email preferences were restored after tests, with optional reminders off. Recipient allow-all remains false. The final queue check found no stranded or failed jobs.

Next: review the test Sheet and this report. Further production rollout needs a separate instruction; no more setup form entries or credentials are needed for the verified staging teacher.
