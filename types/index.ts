/**
 * TypeScript interfaces and types for HomeschoolHub database schema
 */

// Type aliases
export type SubjectType = 'math' | 'reading' | 'science' | 'history' | 'writing' | 'art';

export type StudentColor = 'purple' | 'blue' | 'green' | 'pink' | 'orange';

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

// Database interfaces
export interface Student {
  id: string;
  user_id: string;
  name: string;
  grade: string;
  avatar?: string;
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
  student_id: string;
  subject: string;
  title: string;
  notes?: string;
  completed: boolean;
  date: string;
  created_at: string;
  updated_at: string;
}

