-- Add course scoping to teacher quizzes so access and notifications can be course-specific
ALTER TABLE IF EXISTS teacher_quizzes
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_quizzes_course_id ON teacher_quizzes(course_id);
