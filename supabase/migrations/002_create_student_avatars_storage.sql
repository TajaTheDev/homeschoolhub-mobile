-- ============================================
-- Student Avatars Storage Bucket Setup
-- ============================================
-- 
-- STEP 1: Create the bucket in Supabase Dashboard
-- Go to: Storage > New Bucket
-- - Name: student-avatars
-- - Public: Yes (for public read access)
-- - File size limit: 5MB (recommended)
-- - Allowed MIME types: image/jpeg, image/png, image/webp (optional)
--
-- STEP 2: Run this SQL migration in SQL Editor
-- ============================================

-- First, drop any existing conflicting policies
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to student-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view student-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to student-avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from student-avatars" ON storage.objects;

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies with proper conditions
-- POLICY 1: Allow authenticated users to upload to their own folder (user_id/filename.jpg)
CREATE POLICY "Allow authenticated uploads to student-avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- POLICY 2: Allow public to view/download avatars
CREATE POLICY "Allow public to view student-avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-avatars');

-- POLICY 3: Allow authenticated users to update only their own files
CREATE POLICY "Allow authenticated updates to student-avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- POLICY 4: Allow authenticated users to delete only their own files
CREATE POLICY "Allow authenticated deletes from student-avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

