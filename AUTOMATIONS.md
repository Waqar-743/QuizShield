# QuizShield automations: implementation and deployment

This extends the existing React/Express/Supabase project. The isolated staging database (migrations 001–009), Vercel backend, two authenticated Fastn workflows and hosted cron are running. Controlled live acceptance passed for email, teacher-owned Calendar creation/update/cancellation and released-results Sheets sync. Email remains restricted to the sole approved inbox; original production was not changed. See the current [full QA review](QA_REVIEW_2026-10-18.md) and [fresh live evidence](qa/fastn-verification.json). The [earlier verification report](backend/deploy/STAGING-VERIFICATION.md) is historical. Local mocked tests are recorded separately. New environments default to delivery disabled.

## Findings from the code review

The active assessment path is `teacher_quizzes` → `quiz_attempts`, with inline questions and four-digit access codes. The separate `quizzes`/`quiz_questions`/topic path is legacy; its adaptive start flow is unavailable and is not an accepted feature. Course ownership uses `courses.created_by`; enrolment uses `enrollments(user_id, course_id)`. Authentication uses custom Express JWTs and ordinary email/password for all roles, with current-account and session-version checks on every protected request. See ADMINISTRATION.md for the new access and assignment controls.

Migration 009 restores unique course join codes. Current photo code requires a private `profile-pictures` bucket and signs owned references for one hour; it refuses new uploads to an existing public bucket. Set that bucket private before deploying to another environment, then retest registration and profile reload. The 3 MB application limit leaves room for registration base64 data under the hosting request limit. These staging changes do not migrate or configure production.

Before this change:

- Creating an assessment immediately made it active and inserted in-app notifications; there was no draft/publication boundary or durable outbox.
- One access-code path calculated expiry as opening time plus attempt duration. Updates omitted schedule and camera fields at the controller boundary. Availability had no independent closing time.
- Submission used a conditional status update to prevent overwrites, but did not enforce a server deadline. Concurrent starts could create duplicate attempts.
- Grading immediately exposed results and sent an in-app notification. There was no explicit release action.
- Resend sent account welcome and enrolment emails immediately. Password reset also used Resend. There was no existing Fastn integration.
- Temporary face-verification JWTs were accepted by general authentication middleware. Excessive proctoring flags could complete an attempt automatically.
- The base SQL grants browser database roles broad access. The older launch-fixes script attempts to harden it, but contains `CREATE POLICY IF NOT EXISTS`, which is not valid PostgreSQL syntax. Migration 007 applies the relevant missing attempt columns and closes direct browser table access without relying on that script.
- Deployment files disagree: README describes Vercel, DEPLOYMENT.md names Railway, and frontend production fallback names Vercel. Choose the actual hosted backend and set both frontend and backend URLs explicitly.

These findings are based on repository source and local tests; existing production behavior has not been inspected.

## Architecture and simpler choices

Supabase remains authoritative. `timestamptz` stores absolute instants; an IANA timezone records the teacher's intended display zone. For example, **25 October 2026, 10:00 AM Asia/Karachi** is `2026-10-25T05:00:00Z`. An assessment can stay available until noon while allowing a 30-minute attempt. A student starting at 11:50 gets at most ten minutes.

Database triggers save jobs in the **same transaction** as publication, schedule changes, enrolment and results release. Failed transactions cannot leak external work. No browser timers or unawaited serverless background tasks perform automation.

Hosted Supabase Cron calls the authenticated Express worker every minute. The worker claims persisted rows using leases and `FOR UPDATE SKIP LOCKED`. It handles in-app notifications and local practice suggestions directly, and dispatches email/Google work to Fastn's authenticated webhook. Fastn calls QuizShield preflight immediately before each side effect. A dispatch acknowledgement is `awaiting`, never delivered. A provider receipt completes the row.

Fastn invokes QuizShield's existing Resend service for email. It does **not** independently send Gmail/Resend mail. This keeps one sender, one verified domain and one idempotency mechanism. Student email content and addresses need not pass through Fastn. Password resets continue to use the existing direct service.

Practice suggestions use released teacher feedback and explanations for missed multiple-choice questions inside QuizShield. This is simpler, cheaper and more private than another AI/email workflow. Proctoring evidence is excluded. Suggestions are advisory; they do not decide grades or accuse students of misconduct.

Calendar events use deterministic IDs derived from the quiz UUID. Sheets writes use a database-reserved row per submission with `RAW` input; retries overwrite that row rather than append. The first bound destination remains attached to that assessment/submission, so changing default destinations cannot create duplicate records elsewhere. Use a dedicated results tab; do not sort, delete or insert rows in it. Use another tab for sorted reports. Row 1 headings: `Attempt ID | Quiz | Student | Email | Reviewed grade | Released at`.

One-way sync is intentional. There is no Calendar/Sheets schedule import endpoint. A future import must require explicit existing course and quiz IDs, verify teacher ownership, and save through the assessment schedule API. It must never invent questions or student assignments.

## Delivered behavior

| Workflow | Behavior |
| --- | --- |
| Enrolment | Optional course welcome; off initially |
| Publication | Save draft, then Publish; one announcement per assigned, enrolled student |
| Reminder | At most one optional email per quiz/student; recheck enrolment, assignment, completion and latest schedule |
| Reschedule/cancel | Revisioned jobs invalidate stale work; existing Calendar event is updated/cancelled; meaningful updates notify current assigned students |
| Results | Save grade privately, then Release saved results; private authenticated link, fixed Sheet row, in-app notification |
| Follow-up | Released results create private practice suggestions in the student dashboard |
| History | Pending, running, awaiting, succeeded, failed, cancelled and uncertain are persisted; teacher retry is available only for known failures |

An omitted assignment list means all current course enrolments; an explicit empty list means nobody. Recipients are expanded at publication. Later enrolments can access an all-enrolled quiz but do not receive a retroactive announcement. Enabling reminders generates unsent reminders for current enrolments. Removed or unenrolled students never receive an email after eligibility is revoked.

New assessments require an opening and future closing time before publication. Existing published assessments remain published; they can have a legacy open-ended window until a teacher sets a close. Existing graded completed results retain their prior visibility without retrospective emails. New reviews require release. Released grades are immutable in this version. Questions cannot change after the first attempt starts.

## Deploy the database and backend

1. Back up the database and use a staging project first. For an established database, confirm migrations 001–006 are present; then run `backend/migrations/007_durable_automations.sql` and `backend/migrations/008_verified_google_connections.sql` once, in order. It is a versioned migration, not a repeatedly executable setup script. Do not rerun the development table-creation script on production: it disables RLS and grants client roles access.
2. Deploy the backend on Vercel or Railway, with Node 20 or newer and a real Supabase service-role key. Migration 007 revokes browser database-role access; all application data goes through the ownership-checked Express API. `SUPABASE_SERVICE_KEY` is required in production.
3. Set the values from `backend/.env.example` in the host's secret environment. Never put service credentials in Vite variables. `FRONTEND_URL` is the full deployed app base, including `/QuizShield` on GitHub Pages. `BACKEND_PUBLIC_URL` is the HTTPS backend origin without `/api`.
4. Set frontend `VITE_API_URL` to the actual backend API base. Build/deploy the existing frontend with the appropriate Pages base path. Verify direct links to `/quiz/teacher-results/<attemptId>` resolve through the existing SPA fallback.
5. Vercel uses the native Express framework with `src/index.ts` and a 60-second function limit. `.vercelignore` excludes the legacy API wrapper. On Railway, use the existing backend build/start scripts and permit requests lasting at least 60 seconds. Do not enable two independent worker schedules.

Required automation environment:

| Variable | Value |
| --- | --- |
| `AUTOMATION_WORKER_SECRET` | Random secret of at least 32 characters, shared only with hosted scheduler Vault |
| `BACKEND_PUBLIC_URL` | Public HTTPS backend origin |
| `FASTN_WEBHOOK_URL` | Exact URL copied from Fastn's webhook trigger |
| `AUTOMATION_GOOGLE_ENABLED` | Defaults to `false`; blocks Google jobs and rejects settings that enable Sheets/Calendar until the separate Google acceptance phase passes |
| `FASTN_ACCESS_KEY` | Webhook authentication key, sent as `x-fastn-access-key` |
| `RESEND_API_KEY` | Existing email service key |
| `EMAIL_FROM` | Verified Resend sender/domain; testing default is not a production sender |
| `AUTOMATION_LIVE` | Keep `false` during setup; explicitly set `true` for controlled validation |
| `AUTOMATION_TEST_RECIPIENTS` | Comma-separated controlled test inbox addresses |
| `AUTOMATION_ALLOW_ALL_RECIPIENTS` | Keep `false` until all acceptance checks pass; explicitly enable production delivery later |

`JWT_SECRET`, Supabase variables and existing AI configuration are retained. Welcome, receipts and summaries are not sent by the old account/enrolment code. Receipts and summaries have no automatic sender in this version.

## Configure Fastn

Two independent workflows are deployed in staging:

| Purpose | Source to upload | Published / Live deployment |
| --- | --- | --- |
| Email | `backend/fastn/quizshield-email.mjs` | `wv_a3e87176bbd9` / `wdep_93e2748673db` |
| Calendar and Sheets | `backend/fastn/quizshield-google.workflow.mjs` | `wv_bb6373c66c8a` / `wdep_1bdcd52121e1` |

Edit the readable Google source `backend/fastn/quizshield-google.mjs`, then run `node fastn/build-workflows.cjs` from `backend`. Upload the generated `.workflow.mjs` artifact. Fastn's V8 loader accepts the default workflow export but rejects local named test exports; the helper removes only those named exports. Both workflows use `QUIZSHIELD_API_BASE=https://your-backend/api/automations/delivery`. Business eligibility, recipient restrictions, provider receipts and stable side-effect identity remain authoritative in the backend.

For a new environment:

1. Apply migrations through 009, then configure the backend secrets and private photo storage as described above. Begin with live delivery and Google disabled.
2. Create the email workflow from its source. Use Standard execution, a timeout below the five-minute lease, and one attempt. Publish and explicitly deploy it to Live.
3. Create an API-key-authenticated webhook with Sequential dispatch, `deliveryId` deduplication and no automatic trigger retries; route it to the Live deployment. Set `FASTN_WEBHOOK_URL` and the **Live** `FASTN_ACCESS_KEY` in backend environment settings. MCP login does not provision this hosted credential.
4. Complete controlled email acceptance before enabling Google. Keep `AUTOMATION_ALLOW_ALL_RECIPIENTS=false`.
5. Authorize Calendar and Sheets for the actual teacher's Fastn customer/installation. The staging connection used a managed Google provider; no separate user Google Cloud client credentials were needed.
6. Bind the Google workflow's connectors with **MULTI_TENANT** scope and pinned action versions. It uses literal connector calls, not dynamic action mappings. The private `quizshieldGoogleCalendar` connector supplies owned-calendar listing and deterministic get/create/update/cancel; its typed HTTP definitions are in `backend/fastn/calendar-action-templates.json`. The stock Calendar insert/update contracts lack the required deterministic ID and complete resource controls. All five private actions passed live checks.
7. Verify teacher ownership and the exact dedicated destination IDs. Keep Calendar attendees empty, `sendUpdates=none`, default reminders off and calendar notification subscriptions empty. Sheets uses `updateValues`, a reserved range and `valueInputOption=RAW`, never append. Verify create/read/update/cancel, conflicts, replay and six-field Sheet parity against Google.
8. Publish/deploy Google and provision its authenticated webhook. Pin the route to the verified teacher tenant and installation, with matching `x-end-org-id` and `x-installation-id` context. Never route a caller-supplied destination. Through an operator-only database session, store `tenant_ref`, `installation_id`, verified destination IDs, `verified_at` and `google_webhook_url` in `automation_connections`; set connected flags only after verification. Teacher settings cannot replace these bindings.
9. Enable Google in the host and opt in that verified teacher's Calendar/Sheets preferences. Run the complete live lifecycle and save evidence. Repeat ownership and route verification for every teacher.

The staging widget `wgt_2eed06caa23c` is active, and setup `stp_9db655104d21` completed. Fastn did not propagate a newly added trigger to this existing installation. The working staging Google webhook was therefore explicitly pinned to the verified teacher/installation and saved in its backend binding; it passed the independent hosted schedule. Future teachers need explicit route provisioning until platform trigger propagation is fixed (feedback `01792265909-cb0b4b74`). Automatic multi-teacher onboarding is not claimed.

`backend/fastn/quizshield.mjs` and `verified-action-mappings.json` are older local orchestration references, not the deployed Google workflow. Do not configure `QUIZSHIELD_ACTIONS` for the current literal-call workflow.

The UI reports operator-provisioned connection status; it does not implement self-service Google OAuth. Status is not a live token-health probe. Revocations appear as failed/uncertain executions until the operator reconnects the account.

## Install the hosted schedule

In the **hosted Supabase** Vault, create `quizshield_backend_url` (the backend HTTPS origin) and `quizshield_worker_secret` (the same worker secret as the backend). Enable Supabase Cron/pg_net if necessary. Run `backend/deploy/supabase-cron.sql` to create a single recurring job. It replaces an existing job of the same name instead of duplicating it.

The schedule calls `POST /api/automations/worker` every minute with a Bearer secret. Opening/closing enforcement compares timestamps in the API and database, so access boundaries do not depend on cron timing. Notifications may be delayed by the minute interval, host cold starts, queue size or provider outages. A batch processes at most ten jobs; for larger cohorts, increase safe hosted throughput and monitor queue lag before promising a delivery SLA.

Inspect both `cron.job_run_details` and `net._http_response`: a successful SQL cron invocation only means the HTTP request was queued. Configure hosted alerts for worker HTTP failures, queue age, `failed` and `uncertain` counts. Database queue rows survive process restarts, host redeploys and closed browsers.

## Failures, retries and reconciliation

Known preparation/connection failures appear as `failed`; the owner may use Retry after fixing configuration. Every retry rechecks recipient eligibility and current state. Unknown dispatch/provider outcomes and expired leases appear as `uncertain` and have no teacher resend button. This intentionally trades automatic recovery for avoiding duplicate mail after ambiguous failures.

For uncertain work, an operator checks the Fastn execution and provider record. If the side effect happened, record its provider receipt and set the job to `succeeded` through an operator-only database session. If it provably did not happen, invalidate the old execution token, then requeue it with the **same** side-effect key. Never blindly requeue uncertain emails. Resend deduplicates keys for 24 hours; this implementation refuses another provider call after 23 hours from its first attempt. Callback tokens are job-specific and short-lived. Keep them out of logs and screenshots.

Calendar sequential processing, stable IDs, revisions and a second preflight prevent stale queued changes from replacing newer schedules. A third-party request already in flight when a schedule changes cannot be atomically recalled; the next sequential current-revision job brings Calendar to the latest state. Stopping sync or disconnecting a Google account prevents further writes until re-enabled/reconnected. Existing records remain in the originally bound destination.

## Verification and acceptance checks

Run from `backend`: `npm ci`, `npm run build`, `npm test -- --runInBand`, `npm run test:fastn`. Database tests execute the real migration and triggers in isolated PGlite PostgreSQL. API delivery tests use controlled in-memory fixtures and a mocked email provider. Fastn orchestration tests use mocked connector adapters. The Jest command enables VM modules for PGlite's dynamic WASM imports. From `frontend`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

Local checks cover draft silence, atomic save/outbox rollback, assigned recipients, server window boundaries, attempt duration, repeated starts, no completed-student reminders, withdrawn enrolment, cancellation, stale revisions, one-reminder policy, lease expiry, private release, ownership, retired face-endpoint rejection, fixed Sheet rows, Calendar orchestration and simulated external failures. Hosted email and teacher-bound Google acceptance have both passed separately; see the evidence report. The following checklist is retained for new environments.

The existing dependency audit reported 66 backend and 32 frontend findings during installation. They need a separate dependency review; no broad dependency upgrades were included in this feature. Existing frontend build warnings include an older Browserslist dataset ; the face-recognition dependency and models have been removed. The original smoke tests accept database-unavailable responses; passing them does not establish a working production authentication/database connection.

1. Use a staging teacher, two controlled enrolled students and one unassigned controlled account. Keep the email allowlist enabled. Select a dedicated test Calendar and empty results tab.
2. Save a future quiz, confirm no draft announcement, then publish and confirm only assigned students get one announcement. Restart/redeploy the worker and confirm completed jobs do not repeat.
3. Enable one reminder. Complete one student's attempt before the reminder is due. Close every QuizShield browser and stop local servers. Use hosted scheduler/provider history to confirm the unsubmitted student's reminder arrives and the completed student's does not.
4. Verify early access is denied, start at the scheduled Pakistan time, and verify submission beyond the earlier of duration/close is rejected server-side. Repeat while the browser clock/timezone is changed.
5. Reschedule, then cancel another quiz. Confirm outdated reminders are invalidated and only one Calendar event exists with the latest schedule/cancelled state. Verify an attempt cannot start after cancellation.
6. Save a grade privately, confirm the student cannot see it, then release the saved grade. Check one private result message, one approved-results row, and practice suggestions inside QuizShield. Replaying a callback must not create another email or Sheet row.
7. Disconnect a test Google connection or simulate a provider failure. Confirm history reports failure/uncertainty, not success. Restore access and retry only known failures. Try another teacher's job ID and confirm access is denied.

For local visual inspection only, `node backend/fixtures/ui-preview.cjs` after a backend build starts a loopback-only in-memory API at port 5556. Run the frontend with `VITE_API_URL=http://127.0.0.1:5556/api`, then sign in with `preview@example.test` and a non-empty test password. This fixture never accesses a database or external provider and is not a production login path.

## Short hackathon demonstration

1. Show Integrations & automation: minimal email defaults, Pakistan timezone, controlled recipients and execution history.
2. Save an assessment for 25 October at 10:00 AM Pakistan time, closing at noon, with a 30-minute attempt and selected students. Show that saving stays quiet; publish and point to durable queued actions.
3. Use a second short scheduled assessment for the live demo. Close all QuizShield pages and show the hosted cron/Fastn run. Reopen to show successful receipts and the Calendar event.
4. Have one controlled student submit, save a reviewed grade, and show that results remain private until Release. Show the private link, one Sheet row and practice suggestions.
5. Reschedule/cancel the other assessment and show stale reminders cancelled and the same Calendar event updated. Finish by showing a simulated failed action and its safe retry state.

Do not claim the future-date example or provider integrations ran live unless the hosted acceptance pass has actually been completed.

## Official references checked

- [Fastn webhook triggers](https://github.com/fastn-ai/docs/blob/main/build/triggers/webhooks.md): authentication header, sequential mode and payload deduplication.
- [Fastn workflow runtime](https://github.com/fastn-ai/docs/blob/main/reference/workflow-runtime.md) and [editor tabs](https://github.com/fastn-ai/docs/blob/main/build/workflows/the-tabs.md): context, tenant headers and workspace-specific connector signatures.
- [Supabase hosted scheduling](https://supabase.com/docs/guides/functions/schedule-functions) and [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
- [Google Calendar insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) and [Sheets values.update](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/update).
- [Resend idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).
- [Vercel functions configuration](https://vercel.com/docs/project-configuration/vercel-json#functions).
