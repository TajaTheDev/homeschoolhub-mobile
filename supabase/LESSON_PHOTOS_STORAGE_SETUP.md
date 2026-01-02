# Lesson Photos Storage Bucket Setup Guide

## Step 1: Create the Storage Bucket

1. Go to **Supabase Dashboard > Storage**
2. Click **"New Bucket"**
3. Configure the bucket:
   - **Name**: `lesson-photos`
   - **Public**: **Yes** (toggle should be ON for public read access)
   - **File size limit**: **10MB** (recommended)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp` (optional)

## Step 2: Create Storage Policies

Go to **Storage > lesson-photos > Policies** and click **"New Policy"** for each of the 4 policies:

### Policy 1: INSERT (Upload)

1. Click **"New Policy"**
2. Fill in the form:
   - **Policy name**: `Allow authenticated uploads to lesson-photos`
   - **Allowed Operation**: Select `INSERT`
   - **Target roles**: Select `authenticated`
   - **Policy definition**: Paste this:
   ```sql
   (bucket_id = 'lesson-photos' AND
   auth.uid()::text = (storage.foldername(name))[1])
   ```
3. Click **"Save"** or **"Review"** then **"Save"**

### Policy 2: SELECT (View/Download)

1. Click **"New Policy"**
2. Fill in the form:
   - **Policy name**: `Allow public to view lesson-photos`
   - **Allowed Operation**: Select `SELECT`
   - **Target roles**: Select `public`
   - **Policy definition**: Paste this:
   ```sql
   (bucket_id = 'lesson-photos')
   ```
3. Click **"Save"** or **"Review"** then **"Save"**

### Policy 3: UPDATE

1. Click **"New Policy"**
2. Fill in the form:
   - **Policy name**: `Allow authenticated updates to lesson-photos`
   - **Allowed Operation**: Select `UPDATE`
   - **Target roles**: Select `authenticated`
   - **Policy definition**: Paste this:
   ```sql
   (bucket_id = 'lesson-photos' AND
   auth.uid()::text = (storage.foldername(name))[1])
   ```
3. Click **"Save"** or **"Review"** then **"Save"**

### Policy 4: DELETE

1. Click **"New Policy"**
2. Fill in the form:
   - **Policy name**: `Allow authenticated deletes from lesson-photos`
   - **Allowed Operation**: Select `DELETE`
   - **Target roles**: Select `authenticated`
   - **Policy definition**: Paste this:
   ```sql
   (bucket_id = 'lesson-photos' AND
   auth.uid()::text = (storage.foldername(name))[1])
   ```
3. Click **"Save"** or **"Review"** then **"Save"**

## Step 3: Verify Policies

After creating all policies, verify in **Storage > lesson-photos > Policies**:

- ✅ "Allow authenticated uploads to lesson-photos" (INSERT, authenticated)
- ✅ "Allow public to view lesson-photos" (SELECT, public)
- ✅ "Allow authenticated updates to lesson-photos" (UPDATE, authenticated)
- ✅ "Allow authenticated deletes from lesson-photos" (DELETE, authenticated)

## Alternative: Simplified Policies (If Folder Restrictions Don't Work)

If the folder-based user restrictions cause issues, you can use simpler policies that allow all authenticated users to manage files in the bucket. The database-level RLS on the `lesson_photos` table will still provide security.

### Simplified Policy Expressions

All four policies can use:
- **USING/WITH CHECK**: `bucket_id = 'lesson-photos'`

This is less restrictive but will still work since:
- Only authenticated users can upload (policy target is `authenticated`)
- Public can view (which is needed for displaying photos)
- The `lesson_photos` table has RLS policies that restrict access based on lesson ownership

## Troubleshooting

### If uploads fail:

1. **Check bucket is public:**
   - Storage > lesson-photos > Settings
   - Ensure "Public bucket" toggle is ON

2. **Check RLS is enabled:**
   - Storage > lesson-photos > Policies
   - Should see "Row Level Security enabled"

3. **Check file size:**
   - Ensure uploaded images are under the bucket's file size limit
   - Recommended: 10MB limit

4. **Check authentication:**
   - User must be authenticated (logged in)
   - Check Supabase Auth > Users to verify user exists

5. **Check console logs:**
   - Look for specific error messages in the app console
   - Common errors:
     - `new row violates row-level security policy` → Policy issue
     - `Bucket not found` → Bucket doesn't exist or wrong name
     - `File too large` → Exceeds size limit

### If folder-based restrictions don't work:

Some Supabase setups may not support `storage.foldername()` function. In that case:

1. Use the simplified policies (just `bucket_id = 'lesson-photos'`)
2. Rely on database-level security through the `lesson_photos` table RLS policies
3. The app already validates that users can only access photos for their own lessons

## Testing

After setup, test the upload:

1. Open the app
2. Create a new lesson
3. Try uploading a photo
4. Check console for any errors
5. Verify file appears in Storage > lesson-photos
6. Verify photo displays correctly in the lesson view

