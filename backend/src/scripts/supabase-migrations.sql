-- Quiz Codes Table
-- Run this in Supabase SQL Editor

-- Create quiz_codes table
CREATE TABLE IF NOT EXISTS quiz_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  max_attempts INTEGER
);

-- Create index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_quiz_codes_code ON quiz_codes(code);
CREATE INDEX IF NOT EXISTS idx_quiz_codes_quiz_id ON quiz_codes(quiz_id);

-- Cheating Violations Table
CREATE TABLE IF NOT EXISTS cheating_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID,
  teacher_id UUID REFERENCES users(id),
  violation_type VARCHAR(50) NOT NULL,
  detection_method VARCHAR(100),
  severity VARCHAR(20) DEFAULT 'low',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_violations_attempt_id ON cheating_violations(quiz_attempt_id);
CREATE INDEX IF NOT EXISTS idx_violations_student_id ON cheating_violations(student_id);
CREATE INDEX IF NOT EXISTS idx_violations_teacher_id ON cheating_violations(teacher_id);

-- Add new columns to quiz_attempts table if they don't exist
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'in-progress';
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20);
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS teacher_grade INTEGER;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS violation_count INTEGER DEFAULT 0;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS accessed_via VARCHAR(20) DEFAULT 'enrolled';

-- Remove foreign key constraint on quiz_id if it exists to support teacher_quizzes
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'quiz_attempts_quiz_id_fkey') THEN
        ALTER TABLE quiz_attempts DROP CONSTRAINT quiz_attempts_quiz_id_fkey;
    END IF;
END $$;

-- Enhanced Questions Table (for MCQ and Short Answer support)
-- Update existing questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_type VARCHAR(50) DEFAULT 'multipleChoice';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answers TEXT[] DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Enhanced Quizzes Table (for timer and scheduling)
-- Check if quizzes table exists, if not create it
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER, -- in minutes
  start_date_time TIMESTAMP WITH TIME ZONE,
  end_date_time TIMESTAMP WITH TIME ZONE,
  is_scheduled BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to quizzes if they don't exist
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit INTEGER;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS start_date_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS end_date_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false;

-- Create quiz_questions junction table for many-to-many
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  order_number INTEGER DEFAULT 0,
  UNIQUE(quiz_id, question_id)
);

-- Row Level Security Policies
-- Enable RLS
ALTER TABLE quiz_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_violations ENABLE ROW LEVEL SECURITY;

-- Quiz codes policies
CREATE POLICY "Teachers can manage their quiz codes" ON quiz_codes
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Anyone can read active quiz codes" ON quiz_codes
  FOR SELECT USING (is_active = true);

-- Violations policies
CREATE POLICY "Students can report their own violations" ON cheating_violations
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view violations for their quizzes" ON cheating_violations
  FOR SELECT USING (teacher_id = auth.uid() OR student_id = auth.uid());
