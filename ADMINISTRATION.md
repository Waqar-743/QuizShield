# QuizShield administrator operations

This feature runs on the separate [staging UI](https://quizshield-automation-ui.vercel.app) and [staging API](https://quizshield-automation-staging.vercel.app). Original production, its Supabase project and GitHub Pages are unchanged. Delivery remains limited to the existing approved inbox `joinwaqarahmed@gmail.com`.

## Implementation and deployment

`main` is `b268807`; the feature branch started at `18c36e7`. The local tree also contained the previous QA fixes, migration 009 and QA evidence. They were backed up before editing and retained. The two user-added root PNGs are excluded from commits and remain untouched.

GitHub Pages deploys only `main` using `.github/workflows/pages.yml`. Its last successful build was [run 26206217124](https://github.com/Waqar-743/QuizShield/actions/runs/26206217124). Its shipped JavaScript does not include `TeacherAutomations`; the separate Vercel staging bundle does. This is a branch/deployment difference. Deploying staging does not update Pages. See [the captured comparison](qa/admin-deployment-comparison.json).

React, Express, custom JWT/bcrypt authentication, Supabase and Fastn remain in place. New administrator routes use `/api/admin`; the dashboard uses `/dashboard/admin`. The teacher menu continues to contain **Integrations & automation**. The existing transactional outbox, worker and hosted cron remain the only scheduler.

## First administrator

There is no public administrator registration, default account or default password. Ordinary registration accepts only student and teacher roles. Administrator profile editing cannot set a password, reset token, hash or email identity.

1. Apply the existing schema and migrations 001–009, then the additive `010_admin_access.sql` `011_retire_camera_configuration.sql` and `012_manage_disabled_automation.sql`. Never replay the legacy schema scripts against an existing deployment; some original scripts grant anonymous access. Preserve the existing RLS/grant hardening from 007 and the previous deployment.
2. The intended operator creates an ordinary account with their own email/password. Verify ownership out of band. Do not promote an unverified email based only on its name.
3. In a trusted operator shell, configure the intended deployment's server environment, including its Supabase service role key and JWT secret. Verify the project reference before proceeding. These credentials never belong in the browser, Git, chat or an account profile.
4. From `backend`, run `npm run admin:bootstrap -- verified-owner@example.com --confirm-verified-owner`. This calls a service-role-only database function under a transaction lock. It refuses once an active administrator exists, grants the verified existing account administrator access, revokes its existing sessions and records an audit event.
5. Sign in at `/admin/login` using that account's existing password. The account lands at `/dashboard/admin`. After bootstrap, an existing administrator can grant administrator status through the audited account editor. Set up a second trusted administrator before any planned handover.

Staging browser QA uses a separately generated, random-password fixture. Its credentials exist only in the ignored local `backend/.vercel/admin-fixtures.json`; they are not application defaults and must never be committed or shared. For an operator handover, grant a verified operator administrator access, then deactivate the test administrator. The last active administrator cannot be suspended, deactivated or demoted, including through concurrent database requests. Physical account deletion is disabled by a database trigger.

Every protected API request reads the current account role, active status and session version. Role/status/password/email changes increment that version. Password reset and online logout revoke old sessions. The frontend checks on mount, window focus and every minute while visible; API authorization takes effect on the next request immediately. Offline logout clears the browser; server revocation requires a successful online request.

## Administrator guide

1. **Overview** shows actual teacher/student totals, courses, teacher-authored quizzes and completed submissions. Totals include inactive accounts; these are not active-account estimates. A failed query produces an error rather than invented counts.
2. **Teachers**, **Students** and **All accounts** support name/email search, status filters and 20-row pages. Open an account for status, permitted profile fields, owned/enrolled courses, authored assessments, recent assessment records and automation records. Detail views show the latest 50 records and their total counts.
3. **Invite account** creates a locked invited account with an unpredictable unusable password. The recipient receives an expiring, single-use account-setup link and chooses their own password. Outside the staging allowlist no email is sent and the account remains invited. Invite delivery failure leaves a recoverable invited record; retry through password recovery. An administrator cannot activate an invited account before setup.
4. **Save account** edits name/bio and access/role. **Send password recovery** never reveals a password or reset token. A suspended or deactivated account must first be reactivated before recovery is allowed.
5. Before selecting **deactivated**, inspect **Removal impact** and the listed courses, quizzes, assessment records and automations. Confirm the explicit checkbox. Deactivation is the normal removal process: records and grades remain, sessions are revoked, queued work is cancelled and dispatched work becomes uncertain. It is recoverable by restoring active status.
6. **Courses & enrolment** transfers a course to an active teacher with explicit confirmation. The transaction also transfers its teacher quizzes, bank-question authorship and legacy course assessment/code ownership. Existing attempts and reviewed grades remain. Pending old-owner jobs are invalidated; in-progress jobs require reconciliation. Existing Google records remain at the original teacher's destinations and credentials are never transferred. Review these records before the successor resumes synchronization.
7. Find the successor teacher or student by name/email using the paginated account selectors. Course capacity and active student status are enforced. Unenrolment stops pending recipient actions and retains submissions.
8. **Audit history** records administrative profile/access changes, invitations, recovery requests, transfers, enrolments, automation assignments, safe retries and delivery reconciliation. It contains actor/target IDs, time and allowlisted change details, never authentication secrets.

Permanent deletion is intentionally unavailable. Existing foreign keys include cascades from users/courses to enrolments, attempts and automation records; a raw delete can destroy assessment and grading evidence. A future destructive cleanup requires a separate retention decision, reviewed dependency inventory, backup, ownership-transfer plan and explicit authorization. Do not disable the deletion trigger as routine account management.

## Automation operations guide

1. Open **Automation operations**. The scheduler panel reports the database worker heartbeat, relay/email configuration, delivery switch and recipient restriction. Configuration alone is not delivery success. A heartbeat older than five minutes needs investigation in Supabase `cron.job_run_details` and `net._http_response`; verify the staging backend URL and worker secret in Vault. The existing `quizshield-automation-worker` cron runs every minute with local servers stopped.
2. Select a teacher. Assign announcement, one reminder, schedule/cancellation, welcome or released-results email; Google Calendar; and/or released-results Sheets synchronization. Choose enabled defaults and which preferences the teacher may change. New teachers have no grant. Migration 010 preserves explicit existing teacher automation configurations.
3. Save the assignment as **active**, **paused** or **revoked**. Pausing/revoking cancels pending external work; in-progress actions become uncertain. Re-enabling access does not silently replay cancelled historical messages. Only eligible failed actions can be retried. Unassigned/disabled teachers and students are rechecked before each dispatch and callback side effect.
4. Set reminder hours (1–168) and timezone. Existing reminder-retiming behavior remains. Destinations are locked to the teacher's separately verified connection. Teachers cannot substitute a Calendar, Sheet, tenant, installation or webhook. Existing Google records keep their original deterministic event ID or reserved Sheet row.
5. Filter execution history by teacher, assessment ID, action and status. **Retry safely** accepts only still-eligible failed jobs with no receipt and a valid deduplication window. It retains the original deduplication key. Successful, uncertain or stale email jobs cannot be blindly retried.
6. For **uncertain** actions, investigate the original job/delivery ID in Fastn and the provider. Use **Investigate** only to record an independently confirmed provider receipt and evidence note. This action sends nothing. If delivery remains unknown, leave it uncertain; do not invent a receipt or create another message.

Drafts queue no actions. Publication is idempotent and announces only to assigned, enrolled students. One optional reminder excludes completed submissions. Rescheduling/cancellation invalidates obsolete work. Reviewed results stay private until explicit release; Sheets jobs are created only after release. Calendar uses a deterministic event ID, no attendees and no default reminders. Sheets uses reserved rows and RAW values. All delivery paths retain the approved test-recipient gate.

## Google connection setup and current blockers

Teachers authorize their own Google accounts. The application does not collect Client Secrets, service keys, tenant IDs or callback URLs from teachers. Credentials remain in Fastn storage; only server-side binding references exist in Supabase.

1. The operator configures `FASTN_PLATFORM_API_KEY` (server only, with setup-link and installation read permissions) and `FASTN_GOOGLE_WIDGET_ID`. Do not reuse the webhook delivery credential by assumption. The staging server currently lacks these new setup settings; the UI reports this as **blocked**, not connected. The existing email/verified Google delivery relay continues independently.
2. The administrator assigns Google capabilities, then chooses **Generate teacher authorization link**. The server resolves the teacher from the authenticated application account, uses a stable teacher-specific external reference (or the existing teacher's bound tenant), and requests a 15-minute Fastn setup link. A reconnect requests a new connection under that same teacher scope. The teacher can also start this from their own automation page.
3. The selected teacher opens the short-lived link and authorizes their own Google account. No administrator should consent with their own account for a different teacher. The teacher returns and chooses **Check setup**, or the administrator chooses **Verify setup**. Query-string callback values alone never prove success; the server reads the stored setup resource and checks its teacher metadata and tenant ownership.
4. Provisioning must also pass the operator checks below. Merely finishing OAuth never marks a connection ready. The current Fastn widget is allowed only for the original staging teacher; its existing installation contains the email trigger instance but omits the Google instance. The original verified teacher uses a separately provisioned, tested Google route. This limitation is still present; a new teacher must not reuse that route.
5. In Fastn, allow the intended teacher's tenant, verify that the installation belongs to that teacher and widget, and confirm both Google connections are active under that installation. Verify Calendar **owner** access and Sheet access through that installation; approve only dedicated assessment destinations. Verify the Sheet's six-column results tab. Provision the missing teacher-specific Google webhook instance, prove its tenant/installation headers, run its approved test suite and correlate a real execution. Only then may the operator write a verified binding for that teacher. Calendar ownership is also checked during each real Google delivery.
6. The application deliberately leaves new provisioning **blocked** until the missing installation route and destination ownership are verified. It provides no ordinary profile/API field for declaring arbitrary connection success. The existing operator verification uses provider tools and service-role-only binding storage; automatic new-teacher verification/provisioning remains a release gate.
7. **Revoke Google access** removes the application's verified access flags and invalidates its queued Google jobs. Reconciliation remains necessary for actions that already reached Google. To remove provider consent itself, the teacher also removes Fastn in Google account security, or the Fastn operator revokes the scoped connections. Application revocation does not claim to have deleted OAuth tokens from Google/Fastn.

A real teacher-scoped Fastn setup link was generated during this run using the connected operator tool. Its response uses `setupId`/`setupUrl`; the backend adapter follows that contract. This proves provider link generation, not authorization of a second teacher or end-to-end new installation provisioning. No short-lived setup link is committed in evidence.

Provider references: [Fastn HTTP authentication](https://github.com/fastn-ai/docs/blob/main/reference/api.md), [Fastn tenancy](https://github.com/fastn-ai/docs/blob/main/tutorials/developer/understanding-tenancy.md). The integration continues using the previously approved workflows; their code/configuration was not replaced.

## Teacher guide

1. Sign in with email/password; open **Integrations & automation** in the teacher sidebar.
2. Read your administrator assignment and connection status. Unassigned capabilities and administrator-controlled fields are disabled and labelled.
3. For assigned Google capabilities, choose **Connect or reconnect my Google account**, authorize your own account and check setup. If blocked, ask the administrator to finish the indicated setup; do not enter provider secrets or borrow another teacher's connection.
4. Change only enabled preferences, then choose **Save permitted settings**. Calendar/Sheet destinations remain read-only. Drafts remain quiet; publication, reminders and released results follow the rules above.
5. Inspect your execution history, filter statuses, and retry eligible failures. An uncertain delivery requires administrator investigation.

## Camera retirement and biometric cleanup

Registration, all role sign-ins, profile setup and quiz entry/completion no longer use face enrolment, live face verification or camera access. Removed components/hooks, face-login and registration-picture endpoints, temporary face tokens, monitoring switches, the `face-api.js` dependency and all seven public model assets. New reports accept browser activity types only; camera/face event types are rejected. Vercel UI responses disable camera/microphone through Permissions-Policy. Ordinary private profile-picture support remains optional and separate; initials are used without requiring any asset.

Existing migrations 001–009 were preserved. Migration 011 retires camera defaults without deleting legacy columns. Legacy evidence and user-owned images remain historical files, not active features. See [inventory](qa/admin-biometric-inventory.json): staging initially held one descriptor, no image references and zero private profile objects. Production was not inventoried or changed.

`backend/migrations/review/012_legacy_biometric_cleanup.sql` is **review-only** and is never run automatically. It requires `SET LOCAL quizshield.confirm_biometric_cleanup='approved'` inside an explicit transaction. It clears numeric descriptors, preserves all assessment/grading/history rows and deletes no images. A hosted staging trial passed and was rolled back; see [dry-run evidence](qa/admin-biometric-cleanup-dry-run.json). No destructive cleanup was committed to staging.

Before any permanent cleanup, inventory production separately, obtain the institution's retention decision, protect a time-limited encrypted backup and review image provenance. A profile-picture key alone does not distinguish a biometric enrolment photo from an ordinary avatar. Review explicit object keys with documented provenance; never delete the whole bucket or infer biometric purpose from faces in images. Backup recovery, if authorized, must preserve the retired collection/access policy.

## Rollback and production release

The migrations are additive except for retirement of old camera defaults. Roll back the staging application to a reviewed camera-free build; keep the access columns, audit records, deactivation state and session versions. Do not redeploy a JWT-only middleware build against suspended accounts. Disable new external dispatches during an incident and reconcile in-progress jobs before resuming. Do not restore removed camera code as a routine rollback.

Before production: review/merge the PR through the normal human process; back up and apply additive migrations to the intended production project; bootstrap a verified operator; configure/check hosted cron and all server settings; complete multi-teacher Fastn provisioning and independent Google consent/isolation checks; repeat role, recovery, timing and assessment acceptance in the deployment environment. Unrestricted email remains a separate explicit release decision. Neither merge nor production deployment is performed by this work.

Current test evidence and remaining coverage are in [the verification report](ADMIN-VERIFICATION.md). The older QA report remains historical evidence of the preserved fixes; its camera requirements are superseded by this document.
