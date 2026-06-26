-- TOC scan rate limiting (20/day per user, UTC calendar day)
-- Service-role / Edge Function only — not exposed to clients via RLS policies.

CREATE TABLE IF NOT EXISTS toc_scan_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL,
  scan_count INTEGER NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_toc_scan_usage_user_date
  ON toc_scan_usage (user_id, scan_date);

ALTER TABLE toc_scan_usage ENABLE ROW LEVEL SECURITY;
-- No policies: authenticated/anon cannot read or write; service role bypasses RLS.

COMMENT ON TABLE toc_scan_usage IS
  'Daily TOC extraction scan counts for extract-toc Edge Function rate limiting.';

-- Atomically reserve a scan slot (row-locked). Returns allowed=false when at limit.
CREATE OR REPLACE FUNCTION check_and_increment_toc_scan(
  p_user_id UUID,
  p_daily_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  allowed BOOLEAN,
  scan_count INTEGER,
  daily_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_daily_limit IS NULL OR p_daily_limit < 1 THEN
    RAISE EXCEPTION 'daily_limit must be at least 1';
  END IF;

  INSERT INTO toc_scan_usage (user_id, scan_date, scan_count)
  VALUES (p_user_id, v_date, 0)
  ON CONFLICT (user_id, scan_date) DO NOTHING;

  SELECT tu.scan_count
  INTO v_count
  FROM toc_scan_usage tu
  WHERE tu.user_id = p_user_id
    AND tu.scan_date = v_date
  FOR UPDATE;

  IF v_count >= p_daily_limit THEN
    RETURN QUERY SELECT false, v_count, p_daily_limit;
    RETURN;
  END IF;

  UPDATE toc_scan_usage
  SET
    scan_count = scan_count + 1,
    updated_at = now()
  WHERE user_id = p_user_id
    AND scan_date = v_date
  RETURNING toc_scan_usage.scan_count INTO v_count;

  RETURN QUERY SELECT true, v_count, p_daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_toc_scan(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_and_increment_toc_scan(UUID, INTEGER) TO service_role;
