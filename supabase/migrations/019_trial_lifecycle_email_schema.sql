-- Trial lifecycle email infrastructure (tables + expire cron reschedule).
-- Prerequisite: pg_cron enabled (see 014). pg_net required when scheduling
-- trial-lifecycle-emails cron (020 or manual SQL after Edge Function deploy).

-- ---------------------------------------------------------------------------
-- email_preferences — one-click unsubscribe without login
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unsubscribe_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_unsubscribed_at
  ON public.email_preferences(unsubscribed_at)
  WHERE unsubscribed_at IS NOT NULL;

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_preferences IS
  'Trial/marketing email opt-out. Billing-issue mail (RevenueCat webhook) is separate and transactional.';

COMMENT ON COLUMN public.email_preferences.unsubscribe_token IS
  'Random token in unsubscribe URLs; treat like a secret.';

-- ---------------------------------------------------------------------------
-- trial_email_log — at-most-once per (user, template)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trial_email_log (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, template)
);

CREATE INDEX IF NOT EXISTS idx_trial_email_log_template_sent
  ON public.trial_email_log(template, sent_at DESC);

ALTER TABLE public.trial_email_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.trial_email_log IS
  'Send log for trial lifecycle templates: welcome, feature_*, progress_recap, reengage, converting, winback.';

-- ---------------------------------------------------------------------------
-- Ensure preference row exists (service role / Edge Functions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_email_preferences(p_user_id UUID)
RETURNS public.email_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.email_preferences;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  INSERT INTO public.email_preferences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.email_preferences WHERE user_id = p_user_id;
  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.ensure_email_preferences(UUID) IS
  'Creates email_preferences row with unsubscribe_token if missing.';

REVOKE ALL ON FUNCTION public.ensure_email_preferences(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_email_preferences(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- Reschedule expire_lapsed_user_trials: 03:00 UTC → 16:00 UTC
-- Runs after trial-lifecycle-emails (14:00 UTC) so last-day sends still see active.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid
  INTO v_jobid
  FROM cron.job
  WHERE jobname = 'expire-lapsed-user-trials'
  LIMIT 1;

  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'expire-lapsed-user-trials',
  '0 16 * * *',
  $$SELECT public.expire_lapsed_user_trials()$$
);
