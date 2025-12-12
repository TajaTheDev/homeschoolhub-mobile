# Supabase Storage Bucket Setup Checklist

## Step 1: Create/Verify the Bucket

1. Go to **Supabase Dashboard > Storage**
2. Click on **"student-avatars"** bucket (or create it if it doesn't exist)
3. Verify bucket settings:
   - ✅ **Name**: `student-avatars`
   - ✅ **Public**: **Yes** (toggle should be ON)
   - ✅ **File size limit**: At least **5MB** (recommended: 5MB)
   - ✅ **Allowed MIME types**: `image/jpeg, image/png, image/webp` (optional)

## Step 2: Apply Storage Policies

### Option A: Using SQL Editor (Recommended)

1. Go to **Supabase Dashboard > SQL Editor**
2. Open the file: `supabase/migrations/002_create_student_avatars_storage.sql`
3. Copy and paste the entire SQL script
4. Click **Run** to execute

The script will:
- Drop any existing conflicting policies
- Create the 4 required policies

### Option B: Manual Policy Creation

1. Go to **Storage > student-avatars > Policies**
2. **Delete all existing policies** for this bucket
3. Click **"New Policy"** for each policy below:

#### Policy 1: INSERT (Upload)
```sql
CREATE POLICY "Anyone can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'student-avatars');
```

#### Policy 2: SELECT (View)
```sql
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'student-avatars');
```

#### Policy 3: UPDATE
```sql
CREATE POLICY "Users can update their avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'student-avatars');
```

#### Policy 4: DELETE
```sql
CREATE POLICY "Users can delete their avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'student-avatars');
```

## Step 3: Verify Policies

After running the SQL, verify in **Storage > student-avatars > Policies**:

- ✅ "Anyone can upload avatars" (INSERT, authenticated)
- ✅ "Anyone can view avatars" (SELECT, public)
- ✅ "Users can update their avatars" (UPDATE, authenticated)
- ✅ "Users can delete their avatars" (DELETE, authenticated)

## Troubleshooting

### If uploads still fail:

1. **Check bucket is public:**
   - Storage > student-avatars > Settings
   - Ensure "Public bucket" toggle is ON

2. **Check RLS is enabled:**
   - Storage > student-avatars > Policies
   - Should see "Row Level Security enabled"

3. **Check file size:**
   - Ensure uploaded images are under the bucket's file size limit
   - Recommended: 5MB limit

4. **Check authentication:**
   - User must be authenticated (logged in)
   - Check Supabase Auth > Users to verify user exists

5. **Check console logs:**
   - Look for specific error messages in the app console
   - Common errors:
     - `new row violates row-level security policy` → Policy issue
     - `Bucket not found` → Bucket doesn't exist or wrong name
     - `File too large` → Exceeds size limit

## Testing

After setup, test the upload:

1. Open the app
2. Go to Profile Settings or Student Edit
3. Try uploading a photo
4. Check console for any errors
5. Verify file appears in Storage > student-avatars

