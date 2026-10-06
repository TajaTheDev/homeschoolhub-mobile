/**
 * Single source of truth for homeschool grade labels and promotion suggestions.
 */

import type { GradeLevel } from '@/types';

/** Standard grades shown in student pickers (matches historical app data). */
export const ORDERED_GRADE_LEVELS: GradeLevel[] = [
  'Pre-K',
  'Kindergarten',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

export const GRADUATED_GRADE_LABEL = 'Graduated';

/** Chips for "next year" on End School Year (standard progression + graduated). */
export const END_SCHOOL_YEAR_NEXT_GRADE_CHIPS: string[] = [
  ...ORDERED_GRADE_LEVELS,
  GRADUATED_GRADE_LABEL,
];

/**
 * Returns the next grade in ORDERED_GRADE_LEVELS, or Graduated after 12th.
 * Returns empty string if current is not in the list (custom/blank — no guess).
 */
export function getSuggestedNextGrade(current: string): string {
  const trimmed = current.trim();
  if (!trimmed) {
    return '';
  }

  const index = ORDERED_GRADE_LEVELS.indexOf(trimmed as GradeLevel);
  if (index === -1) {
    return '';
  }

  if (index >= ORDERED_GRADE_LEVELS.length - 1) {
    return GRADUATED_GRADE_LABEL;
  }

  return ORDERED_GRADE_LEVELS[index + 1];
}
