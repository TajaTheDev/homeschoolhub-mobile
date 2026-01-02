-- Create lesson_photos table for storing lesson photo metadata
CREATE TABLE IF NOT EXISTS lesson_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE lesson_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view lesson_photos for their lessons"
  ON lesson_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_photos.lesson_id
    AND students.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert lesson_photos for their lessons"
  ON lesson_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_photos.lesson_id
    AND students.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete lesson_photos for their lessons"
  ON lesson_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM lessons
    JOIN students ON students.id = lessons.student_id
    WHERE lessons.id = lesson_photos.lesson_id
    AND students.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lesson_photos_lesson ON lesson_photos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_photos_created ON lesson_photos(created_at);

