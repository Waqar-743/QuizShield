-- Additive access controls. Apply after 009. Does not remove accounts or assessment data.
BEGIN;
ALTER TABLE public.users
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','suspended','deactivated')),
 ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

CREATE TABLE public.admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 action text NOT NULL,
 target_id uuid,
 details jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_recent ON public.admin_audit(created_at DESC);
CREATE TABLE public.automation_grants (
 teacher_id uuid PRIMARY KEY REFERENCES public.users(id),
 status text NOT NULL DEFAULT 'paused' CHECK(status IN ('active','paused','revoked')),
 capabilities text[] NOT NULL DEFAULT '{}',
 editable_keys text[] NOT NULL DEFAULT ARRAY['timezone','reminder_hours'],
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve explicitly configured existing automations; new teachers receive no grant.
INSERT INTO public.automation_grants(teacher_id,status,capabilities)
 SELECT s.teacher_id,'active',ARRAY['announcement','deadline_reminder','results_email','schedule_email','welcome_email','calendar_sync','sheets_sync']
 FROM public.automation_settings s JOIN public.users u ON u.id=s.teacher_id WHERE u.role='teacher';
CREATE TABLE public.automation_health (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), last_started_at timestamptz,
 last_completed_at timestamptz, processed integer, last_error text
);
CREATE TABLE public.google_setup_requests (
 teacher_id uuid PRIMARY KEY REFERENCES public.users(id),
 setup_id text UNIQUE, tenant_id text UNIQUE, expires_at timestamptz,
 status text NOT NULL DEFAULT 'required' CHECK(status IN ('required','authorizing','blocked','verified','revoked')),
 blocker text, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_connections ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE FUNCTION public.guard_account_access() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 -- Serialize active-admin changes, including concurrent demotions/deactivations.
 PERFORM pg_advisory_xact_lock(743010);
 IF TG_OP='DELETE' THEN
   RAISE EXCEPTION 'Physical account deletion is disabled; use recoverable deactivation';
 END IF;
 IF OLD.role='admin' AND OLD.status='active' AND (NEW.role<>'admin' OR NEW.status<>'active')
 AND NOT EXISTS(SELECT 1 FROM users WHERE id<>OLD.id AND role='admin' AND status='active') THEN
   RAISE EXCEPTION 'The last active administrator cannot be removed or demoted';
 END IF;
 IF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status
 OR NEW.password IS DISTINCT FROM OLD.password OR NEW.email IS DISTINCT FROM OLD.email THEN
   NEW.session_version := OLD.session_version+1;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_access_guard BEFORE UPDATE OR DELETE ON public.users
 FOR EACH ROW EXECUTE FUNCTION public.guard_account_access();

CREATE FUNCTION public.invalidate_account_jobs() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status<>'active' OR NEW.role IS DISTINCT FROM OLD.role THEN
   UPDATE automation_jobs SET status=CASE WHEN status IN ('running','awaiting') THEN 'uncertain' ELSE 'cancelled' END,
     last_error=CASE WHEN status IN ('running','awaiting') THEN 'Account access changed during execution; reconcile provider outcome' ELSE 'Account access disabled or role changed' END,
     updated_at=now()
   WHERE (teacher_id=NEW.id OR student_id=NEW.id) AND status IN ('pending','failed','running','awaiting');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_job_invalidation AFTER UPDATE OF status,role ON public.users
 FOR EACH ROW EXECUTE FUNCTION public.invalidate_account_jobs();

CREATE FUNCTION public.assert_active_admin(p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(743010);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin' AND status='active') THEN
   RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501';
 END IF;
END $$;

CREATE FUNCTION public.revoke_account_sessions(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE users SET session_version=session_version+1 WHERE id=p_user;
$$;

CREATE FUNCTION public.bootstrap_first_admin(p_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(743010);
 IF EXISTS(SELECT 1 FROM users WHERE role='admin' AND status='active') THEN RAISE EXCEPTION 'An active administrator already exists'; END IF;
 SELECT id INTO target FROM users WHERE email=lower(trim(p_email)) AND status='active' FOR UPDATE;
 IF target IS NULL THEN RAISE EXCEPTION 'Create and verify the intended operator account before bootstrapping'; END IF;
 UPDATE users SET role='admin' WHERE id=target;
 INSERT INTO admin_audit(action,target_id,details) VALUES('first_admin_bootstrap',target,'{"method":"operator service-role command"}');
 RETURN target;
END $$;

CREATE FUNCTION public.admin_update_account(p_actor uuid,p_target uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row users; after_row users;
BEGIN
 PERFORM assert_active_admin(p_actor);
 PERFORM pg_advisory_xact_lock(743010);
 SELECT * INTO before_row FROM users WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('name','bio','role','status')) THEN RAISE EXCEPTION 'Unsupported account field'; END IF;
 IF p_patch ? 'name' AND (length(trim(p_patch->>'name')) NOT BETWEEN 2 AND 80 OR p_patch->>'name' IS NULL) THEN RAISE EXCEPTION 'Name must be 2–80 characters'; END IF;
 IF p_patch ? 'bio' AND length(p_patch->>'bio')>500 THEN RAISE EXCEPTION 'Bio must be at most 500 characters'; END IF;
 IF p_patch ? 'role' AND coalesce(p_patch->>'role','') NOT IN ('admin','teacher','student') THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF p_patch ? 'status' AND coalesce(p_patch->>'status','') NOT IN ('active','suspended','deactivated') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF before_row.status='invited' AND p_patch->>'status'='active' THEN RAISE EXCEPTION 'Invited accounts must complete secure account setup'; END IF;
 UPDATE users SET name=CASE WHEN p_patch?'name' THEN trim(p_patch->>'name') ELSE name END,
 bio=CASE WHEN p_patch?'bio' THEN p_patch->>'bio' ELSE bio END,
 role=coalesce(p_patch->>'role',role),status=coalesce(p_patch->>'status',status),updated_at=now()
 WHERE id=p_target RETURNING * INTO after_row;
 INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES(p_actor,'account_updated',p_target,
 jsonb_build_object('fields',p_patch,'previous_role',before_row.role,'previous_status',before_row.status));
END $$;

CREATE FUNCTION public.admin_transfer_course(p_actor uuid,p_course uuid,p_teacher uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous_owner uuid;
BEGIN
 PERFORM assert_active_admin(p_actor);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_teacher AND role='teacher' AND status='active') THEN RAISE EXCEPTION 'Select an active teacher'; END IF;
 SELECT created_by INTO previous_owner FROM courses WHERE id=p_course FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;
 IF previous_owner=p_teacher THEN RAISE EXCEPTION 'Teacher already owns this course'; END IF;
 UPDATE courses SET created_by=p_teacher WHERE id=p_course;
 UPDATE teacher_quizzes SET teacher_id=p_teacher::text WHERE course_id=p_course;
 UPDATE questions SET created_by=p_teacher WHERE topic_id IN(SELECT id FROM topics WHERE course_id=p_course);
 UPDATE quizzes SET created_by=p_teacher WHERE topic_id IN(SELECT id FROM topics WHERE course_id=p_course);
 UPDATE quiz_codes SET created_by=p_teacher WHERE course_id=p_course;
 UPDATE automation_jobs SET status=CASE WHEN status IN ('running','awaiting') THEN 'uncertain' ELSE 'cancelled' END,
 last_error='Course ownership transferred; inspect historical destinations before further sync',updated_at=now()
 WHERE course_id=p_course AND status IN ('pending','failed','running','awaiting');
 INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES(p_actor,'course_transferred',p_course,
 jsonb_build_object('previous_owner',previous_owner,'new_owner',p_teacher));
END $$;

CREATE FUNCTION public.admin_set_enrolment(p_actor uuid,p_course uuid,p_student uuid,p_enrolled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM assert_active_admin(p_actor);
 IF p_enrolled AND NOT EXISTS(SELECT 1 FROM users WHERE id=p_student AND role='student' AND status='active') THEN RAISE EXCEPTION 'Select an active student'; END IF;
 PERFORM 1 FROM courses WHERE id=p_course FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course not found'; END IF;
 IF p_enrolled THEN
   IF NOT EXISTS(SELECT 1 FROM enrollments WHERE course_id=p_course AND user_id=p_student)
   AND EXISTS(SELECT 1 FROM courses c WHERE c.id=p_course AND c.max_students IS NOT NULL AND (SELECT count(*) FROM enrollments WHERE course_id=c.id)>=c.max_students) THEN RAISE EXCEPTION 'Course is full'; END IF;
   INSERT INTO enrollments(course_id,user_id) VALUES(p_course,p_student) ON CONFLICT(user_id,course_id) DO NOTHING;
 ELSE
   DELETE FROM enrollments WHERE course_id=p_course AND user_id=p_student;
   UPDATE automation_jobs SET status=CASE WHEN status IN ('running','awaiting') THEN 'uncertain' ELSE 'cancelled' END,
    last_error='Enrolment removed; reconcile any in-progress delivery',updated_at=now()
    WHERE course_id=p_course AND student_id=p_student AND status IN ('pending','failed','running','awaiting');
 END IF;
 INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES(p_actor,'enrolment_changed',p_student,jsonb_build_object('course_id',p_course,'enrolled',p_enrolled));
END $$;

CREATE FUNCTION public.admin_set_automation_grant(p_actor uuid,p_teacher uuid,p_status text,p_capabilities text[],p_editable text[],p_defaults jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM assert_active_admin(p_actor);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_teacher AND role='teacher' AND status='active') THEN RAISE EXCEPTION 'Select an active teacher'; END IF;
 IF p_status NOT IN ('active','paused','revoked') OR NOT p_capabilities <@ ARRAY['announcement','deadline_reminder','results_email','schedule_email','welcome_email','calendar_sync','sheets_sync'] THEN RAISE EXCEPTION 'Invalid automation grant'; END IF;
 IF NOT p_editable <@ ARRAY['timezone','reminder_hours','announcement','deadline_reminder','results_email','schedule_email','welcome_email','calendar_sync','sheets_sync'] THEN RAISE EXCEPTION 'Invalid editable settings'; END IF;
 INSERT INTO automation_grants(teacher_id,status,capabilities,editable_keys) VALUES(p_teacher,p_status,p_capabilities,p_editable)
 ON CONFLICT(teacher_id) DO UPDATE SET status=excluded.status,capabilities=excluded.capabilities,editable_keys=excluded.editable_keys,updated_at=now();
 INSERT INTO automation_settings(teacher_id) VALUES(p_teacher) ON CONFLICT DO NOTHING;
 UPDATE automation_settings SET
 announcement=coalesce((p_defaults->>'announcement')::boolean,announcement), deadline_reminder=coalesce((p_defaults->>'deadline_reminder')::boolean,deadline_reminder),
 results_email=coalesce((p_defaults->>'results_email')::boolean,results_email),schedule_email=coalesce((p_defaults->>'schedule_email')::boolean,schedule_email),
 welcome_email=coalesce((p_defaults->>'welcome_email')::boolean,welcome_email),calendar_sync=coalesce((p_defaults->>'calendar_sync')::boolean,calendar_sync),sheets_sync=coalesce((p_defaults->>'sheets_sync')::boolean,sheets_sync),
 timezone=coalesce(p_defaults->>'timezone',timezone),reminder_hours=coalesce((p_defaults->>'reminder_hours')::integer,reminder_hours),updated_at=now() WHERE teacher_id=p_teacher;
 UPDATE automation_jobs SET status=CASE WHEN status IN ('running','awaiting') THEN 'uncertain' ELSE 'cancelled' END,
 last_error='Administrator changed automation access; reconcile any in-progress delivery',updated_at=now()
 WHERE teacher_id=p_teacher AND channel IN ('email','fastn') AND status IN ('pending','failed','running','awaiting')
 AND (p_status<>'active' OR NOT (CASE kind WHEN 'reminder' THEN 'deadline_reminder' WHEN 'results' THEN 'results_email' WHEN 'schedule' THEN 'schedule_email' WHEN 'cancellation' THEN 'schedule_email' WHEN 'welcome' THEN 'welcome_email' WHEN 'calendar' THEN 'calendar_sync' WHEN 'sheets' THEN 'sheets_sync' ELSE kind END)=ANY(p_capabilities));
 INSERT INTO admin_audit(actor_id,action,target_id,details) VALUES(p_actor,'automation_grant_updated',p_teacher,jsonb_build_object('status',p_status,'capabilities',p_capabilities,'editable_keys',p_editable,'defaults',p_defaults));
END $$;

DO $$ DECLARE fn record; tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['admin_audit','automation_grants','automation_health','google_setup_requests'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tbl);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',tbl);
 END LOOP;
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND proname IN ('assert_active_admin','revoke_account_sessions','bootstrap_first_admin','admin_update_account','admin_transfer_course','admin_set_enrolment','admin_set_automation_grant') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);
 END LOOP;
END $$;
COMMIT;
