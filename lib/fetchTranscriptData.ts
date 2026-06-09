/**
 * Supabase data fetching for academic transcript PDF.
 */

import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.generated';

type LessonCompletionRow = Tables<'lesson_completions'>;

export type TranscriptSubjectRow = {
  subject: string;
  curriculumName: string | null;
  lessonsCompleted: number;
  finalGrade: string;
  numericAverage: number | null;
  gradedCount: number;
};

export type TranscriptData = {
  subjects: TranscriptSubjectRow[];
  summary: {
    totalLessons: number;
    weightedAverage: string | null;
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

  // Pick the newest name we see per subject
  const map: Record<string, string | null> = {};
  (data ?? []).forEach((plan) => {
    if (map[plan.subject] !== undefined) return;
    map[plan.subject] = plan.name?.trim() || null;
  });

  return map;
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
  const completionSubjects = [...new Set(completions.map((row) => row.subject))];
  const curriculumBySubject = await fetchAllLessonPlanNames(studentId);
  const planSubjects = Object.keys(curriculumBySubject);

  // Include subjects that have assigned lesson plans even if there are zero completions in range.
  const subjects = Array.from(new Set([...completionSubjects, ...planSubjects]));

  const bySubject = new Map<string, LessonCompletionRow[]>();
  completions.forEach((row) => {
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
    summary: {
      totalLessons,
      weightedAverage,
    },
  };
}
