/**
 * Date filtering utilities for lesson counts
 * Provides functions to filter lessons by time periods (week, month, year)
 */

import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import type { Lesson } from '@/types';

/**
 * Get the start of the week (Monday) for a given date
 * @param date - The date to get the week start for
 * @returns Date set to Monday at 00:00:00
 */
export const getStartOfWeek = (date: Date): Date => {
  return startOfWeek(date, { weekStartsOn: 1 });
};

/**
 * Get the end of the week (Sunday) for a given date
 * @param date - The date to get the week end for
 * @returns Date set to Sunday at 23:59:59.999
 */
export const getEndOfWeek = (date: Date): Date => {
  const end = endOfWeek(date, { weekStartsOn: 1 });
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Get the start of the month for a given date
 * @param date - The date to get the month start for
 * @returns Date set to the first day of the month at 00:00:00
 */
export const getStartOfMonth = (date: Date): Date => {
  return startOfMonth(date);
};

/**
 * Get the end of the month for a given date
 * @param date - The date to get the month end for
 * @returns Date set to the last day of the month at 23:59:59.999
 */
export const getEndOfMonth = (date: Date): Date => {
  const end = endOfMonth(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Check if a lesson date falls within a date range (inclusive)
 * @param lessonDate - The lesson date (string or Date)
 * @param start - Start date of the range
 * @param end - End date of the range
 * @returns true if the lesson date is within the range
 */
export const isDateInRange = (lessonDate: Date | string, start: Date, end: Date): boolean => {
  const date = typeof lessonDate === 'string' ? new Date(lessonDate) : lessonDate;
  // Compare dates only (ignore time)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  return dateOnly >= startOnly && dateOnly <= endOnly;
};

/**
 * Filter lessons by student ID
 * Handles both student_id (backward compatibility) and students array (many-to-many)
 * @param lessons - Array of lessons
 * @param studentId - Student ID to filter by
 * @returns Filtered lessons for the student
 */
export const filterLessonsByStudent = (lessons: Lesson[], studentId: string): Lesson[] => {
  return lessons.filter((lesson) => {
    // Check if this student is in the lesson's students array (many-to-many)
    if (lesson.students && lesson.students.length > 0) {
      return lesson.students.some((s: any) => s.id === studentId);
    }
    // Fallback to student_id for backward compatibility
    return lesson.student_id === studentId;
  });
};

/**
 * Get lesson counts by time period (week, month, total)
 * @param lessons - Array of lessons to count
 * @param studentId - Optional student ID to filter by
 * @returns Object with counts for thisWeek, thisMonth, total, and their completed counts
 */
export const getLessonCountsByPeriod = (
  lessons: Lesson[],
  studentId?: string
): {
  thisWeek: number;
  thisMonth: number;
  total: number;
  completedThisWeek: number;
  completedThisMonth: number;
  completedTotal: number;
} => {
  const now = new Date();
  
  // Filter by student if provided
  const studentLessons = studentId 
    ? filterLessonsByStudent(lessons, studentId)
    : lessons;
  
  // Calculate date ranges
  const weekStart = getStartOfWeek(now);
  const weekEnd = getEndOfWeek(now);
  const monthStart = getStartOfMonth(now);
  const monthEnd = getEndOfMonth(now);
  
  // Filter lessons by date ranges
  const thisWeekLessons = studentLessons.filter(l => 
    isDateInRange(l.date, weekStart, weekEnd)
  );
  const thisMonthLessons = studentLessons.filter(l => 
    isDateInRange(l.date, monthStart, monthEnd)
  );
  
  return {
    thisWeek: thisWeekLessons.length,
    thisMonth: thisMonthLessons.length,
    total: studentLessons.length,
    completedThisWeek: thisWeekLessons.filter(l => l.completed).length,
    completedThisMonth: thisMonthLessons.filter(l => l.completed).length,
    completedTotal: studentLessons.filter(l => l.completed).length,
  };
};

