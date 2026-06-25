-- RLS policies + enablement for tables missing protection on live.
-- Apply in phases via Supabase SQL Editor (do not run end-to-end blindly).
--
-- SAFE ORDER:
--   Phase 1 — CREATE POLICIES (this file, lines below through curriculum items)
--   Phase 2 — TEST app (exports, recurring plan, curriculum share, lesson plans, archive)
--   Phase 3 — ENABLE ROW LEVEL SECURITY (bottom of file)
--   Phase 4 — VERIFY with pg_policies / advisors
--
-- Never ENABLE RLS on a table before its policies exist.

-- =============================================================================
-- PHASE 1: CREATE POLICIES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lesson_plans (via student_id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own lesson plans" ON lesson_plans;
CREATE POLICY "Users can view own lesson plans"
  ON lesson_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_plans.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own lesson plans" ON lesson_plans;
CREATE POLICY "Users can insert own lesson plans"
  ON lesson_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_plans.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own lesson plans" ON lesson_plans;
CREATE POLICY "Users can update own lesson plans"
  ON lesson_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_plans.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own lesson plans" ON lesson_plans;
CREATE POLICY "Users can delete own lesson plans"
  ON lesson_plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_plans.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- lesson_plan_items (via lesson_plans → students)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own lesson plan items" ON lesson_plan_items;
CREATE POLICY "Users can view own lesson plan items"
  ON lesson_plan_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM lesson_plans lp
      JOIN students s ON s.id = lp.student_id
      WHERE lp.id = lesson_plan_items.lesson_plan_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own lesson plan items" ON lesson_plan_items;
CREATE POLICY "Users can insert own lesson plan items"
  ON lesson_plan_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM lesson_plans lp
      JOIN students s ON s.id = lp.student_id
      WHERE lp.id = lesson_plan_items.lesson_plan_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own lesson plan items" ON lesson_plan_items;
CREATE POLICY "Users can update own lesson plan items"
  ON lesson_plan_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM lesson_plans lp
      JOIN students s ON s.id = lp.student_id
      WHERE lp.id = lesson_plan_items.lesson_plan_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own lesson plan items" ON lesson_plan_items;
CREATE POLICY "Users can delete own lesson plan items"
  ON lesson_plan_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM lesson_plans lp
      JOIN students s ON s.id = lp.student_id
      WHERE lp.id = lesson_plan_items.lesson_plan_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- lesson_completions (via student_id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own lesson completions" ON lesson_completions;
CREATE POLICY "Users can view own lesson completions"
  ON lesson_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_completions.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own lesson completions" ON lesson_completions;
CREATE POLICY "Users can insert own lesson completions"
  ON lesson_completions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_completions.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own lesson completions" ON lesson_completions;
CREATE POLICY "Users can update own lesson completions"
  ON lesson_completions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_completions.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own lesson completions" ON lesson_completions;
CREATE POLICY "Users can delete own lesson completions"
  ON lesson_completions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = lesson_completions.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- reading_log (via student_id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own reading log" ON reading_log;
CREATE POLICY "Users can view own reading log"
  ON reading_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = reading_log.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own reading log" ON reading_log;
CREATE POLICY "Users can insert own reading log"
  ON reading_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = reading_log.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own reading log" ON reading_log;
CREATE POLICY "Users can update own reading log"
  ON reading_log FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = reading_log.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own reading log" ON reading_log;
CREATE POLICY "Users can delete own reading log"
  ON reading_log FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = reading_log.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- school_year_archives (via student_id; INSERT also via archive_school_year RPC)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own student archives" ON school_year_archives;
CREATE POLICY "Users can view own student archives"
  ON school_year_archives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own student archives" ON school_year_archives;
CREATE POLICY "Users can insert own student archives"
  ON school_year_archives FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = school_year_archives.student_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- curriculum_library — community read + authenticated writes
-- (SELECT policy "Authenticated users can read curriculum library" already exists)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert curriculum library" ON curriculum_library;
CREATE POLICY "Authenticated users can insert curriculum library"
  ON curriculum_library FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own contributed curriculum" ON curriculum_library;
CREATE POLICY "Users can update own contributed curriculum"
  ON curriculum_library FOR UPDATE
  TO authenticated
  USING (
    created_by IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = curriculum_library.created_by
        AND s.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own contributed curriculum" ON curriculum_library;
CREATE POLICY "Users can delete own contributed curriculum"
  ON curriculum_library FOR DELETE
  TO authenticated
  USING (
    created_by IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM students s
      WHERE s.id = curriculum_library.created_by
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- curriculum_library_items — community item maintenance
-- (SELECT policy "Authenticated users can read curriculum library items" already exists)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can insert curriculum library items"
  ON curriculum_library_items FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can update curriculum library items"
  ON curriculum_library_items FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can delete curriculum library items"
  ON curriculum_library_items FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

-- -----------------------------------------------------------------------------
-- OPTIONAL: deduplicate lesson_photos policies (7 → 4)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view lesson_photos for their lessons" ON lesson_photos;
DROP POLICY IF EXISTS "Users can insert lesson_photos for their lessons" ON lesson_photos;
DROP POLICY IF EXISTS "Users can delete lesson_photos for their lessons" ON lesson_photos;
-- Keeps: "Users can view/insert/update/delete photos for their lessons"

-- =============================================================================
-- PHASE 3: ENABLE RLS (run only after Phase 1 policies exist + Phase 2 testing)
-- =============================================================================

-- ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lesson_plan_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reading_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE school_year_archives ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE curriculum_library ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE curriculum_library_items ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PHASE 4: VERIFY
-- =============================================================================

-- SELECT
--   c.relname AS table_name,
--   c.relrowsecurity AS rls_enabled,
--   (SELECT count(*)::int FROM pg_policies p
--    WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policy_count
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
-- ORDER BY c.relname;
