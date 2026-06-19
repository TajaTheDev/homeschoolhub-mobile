-- School year archive: tag completions, reset active progress, atomic archive RPC.
-- Run this in Supabase SQL Editor before deploying app code that calls archive_school_year.

-- ---------------------------------------------------------------------------
-- 1. school_year_archives (skip if already created in your project)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_year_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_year_label TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  summary JSONB,
  archived_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_year_archives_student
  ON school_year_archives(student_id);

ALTER TABLE school_year_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own student archives" ON school_year_archives;
CREATE POLICY "Users can view own student archives"
  ON school_year_archives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own student archives" ON school_year_archives;
CREATE POLICY "Users can insert own student archives"
  ON school_year_archives FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. lesson_completions.school_year_archive_id
-- ---------------------------------------------------------------------------
ALTER TABLE lesson_completions
  ADD COLUMN IF NOT EXISTS school_year_archive_id UUID
  REFERENCES school_year_archives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_completions_student_active
  ON lesson_completions(student_id, school_year_archive_id)
  WHERE school_year_archive_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. students.school_year_start_date (filters manual completed lessons)
-- ---------------------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS school_year_start_date TEXT;

-- ---------------------------------------------------------------------------
-- 4. archive_school_year — single transaction
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION archive_school_year(
  p_student_id UUID,
  p_school_year_label TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF school_year_archives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_archive school_year_archives;
  v_new_start TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = p_student_id AND s.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Student not found or access denied';
  END IF;

  IF p_school_year_label IS NULL OR trim(p_school_year_label) = '' THEN
    RAISE EXCEPTION 'School year label is required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;

  IF p_end_date::date < p_start_date::date THEN
    RAISE EXCEPTION 'End date must be on or after start date';
  END IF;

  v_new_start := (p_end_date::date + INTERVAL '1 day')::date::text;

  INSERT INTO school_year_archives (
    student_id,
    school_year_label,
    start_date,
    end_date,
    summary,
    archived_at
  ) VALUES (
    p_student_id,
    trim(p_school_year_label),
    p_start_date,
    p_end_date,
    COALESCE(p_summary, '{}'::jsonb),
    now()
  )
  RETURNING * INTO v_archive;

  UPDATE lesson_completions
  SET school_year_archive_id = v_archive.id
  WHERE student_id = p_student_id
    AND school_year_archive_id IS NULL;

  UPDATE students
  SET school_year_start_date = v_new_start,
      updated_at = now()
  WHERE id = p_student_id;

  RETURN NEXT v_archive;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_school_year(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. next_lesson — ignore archived completions (current school year only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_lesson(p_student UUID, p_subject TEXT)
RETURNS TABLE (
  item_id UUID,
  order_index INTEGER,
  title TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lpi.id AS item_id,
    lpi.order_index,
    lpi.title
  FROM lesson_plans lp
  INNER JOIN lesson_plan_items lpi ON lpi.lesson_plan_id = lp.id
  LEFT JOIN lesson_completions lc
    ON lc.lesson_plan_item_id = lpi.id
    AND lc.student_id = p_student
    AND lc.school_year_archive_id IS NULL
    AND lc.status IS DISTINCT FROM 'planned'
  WHERE lp.student_id = p_student
    AND trim(lp.subject) = trim(p_subject)
    AND lc.id IS NULL
  ORDER BY lpi.order_index ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION next_lesson(UUID, TEXT) TO authenticated;
