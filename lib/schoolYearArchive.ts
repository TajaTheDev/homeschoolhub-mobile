/**
 * School year archive helpers: defaults, summary snapshot, archive RPC.
 */

import {
  fetchAllMergedCompletedLessons,
  fetchCurriculumItemCountsBySubject,
} from '@/lib/fetchPdfExportData';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.generated';
import { format } from 'date-fns';

export type SchoolYearArchiveRow = Tables<'school_year_archives'>;

export type SchoolYearArchiveSubjectSummary = {
  completed: number;
  curriculumTotal: number | null;
  goal: number | null;
};

export type SchoolYearArchiveSummary = {
  subjects: Record<string, SchoolYearArchiveSubjectSummary>;
  totals: {
    lessonsCompleted: number;
    subjectsCount: number;
  };
};

export type ArchiveSchoolYearParams = {
  studentId: string;
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  summary: SchoolYearArchiveSummary;
};

/**
 * Default label e.g. "2025–2026" (July–June school year).
 */
export function defaultSchoolYearLabel(referenceDate = new Date()): string {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  const startYear = month >= 6 ? year : year - 1;
  return `${startYear}–${startYear + 1}`;
}

/**
 * July 1 of the first year in the label (e.g. "2025–2026" → 2025-07-01).
 */
export function defaultSchoolYearStartDate(schoolYearLabel: string): string {
  const match = schoolYearLabel.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : new Date().getFullYear();
  return `${startYear}-07-01`;
}

/**
 * Today's date as YYYY-MM-DD for archive end_date.
 */
export function defaultSchoolYearEndDate(referenceDate = new Date()): string {
  return format(referenceDate, 'yyyy-MM-dd');
}

/**
 * Builds per-subject progress snapshot using active-year merged completion logic.
 */
export async function buildArchiveSummary(
  studentId: string,
  subjectRecords: Array<{ subject: string; goal: number | null }>
): Promise<SchoolYearArchiveSummary> {
  const [mergedLessons, curriculumCounts] = await Promise.all([
    fetchAllMergedCompletedLessons(studentId, { activeOnly: true }),
    fetchCurriculumItemCountsBySubject(studentId),
  ]);

  const completedBySubject: Record<string, number> = {};
  mergedLessons.forEach((row) => {
    completedBySubject[row.subject] = (completedBySubject[row.subject] ?? 0) + 1;
  });

  const subjects: Record<string, SchoolYearArchiveSubjectSummary> = {};
  const subjectNames = new Set([
    ...subjectRecords.map((row) => row.subject),
    ...Object.keys(completedBySubject),
    ...Object.keys(curriculumCounts),
  ]);

  subjectNames.forEach((subject) => {
    const record = subjectRecords.find((row) => row.subject === subject);
    subjects[subject] = {
      completed: completedBySubject[subject] ?? 0,
      curriculumTotal: curriculumCounts[subject] ?? null,
      goal: record?.goal ?? null,
    };
  });

  const lessonsCompleted = mergedLessons.length;

  return {
    subjects,
    totals: {
      lessonsCompleted,
      subjectsCount: Object.keys(subjects).length,
    },
  };
}

/**
 * Archives the current school year for a student in one atomic transaction.
 */
export async function archiveSchoolYear(
  params: ArchiveSchoolYearParams
): Promise<SchoolYearArchiveRow> {
  const { data, error } = await supabase
    .rpc('archive_school_year', {
      p_student_id: params.studentId,
      p_school_year_label: params.schoolYearLabel.trim(),
      p_start_date: params.startDate,
      p_end_date: params.endDate,
      p_summary: params.summary,
    })
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Archive failed with no data returned.');
  }

  return data;
}
