-- Enforce one student_subjects row per (student_id, subject).
-- Run in Supabase SQL Editor BEFORE deploying app auto-enroll changes.

-- 1. Preview duplicates (optional)
-- SELECT student_id, subject, COUNT(*) AS n
-- FROM student_subjects
-- GROUP BY student_id, subject
-- HAVING COUNT(*) > 1;

-- 2. Remove duplicate rows (keep earliest by created_at, then id)
DELETE FROM student_subjects
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY student_id, subject
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM student_subjects
  ) ranked
  WHERE rn > 1
);

-- 3. Add unique constraint
ALTER TABLE student_subjects
  DROP CONSTRAINT IF EXISTS student_subjects_student_subject_unique;

ALTER TABLE student_subjects
  ADD CONSTRAINT student_subjects_student_subject_unique
  UNIQUE (student_id, subject);
