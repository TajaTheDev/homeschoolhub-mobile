-- Migration to fix column name mismatch
-- The table has both 'photo_path' and 'storage_path' columns
-- We're using 'storage_path' in our code, so we need to drop 'photo_path'

-- Drop the photo_path column since we're using storage_path
-- If you want to migrate any data from photo_path to storage_path first, do that before running this
ALTER TABLE lesson_photos DROP COLUMN IF EXISTS photo_path;

