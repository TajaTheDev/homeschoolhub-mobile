/**
 * TypeScript interfaces and types for HomeschoolHub database schema
 */

// Import types for use in interfaces
import type { LessonPhoto, LessonStudent } from './database';

// Type aliases
export type SubjectType = 'math' | 'reading' | 'science' | 'history' | 'writing' | 'art';

export type StudentColor = 'purple' | 'blue' | 'green' | 'pink' | 'orange';

export type AvatarType = 'initial' | 'photo' | 'illustration';

export type GradeLevel =
  | 'Pre-K'
  | 'Kindergarten'
  | '1st'
  | '2nd'
  | '3rd'
  | '4th'
  | '5th'
  | '6th'
  | '7th'
  | '8th'
  | '9th'
  | '10th'
  | '11th'
  | '12th';

// Grade display helper type
export type GradeDisplay = {
  display: string; // What to show user (e.g., "A", "95%", "Pass", "18/20")
  color: string;   // Color for the grade badge
  numeric?: number; // Numeric value for calculations (optional)
};

// Database interfaces
export interface Student {
  id: string;
  user_id: string;
  name: string;
  grade: string;
  avatar_type: AvatarType;
  avatar_value: string | null;
  color_theme: StudentColor;
  created_at: string;
  updated_at: string;
}

export interface StudentSubject {
  id: string;
  student_id: string;
  subject: string;
  goal?: number;
  created_at: string;
}

export interface Lesson {
  id: string;
  student_id: string; // Keep for backward compatibility
  subject: string;
  title: string;
  notes?: string;
  completed: boolean;
  date: string;
  created_at: string;
  updated_at: string;
  // Recurring lesson fields
  is_recurring?: boolean;
  recurrence_pattern?: 'daily' | 'weekly' | 'custom';
  recurrence_days?: string; // JSON array as string
  recurrence_end_date?: string;
  parent_lesson_id?: string;
  // Grade fields
  grade_type?: 'letter' | 'percentage' | 'pass_fail' | 'points' | 'custom';
  grade_value?: string;
  grade_max_points?: number;
  graded_at?: string;
  photos?: LessonPhoto[];
  students?: Student[]; // NEW: Array of students
  lesson_students?: LessonStudent[]; // NEW: Junction records
}

// Attendance interfaces
export interface AttendanceRecord {
  id: string;
  user_id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  present: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DailyAttendance {
  date: string;
  students: {
    student_id: string;
    student_name: string;
    present: boolean;
    notes?: string;
  }[];
}

export interface AttendanceStats {
  student_id: string;
  student_name: string;
  total_days: number;
  days_present: number;
  days_absent: number;
  attendance_rate: number; // Percentage
}

// Re-export database types
export type { DayOfWeek, LessonPhoto, LessonStudent, SchoolBreak, SchoolSchedule } from './database';

