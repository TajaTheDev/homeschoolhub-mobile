-- COMMIT 1 / STEP 2 — tighten ownership (do NOT run while 1.1.11 is still sharing)
--
-- Prerequisite: the store build that always sets created_by = auth.uid() has
-- reasonable adoption (same bar as Commit 2 category backfill).
-- Until then, leave 015 transitional policies in place.
--
-- Drops OR created_by IS NULL from parent INSERT and all item write policies.
-- Null legacy rows become fully frozen (no item writes from the app).
-- Service role / Table Editor still bypasses RLS.

DROP POLICY IF EXISTS "Authenticated users can insert curriculum library" ON curriculum_library;
CREATE POLICY "Authenticated users can insert curriculum library"
  ON curriculum_library FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert curriculum library items" ON curriculum_library_items;
CREATE POLICY "Authenticated users can insert curriculum library items"
  ON curriculum_library_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND c.created_by = (SELECT auth.uid())
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
        AND c.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curriculum_library c
      WHERE c.id = curriculum_library_items.curriculum_id
        AND c.created_by = (SELECT auth.uid())
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
        AND c.created_by = (SELECT auth.uid())
    )
  );
