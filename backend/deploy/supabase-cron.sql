-- Run on HOSTED Supabase after 007. First create two Vault secrets in the
-- dashboard: quizshield_backend_url (HTTPS origin) and quizshield_worker_secret
-- (same >=32-character value as backend AUTOMATION_WORKER_SECRET).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='quizshield_backend_url')
 OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='quizshield_worker_secret') THEN
   RAISE EXCEPTION 'Create the two QuizShield Vault secrets before installing the cron job';
 END IF;
END $$;

-- Replace an existing schedule instead of adding a second worker cron.
DO $$ DECLARE existing bigint; BEGIN
 FOR existing IN SELECT jobid FROM cron.job WHERE jobname='quizshield-automation-worker' LOOP
   PERFORM cron.unschedule(existing);
 END LOOP;
END $$;
SELECT cron.schedule('quizshield-automation-worker','* * * * *',$job$
 SELECT net.http_post(
   url := (SELECT rtrim(decrypted_secret,'/') FROM vault.decrypted_secrets WHERE name='quizshield_backend_url') || '/api/automations/worker',
   headers := jsonb_build_object('Content-Type','application/json','Authorization',
     'Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='quizshield_worker_secret')),
   body := '{}'::jsonb,
   timeout_milliseconds := 55000
 );
$job$);

-- Monitor cron.job_run_details AND net._http_response. A successful cron SQL
-- call means the HTTP request was queued; inspect its HTTP response separately.
