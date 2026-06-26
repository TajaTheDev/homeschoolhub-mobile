# Homeschool Hub — Database Schema

> **Source of truth:** `types/database.generated.ts` (Supabase `gen types` export)  
> **Schema:** `public`  
> **PostgREST version:** 13.0.5  
> **Tables:** 18 · **Views:** none · **Enums:** none

TypeScript `string` columns are documented as `UUID`, `TEXT`, or `TIMESTAMPTZ` based on column name and usage. TypeScript `number` is documented as `INTEGER` unless noted.

---

## Tables

### `attendance`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `date` | `TEXT` | no | yes | |
| `present` | `BOOLEAN` | yes | no | |
| `notes` | `TEXT` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `breaks`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `start_date` | `TEXT` | no | yes | |
| `end_date` | `TEXT` | no | yes | |
| `reason` | `TEXT` | yes | no | |
| `emoji` | `TEXT` | yes | no | |
| `caused_shifts` | `BOOLEAN` | yes | no | |
| `shift_days` | `INTEGER` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `curriculum_library`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `name` | `TEXT` | no | yes | |
| `category` | `TEXT` | no | yes | |
| `publisher` | `TEXT` | yes | no | |
| `edition` | `TEXT` | yes | no | |
| `level` | `TEXT` | yes | no | |
| `verified` | `BOOLEAN` | yes | no | |
| `created_by` | `UUID` | yes | no | → `students(id)` |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `curriculum_library_items`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `curriculum_id` | `UUID` | no | yes | → `curriculum_library(id)` |
| `title` | `TEXT` | no | yes | |
| `order_index` | `INTEGER` | no | yes | |

---

### `lesson_completions`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `lesson_plan_item_id` | `UUID` | yes | no | → `lesson_plan_items(id)` |
| `subject` | `TEXT` | no | yes | |
| `title_snapshot` | `TEXT` | no | yes | |
| `date` | `TEXT` | no | yes | |
| `status` | `TEXT` | no | no (default) | |
| `grade` | `TEXT` | yes | no | |
| `completed_at` | `TIMESTAMPTZ` | yes | no | |
| `school_year_archive_id` | `UUID` | yes | no | → `school_year_archives(id)` |

`NULL` `school_year_archive_id` = current school year (counts toward progress). Archived rows remain for exports.

---

### `school_year_archives`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `school_year_label` | `TEXT` | no | yes | |
| `start_date` | `TEXT` | yes | no | `YYYY-MM-DD` |
| `end_date` | `TEXT` | yes | no | `YYYY-MM-DD` |
| `summary` | `JSONB` | yes | no | Per-subject snapshot |
| `archived_at` | `TIMESTAMPTZ` | yes | no | |

---

### `lesson_photos`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `lesson_id` | `UUID` | no | yes | → `lessons(id)` |
| `storage_path` | `TEXT` | yes | no | |
| `caption` | `TEXT` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `lesson_plan_items`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `lesson_plan_id` | `UUID` | no | yes | → `lesson_plans(id)` |
| `title` | `TEXT` | no | yes | |
| `order_index` | `INTEGER` | no | yes | |

---

### `lesson_plans`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `subject` | `TEXT` | no | yes | |
| `name` | `TEXT` | yes | no | |
| `source` | `TEXT` | yes | no | |
| `edition` | `TEXT` | yes | no | |
| `toc_image_path` | `TEXT` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `lesson_shifts`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `break_id` | `UUID` | no | yes | → `breaks(id)` |
| `lesson_id` | `UUID` | no | yes | → `lessons(id)` |
| `original_date` | `TEXT` | no | yes | |
| `shifted_date` | `TEXT` | no | yes | |
| `shift_days` | `INTEGER` | no | yes | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `lesson_students`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `lesson_id` | `UUID` | no | yes | → `lessons(id)` |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `lessons`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `subject` | `TEXT` | no | yes | |
| `title` | `TEXT` | no | yes | |
| `date` | `TEXT` | no | yes | |
| `notes` | `TEXT` | yes | no | |
| `completed` | `BOOLEAN` | yes | no | |
| `is_recurring` | `BOOLEAN` | yes | no | |
| `recurrence_pattern` | `TEXT` | yes | no | |
| `recurrence_days` | `TEXT` | yes | no | |
| `recurrence_end_date` | `TEXT` | yes | no | |
| `parent_lesson_id` | `UUID` | yes | no | → `lessons(id)` |
| `grade_type` | `TEXT` | yes | no | |
| `grade_value` | `TEXT` | yes | no | |
| `grade_max_points` | `INTEGER` | yes | no | |
| `graded_at` | `TIMESTAMPTZ` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `reading_log`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `title` | `TEXT` | no | yes | |
| `author` | `TEXT` | yes | no | |
| `status` | `TEXT` | no | no (default) | |
| `date_started` | `TEXT` | yes | no | |
| `date_finished` | `TEXT` | yes | no | |
| `rating` | `INTEGER` | yes | no | |
| `notes` | `TEXT` | yes | no | |
| `pages_read` | `INTEGER` | yes | no | |
| `minutes_read` | `INTEGER` | yes | no | |
| `reader_type` | `TEXT` | yes | no | `independent` \| `read_aloud` |
| `book_photo_path` | `TEXT` | yes | no | Supabase storage path in `lesson-photos` bucket |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `school_breaks`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `name` | `TEXT` | no | yes | |
| `start_date` | `TEXT` | no | yes | |
| `end_date` | `TEXT` | no | yes | |
| `emoji` | `TEXT` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `school_schedule`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `sunday` | `BOOLEAN` | yes | no | |
| `monday` | `BOOLEAN` | yes | no | |
| `tuesday` | `BOOLEAN` | yes | no | |
| `wednesday` | `BOOLEAN` | yes | no | |
| `thursday` | `BOOLEAN` | yes | no | |
| `friday` | `BOOLEAN` | yes | no | |
| `saturday` | `BOOLEAN` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `student_subjects`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `student_id` | `UUID` | no | yes | → `students(id)` |
| `subject` | `TEXT` | no | yes | |
| `goal` | `INTEGER` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |

---

### `students`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `name` | `TEXT` | no | yes | |
| `grade` | `TEXT` | no | yes | |
| `color_theme` | `TEXT` | yes | no | |
| `avatar` | `TEXT` | yes | no | |
| `avatar_type` | `TEXT` | yes | no | |
| `avatar_value` | `TEXT` | yes | no | |
| `active` | `BOOLEAN` | yes | no | |
| `school_year_start_date` | `TEXT` | yes | no | `YYYY-MM-DD`; manual lessons before this date are excluded from current-year progress |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `user_subscriptions`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `revenuecat_customer_id` | `TEXT` | yes | no | |
| `subscription_status` | `TEXT` | yes | no | |
| `trial_start_date` | `TEXT` | yes | no | |
| `trial_end_date` | `TEXT` | yes | no | |
| `last_checked_at` | `TIMESTAMPTZ` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

### `user_trials`

| Column | Type | Nullable | Required on insert | FK |
|--------|------|----------|-------------------|-----|
| `id` | `UUID` | no | no (auto) | PK |
| `user_id` | `UUID` | no | yes | |
| `started_at` | `TIMESTAMPTZ` | no | no (default) | |
| `expires_at` | `TIMESTAMPTZ` | no | yes | |
| `duration_days` | `INTEGER` | no | no (default) | |
| `status` | `TEXT` | no | no (default) | |
| `converted_at` | `TIMESTAMPTZ` | yes | no | |
| `subscription_plan` | `TEXT` | yes | no | |
| `created_at` | `TIMESTAMPTZ` | yes | no | |
| `updated_at` | `TIMESTAMPTZ` | yes | no | |

---

## Functions (RPC)

### `next_lesson`

```sql
next_lesson(p_student UUID, p_subject TEXT)
  RETURNS TABLE (
    item_id UUID,
    order_index INTEGER,
    title TEXT
  )
```

**Arguments**

| Parameter | Type | Required |
|-----------|------|----------|
| `p_student` | `UUID` | yes |
| `p_subject` | `TEXT` | yes |

**Returns:** first lesson plan item not completed in the **current** school year (ignores `lesson_completions` where `school_year_archive_id IS NOT NULL`).

---

### `archive_school_year`

```sql
archive_school_year(
  p_student_id UUID,
  p_school_year_label TEXT,
  p_start_date TEXT,
  p_end_date TEXT,
  p_summary JSONB DEFAULT '{}'::jsonb
) RETURNS SETOF school_year_archives
```

Atomically inserts an archive row, tags all active `lesson_completions` for the student with `school_year_archive_id`, and sets `students.school_year_start_date` to the day after `p_end_date`.

---

### `ensure_user_trial`

```sql
ensure_user_trial(
  p_duration_days INTEGER DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NULL
) RETURNS user_trials
```

**Arguments**

| Parameter | Type | Required |
|-----------|------|----------|
| `p_duration_days` | `INTEGER` | no |
| `p_started_at` | `TIMESTAMPTZ` | no |

**Returns:** a single `user_trials` row (creates one for the authenticated user when none exists).

---

### `convert_user_trial`

```sql
convert_user_trial(p_plan TEXT DEFAULT NULL) RETURNS user_trials
```

**Arguments**

| Parameter | Type | Required |
|-----------|------|----------|
| `p_plan` | `TEXT` | no |

**Returns:** a single `user_trials` row for the authenticated user after conversion.

---

### `delete_user_account`

```sql
delete_user_account(user_id UUID) RETURNS void
```

**Arguments**

| Parameter | Type | Required |
|-----------|------|----------|
| `user_id` | `UUID` | yes |

**Returns:** nothing.

---

## Entity relationships

```
students
  ├── school_year_archives (student_id)
  ├── lesson_plans (student_id)
  ├── lesson_completions (student_id)
  ├── student_subjects (student_id)
  ├── lessons (student_id)
  ├── lesson_students (student_id)
  ├── attendance (student_id)
  ├── reading_log (student_id)
  └── curriculum_library (created_by)

lesson_plans
  └── lesson_plan_items (lesson_plan_id)
        └── lesson_completions (lesson_plan_item_id)

curriculum_library
  └── curriculum_library_items (curriculum_id)

lessons
  ├── lesson_photos (lesson_id)
  ├── lesson_students (lesson_id)
  ├── lesson_shifts (lesson_id)
  └── lessons (parent_lesson_id, self)

breaks
  └── lesson_shifts (break_id)
```

---

## Refresh

Regenerate types and update this file when the live schema changes:

```bash
supabase gen types typescript --project-id cmfqthzlzqijadltnljb > types/database.generated.ts
```
