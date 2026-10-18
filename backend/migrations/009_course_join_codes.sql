-- Restore the existing course-code feature on databases created from the base schema.
-- Additive only: no courses/enrolments are removed. Apply to staging first.
BEGIN;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_code text;
CREATE UNIQUE INDEX IF NOT EXISTS courses_course_code_unique
  ON public.courses(course_code);
DO $$
DECLARE course_row record; candidate text;
BEGIN
  FOR course_row IN SELECT id FROM public.courses WHERE course_code IS NULL OR btrim(course_code)='' LOOP
    LOOP
      candidate := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.courses WHERE course_code=candidate);
    END LOOP;
    UPDATE public.courses SET course_code=candidate WHERE id=course_row.id;
  END LOOP;
END $$;
COMMIT;
