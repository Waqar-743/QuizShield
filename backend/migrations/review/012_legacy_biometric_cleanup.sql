-- REVIEW ONLY. Not part of automatic deployment. Take a restricted, encrypted backup
-- under the institution's retention policy and obtain deletion authorization first.
-- This destroys numeric face descriptors. It does NOT delete images: the private
-- profile-pictures bucket mixes legacy enrolment photos with ordinary profile assets,
-- and filenames/face appearance do not establish biometric purpose.
-- Validation: run in a transaction on staging with synthetic data, then ROLLBACK.
-- After review, run SET LOCAL quizshield.confirm_biometric_cleanup='approved';
-- in the same explicit transaction and COMMIT deliberately.
DO $$ BEGIN
 IF current_setting('quizshield.confirm_biometric_cleanup',true) IS DISTINCT FROM 'approved' THEN
   RAISE EXCEPTION 'Biometric cleanup requires explicit operator approval in a transaction';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='face_encoding') THEN
   UPDATE public.users SET face_encoding=NULL WHERE face_encoding IS NOT NULL;
 END IF;
END $$;
-- Historical assessment events, submissions and grading records remain untouched.
-- Drop legacy columns only in a future migration after old clients are retired.
