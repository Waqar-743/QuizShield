-- =============================================================================
-- Migration 005: Launch Fixes
-- Run this ONCE in the Supabase SQL Editor before going live.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add missing columns to quiz_attempts
--    (auto_submitted, submission_reason, violations were written by code
--     but never existed in the schema — silently failing on every auto-submit)
-- -----------------------------------------------------------------------------
ALTER TABLE quiz_attempts
  ADD COLUMN IF NOT EXISTS auto_submitted     BOOLEAN   DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_reason  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS violations         JSONB     DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 2. Add missing columns to users
--    (face_encoding and profile_picture_url are used throughout but absent
--     from the original CREATE TABLE statement)
-- -----------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS face_encoding        TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url  TEXT;

-- -----------------------------------------------------------------------------
-- 3. Add missing columns to teacher_quizzes
--    (course_id is referenced in quizService but missing from schema)
-- -----------------------------------------------------------------------------
ALTER TABLE teacher_quizzes
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- Fix teacher_id type — it was VARCHAR(255) but should reference users(id) UUID.
-- We do this safely: add new UUID column, copy existing data, drop old.
-- Only run if teacher_id is still VARCHAR. Check with:
-- SELECT data_type FROM information_schema.columns WHERE table_name='teacher_quizzes' AND column_name='teacher_id';
-- If it returns 'uuid', skip this block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teacher_quizzes'
      AND column_name = 'teacher_id'
      AND data_type = 'character varying'
  ) THEN
    ALTER TABLE teacher_quizzes ADD COLUMN teacher_id_uuid UUID;
    UPDATE teacher_quizzes
      SET teacher_id_uuid = teacher_id::UUID
      WHERE teacher_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    ALTER TABLE teacher_quizzes DROP COLUMN teacher_id;
    ALTER TABLE teacher_quizzes RENAME COLUMN teacher_id_uuid TO teacher_id;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Add all missing indexes for high-traffic columns
-- -----------------------------------------------------------------------------

-- cheating_violations.quiz_attempt_id — queried on EVERY violation report
CREATE INDEX IF NOT EXISTS idx_violations_quiz_attempt_id
  ON cheating_violations(quiz_attempt_id);

-- quiz_attempts.quiz_id — queried in every submission and analytics call
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id
  ON quiz_attempts(quiz_id);

-- teacher_quizzes.access_code — queried on every quiz start-by-code
CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_access_code
  ON teacher_quizzes(access_code);

-- notifications.user_id — queried on every page load for unread badges
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id);

-- quiz_attempts composite — used in most student analytics queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_status
  ON quiz_attempts(user_id, status);

-- teacher_quizzes.teacher_id — used in all teacher dashboard queries
CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_teacher_id
  ON teacher_quizzes(teacher_id);

-- cheating_violations.timestamp — used for ordering violations
CREATE INDEX IF NOT EXISTS idx_violations_timestamp
  ON cheating_violations(timestamp DESC);

-- -----------------------------------------------------------------------------
-- 5. Enable Row Level Security on all tables
--    IMPORTANT: The backend uses the SERVICE ROLE key which bypasses RLS.
--    These policies protect against direct Supabase client access from browsers.
-- -----------------------------------------------------------------------------

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics              ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_quizzes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_codes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions      ENABLE ROW LEVEL SECURITY;

-- Revoke direct anon access (browser clients cannot bypass the Express API)
REVOKE ALL ON users               FROM anon;
REVOKE ALL ON teacher_quizzes     FROM anon;
REVOKE ALL ON quiz_attempts       FROM anon;
REVOKE ALL ON cheating_violations FROM anon;
REVOKE ALL ON questions           FROM anon;
REVOKE ALL ON notifications       FROM anon;

-- The service role (used by the backend) is unaffected by these policies.
-- Authenticated Supabase sessions (if any) can only read their own rows:
CREATE POLICY IF NOT EXISTS "Users can view their own data"
  ON users FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Students view their own attempts"
  ON quiz_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Students view their own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6. Verify migration ran correctly
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'quiz_attempts'
    AND column_name IN ('auto_submitted', 'submission_reason', 'violations');

  IF col_count < 3 THEN
    RAISE EXCEPTION 'Migration failed: quiz_attempts is missing required columns. Found %/3.', col_count;
  END IF;

  RAISE NOTICE 'Migration 005 completed successfully.';
END $$;
