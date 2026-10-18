# Administrator and camera retirement verification

Verdict: **PASS WITH BLOCKERS for staging review; production release is not approved.** Tested on 18 October 2026 (Asia/Karachi). Original production, its database and GitHub Pages were not changed. Email delivery stayed restricted to `joinwaqarahmed@gmail.com`.

## Implementation under review

The feature branch is `codex/fastn-email-staging`, with [pull request 6](https://github.com/Waqar-743/QuizShield/pull/6). Use the [staging administrator sign-in](https://quizshield-automation-ui.vercel.app/admin/login) and [staging API](https://quizshield-automation-staging.vercel.app). Operator setup, account management, teacher instructions, migration and rollback procedures are in [ADMINISTRATION.md](ADMINISTRATION.md).

The implementation adds current-account authorization, session revocation, an operator-only first-administrator command, database protection for the last active administrator, account and course management, audit history, automation grants and operational views. It extends the existing outbox, Fastn workflows and hosted scheduler. Camera and face requirements, components, endpoints, dependencies and model assets have been removed from active application paths.

The prior working tree was backed up before editing at `.git/quizshield-before-admin-20261018`. Existing QA fixes, migration 009 and historical evidence were retained. The two user-owned root PNG files were checked against that backup and remain unchanged and uncommitted. Migrations 001–008 were not rewritten. See [deployment comparison](qa/admin-deployment-comparison.json) for the original branch, Pages and staging differences. Pages deploys `main`; its old bundle does not contain the teacher automation page. The feature branch's Vercel staging does.

## Automated checks

| Check | Result | Scope |
| --- | --- | --- |
| Backend Jest | 113 passed, 9 suites | Includes real in-process PostgreSQL/PGlite migration and concurrency tests, plus mocked API/provider boundaries |
| Fastn adapter tests | 24 passed | Local adapter tests with mocked providers; not 24 live deliveries |
| Backend TypeScript build | Passed | Compilation |
| Frontend lint, TypeScript and Vite build | Passed | Static validation and production bundle |

Regression coverage includes role/status/session changes, last-administrator concurrency, privileged endpoint denial, safe DTOs, account changes and job invalidation, ownership transfer, grants, teacher isolation, setup-link scoping, retired endpoints, quiz access/timing, private results and existing delivery deduplication. Mocked provider results are not presented as live connection success. CI now also requires frontend lint/types and the workflow adapter tests.

## Hosted application and database checks

| Evidence | Result | Coverage |
| --- | --- | --- |
| [Administrator API](qa/admin-hosted-api.json) | 37/37 passed on repeat run | Three roles, direct privileged calls, actual counts/search/details, invitation safeguards, suspension, stale sessions, role changes, removal confirmation, grants, teacher isolation, blocked setup, audit and logout |
| [Advanced administrator checks](qa/admin-advanced-api.json) | 12/12 passed | Enrolment, transfer, former-owner denial, two simultaneous administrator demotions, pending/running work invalidation and uncertain retry refusal |
| [Assessment lifecycle](qa/admin-assessment-lifecycle.json) | 21/21 passed | Draft silence, publish idempotency, access/timing, concurrent start, answer idempotency, immutable submission, private grades, explicit release and one Sheets job after release |
| [Final boundaries](qa/admin-final-boundaries.json) | Passed | Real first-admin audit event; anonymous access denied to all four new protected tables; completed browser assessment checked in the database; deployed camera Permissions-Policy |
| [Biometric cleanup trial](qa/admin-biometric-cleanup-dry-run.json) | Passed and rolled back | Descriptor-only cleanup on staging, preserving assessment counts and restoring the descriptor through rollback |

The first bootstrap was exercised against staging, not just mocked. The test administrator uses a randomly generated fixture password held only in ignored local operator storage. There are no application default credentials. Temporary secondary administrators were deactivated after testing; the primary QA administrator remains for review until a verified operator takes over.

## Real hosted automation and provider verification

The existing hosted cron dispatched these jobs while no local application server or worker was running. [Application evidence](qa/admin-hosted-automation.json), [provider readback](qa/admin-provider-readback.json) and [exact execution correlations](qa/admin-execution-correlations.json) are separate from mocks.

| Action | Provider evidence |
| --- | --- |
| One publication email | Fastn `exec_e2d1ae2d3d8b`; Resend receipt `01a14f94-6f32-76f4-84b8-fdf0ec51ecfb`, provider reports delivered to the approved inbox |
| Calendar event | Fastn `exec_7bf08806ff23`; event read back as confirmed, revision 2, Asia/Karachi, no default reminders |
| Released results to Sheets | Fastn `exec_4c6286c2f15b`; six fields read back from the reserved `Sheet1!A7:F7`, grade 86 and release timestamp match the application |
| Calendar cancellation | Fastn `exec_fd9999f3f865`; the same deterministic event read back as cancelled |

Publication replay did not create a second announcement, and results release created one Sheets action. The live test kept optional reminders disabled. Submitted-student exclusion and reminder retiming/cancellation are covered by automated regressions and retained earlier evidence; a new live reminder delivery was not performed during this acceptance run. The earlier saved 19-case Fastn suite remains historical evidence and was **not rerun in full** here. Provider workflow code and configuration were not replaced. A complete current live suite is a release gate.

A real teacher-scoped Fastn setup link was generated through the connected operator tool. The actual response contract (`setupId`, `setupUrl`, expiry, tenant and metadata) was checked and the backend adapter updated accordingly. The secret short-lived URL is omitted from Git. This proves link creation only; it does not prove a second teacher's Google consent or installation provisioning.

## Real browser coverage

Browser tests used the hosted staging application, not a local preview:

- Administrator ordinary password login and role redirect; real counts and scheduler status; narrow navigation; teacher search and account impact/details; logout.
- Teacher password login and redirect; **Integrations & automation** in the menu; assigned/locked settings and connection states; direct administrator navigation redirected to the teacher dashboard; logout.
- Student password login and redirect; quiz entry, answering and explicit submission with no camera prompt or preview. Attempt `fdc9668f-1650-4b6f-b490-51a1f16eba97` was confirmed completed with score 1, no teacher grade and no released results.
- Narrow layouts were inspected at 304px and approximately 665px CSS width. No full-width desktop or physical mobile-device run is claimed.

Screenshots: [administrator mobile navigation](qa/admin-evidence/admin-mobile.png), [automation operations](qa/admin-evidence/automation-operations.png), [account impact](qa/admin-evidence/account-impact.png), [teacher menu](qa/admin-evidence/teacher-menu.png), [teacher automation](qa/admin-evidence/teacher-automation.png), [student submission](qa/admin-evidence/student-submission.png).

Static checks found no active camera calls/face hooks, all seven model assets and the face dependency were removed, the result page contained no video element, and the deployed UI returned `camera=(), microphone=()`. No browser network recording was captured, so this is not a request-by-request network trace. Full browser registration, inbox setup/reset-link consumption, full-width desktop, physical-device mobile and network-failure recovery still need acceptance coverage. API and automated coverage for related validation/recovery paths does not substitute for those browser checks.

## Remaining blockers and limitations

1. New-teacher Google onboarding is deliberately blocked. Staging lacks `FASTN_PLATFORM_API_KEY` and `FASTN_GOOGLE_WIDGET_ID`. The existing Fastn installation omits its Google trigger instance; the original teacher has a separately verified route. The operator must configure the setup settings, allow each intended teacher's tenant, verify their own Google authorization/destinations, provision and test their own route and persist a verified binding. The UI never labels an incomplete new connection connected, and no teacher's credentials are reused for another teacher.
2. A second human teacher's consent and fully provisioned multi-teacher Google isolation have not been exercised live. Application-level cross-teacher access denial passed. Provider consent revocation remains a teacher/ Fastn operator action; the application's revoke control disables application access and queued work without claiming to erase provider OAuth tokens.
3. Complete the current 19-case live provider suite and the outstanding browser coverage above before production approval. The preserved prior QA limitation around recovering unsaved draft answers remains; this change does not claim a new draft-answer recovery feature.
4. Legacy biometric information remains stored pending review. The initial staging inventory found one descriptor, zero profile-image references and zero private profile objects. Production has not been inventoried. The separately gated cleanup migration was validated with rollback only and has not destructively run.

## Cleanup, rollback and next steps

Hosted test Calendar records were cancelled and test preferences restored. Synthetic account, course, quiz, submission, grading and audit evidence is retained for review rather than deleting assessment history. Synthetic never-dispatched in-progress leases were reconciled without provider side effects. The released Sheets test row remains as evidence. The approved recipient restriction remains enabled.

Review the PR and the additive migrations 010–012. Run the missing acceptance checks, complete operator-only Fastn provisioning and hand over the QA administrator to a verified human operator. Keep the access/session safeguards on rollback; use the camera-free application rollback guidance in ADMINISTRATION.md. Permanent account deletion and biometric-image deletion require a separate reviewed retention decision and are not part of this deployment. No merge or production deployment was performed.
