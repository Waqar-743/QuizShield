-- Per-quiz camera monitoring toggle.
-- Teachers decide whether students must enable a webcam for this quiz.
ALTER TABLE teacher_quizzes
  ADD COLUMN IF NOT EXISTS camera_monitoring boolean NOT NULL DEFAULT true;
