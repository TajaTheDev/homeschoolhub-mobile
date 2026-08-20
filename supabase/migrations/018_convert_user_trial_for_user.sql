-- Webhook-safe trial conversion (explicit user_id; convert_user_trial requires auth.uid()).
CREATE OR REPLACE FUNCTION public.convert_user_trial_for_user(
  p_user_id UUID,
  p_plan TEXT DEFAULT NULL
)
RETURNS user_trials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial user_trials;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_plan IS NOT NULL AND p_plan NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Invalid subscription plan';
  END IF;

  UPDATE user_trials
  SET
    status = 'converted',
    converted_at = COALESCE(converted_at, now()),
    subscription_plan = COALESCE(p_plan, subscription_plan),
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_trial;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trial record found for user';
  END IF;

  RETURN v_trial;
END;
$$;

COMMENT ON FUNCTION public.convert_user_trial_for_user(UUID, TEXT) IS
  'Marks a user trial converted by user_id. Used by RevenueCat webhook (service role).';

REVOKE ALL ON FUNCTION public.convert_user_trial_for_user(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_user_trial_for_user(UUID, TEXT) TO service_role;
