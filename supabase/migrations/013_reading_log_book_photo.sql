-- Add optional book cover photo path to reading_log entries.
-- Storage: lesson-photos bucket, path {userId}/reading-log/{studentId}/{timestamp}.jpg

ALTER TABLE reading_log
  ADD COLUMN IF NOT EXISTS book_photo_path TEXT;

COMMENT ON COLUMN reading_log.book_photo_path IS
  'Supabase storage path in lesson-photos bucket (first segment = auth user id)';
