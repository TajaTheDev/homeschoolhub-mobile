-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS lesson_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(lesson_id, student_id)
);

-- Enable RLS
ALTER TABLE lesson_students ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view lesson_students for their lessons" ON lesson_students;
DROP POLICY IF EXISTS "Users can insert lesson_students for their lessons" ON lesson_students;
DROP POLICY IF EXISTS "Users can delete lesson_students for their lessons" ON lesson_students;

-- RLS Policies
CREATE POLICY "Users can view lesson_students for their lessons"
  ON lesson_students FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_students.lesson_id
    AND students.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert lesson_students for their lessons"
  ON lesson_students FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_students.lesson_id
    AND students.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete lesson_students for their lessons"
  ON lesson_students FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_students.lesson_id
    AND students.user_id = auth.uid()
  ));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lesson_students_lesson ON lesson_students(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_students_student ON lesson_students(student_id);

-- Migrate existing data (link existing lessons to their students)
INSERT INTO lesson_students (lesson_id, student_id)
SELECT id, student_id FROM lessons
WHERE student_id IS NOT NULL
ON CONFLICT (lesson_id, student_id) DO NOTHING;

