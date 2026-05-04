# QuizShield — Senior QA & Backend Review Report

**Reviewer:** Elite Senior QA Engineer & Backend Systems Analyst persona
**Scope:** `backend/` — Express + Supabase API powering an exam-proctoring platform for an educational institute
**Date:** 2026-05-04
**Build status after fixes:** `tsc --noEmit` clean · `npm test` 11/11 passing

---

## Viability Verdict

The backend is **production-conditional**. Architecture is sound (Express + Supabase service-role, JWT auth, rate limiting, structured routes, smoke tests), but it shipped with several integrity-critical gaps for a system that grades students and stores biometric face encodings: a non-atomic quiz submission path that could be raced into duplicate scoring, a scheduled-quiz expiry rule that locks honest students out, weak password hashing for 2026, missing security headers, fragile question-ID parsing, leaky error responses, and lack of input length caps that allow trivially abusive payloads.

**Scale multiplier — for an educational institute (high-burst load: 200+ students starting one quiz simultaneously at the start bell):** every flaw above becomes amplified. Multiple students racing the same submit endpoint, every teacher hitting the same access-code generator within seconds — these patterns are exactly where the bugs surface.

The fixes in this report bring the backend to a **conditional pass** for institutional pilot use. P0 follow-ups (RLS, biometric storage, DB constraints) must be completed before institute-wide rollout.

---

## Issues Found

Severity legend: 🔴 P0 (must fix before prod) · 🟡 P1 (fix before scaling) · 🟢 P2 (technical debt).

### 🔴 1. Race condition on quiz submission
- **File:** `backend/src/services/quizService.ts → submitAllAnswers`
- **Problem:** The flow read `attempt.status`, validated it, then issued a separate `UPDATE`. Two concurrent submits (browser retry, double-click, network blip + retry) could both pass the read check, then both write — the second submission overwriting the first student's answers, or in the worst case overwriting a higher score with a lower one. Likelihood: **High** under network instability. Impact: **Data integrity / unfair grading**.
- **Status:** ✅ FIXED — submission is now atomic via `update().eq('status', 'in-progress').select('id')`. If zero rows are affected, we throw `Quiz already submitted` instead of silently overwriting.

### 🔴 2. Scheduled-quiz expiry logic is broken
- **File:** `quizService.ts → startQuizByCode`
- **Problem:** The old code computed `expiry = scheduled_start + time_limit` and rejected starts past that. But `time_limit` is the **per-attempt duration**, not the availability window. Effect: a student who joins the class one minute after the scheduled start of a 10-minute quiz only gets 9 minutes — **not 10**. Worse, anyone who tries to start after `time_limit` expires from `scheduled_start` is locked out entirely with `QUIZ_EXPIRED`, even though no one has attempted yet. This is the kind of bug that causes a teacher to get a flood of "I can't open the quiz" messages mid-class.
- **Status:** ✅ FIXED — start is blocked only before `scheduled_start`; availability is now controlled by `is_active`, which is also enforced.

### 🔴 3. Duplicate in-progress attempts allowed
- **File:** `quizService.ts → startQuizByCode`
- **Problem:** A student could call `start` repeatedly (browser refresh, tab duplication, intentional abuse) and create unbounded `quiz_attempts` rows in `in-progress`. Each gets a unique attemptId; submissions to old attemptIds stayed open forever; analytics double-counted.
- **Status:** ✅ FIXED — start now reuses any existing in-progress attempt for the same `(user_id, quiz_id)` pair instead of creating a new one.

### 🔴 4. Fragile question-ID parser
- **File:** `quizService.ts → submitAllAnswers`
- **Problem:** `answer.questionId.split('-q')[1]` would silently return wrong indexes if a quiz UUID contained a literal `-q` segment, scoring answers against the wrong question.
- **Status:** ✅ FIXED — regex `/-q(\d+)$/` anchored at end-of-string; non-matching IDs are skipped instead of misrouted.

### 🔴 5. Email enumeration on register
- **File:** `authService.ts → register`
- **Problem:** Returned `'User already exists'` (HTTP 400) when an email was taken — a stock enumeration oracle for credential-stuffing prep.
- **Status:** ✅ FIXED — generic `'Unable to register with the provided details'` (HTTP 409). Note: the controller still returns 409 vs 201, so a *very* determined attacker can still distinguish, but the error message no longer confirms it.

### 🔴 6. Leaky error responses in production
- **File:** `middleware/errorHandler.ts`
- **Problem:** Raw `err.message` was forwarded to clients verbatim — including Supabase / Postgres errors that leak schema, constraint names, and column types.
- **Status:** ✅ FIXED — 5xx errors now return `'Server error'` in prod; 4xx errors with multi-line / >500-char messages are scrubbed; full detail is still logged server-side.

### 🟡 7. Weak password hashing
- **File:** `authService.ts → register, resetPassword`
- **Problem:** `bcrypt.genSalt(10)` is below current OWASP guidance for 2026 (≥12 for bcrypt).
- **Status:** ✅ FIXED — bumped to 12 rounds. **Note:** existing user passwords stay at 10 rounds until they next log in. Consider adding a transparent rehash-on-login (see Follow-ups).

### 🟡 8. Long-lived JWTs (30 days)
- **File:** `authService.ts`
- **Problem:** A 30-day token with no refresh / revocation list means a stolen token is valid for a month. For a system handling minor student data, that is too long.
- **Status:** ✅ FIXED — reduced to 7 days. Real revocation still requires a refresh-token mechanism (see Follow-ups).

### 🟡 9. Missing security headers
- **File:** `index.ts`
- **Problem:** No `helmet` — missing X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, etc.
- **Status:** ✅ FIXED — `helmet()` added with CSP off (irrelevant for an API) and CORP `cross-origin` (frontend on a different origin).

### 🟡 10. No input length caps
- **File:** `authService.ts`, `quizService.ts`
- **Problem:** A teacher could create a quiz with 10,000 questions and 1MB question bodies, or a student could PATCH a profile bio of unbounded size, all bounded only by the 10mb body limit.
- **Status:** ✅ FIXED — explicit caps on title / description / question text / options / option count / question count / time-limit range / name / bio / interests array length.

### 🟡 11. `trust proxy` not set
- **File:** `index.ts`
- **Problem:** Behind Vercel/Cloudflare, `req.ip` returns the proxy's IP, defeating per-IP rate limits.
- **Status:** ✅ FIXED — `app.set('trust proxy', 1)`.

### 🟡 12. Quiz access-code collision under race
- **File:** `quizService.ts → generateUniqueCode`
- **Problem:** 4-digit code (only 9000 keys) with non-atomic check-then-insert. Two teachers creating quizzes within the same millisecond could both probe the same unused code and both insert — last-write-wins on the constraint or, if no UNIQUE constraint exists, **two quizzes with the same code, breaking student lookups**.
- **Status:** ✅ PARTIALLY FIXED — switched to `crypto.randomInt`, used `maybeSingle()`, increased attempts to 25. The genuine fix is a `UNIQUE` constraint on `teacher_quizzes.access_code` plus retry on conflict — see Follow-ups.

### 🟡 13. Sensitive query parameters logged
- **File:** `index.ts`
- **Problem:** Morgan logged URLs that included `?code=`, `?password=`. Token redaction was already in place.
- **Status:** ✅ FIXED — added `code=` and `password=` to the log redactor.

### 🟢 14. Body limits are too generous
- **Problem:** `urlencoded` was set to 10mb. JSON stays at 10mb because face encoding + base64 profile picture in registration legitimately needs it; URL-encoded forms do not.
- **Status:** ✅ FIXED — urlencoded reduced to 2mb.

---

## What Still Works (briefly)

- Service-role Supabase client correctly isolated server-side (anon key never reaches frontend).
- CORS uses an exact-match Set with a controlled regex for GitLab Pages — no `startsWith` foot-gun.
- `requireEnv` and the JWT-secret-length check fail loudly at startup if misconfigured.
- Targeted rate limits per sensitive route (login / face verify / reset / AI / violations).
- Password reset uses `crypto.randomBytes(32)` + SHA-256 hashed token storage with TTL — textbook.
- Health endpoint returns 503 when degraded (good for k8s/Vercel probes).
- Smoke tests already cover the unauthenticated 401 boundary.

---

## What You Need to Do (Follow-Up Action Items)

These are **NOT** code fixes — they need infrastructure / DB / human action.

### 🔴 Database hardening (do first)

1. **Add a UNIQUE constraint on `teacher_quizzes.access_code`** (currently relied upon implicitly):
   ```sql
   ALTER TABLE teacher_quizzes
   ADD CONSTRAINT teacher_quizzes_access_code_unique UNIQUE (access_code);
   ```
2. **Indexes for hot paths** — verify these exist; add if missing:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz_status
     ON quiz_attempts (user_id, quiz_id, status);
   CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_status
     ON quiz_attempts (quiz_id, status, completed_at DESC);
   CREATE INDEX IF NOT EXISTS idx_enrollments_course_user
     ON enrollments (course_id, user_id);
   CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
     ON notifications (user_id, is_read, created_at DESC);
   CREATE INDEX IF NOT EXISTS idx_users_email_lower
     ON users (lower(email));
   CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_teacher
     ON teacher_quizzes (teacher_id, created_at DESC);
   ```
3. **Enable Supabase Row-Level Security (RLS)** on every table even though API enforces auth — defense in depth. The service-role key bypasses RLS, so you don't lose anything; you only gain protection if the service key is ever leaked or misused.
4. **Add `created_at` / `updated_at` audit columns** with default `now()` triggers on every table that doesn't already have them (especially `quiz_attempts`, `enrollments`, `notifications`).

### 🔴 Biometric data (compliance)

You store `face_encoding` as plain JSON in the `users` table. For an educational institute (minors, GDPR / FERPA-style requirements):
- **Move face encodings to a separate table** `user_face_encodings(user_id, encoding, created_at)` so face data has its own retention and deletion lifecycle.
- **Encrypt at rest** — store as `bytea`, not text. Encrypt with a server-side key (KMS or Supabase Vault).
- **Document a deletion policy** — when a user is deleted or asks for face removal, this row goes immediately.
- **Increase the match threshold** — `MATCH_THRESHOLD = 0.6` for 128-d face-api descriptors is the documented baseline but is too permissive for high-stakes auth. Tighten to `0.5` after measuring false-rejection rate on a real user sample.

### 🟡 Secrets & env

5. Rotate `JWT_SECRET` after deployment of these changes (existing 30-day tokens become unusable, which is what you want).
6. Make sure `SUPABASE_SERVICE_KEY` is **not** the same value as `SUPABASE_KEY` in production. Right now `environment.ts` falls back to the anon key, which would silently break service operations under RLS.

### 🟡 Refresh tokens / session revocation

7. Today, a stolen JWT is valid for 7 days with no kill switch. Add either:
   - A short-lived (15 min) access token + refresh token in an httpOnly cookie, OR
   - A `token_version` column on `users`; include it in JWT claims; bump it on logout/password-change to invalidate all old tokens.

### 🟡 Password rehash on login

8. After login succeeds, if `bcrypt.getRounds(user.password) < 12`, transparently re-hash and update. Lets the cost-12 upgrade roll out without forcing password resets.

### 🟡 Observability

9. Replace `console.*` with a structured logger (`pino` recommended — minimal overhead). Attach a per-request correlation ID middleware so you can trace a single student's failed submit through the logs.
10. Add metrics: error rate, p95/p99 latency on `/api/quizzes/*`, daily active students, peak concurrent attempts. A free Grafana Cloud instance is enough for an institute pilot.

### 🟡 Load test

11. Before the first real exam day: **load-test the start-quiz path with at least 200 concurrent students** hitting one access code. Use k6 or Artillery. Verify p95 < 500ms and zero duplicate `quiz_attempts` rows. The fixes in this PR make that possible — but you have to *prove* it.

### 🟢 Misc cleanup

12. `getStudentAnalytics` streak loop logic is correct but cryptic — pull it into a named helper with a comment.
13. The `notifyCourseStudents` insert is unawaited error-wise; if it fails, students don't see the new quiz. Wrap it in try/catch and log clearly.
14. Quiz `questions` are stored as a JSONB blob inside `teacher_quizzes`. This is fine for ≤100 questions but blocks per-question analytics ("which question did most students fail?"). If that analytics feature is on the roadmap, normalize into a `quiz_questions` child table.

---

## Files Modified

| File | Change |
|------|--------|
| `backend/package.json` | Added `helmet@^7.2.0` |
| `backend/src/index.ts` | helmet, trust proxy, log redaction (`code=`, `password=`), urlencoded body limit 2mb |
| `backend/src/services/authService.ts` | bcrypt rounds 10→12, JWT 30d→7d, input length caps, register email-enumeration fix, profile update validation |
| `backend/src/services/quizService.ts` | atomic submission guard, dedupe in-progress attempts, fixed scheduled-start expiry logic, robust questionId regex parser, crypto.randomInt for access codes, comprehensive payload validation |
| `backend/src/middleware/errorHandler.ts` | scrubs raw 5xx messages in prod, scrubs multi-line 4xx, no stack leaks |

**Build:** `tsc --noEmit` → clean.
**Tests:** `npm test` → 11/11 passing (smoke suite).

---

## Final Verdict

**Conditional pass for institute pilot.**

The code-level integrity bugs (atomic submit, scheduled-window logic, duplicate attempts, ID parsing) are fixed — these were the issues that would have caused real students to be misgraded or locked out on exam day.

Before institute-wide rollout (≥1000 students), you must complete:
1. The `UNIQUE(access_code)` constraint and the listed indexes (1 hour of DB work)
2. Biometric data isolation + encryption (1 day of work + legal sign-off)
3. A real load test of 200+ concurrent quiz starts (half a day with k6)
4. Refresh tokens or `token_version` for session revocation (1 day)

If you ship without those, you will eventually have an exam-day incident. If you ship with them, this is a defensible production deployment for an educational institute.
