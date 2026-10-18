-- Run after migrations 001-006 and the launch-fixes columns. Transactional outbox:
-- no HTTP calls occur inside a database transaction.
BEGIN;
ALTER TABLE public.teacher_quizzes
  ADD COLUMN IF NOT EXISTS lifecycle text NOT NULL DEFAULT 'published' CHECK (lifecycle IN ('draft','published','cancelled')),
  ADD COLUMN IF NOT EXISTS closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Karachi',
  ADD COLUMN IF NOT EXISTS schedule_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS assigned_student_ids uuid[];
ALTER TABLE public.teacher_quizzes ADD CONSTRAINT quiz_availability_window CHECK (closes_at IS NULL OR scheduled_start IS NULL OR closes_at > scheduled_start);
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS results_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_reason varchar(100),
  ADD COLUMN IF NOT EXISTS violations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS automation_key text UNIQUE;

CREATE TABLE public.automation_settings (
  teacher_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  announcement boolean NOT NULL DEFAULT true,
  deadline_reminder boolean NOT NULL DEFAULT false,
  reminder_hours integer NOT NULL DEFAULT 24 CHECK (reminder_hours BETWEEN 1 AND 168),
  results_email boolean NOT NULL DEFAULT true,
  schedule_email boolean NOT NULL DEFAULT true,
  welcome_email boolean NOT NULL DEFAULT false,
  calendar_id text NOT NULL DEFAULT '',
  spreadsheet_id text NOT NULL DEFAULT '',
  sheet_tab text NOT NULL DEFAULT 'Results',
  calendar_sync boolean NOT NULL DEFAULT false,
  sheets_sync boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Connection references are provisioned by the operator, never accepted from a teacher.
CREATE TABLE public.automation_connections (
  teacher_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id text NOT NULL UNIQUE,
  calendar_connected boolean NOT NULL DEFAULT false,
  sheets_connected boolean NOT NULL DEFAULT false
);
CREATE TABLE public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id uuid REFERENCES public.teacher_quizzes(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('announcement','reminder','schedule','cancellation','welcome','results','calendar','sheets','followup')),
  channel text NOT NULL CHECK (channel IN ('email','inapp','fastn','internal')),
  version integer,
  dedupe_key text NOT NULL UNIQUE,
  run_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','awaiting','succeeded','failed','cancelled','uncertain')),
  attempts integer NOT NULL DEFAULT 0,
  execution_token uuid,
  lease_until timestamptz,
  last_error text,
  provider_id text,
  first_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_due ON public.automation_jobs(run_at) WHERE status = 'pending';
CREATE INDEX automation_teacher_history ON public.automation_jobs(teacher_id, created_at DESC);
CREATE TABLE public.learning_followups (
  attempt_id uuid PRIMARY KEY REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  suggestions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.automation_records (
  teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  record_key text NOT NULL,
  destination text NOT NULL,
  tab text NOT NULL,
  row_number integer,
  PRIMARY KEY(teacher_id,record_key)
);
CREATE FUNCTION public.bind_automation_record(p_teacher uuid,p_key text,p_destination text,p_tab text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r automation_records; n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_destination||':'||p_tab,0));
 SELECT * INTO r FROM automation_records WHERE teacher_id=p_teacher AND record_key=p_key;
 IF NOT FOUND THEN
   SELECT coalesce(max(row_number),1)+1 INTO n FROM automation_records WHERE destination=p_destination AND tab=p_tab;
   INSERT INTO automation_records VALUES(p_teacher,p_key,p_destination,p_tab,CASE WHEN p_tab='' THEN NULL ELSE n END) RETURNING * INTO r;
 END IF;
 RETURN to_jsonb(r);
END $$;

CREATE FUNCTION public.enqueue_automation(p_teacher uuid, p_quiz uuid, p_course uuid, p_student uuid,
 p_attempt uuid, p_kind text, p_channel text, p_version integer, p_key text, p_run timestamptz DEFAULT now())
RETURNS void LANGUAGE sql SET search_path = public AS $$
 INSERT INTO automation_jobs(teacher_id,quiz_id,course_id,student_id,attempt_id,kind,channel,version,dedupe_key,run_at)
 VALUES(p_teacher,p_quiz,p_course,p_student,p_attempt,p_kind,p_channel,p_version,p_key,p_run)
 ON CONFLICT(dedupe_key) DO UPDATE SET run_at=EXCLUDED.run_at, version=EXCLUDED.version,
 status='pending', last_error=NULL, updated_at=now()
 WHERE automation_jobs.first_delivery_at IS NULL AND automation_jobs.provider_id IS NULL
 AND automation_jobs.status IN ('pending','cancelled','failed');
$$;

CREATE FUNCTION public.queue_quiz_automations() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s record; event text; ch text; changed boolean := false;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.course_id IS DISTINCT FROM OLD.course_id THEN RAISE EXCEPTION 'A quiz cannot be moved to another course'; END IF;
   IF NEW.questions IS DISTINCT FROM OLD.questions AND EXISTS(SELECT 1 FROM quiz_attempts WHERE quiz_id=NEW.id) THEN RAISE EXCEPTION 'Questions cannot change after a student has started'; END IF;
   changed := ROW(NEW.scheduled_start,NEW.closes_at,NEW.timezone,NEW.lifecycle,NEW.assigned_student_ids)
     IS DISTINCT FROM ROW(OLD.scheduled_start,OLD.closes_at,OLD.timezone,OLD.lifecycle,OLD.assigned_student_ids);
   IF changed THEN NEW.schedule_version := OLD.schedule_version + 1; ELSE NEW.schedule_version := OLD.schedule_version; RETURN NEW; END IF;
   UPDATE automation_jobs SET status='cancelled',last_error='Schedule superseded',updated_at=now()
    WHERE quiz_id=NEW.id AND status IN ('pending','failed','running','awaiting') AND kind IN ('reminder','schedule','calendar','cancellation');
 END IF;
 IF NEW.lifecycle='draft' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.lifecycle='draft' AND NEW.lifecycle='cancelled' THEN RETURN NEW; END IF;
 event := CASE WHEN NEW.lifecycle='cancelled' THEN 'cancellation'
   WHEN TG_OP='INSERT' THEN 'announcement'
   WHEN OLD.lifecycle='draft' THEN 'announcement' ELSE 'schedule' END;
 IF TG_OP='UPDATE' AND OLD.lifecycle='cancelled' THEN RAISE EXCEPTION 'Cancelled quizzes cannot be republished'; END IF;
 -- Existing published quizzes retain their historic results; new releases are explicit.
 FOR s IN SELECT e.user_id FROM enrollments e JOIN users u ON u.id=e.user_id
   WHERE e.course_id=NEW.course_id AND u.role='student'
   AND (NEW.assigned_student_ids IS NULL OR e.user_id=ANY(NEW.assigned_student_ids)) LOOP
   FOREACH ch IN ARRAY ARRAY['email','inapp'] LOOP
     PERFORM enqueue_automation(NEW.teacher_id::uuid,NEW.id,NEW.course_id,s.user_id,NULL,event,ch,
       CASE WHEN event='announcement' THEN NULL ELSE NEW.schedule_version END,
       NEW.id||':'||s.user_id||':'||event||':'||ch||CASE WHEN event='announcement' THEN '' ELSE ':'||NEW.schedule_version END);
   END LOOP;
   IF NEW.lifecycle='published' AND NEW.closes_at IS NOT NULL THEN
     PERFORM enqueue_automation(NEW.teacher_id::uuid,NEW.id,NEW.course_id,s.user_id,NULL,'reminder','email',NEW.schedule_version,
       NEW.id||':'||s.user_id||':reminder',greatest(now(),NEW.closes_at - make_interval(hours => coalesce(
         (SELECT reminder_hours FROM automation_settings WHERE teacher_id=NEW.teacher_id::uuid),24))));
   END IF;
 END LOOP;
 PERFORM enqueue_automation(NEW.teacher_id::uuid,NEW.id,NEW.course_id,NULL,NULL,'calendar','fastn',NEW.schedule_version,
   NEW.id||':calendar:'||NEW.schedule_version);
 RETURN NEW;
END $$;
-- BEFORE trigger is needed to persist the revision; FK checks on queued quiz jobs are deferred.
ALTER TABLE public.automation_jobs DROP CONSTRAINT automation_jobs_quiz_id_fkey;
ALTER TABLE public.automation_jobs ADD CONSTRAINT automation_jobs_quiz_id_fkey FOREIGN KEY(quiz_id)
 REFERENCES public.teacher_quizzes(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE TRIGGER quiz_automation_outbox BEFORE INSERT OR UPDATE ON public.teacher_quizzes
 FOR EACH ROW EXECUTE FUNCTION public.queue_quiz_automations();

CREATE FUNCTION public.queue_enrolment_automation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
 SELECT created_by INTO owner FROM courses WHERE id=NEW.course_id;
 IF owner IS NOT NULL THEN
   PERFORM enqueue_automation(owner,NULL,NEW.course_id,NEW.user_id,NULL,'welcome','email',NULL,'enrolment:'||NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enrolment_automation_outbox AFTER INSERT ON public.enrollments
 FOR EACH ROW EXECUTE FUNCTION public.queue_enrolment_automation();

CREATE FUNCTION public.retime_automation_reminders() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE q teacher_quizzes; a quiz_attempts; student uuid;
BEGIN
 UPDATE automation_jobs j SET run_at=greatest(now(),current_quiz.closes_at-make_interval(hours=>NEW.reminder_hours)),updated_at=now()
 FROM teacher_quizzes current_quiz WHERE j.quiz_id=current_quiz.id AND j.teacher_id=NEW.teacher_id AND j.kind='reminder'
 AND j.status='pending' AND current_quiz.closes_at IS NOT NULL;
 -- Enabling a destination/reminder also recovers unsent, previously disabled jobs.
 FOR q IN SELECT * FROM teacher_quizzes WHERE teacher_id::uuid=NEW.teacher_id AND lifecycle='published' LOOP
   IF NEW.calendar_sync THEN
     PERFORM enqueue_automation(NEW.teacher_id,q.id,q.course_id,NULL,NULL,'calendar','fastn',q.schedule_version,q.id||':calendar:'||q.schedule_version);
   END IF;
   IF NEW.deadline_reminder AND q.closes_at>now() THEN
     FOR student IN SELECT user_id FROM enrollments WHERE course_id=q.course_id
       AND (q.assigned_student_ids IS NULL OR user_id=ANY(q.assigned_student_ids)) LOOP
       PERFORM enqueue_automation(NEW.teacher_id,q.id,q.course_id,student,NULL,'reminder','email',q.schedule_version,
         q.id||':'||student||':reminder',greatest(now(),q.closes_at-make_interval(hours=>NEW.reminder_hours)));
     END LOOP;
   END IF;
   IF NEW.sheets_sync THEN
     FOR a IN SELECT * FROM quiz_attempts WHERE quiz_id=q.id AND results_released_at IS NOT NULL AND teacher_grade IS NOT NULL LOOP
       PERFORM enqueue_automation(NEW.teacher_id,q.id,q.course_id,a.user_id,a.id,'sheets','fastn',NULL,a.id||':sheets:fastn');
     END LOOP;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER automation_reminder_settings AFTER INSERT OR UPDATE ON public.automation_settings
 FOR EACH ROW EXECUTE FUNCTION public.retime_automation_reminders();

CREATE FUNCTION public.enforce_assessment_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q teacher_quizzes; duration_deadline timestamptz;
BEGIN
 SELECT * INTO q FROM teacher_quizzes WHERE id=NEW.quiz_id FOR SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF; -- Preserve the separate adaptive practice path.
 IF TG_OP='INSERT' THEN
   IF q.lifecycle<>'published' OR NOT q.is_active OR (q.scheduled_start IS NOT NULL AND now()<q.scheduled_start)
      OR (q.closes_at IS NOT NULL AND now()>=q.closes_at) THEN RAISE EXCEPTION 'Quiz is not available'; END IF;
   IF NOT EXISTS(SELECT 1 FROM enrollments WHERE user_id=NEW.user_id AND course_id=q.course_id)
      OR (q.assigned_student_ids IS NOT NULL AND NOT NEW.user_id=ANY(q.assigned_student_ids)) THEN RAISE EXCEPTION 'Quiz is not assigned to this student'; END IF;
   NEW.started_at := now();
   NEW.deadline_at := least(now()+make_interval(mins=>coalesce(q.time_limit,30)),q.closes_at);
 ELSE
   IF NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.deadline_at IS DISTINCT FROM OLD.deadline_at
     OR NEW.quiz_id IS DISTINCT FROM OLD.quiz_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Attempt identity and deadline are immutable'; END IF;
   IF (NEW.answers IS DISTINCT FROM OLD.answers OR (OLD.status='in-progress' AND NEW.status='completed')) THEN
     duration_deadline := least(coalesce(OLD.deadline_at,OLD.started_at+make_interval(mins=>coalesce(q.time_limit,30))),q.closes_at);
     IF q.lifecycle<>'published' OR NOT q.is_active OR now()>=duration_deadline THEN RAISE EXCEPTION 'Submission deadline has passed or quiz was cancelled'; END IF;
   END IF;
   IF OLD.results_released_at IS NOT NULL AND ROW(NEW.teacher_grade,NEW.teacher_feedback) IS DISTINCT FROM ROW(OLD.teacher_grade,OLD.teacher_feedback) THEN RAISE EXCEPTION 'Released grades cannot be changed'; END IF;
   IF NEW.results_released_at IS NOT NULL AND OLD.results_released_at IS NULL THEN
     IF NEW.teacher_grade IS NULL OR NEW.status<>'completed' THEN RAISE EXCEPTION 'Review a completed submission before releasing it'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assessment_attempt_guard BEFORE INSERT OR UPDATE ON public.quiz_attempts
 FOR EACH ROW EXECUTE FUNCTION public.enforce_assessment_attempt();

CREATE FUNCTION public.start_teacher_assessment(p_quiz uuid,p_student uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a quiz_attempts; q teacher_quizzes;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_quiz::text||':'||p_student::text,0));
 SELECT * INTO q FROM teacher_quizzes WHERE id=p_quiz FOR SHARE;
 IF NOT FOUND OR q.lifecycle<>'published' OR NOT q.is_active OR now()<q.scheduled_start OR now()>=q.closes_at THEN RAISE EXCEPTION 'Quiz is not available'; END IF;
 IF NOT EXISTS(SELECT 1 FROM enrollments WHERE course_id=q.course_id AND user_id=p_student)
   OR (q.assigned_student_ids IS NOT NULL AND NOT p_student=ANY(q.assigned_student_ids)) THEN RAISE EXCEPTION 'Quiz is not assigned to this student'; END IF;
 SELECT * INTO a FROM quiz_attempts WHERE quiz_id=p_quiz AND user_id=p_student ORDER BY started_at DESC LIMIT 1;
 IF FOUND THEN
   IF a.status<>'in-progress' OR now()>=least(coalesce(a.deadline_at,a.started_at+make_interval(mins=>coalesce(q.time_limit,30))),q.closes_at) THEN RAISE EXCEPTION 'Attempt already completed or expired'; END IF;
 ELSE
   INSERT INTO quiz_attempts(user_id,quiz_id,status,max_score) VALUES(p_student,p_quiz,'in-progress',jsonb_array_length(q.questions)) RETURNING * INTO a;
 END IF;
 RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.start_teacher_assessment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_teacher_assessment(uuid,uuid) TO service_role;

CREATE FUNCTION public.queue_result_automations() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE q teacher_quizzes; ch text; k text;
BEGIN
 IF NEW.results_released_at IS NOT NULL AND OLD.results_released_at IS NULL THEN
   SELECT * INTO q FROM teacher_quizzes WHERE id=NEW.quiz_id;
   IF FOUND THEN
     FOREACH ch IN ARRAY ARRAY['email','inapp','fastn','internal'] LOOP
       k := CASE ch WHEN 'fastn' THEN 'sheets' WHEN 'internal' THEN 'followup' ELSE 'results' END;
       PERFORM enqueue_automation(q.teacher_id::uuid,q.id,q.course_id,NEW.user_id,NEW.id,k,ch,NULL,NEW.id||':'||k||':'||ch);
     END LOOP;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER result_automation_outbox AFTER UPDATE ON public.quiz_attempts
 FOR EACH ROW EXECUTE FUNCTION public.queue_result_automations();

CREATE FUNCTION public.claim_automation_job() RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 -- An expired lease may have reached an external service. Reconcile before retrying.
 UPDATE automation_jobs SET status=CASE WHEN channel IN ('inapp','internal') THEN 'pending' ELSE 'uncertain' END,
 last_error=CASE WHEN channel IN ('inapp','internal') THEN 'Recovering interrupted local action' ELSE 'Delivery acknowledgement missing; reconcile before retry' END,updated_at=now()
 WHERE status IN ('running','awaiting') AND lease_until<now();
 RETURN QUERY UPDATE automation_jobs SET status='running',attempts=attempts+1,
 execution_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',updated_at=now()
 WHERE id=(SELECT j.id FROM automation_jobs j WHERE j.status='pending' AND j.run_at<=now()
   AND NOT EXISTS(SELECT 1 FROM automation_jobs busy WHERE busy.quiz_id=j.quiz_id AND busy.kind=j.kind
     AND j.kind IN ('calendar','sheets') AND busy.status IN ('running','awaiting'))
   ORDER BY j.run_at,j.id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *;
END $$;

-- Previously reviewed grades were already visible. Preserve that existing visibility,
-- without generating retrospective notifications.
ALTER TABLE public.quiz_attempts DISABLE TRIGGER result_automation_outbox;
UPDATE public.quiz_attempts SET results_released_at=coalesce(completed_at,now()) WHERE teacher_grade IS NOT NULL AND status='completed';
ALTER TABLE public.quiz_attempts ENABLE TRIGGER result_automation_outbox;

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_settings,public.automation_connections,public.automation_jobs,public.learning_followups FROM anon,authenticated;
REVOKE ALL ON public.automation_records FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.bind_automation_record(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bind_automation_record(uuid,text,text,text) TO service_role;
GRANT ALL ON public.automation_records TO service_role;
REVOKE ALL ON FUNCTION public.enqueue_automation(uuid,uuid,uuid,uuid,uuid,text,text,integer,text,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_automation_job() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_automation(uuid,uuid,uuid,uuid,uuid,text,text,integer,text,timestamptz),public.claim_automation_job() TO service_role;
GRANT ALL ON public.automation_settings,public.automation_connections,public.automation_jobs,public.learning_followups TO service_role;
-- QuizShield uses custom JWTs through Express, not Supabase browser sessions.
-- Remove the original development schema's direct client bypass.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','courses','topics','questions','enrollments','quizzes','quiz_attempts','teacher_quizzes','cheating_violations','notifications','quiz_codes','quiz_questions'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
   EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
COMMIT;
