-- Add avatar support columns to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS avatar_type TEXT DEFAULT 'initial',
ADD COLUMN IF NOT EXISTS avatar_value TEXT;

-- avatar_type can be:
-- 'initial' - colored circle with initials (default)
-- 'photo' - uploaded photo (avatar_value = storage path)
-- 'illustration' - chosen illustration (avatar_value = illustration name)

COMMENT ON COLUMN students.avatar_type IS 'Type of avatar: initial, photo, or illustration';
COMMENT ON COLUMN students.avatar_value IS 'Storage path for photo or illustration name';

