# Deployment Information

The controlled staging automation is deployed on Vercel: [backend](https://quizshield-automation-staging.vercel.app) and [teacher UI](https://quizshield-automation-ui.vercel.app). Email, Calendar and Sheets live acceptance passed; unrestricted student delivery remains disabled. See [the verification report](./backend/deploy/STAGING-VERIFICATION.md).

For setup, hosted scheduling and environment variables, see [AUTOMATIONS.md](./AUTOMATIONS.md). Apply migrations 007 and 008 in order before using the verified Google bindings. The original production application was not changed. The Railway instructions below are legacy references and must be checked against the host you actually use.

**Backend URL:** https://quizshield-production.up.railway.app
**API Endpoint:** https://quizshield-production.up.railway.app/api

## Setup
1. Add `VITE_API_URL` to GitHub Repository Secrets/Variables with value:
   `https://quizshield-production.up.railway.app/api`

2. Ensure Railway variables are set:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `FRONTEND_URL`: `https://Waqar-743.github.io`
