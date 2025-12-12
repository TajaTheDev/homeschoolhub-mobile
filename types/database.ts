/**
 * Database type definitions for HomeschoolHub
 * These types match the Supabase database schema
 */

export interface SchoolSchedule {
  id: string;
  user_id: string;
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolBreak {
  id: string;
  user_id: string;
  name: string;
  start_date: string; // Format: 'YYYY-MM-DD'
  end_date: string;   // Format: 'YYYY-MM-DD'
  created_at: string;
}

export interface DayOfWeek {
  key: keyof Omit<SchoolSchedule, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
  label: string;
  number: number; // 0=Sunday, 1=Monday, etc.
}

export interface LessonPhoto {
  id: string;
  lesson_id: string;
  photo_path: string;
  caption: string | null;
  created_at: string;
}

