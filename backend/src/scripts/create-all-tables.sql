-- Complete Database Schema for Adaptive Learning Platform
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  difficulty VARCHAR(50) DEFAULT 'Beginner',
  thumbnail TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Topics Table
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT,
  question_text TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  correct_answer INTEGER,
  correct_answers TEXT[] DEFAULT '{}',
  difficulty VARCHAR(50) DEFAULT 'Easy',
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  explanation TEXT,
  question_type VARCHAR(50) DEFAULT 'multipleChoice',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  UNIQUE(user_id, course_id)
);

-- 6. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  time_limit INTEGER,
  start_date_time TIMESTAMP WITH TIME ZONE,
  end_date_time TIMESTAMP WITH TIME ZONE,
  is_scheduled BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Quiz Attempts Table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  answers JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  violation_count INTEGER DEFAULT 0,
  is_flagged BOOLEAN DEFAULT false,
  accessed_via VARCHAR(20) DEFAULT 'enrolled'
);

-- 8. Quiz Codes Table
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

-- 9. Cheating Violations Table
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

-- 10. Quiz Questions Junction Table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  order_number INTEGER DEFAULT 0,
  UNIQUE(quiz_id, question_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);
CREATE INDEX IF NOT EXISTS idx_topics_course_id ON topics(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_codes_code ON quiz_codes(code);
CREATE INDEX IF NOT EXISTS idx_violations_student_id ON cheating_violations(student_id);

-- Disable RLS for now (for easier development)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_violations DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated users
GRANT ALL ON users TO anon, authenticated;
GRANT ALL ON courses TO anon, authenticated;
GRANT ALL ON topics TO anon, authenticated;
GRANT ALL ON questions TO anon, authenticated;
GRANT ALL ON enrollments TO anon, authenticated;
GRANT ALL ON quizzes TO anon, authenticated;
GRANT ALL ON quiz_attempts TO anon, authenticated;
GRANT ALL ON quiz_codes TO anon, authenticated;
GRANT ALL ON cheating_violations TO anon, authenticated;
GRANT ALL ON quiz_questions TO anon, authenticated;
