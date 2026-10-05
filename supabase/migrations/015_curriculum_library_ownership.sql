-- COMMIT 1 / STEP 1 — transitional ownership (safe to run while 1.1.11 is live)
--
-- created_by is auth.uid() on NEW app inserts, not students(id).
-- 1.1.11 omits created_by (NULL) and then inserts items — policies must allow that.
--
-- STEP 2 (later): run 016_curriculum_library_ownership_tighten.sql
-- after adoption of the build that always sets created_by. That drops OR IS NULL.
--
-- Apply in Supabase SQL Editor. Service role / Table Editor bypasses RLS.

-- Drop created_by → students FK so inserts can store auth.users ids.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.curriculum_library'::regclass
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%created_by%'
  LOOP
    EXECUTE format('ALTER TABLE public.curriculum_library DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Parent INSERT: new clients set created_by = auth.uid(); 1.1.11 omits the column (NULL).
-- created_by = auth.uid() alone rejects 1.1.11 because NULL = uid is not true.
DROP POLICY IF EXISTS "Authenticated users can insert curriculum library" ON curriculum_library;
CREATE POLICY "Authenticated users can insert curriculum library"
  ON curriculum_library FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR created_by IS NULL
  );

-- Parent UPDATE/DELETE: owner only. Null rows stay frozen for metadata changes.
-- 1.1.11 share does not UPDATE the parent; it only INSERT parent + items.
DROP POLICY IF EXISTS "Users can update own contributed curriculum" ON curriculum_library;
CREATE POLICY "Users can update own contributed curriculum"
  ON curriculum_library FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contributed curriculum" ON curriculum_library;
CREATE POLICY "Users can delete own contributed curriculum"
  ON curriculum_library FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Items: owner of parent, OR parent still unowned (1.1.11 shares).
-- Owned rows are protected immediately. Null-parent rows stay writable until STEP 2.
DROP POLICY IF EXISTS "Authenticated users can insert curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can insert curriculum library items"
  ON curriculum_library_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND (
          c.created_by = (SELECT auth.uid())
          OR c.created_by IS NULL
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can update curriculum library items"
  ON curriculum_library_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND (
          c.created_by = (SELECT auth.uid())
          OR c.created_by IS NULL
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND (
          c.created_by = (SELECT auth.uid())
          OR c.created_by IS NULL
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can delete curriculum library items"
  ON curriculum_library_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND (
          c.created_by = (SELECT auth.uid())
          OR c.created_by IS NULL
        )
    )
  );
