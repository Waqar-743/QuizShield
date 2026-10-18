-- Administrators can pause/revoke retained automation grants after an account is disabled.
-- Enabling still requires an active teacher. Existing function privileges are retained.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_set_automation_grant(p_actor uuid,p_teacher uuid,p_status text,p_capabilities text[],p_editable text[],p_defaults jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM assert_active_admin(p_actor);
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_teacher) THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF p_status='active' AND NOT EXISTS(SELECT 1 FROM users WHERE id=p_teacher AND role='teacher' AND status='active') THEN RAISE EXCEPTION 'Select an active teacher before enabling automation'; END IF;
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

COMMIT;
