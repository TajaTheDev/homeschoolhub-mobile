-- Step 2: 7-arg archive_school_year overload (grade capture + manual lesson tagging).
-- Keeps existing 5-arg function from 009 for old app builds during rollout.

CREATE OR REPLACE FUNCTION public.archive_school_year(
  p_student_id UUID,
  p_school_year_label TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_grade_level TEXT,
  p_next_grade TEXT,
  p_summary JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.school_year_archives
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_archive public.school_year_archives;
  v_new_start TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.students s
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

  IF p_grade_level IS NULL OR trim(p_grade_level) = '' THEN
    RAISE EXCEPTION 'Grade level for this school year is required';
  END IF;

  IF p_next_grade IS NULL OR trim(p_next_grade) = '' THEN
    RAISE EXCEPTION 'Next year grade is required';
  END IF;

  v_new_start := (p_end_date::date + INTERVAL '1 day')::date::text;

  INSERT INTO public.school_year_archives (
    student_id,
    school_year_label,
    start_date,
    end_date,
    summary,
    grade_level,
    archived_at
  ) VALUES (
    p_student_id,
    trim(p_school_year_label),
    p_start_date,
    p_end_date,
    COALESCE(p_summary, '{}'::jsonb),
    trim(p_grade_level),
    now()
  )
  RETURNING * INTO v_archive;

  UPDATE public.lesson_completions
  SET school_year_archive_id = v_archive.id
  WHERE student_id = p_student_id
    AND school_year_archive_id IS NULL;

  UPDATE public.lessons l
  SET school_year_archive_id = v_archive.id,
      updated_at = now()
  FROM public.lesson_students ls
  WHERE ls.lesson_id = l.id
    AND ls.student_id = p_student_id
    AND l.completed IS TRUE
    AND l.school_year_archive_id IS NULL;

  UPDATE public.lessons
  SET school_year_archive_id = v_archive.id,
      updated_at = now()
  WHERE student_id = p_student_id
    AND completed IS TRUE
    AND school_year_archive_id IS NULL;

  UPDATE public.students
  SET grade = trim(p_next_grade),
      school_year_start_date = v_new_start,
      updated_at = now()
  WHERE id = p_student_id;

  RETURN NEXT v_archive;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_school_year(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;
