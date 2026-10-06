/**
 * Supabase data fetching for academic transcript PDF.
 */

import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.generated';

type LessonCompletionRow = Tables<'lesson_completions'>;
type SchoolYearArchiveRow = Tables<'school_year_archives'>;

type ManualLessonRow = {
  id: string;
  subject: string;
  date: string;
  title: string;
  grade: string | null;
  schoolYearArchiveId: string | null;
};

type MergedCompletedLesson = {
  subject: string;
  date: string;
  title: string;
  grade: string | null;
};

export type TranscriptSubjectRow = {
  subject: string;
  curriculumName: string | null;
  lessonsCompleted: number;
  finalGrade: string;
  numericAverage: number | null;
  gradedCount: number;
};

export type TranscriptSectionSummary = {
  totalLessons: number;
  weightedAverage: string | null;
};

/** @deprecated Legacy single-range transcript shape; cumulative export uses TranscriptYearSection. */
export type TranscriptData = {
  subjects: TranscriptSubjectRow[];
  summary: TranscriptSectionSummary;
};

export type TranscriptYearSection = {
  /** Archive row id, or null for the active (not yet archived) school year. */
  archiveId: string | null;
  /** e.g. school_year_label or "Current school year". */
  label: string;
  /** Grade for this block; null means not recorded (see warnings). */
  gradeLevel: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrentYear: boolean;
  subjects: TranscriptSubjectRow[];
  summary: TranscriptSectionSummary;
};

export type MissingGradeArchive = {
  archiveId: string;
  schoolYearLabel: string;
};

export type CumulativeTranscriptData = {
  sections: TranscriptYearSection[];
  warnings: string[];
  /** Archives in this export missing grade_level (for backfill preflight). */
  missingGradeArchives: MissingGradeArchive[];
};

export type FetchCumulativeTranscriptOptions = {
  /**
   * When set, include only sections whose school-year date range overlaps this window.
   * Default: full cumulative (no filter).
   */
  dateRangeFilter?: {
    startDate: string;
    endDate: string;
  };
};

function parseNumericGrade(grade: string): number | null {
  const cleaned = grade.replace(/%/g, '').trim();
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isLetterGrade(grade: string): boolean {
  return /^[A-F][+-]?$/i.test(grade.trim());
}

function computeFinalGrade(grades: string[]): {
  display: string;
  numericAverage: number | null;
  gradedCount: number;
} {
  const trimmed = grades.map((g) => g.trim()).filter(Boolean);

  if (trimmed.length === 0) {
    return { display: '—', numericAverage: null, gradedCount: 0 };
  }

  const numeric = trimmed
    .map(parseNumericGrade)
    .filter((value): value is number => value !== null);

  if (numeric.length === trimmed.length) {
    const avg = Math.round(numeric.reduce((sum, v) => sum + v, 0) / numeric.length);
    return { display: `${avg}%`, numericAverage: avg, gradedCount: trimmed.length };
  }

  if (trimmed.every(isLetterGrade)) {
    const counts = new Map<string, number>();
    trimmed.forEach((g) => {
      const key = g.toUpperCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    let bestGrade = trimmed[0].toUpperCase();
    let bestCount = 0;
    counts.forEach((count, grade) => {
      if (count > bestCount) {
        bestCount = count;
        bestGrade = grade;
      }
    });

    return { display: bestGrade, numericAverage: null, gradedCount: trimmed.length };
  }

  return { display: '—', numericAverage: null, gradedCount: trimmed.length };
}

async function fetchAllLessonPlanNames(
  studentId: string
): Promise<Record<string, string | null>> {
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('subject, name, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching lesson plans for transcript:', error);
    return {};
  }

  const map: Record<string, string | null> = {};
  (data ?? []).forEach((plan) => {
    if (map[plan.subject] !== undefined) return;
    map[plan.subject] = plan.name?.trim() || null;
  });

  return map;
}

function formatLessonGrade(
  gradeValue: string | null | undefined,
  gradeType: string | null | undefined
): string | null {
  if (!gradeValue?.trim()) return null;
  const value = gradeValue.trim();
  if (gradeType === 'percentage' && !value.includes('%')) {
    return `${value}%`;
  }
  return value;
}

function mergeDedupeKey(subject: string, date: string): string {
  return `${subject.trim()}|${date}`;
}

function mergeCompletedLessons(
  completions: LessonCompletionRow[],
  manualLessons: Array<Omit<ManualLessonRow, 'id' | 'schoolYearArchiveId'>>
): MergedCompletedLesson[] {
  const map = new Map<string, MergedCompletedLesson>();

  manualLessons.forEach((row) => {
    map.set(mergeDedupeKey(row.subject, row.date), {
      subject: row.subject,
      date: row.date,
      title: row.title,
      grade: row.grade,
    });
  });

  completions.forEach((row) => {
    map.set(mergeDedupeKey(row.subject, row.date), {
      subject: row.subject,
      date: row.date,
      title: row.title_snapshot,
      grade: row.grade?.trim() || null,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    return dateCmp !== 0 ? dateCmp : a.subject.localeCompare(b.subject);
  });
}

function buildSubjectRowsFromMerged(
  mergedLessons: MergedCompletedLesson[],
  curriculumBySubject: Record<string, string | null>
): { subjects: TranscriptSubjectRow[]; summary: TranscriptSectionSummary } {
  const mergedSubjects = [...new Set(mergedLessons.map((row) => row.subject))];
  const planSubjects = Object.keys(curriculumBySubject);
  const subjects = Array.from(new Set([...mergedSubjects, ...planSubjects]));

  const bySubject = new Map<string, MergedCompletedLesson[]>();
  mergedLessons.forEach((row) => {
    const bucket = bySubject.get(row.subject) ?? [];
    bucket.push(row);
    bySubject.set(row.subject, bucket);
  });

  const subjectRows: TranscriptSubjectRow[] = subjects
    .map((subject) => {
      const rows = bySubject.get(subject) ?? [];
      const grades = rows
        .map((row) => row.grade)
        .filter((grade): grade is string => Boolean(grade?.trim()));

      const { display, numericAverage, gradedCount } = computeFinalGrade(grades);

      return {
        subject,
        curriculumName: curriculumBySubject[subject] ?? null,
        lessonsCompleted: rows.length,
        finalGrade: display,
        numericAverage,
        gradedCount,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const totalLessons = subjectRows.reduce((sum, row) => sum + row.lessonsCompleted, 0);
  const numericSubjects = subjectRows.filter((row) => row.numericAverage !== null);
  const totalGradedForWeight = numericSubjects.reduce((sum, row) => sum + row.gradedCount, 0);

  let weightedAverage: string | null = null;
  if (totalGradedForWeight > 0) {
    const weightedSum = numericSubjects.reduce(
      (sum, row) => sum + (row.numericAverage ?? 0) * row.gradedCount,
      0
    );
    weightedAverage = `${Math.round(weightedSum / totalGradedForWeight)}%`;
  }

  return {
    subjects: subjectRows,
    summary: { totalLessons, weightedAverage },
  };
}

function dateWithinInclusive(date: string, startDate: string | null, endDate: string | null): boolean {
  if (!startDate || !endDate) {
    return false;
  }
  return date >= startDate && date <= endDate;
}

function sectionOverlapsFilter(
  sectionStart: string | null,
  sectionEnd: string | null,
  filterStart: string,
  filterEnd: string
): boolean {
  if (!sectionStart || !sectionEnd) {
    return true;
  }
  return sectionStart <= filterEnd && sectionEnd >= filterStart;
}

async function fetchCompletedManualLessonsForStudent(
  studentId: string
): Promise<ManualLessonRow[]> {
  const byLessonId = new Map<string, ManualLessonRow>();

  const { data: junctionData, error: junctionError } = await supabase
    .from('lessons')
    .select(
      'id, subject, title, date, grade_value, grade_type, school_year_archive_id, lesson_students!inner(student_id)'
    )
    .eq('lesson_students.student_id', studentId)
    .eq('completed', true);

  if (junctionError) {
    throw new Error(junctionError.message);
  }

  (junctionData ?? []).forEach((lesson) => {
    byLessonId.set(lesson.id, {
      id: lesson.id,
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
      schoolYearArchiveId: lesson.school_year_archive_id ?? null,
    });
  });

  const { data: directData, error: directError } = await supabase
    .from('lessons')
    .select('id, subject, title, date, grade_value, grade_type, school_year_archive_id')
    .eq('student_id', studentId)
    .eq('completed', true);

  if (directError) {
    throw new Error(directError.message);
  }

  (directData ?? []).forEach((lesson) => {
    if (byLessonId.has(lesson.id)) return;
    byLessonId.set(lesson.id, {
      id: lesson.id,
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
      schoolYearArchiveId: lesson.school_year_archive_id ?? null,
    });
  });

  return Array.from(byLessonId.values());
}

async function fetchCompletedManualLessons(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<Array<Omit<ManualLessonRow, 'id' | 'schoolYearArchiveId'>>> {
  const all = await fetchCompletedManualLessonsForStudent(studentId);
  return all
    .filter((row) => row.date >= startDate && row.date <= endDate)
    .map(({ subject, date, title, grade }) => ({ subject, date, title, grade }));
}

/**
 * Fetches transcript data for a student within a school year date range.
 */
export async function fetchTranscriptData(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<TranscriptData> {
  const { data: completionsRaw, error } = await supabase
    .from('lesson_completions')
    .select('*')
    .eq('student_id', studentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .neq('status', 'planned')
    .order('date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const completions = completionsRaw ?? [];
  const manualLessons = await fetchCompletedManualLessons(studentId, startDate, endDate);
  const mergedLessons = mergeCompletedLessons(completions, manualLessons);
  const curriculumBySubject = await fetchAllLessonPlanNames(studentId);
  const { subjects, summary } = buildSubjectRowsFromMerged(mergedLessons, curriculumBySubject);

  return { subjects, summary };
}

const CURRENT_YEAR_LABEL = 'Current school year';

/**
 * Fetches cumulative transcript data grouped by archived school years plus the active year.
 * Read-only: no database writes.
 */
export async function fetchCumulativeTranscriptData(
  studentId: string,
  options: FetchCumulativeTranscriptOptions = {}
): Promise<CumulativeTranscriptData> {
  const [archivesResult, studentResult, completionsResult, manualLessons, curriculumBySubject] =
    await Promise.all([
      supabase
        .from('school_year_archives')
        .select('*')
        .eq('student_id', studentId)
        .order('start_date', { ascending: true }),
      supabase
        .from('students')
        .select('grade, school_year_start_date')
        .eq('id', studentId)
        .single(),
      supabase
        .from('lesson_completions')
        .select('*')
        .eq('student_id', studentId)
        .neq('status', 'planned')
        .order('date', { ascending: true }),
      fetchCompletedManualLessonsForStudent(studentId),
      fetchAllLessonPlanNames(studentId),
    ]);

  if (archivesResult.error) {
    throw new Error(archivesResult.error.message);
  }
  if (studentResult.error) {
    throw new Error(studentResult.error.message);
  }
  if (completionsResult.error) {
    throw new Error(completionsResult.error.message);
  }

  const archives = (archivesResult.data ?? []) as SchoolYearArchiveRow[];
  const studentGrade = studentResult.data?.grade?.trim() ?? '';
  const schoolYearStartDate = studentResult.data?.school_year_start_date ?? null;
  const allCompletions = completionsResult.data ?? [];

  /** Manual lessons assigned via legacy date fallback (still null archive_id in DB). */
  const legacyFallbackLessonIds = new Set<string>();

  const sections: TranscriptYearSection[] = [];

  for (const archive of archives) {
    const archiveCompletions = allCompletions.filter(
      (row) => row.school_year_archive_id === archive.id
    );

    const taggedManuals = manualLessons.filter(
      (row) => row.schoolYearArchiveId === archive.id
    );

    const legacyManuals = manualLessons.filter((row) => {
      if (row.schoolYearArchiveId !== null) {
        return false;
      }
      if (legacyFallbackLessonIds.has(row.id)) {
        return false;
      }
      if (!dateWithinInclusive(row.date, archive.start_date, archive.end_date)) {
        return false;
      }
      legacyFallbackLessonIds.add(row.id);
      return true;
    });

    const manualForMerge = [...taggedManuals, ...legacyManuals].map(
      ({ subject, date, title, grade }) => ({ subject, date, title, grade })
    );

    const mergedLessons = mergeCompletedLessons(archiveCompletions, manualForMerge);
    const { subjects, summary } = buildSubjectRowsFromMerged(
      mergedLessons,
      curriculumBySubject
    );

    sections.push({
      archiveId: archive.id,
      label: archive.school_year_label,
      gradeLevel: archive.grade_level?.trim() || null,
      startDate: archive.start_date,
      endDate: archive.end_date,
      isCurrentYear: false,
      subjects,
      summary,
    });
  }

  if (studentGrade) {
    const currentCompletions = allCompletions.filter(
      (row) => row.school_year_archive_id === null
    );

    const currentManuals = manualLessons.filter((row) => {
      if (row.schoolYearArchiveId !== null) {
        return false;
      }
      if (legacyFallbackLessonIds.has(row.id)) {
        return false;
      }
      if (schoolYearStartDate && row.date < schoolYearStartDate) {
        return false;
      }
      return true;
    });

    const manualForMerge = currentManuals.map(({ subject, date, title, grade }) => ({
      subject,
      date,
      title,
      grade,
    }));

    const mergedLessons = mergeCompletedLessons(currentCompletions, manualForMerge);
    const { subjects, summary } = buildSubjectRowsFromMerged(
      mergedLessons,
      curriculumBySubject
    );

    sections.push({
      archiveId: null,
      label: CURRENT_YEAR_LABEL,
      gradeLevel: studentGrade,
      startDate: schoolYearStartDate,
      endDate: null,
      isCurrentYear: true,
      subjects,
      summary,
    });
  }

  const filter = options.dateRangeFilter;
  const filteredSections = filter
    ? sections.filter((section) => {
        if (section.isCurrentYear) {
          const sectionStart = section.startDate ?? filter.startDate;
          const sectionEnd = section.endDate ?? filter.endDate;
          return sectionOverlapsFilter(sectionStart, sectionEnd, filter.startDate, filter.endDate);
        }
        return sectionOverlapsFilter(
          section.startDate,
          section.endDate,
          filter.startDate,
          filter.endDate
        );
      })
    : sections;

  const includedArchiveIds = new Set(
    filteredSections
      .map((section) => section.archiveId)
      .filter((id): id is string => Boolean(id))
  );

  const missingGradeArchives: MissingGradeArchive[] = archives
    .filter(
      (archive) =>
        includedArchiveIds.has(archive.id) && !archive.grade_level?.trim()
    )
    .map((archive) => ({
      archiveId: archive.id,
      schoolYearLabel: archive.school_year_label,
    }));

  const warnings = missingGradeArchives.map(
    (item) => `School year "${item.schoolYearLabel}" has no grade level recorded.`
  );

  return {
    sections: filteredSections,
    warnings,
    missingGradeArchives,
  };
}
