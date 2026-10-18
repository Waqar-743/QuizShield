-- Additive retirement; retain legacy column for a separately reviewed cleanup.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='teacher_quizzes' AND column_name='camera_monitoring') THEN
   ALTER TABLE public.teacher_quizzes ALTER COLUMN camera_monitoring SET DEFAULT false;
   UPDATE public.teacher_quizzes SET camera_monitoring=false WHERE camera_monitoring IS DISTINCT FROM false;
 END IF;
END $$;
COMMIT;
