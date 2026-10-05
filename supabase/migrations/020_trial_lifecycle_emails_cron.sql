-- Daily pg_net trigger for trial-lifecycle-emails at 14:00 UTC.
-- Prerequisite: pg_net enabled in Dashboard → Database → Extensions.
-- After deploy, set database settings (see deploy docs — secrets stay out of git):
--   ALTER DATABASE postgres SET app.trial_lifecycle_emails_url = 'https://<ref>.supabase.co/functions/v1/trial-lifecycle-emails';
--   ALTER DATABASE postgres SET app.trial_email_cron_secret = '<same value as TRIAL_EMAIL_CRON_SECRET>';

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_trial_lifecycle_emails()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  v_url := current_setting('app.trial_lifecycle_emails_url', true);
  v_secret := current_setting('app.trial_email_cron_secret', true);

  IF v_url IS NULL OR v_url = '' OR v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'trial-lifecycle-emails cron skipped: set app.trial_lifecycle_emails_url and app.trial_email_cron_secret on the database';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', v_secret
    ),
    body := '{}'::jsonb
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_trial_lifecycle_emails() IS
  'POSTs to trial-lifecycle-emails Edge Function. URL and secret via database settings.';

REVOKE ALL ON FUNCTION public.invoke_trial_lifecycle_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invoke_trial_lifecycle_emails() TO postgres;

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid
  INTO v_jobid
  FROM cron.job
  WHERE jobname = 'trial-lifecycle-emails'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'trial-lifecycle-emails',
  '0 14 * * *',
  $$SELECT public.invoke_trial_lifecycle_emails()$$
);
