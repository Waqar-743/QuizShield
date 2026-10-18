# Deployment Information

Administrator and automation work is deployed only to [staging UI](https://quizshield-automation-ui.vercel.app) and [staging API](https://quizshield-automation-staging.vercel.app). See [current administrator verification](ADMINISTRATION.md). Unrestricted student delivery remains disabled.

For current readiness, exact deployment IDs, limitations and evidence, see [the 18 October QA review](./QA_REVIEW_2026-10-18.md). For setup, hosted scheduling and environment variables, see [AUTOMATIONS.md](./AUTOMATIONS.md). Apply migrations through 012 in order; see ADMINISTRATION.md for operator bootstrap and the separately gated biometric cleanup. For optional ordinary profile assets, configure `profile-pictures` as a private bucket; uploads intentionally fail closed on an existing public bucket. Photo uploads are limited to 3 MB, including the host's registration encoding overhead. The original production application was not changed. The Railway instructions below are legacy references and must be checked against the host you actually use.

**Backend URL:** https://quizshield-production.up.railway.app
**API Endpoint:** https://quizshield-production.up.railway.app/api

## Setup
1. Add `VITE_API_URL` to GitHub Repository Secrets/Variables with value:
   `https://quizshield-production.up.railway.app/api`

2. Ensure Railway variables are set:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `FRONTEND_URL`: `https://Waqar-743.github.io`
