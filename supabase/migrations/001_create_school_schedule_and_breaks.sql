-- School Schedule Table (which days of week user schools)
CREATE TABLE school_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sunday BOOLEAN DEFAULT false,
  monday BOOLEAN DEFAULT true,
  tuesday BOOLEAN DEFAULT true,
  wednesday BOOLEAN DEFAULT true,
  thursday BOOLEAN DEFAULT true,
  friday BOOLEAN DEFAULT true,
  saturday BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id)
);

-- School Breaks Table (holidays, vacations, sick days)
CREATE TABLE school_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE school_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for school_schedule
CREATE POLICY "Users can view own schedule"
  ON school_schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule"
  ON school_schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule"
  ON school_schedule FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule"
  ON school_schedule FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for school_breaks
CREATE POLICY "Users can view own breaks"
  ON school_breaks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own breaks"
  ON school_breaks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own breaks"
  ON school_breaks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own breaks"
  ON school_breaks FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_school_schedule_user ON school_schedule(user_id);
CREATE INDEX idx_school_breaks_user ON school_breaks(user_id);
CREATE INDEX idx_school_breaks_dates ON school_breaks(start_date, end_date);

