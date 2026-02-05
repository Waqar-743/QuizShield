-- Create teacher_quizzes table for storing quizzes created by teachers
CREATE TABLE IF NOT EXISTS teacher_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER DEFAULT 30,
  questions JSONB DEFAULT '[]'::jsonb,
  access_code VARCHAR(10) UNIQUE,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by teacher
CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_teacher_id ON teacher_quizzes(teacher_id);

-- Update quiz_codes table to support teacher_quizzes
-- Make course_id nullable since we're now using teacher_quizzes
ALTER TABLE quiz_codes ALTER COLUMN course_id DROP NOT NULL;

-- Add RLS policies
ALTER TABLE teacher_quizzes ENABLE ROW LEVEL SECURITY;

-- Teachers can see and manage their own quizzes
CREATE POLICY "Teachers can manage own quizzes" ON teacher_quizzes
  FOR ALL USING (auth.uid()::text = teacher_id);

-- Everyone authenticated can read quizzes (for quiz access via code)
CREATE POLICY "Authenticated users can read quizzes" ON teacher_quizzes
  FOR SELECT USING (auth.role() = 'authenticated');
