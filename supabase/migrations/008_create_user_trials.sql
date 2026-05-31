-- User Trials Table (tracks free trial period per user)
CREATE TABLE user_trials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'converted')),
  converted_at TIMESTAMPTZ,
  subscription_plan TEXT CHECK (subscription_plan IN ('monthly', 'annual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_trials ENABLE ROW LEVEL SECURITY;

-- Users can only read their own trial record
CREATE POLICY "Users can view own trial"
  ON user_trials FOR SELECT
  USING (auth.uid() = user_id);

-- Indexes for lookups and admin reporting
CREATE INDEX idx_user_trials_user ON user_trials(user_id);
CREATE INDEX idx_user_trials_status ON user_trials(status);
CREATE INDEX idx_user_trials_expires_at ON user_trials(expires_at);

-- Auto-start trial when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_trials (user_id, started_at, expires_at, duration_days)
  VALUES (
    NEW.id,
    now(),
    now() + INTERVAL '30 days',
    30
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_trial();

-- Ensure trial exists for users created before this migration (or if trigger missed)
CREATE OR REPLACE FUNCTION ensure_user_trial(
  p_duration_days INTEGER DEFAULT 30,
  p_started_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS user_trials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial user_trials;
  v_user_id UUID;
  v_started_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_trial FROM user_trials WHERE user_id = v_user_id;

  IF FOUND THEN
    -- Apply legacy start date if it is earlier than the stored start
    IF p_started_at IS NOT NULL AND p_started_at < v_trial.started_at THEN
      v_started_at := p_started_at;

      UPDATE user_trials
      SET
        started_at = v_started_at,
        expires_at = v_started_at + (v_trial.duration_days || ' days')::INTERVAL,
        updated_at = now()
      WHERE id = v_trial.id
      RETURNING * INTO v_trial;
    END IF;

    IF v_trial.status = 'active' AND v_trial.expires_at <= now() THEN
      UPDATE user_trials
      SET status = 'expired', updated_at = now()
      WHERE id = v_trial.id
      RETURNING * INTO v_trial;
    END IF;

    RETURN v_trial;
  END IF;

  v_started_at := COALESCE(p_started_at, now());

  INSERT INTO user_trials (user_id, started_at, expires_at, duration_days)
  VALUES (
    v_user_id,
    v_started_at,
    v_started_at + (p_duration_days || ' days')::INTERVAL,
    p_duration_days
  )
  RETURNING * INTO v_trial;

  RETURN v_trial;
END;
$$;

-- Mark trial as converted when user subscribes
CREATE OR REPLACE FUNCTION convert_user_trial(p_plan TEXT DEFAULT NULL)
RETURNS user_trials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial user_trials;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_plan IS NOT NULL AND p_plan NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'Invalid subscription plan';
  END IF;

  UPDATE user_trials
  SET
    status = 'converted',
    converted_at = now(),
    subscription_plan = COALESCE(p_plan, subscription_plan),
    updated_at = now()
  WHERE user_id = v_user_id
  RETURNING * INTO v_trial;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trial record found for user';
  END IF;

  RETURN v_trial;
END;
$$;

-- Backfill trials for existing auth users who don't have one yet
INSERT INTO user_trials (user_id, started_at, expires_at, duration_days)
SELECT
  id,
  COALESCE(created_at, now()),
  COALESCE(created_at, now()) + INTERVAL '30 days',
  30
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
