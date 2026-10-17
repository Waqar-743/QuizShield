-- Operator-verified Google ownership and destination binding. Run after 007.
BEGIN;
ALTER TABLE public.automation_connections
 ADD COLUMN installation_id text UNIQUE,
 ADD COLUMN verified_calendar_id text,
 ADD COLUMN verified_spreadsheet_id text,
 ADD COLUMN verified_at timestamptz,
 ADD COLUMN google_webhook_url text;
-- Previously provisioned flags alone did not prove teacher-scoped ownership.
UPDATE public.automation_connections SET calendar_connected=false,sheets_connected=false;
ALTER TABLE public.automation_connections ADD CONSTRAINT verified_google_connection CHECK (
 NOT (calendar_connected OR sheets_connected) OR (
   installation_id IS NOT NULL AND installation_id ~ '^inst_[a-f0-9]+$' AND verified_at IS NOT NULL
   AND google_webhook_url IS NOT NULL AND google_webhook_url ~ '^https://webhooks[.]fastn[.]dev/prod/triggers/[A-Za-z0-9_-]+/webhooks/[0-9a-f-]{36}$'
   AND (NOT calendar_connected OR coalesce(verified_calendar_id,'')<>'')
   AND (NOT sheets_connected OR coalesce(verified_spreadsheet_id,'')<>'')
 ));
COMMIT;
