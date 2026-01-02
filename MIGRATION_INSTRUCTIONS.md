# Applying the lesson_students Migration

The `lesson_students` table is missing from your Supabase database. Follow these steps to create it:

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `scripts/apply-lesson-students-migration.sql`
6. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
7. You should see a success message

## Option 2: Via Supabase CLI (if installed)

```bash
# If you have Supabase CLI installed and linked
supabase db push

# Or apply the specific migration
supabase migration up
```

## Verify the Table Was Created

After running the migration, verify it worked:

1. In Supabase Dashboard, go to **Table Editor**
2. You should see `lesson_students` table in the list
3. It should have these columns:
   - `id` (UUID, Primary Key)
   - `lesson_id` (UUID, Foreign Key to lessons)
   - `student_id` (UUID, Foreign Key to students)
   - `created_at` (Timestamp)

## After Migration

Once the table is created, restart your app and the lesson fetching should work properly!

