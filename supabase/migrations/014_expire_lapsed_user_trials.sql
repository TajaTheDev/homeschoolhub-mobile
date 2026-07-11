-- Expire lapsed user_trials daily for analytics accuracy.
-- App access already treats past-date active trials as expired; this updates status.
-- Prerequisite: enable pg_cron in Supabase Dashboard → Database → Extensions.
-- ensure_user_trial still expires the calling user's row on app open (unchanged).

CREATE OR REPLACE FUNCTION public.expire_lapsed_user_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE user_trials
  SET
    status = 'expired',
    updated_at = now()
  WHERE status = 'active'
    AND expires_at <= now()
    AND converted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_lapsed_user_trials() IS
  'Marks active trials past expires_at as expired. Used by pg_cron; does not touch converted rows.';

REVOKE ALL ON FUNCTION public.expire_lapsed_user_trials() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_user_trials() TO postgres;

-- pg_cron (enable extension in Dashboard before db push if this fails)
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
  '0 3 * * *',
  $$SELECT public.expire_lapsed_user_trials()$$
);
