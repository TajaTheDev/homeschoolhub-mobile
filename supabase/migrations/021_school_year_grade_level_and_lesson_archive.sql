-- Step 1 (cumulative transcript): grade on archives + manual lesson archive tagging.
-- RPC overload (Step 2) will populate these; no data deleted or backfilled here.

-- ---------------------------------------------------------------------------
-- 1. school_year_archives.grade_level
-- ---------------------------------------------------------------------------
ALTER TABLE public.school_year_archives
  ADD COLUMN IF NOT EXISTS grade_level TEXT;

COMMENT ON COLUMN public.school_year_archives.grade_level IS
  'Grade the student was in during this archived school year; set at End School Year (user confirmed).';

-- ---------------------------------------------------------------------------
-- 2. lessons.school_year_archive_id (manual completed lessons)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS school_year_archive_id UUID
  REFERENCES public.school_year_archives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_student_active_archive
  ON public.lessons(student_id, school_year_archive_id)
  WHERE school_year_archive_id IS NULL AND completed IS TRUE;

COMMENT ON COLUMN public.lessons.school_year_archive_id IS
  'Set when End School Year archives manual completed lessons for the student (same batch as lesson_completions).';

-- ---------------------------------------------------------------------------
-- 3. RLS: allow owners to UPDATE archives (backfill / edit grade_level)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own student archives" ON public.school_year_archives;
CREATE POLICY "Users can update own student archives"
  ON public.school_year_archives FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );
