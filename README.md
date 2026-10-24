# QuizShield

QuizShield helps teachers and schools manage online assessments, review student work and automate routine communication. Students join courses, take timed quizzes and receive teacher-reviewed results. Administrators control account access and teacher automation permissions.

**Hackathon demo:** [Open staging](https://quizshield-automation-ui.vercel.app/) · **Matching source:** [codex/fastn-email-staging](https://github.com/Waqar-743/QuizShield/tree/codex/fastn-email-staging)

This extends an existing React, Express and Supabase project. New work includes secure administrator access, account management, teacher automation controls, execution history and safe retries. It also removes active camera/face requirements, simplifies signup and adds original animated SVG artwork.

## Version and feature status

- **Staging / feature branch:** administrator dashboard, camera-free authentication, assessment publication/results release and managed automation.
- **[GitHub Pages](https://waqar-743.github.io/QuizShield/) / main:** separately published homepage and signup changes. The complete administrator/backend update is not released here.
- The full application is under review in [PR #6](https://github.com/Waqar-743/QuizShield/pull/6). Do not combine its frontend with the older production backend.

Signup asks only for name, email, password and Student/Teacher. Administrators use an operator-granted account. Protected API requests check current role, account status and session version. Teachers manage courses, assigned timed quizzes, submitted answers and grades. Browser focus/tab events provide context for human review; they do not establish cheating on their own. Results stay private until explicit release.

![Original homepage artwork; no account or student records](https://raw.githubusercontent.com/Waqar-743/QuizShield/codex/fastn-email-staging/qa/homepage-svg/staging-hero.png)

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand |
| API | Express, TypeScript, custom JWT/bcrypt authentication |
| Database/scheduling | Supabase PostgreSQL, transactional outbox, hosted Cron and pg_net |
| Integrations | Fastn, Google Calendar, Google Sheets, Resend |
| Optional AI | Gemini, when a valid server key is configured |

## Setup

### 1. Prerequisites and source

Use Node.js 22 or newer, npm, Git and your own private Supabase project. Fastn/Google/Resend accounts are required only for external automation. Gemini is optional.

```sh
git clone --branch codex/fastn-email-staging --single-branch https://github.com/Waqar-743/QuizShield.git
cd QuizShield
```

### 2. Database

Use an empty isolated project or a backed-up development database, without customer records.

The base schema is retained under `backend/src/scripts/`; ordered application migrations are `backend/migrations/001_*.sql` through `012_*.sql`. A new database needs the base schema before numbered migrations. Bootstrap is a manual operator step, not an automatic npm task. Legacy base scripts contain permissive development grants: apply later access hardening before exposing the API or browser database keys. A clean-database bootstrap has not been verified as one copy/paste command.

For an existing database, inspect the applied schema and run only outstanding migrations in numerical order. Never replay the table-creation or older launch-fixes script against a running database. Migrations 007–008 add the outbox/Google bindings, 009 fixes course codes, and 010–012 add administrator/session safeguards, retire camera defaults and invalidate disabled-account automation.

**Do not run** the cleanup under `backend/migrations/review/` during setup. Biometric cleanup requires a separate retention decision and reviewed execution. See [AUTOMATIONS.md](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/AUTOMATIONS.md) and [ADMINISTRATION.md](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/ADMINISTRATION.md) for migration and rollback details.

### 3. Backend

```sh
cd backend
npm ci
cp .env.example .env
```

PowerShell users can use `Copy-Item .env.example .env`. Fill the private file with values from **your own** development services:

| Setting | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your development database URL |
| `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` | Server-side database credentials; use the service role for the hardened application |
| `JWT_SECRET` | A unique random secret of at least 32 characters |
| `FRONTEND_URL` | Full app base URL; locally `http://localhost:3000` |
| `PORT`, `NODE_ENV` | Normally `5000` and `development` |
| `GEMINI_API_KEY` | Optional assistant/question-generation configuration |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional approved email sender configuration |

Generate a JWT secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save it only in the private local/server environment.

```sh
npm run dev
```

The API listens on `http://localhost:5000`. `/health` checks database and AI configuration separately: without Gemini, aggregate health reports AI as degraded even when database-backed assessments work.

### 4. Frontend

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The template's `VITE_API_URL` targets the local API. For a hosted build, explicitly use that deployment's API base, ending in `/api`.

**Never put service-role keys, Fastn/OAuth credentials or JWT secrets in a `VITE_` variable.** Browser configuration is public. Express owns authentication; Supabase is the database, not a separate browser authentication system.

### 5. First administrator

There is no default administrator email/password. The intended operator registers an ordinary account and verifies ownership out of band. With migrations applied and the trusted server environment loaded, run from `backend`:

```sh
npm run admin:bootstrap -- verified-operator@example.test --confirm-verified-owner
```

Replace the synthetic address with the verified operator's account. The command refuses once an active administrator exists and records an audit event. Use `/admin/login` with that account's existing password. Later administrator grants use the audited dashboard. See [the full operator procedure](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/ADMINISTRATION.md#first-administrator).

## How Fastn is used

Fastn handles external assessment actions. Supabase's existing outbox and worker remain the scheduler; there is no second parallel scheduler.

```text
Publish / reschedule / cancel / release results
  -> database transaction saves versioned automation jobs
  -> hosted Supabase Cron calls the authenticated Express worker
  -> worker dispatches to the authenticated Fastn webhook
  -> Fastn checks current eligibility with QuizShield before the side effect
  -> QuizShield Resend service or Google connector action
  -> receipt/callback updates the stored execution status
```

| Service / connector | Purpose |
| --- | --- |
| Fastn authenticated workflows/webhooks | Route actions with teacher context, run preflight checks and return execution evidence |
| Google Calendar | Create, update or cancel the teacher-owned assessment event |
| Google Sheets | Sync explicitly released results into a reserved results row |
| Resend through Express | Send approved announcement/reminder/result emails; Fastn calls this existing service rather than Gmail |

Drafts send nothing. Publication queues one announcement per assigned, enrolled student. One optional reminder excludes submitted students. Rescheduling/cancellation invalidates stale jobs. Sheets synchronization follows explicit results release. Stable Calendar IDs and reserved Sheet rows prevent duplicate records during retries. Unknown delivery outcomes require investigation rather than blind resend.

### Connecting a teacher's own accounts

1. An administrator assigns approved capabilities and defaults to the teacher.
2. The teacher authorizes their own Google account through a teacher-scoped Fastn setup link. Teachers do not enter Client Secrets, tenant IDs, keys or webhook URLs.
3. The operator verifies ownership, the installation and approved Calendar/Sheet destinations, then provisions/tests that teacher's route.
4. Only a verified binding is shown as connected. Reconnection and revocation remain teacher-specific; another teacher's credentials must never be reused.

**Current limitation:** the demo teacher has a verified working binding, but automatic new-teacher onboarding is incomplete. The existing installation does not automatically propagate the Google trigger. Operator provisioning is still required; Google consent alone does not create a working route.

### Configuration and hosted scheduling

New environments default to external delivery disabled. `backend/.env.example` lists these settings without secret values:

| Settings | Purpose |
| --- | --- |
| `FASTN_WEBHOOK_URL`, `FASTN_ACCESS_KEY` | Authenticated delivery route; server-only |
| `FASTN_PLATFORM_API_KEY`, `FASTN_GOOGLE_WIDGET_ID` | Administrator-guided teacher setup; server-only |
| `BACKEND_PUBLIC_URL`, `AUTOMATION_WORKER_SECRET` | Hosted HTTPS API origin without `/api`, and worker authentication |
| `AUTOMATION_LIVE`, `AUTOMATION_GOOGLE_ENABLED` | Explicit delivery/Google opt-in switches |
| `AUTOMATION_TEST_RECIPIENTS` | Approved test inboxes; keep real addresses in the private environment |
| `AUTOMATION_ALLOW_ALL_RECIPIENTS` | Keep `false` during development and the controlled demo |

In hosted Supabase Vault, set `quizshield_backend_url` and `quizshield_worker_secret`, then install `backend/deploy/supabase-cron.sql`. It calls the existing worker every minute, including with browsers closed and local servers stopped. Monitor the heartbeat and queue history: a configured connection or acknowledgement is not proof of delivery.

Detailed workflow configuration, destination ownership and recovery procedures: [AUTOMATIONS.md](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/AUTOMATIONS.md) and [ADMINISTRATION.md](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/ADMINISTRATION.md).

## Tests and evidence

From `backend`:

```sh
npm run build
npm test -- --runInBand
npm run test:fastn
```

From `frontend`:

```sh
npm run lint
npx tsc --noEmit
npm run build
```

Earlier acceptance recorded 113 backend tests and 24 mocked Fastn adapter tests, plus separate hosted email/Calendar/Sheets checks. Mocks do not prove current provider connectivity. [ADMIN-VERIFICATION.md](https://github.com/Waqar-743/QuizShield/blob/codex/fastn-email-staging/ADMIN-VERIFICATION.md) distinguishes real executions, dates and missing coverage. Historical deployment snapshots precede the later homepage/signup releases.

`backend/fixtures/ui-preview.cjs` supplies loopback-only synthetic visual-review data without accessing Supabase or external providers. It is not a production authentication path or a customer-data seed.

## Data and secret handling

- Use synthetic records and example domains such as `example.test`. Never commit customer/student records, grading exports, face images or customer OAuth material.
- Keep private environments, operator credentials and token-bearing setup links out of Git. Templates contain placeholders only; private `.env*` and `.vercel/` files remain ignored.
- Store secrets in server environment settings, Supabase Vault or Fastn's secure connection storage. Frontend responses contain safe account/connection details only.
- Submission screenshots should contain synthetic data or original artwork. Legacy identity/camera captures are excluded from the current README.
- If a credential appeared in a public commit, revoke/rotate it at the provider first. Deleting it from the latest file is insufficient. Review secret-scanning alerts and coordinate history cleanup before claiming a sanitized repository. Never publish key values or unredacted scan output.
- Permanent deletion and biometric cleanup are separate reviewed operator actions; setup does not delete assessment history.

## What's next

- Complete self-service Google provisioning and independent multi-teacher consent/isolation tests.
- Configure and verify optional Gemini features. Staging has no Gemini key; hints and concept explanations are separately unavailable.
- Finish browser account-setup/recovery and the full current live provider suite.
- Resolve the full feature PR's conflicts and perform a separately reviewed backend/database release. A Pages frontend deploy alone cannot release these backend changes.
