/**
 * Supabase data fetching for PDF export generators.
 * Does not use Zustand stores — queries directly.
 */

import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.generated';
import { format, parseISO } from 'date-fns';

export type LessonCompletionRow = Tables<'lesson_completions'>;
export type ReadingLogRow = Tables<'reading_log'>;

type ManualLessonRow = {
  subject: string;
  date: string;
  title: string;
  grade: string | null;
};

export type MergedCompletedLesson = {
  subject: string;
  date: string;
  title: string;
  grade: string | null;
};

export type YearInReviewPhoto = {
  url: string;
  caption: string | null;
};

export type YearInReviewLessonRow = {
  title: string;
  date: string;
  grade: string | null;
  photos: YearInReviewPhoto[];
};

export type YearInReviewMonthGroup = {
  monthKey: string;
  monthLabel: string;
  lessons: YearInReviewLessonRow[];
};

export type YearInReviewSubjectSection = {
  subject: string;
  curriculumName: string | null;
  months: YearInReviewMonthGroup[];
};

export type GradeSummaryRow = {
  subject: string;
  gradedCount: number;
  display: string;
};

export type YearInReviewData = {
  completions: LessonCompletionRow[];
  finishedBooks: ReadingLogRow[];
  photoHighlights: YearInReviewPhoto[];
  gradesSummary: GradeSummaryRow[];
  consistency: {
    longestStreak: number;
    schoolDays: number;
    busiestMonth: string | null;
    busiestMonthCount: number;
    photosTaken: number;
  };
  stats: {
    lessonsCompleted: number;
    subjectsCovered: number;
    schoolDays: number;
    booksRead: number;
    longestStreak: number;
    photosTaken: number;
  };
  subjectSections: YearInReviewSubjectSection[];
};

export type ReadingLogExportData = {
  finishedBooks: ReadingLogRow[];
  currentlyReading: ReadingLogRow[];
  stats: {
    total: number;
    finished: number;
    currentlyReading: number;
  };
  year: number;
};

function isInDateRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

function getCurrentYearBounds(): { start: string; end: string; year: number } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    year,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function lessonMatchKey(subject: string, date: string): string {
  return `${subject.trim()}|${date}`;
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

function mergeCompletedLessons(
  completions: LessonCompletionRow[],
  manualLessons: ManualLessonRow[]
): MergedCompletedLesson[] {
  const map = new Map<string, MergedCompletedLesson>();

  manualLessons.forEach((row) => {
    map.set(lessonMatchKey(row.subject, row.date), {
      subject: row.subject,
      date: row.date,
      title: row.title,
      grade: row.grade,
    });
  });

  completions.forEach((row) => {
    map.set(lessonMatchKey(row.subject, row.date), {
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

async function fetchCompletedManualLessons(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<ManualLessonRow[]> {
  const byLessonId = new Map<string, ManualLessonRow>();

  const { data: junctionData, error: junctionError } = await supabase
    .from('lessons')
    .select(
      'id, subject, title, date, grade_value, grade_type, lesson_students!inner(student_id)'
    )
    .eq('lesson_students.student_id', studentId)
    .eq('completed', true)
    .gte('date', startDate)
    .lte('date', endDate);

  if (junctionError) {
    throw new Error(junctionError.message);
  }

  (junctionData ?? []).forEach((lesson) => {
    byLessonId.set(lesson.id, {
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
    });
  });

  const { data: directData, error: directError } = await supabase
    .from('lessons')
    .select('id, subject, title, date, grade_value, grade_type')
    .eq('student_id', studentId)
    .eq('completed', true)
    .gte('date', startDate)
    .lte('date', endDate);

  if (directError) {
    throw new Error(directError.message);
  }

  (directData ?? []).forEach((lesson) => {
    if (byLessonId.has(lesson.id)) return;
    byLessonId.set(lesson.id, {
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
    });
  });

  return Array.from(byLessonId.values());
}

async function fetchAllCompletedManualLessons(studentId: string): Promise<ManualLessonRow[]> {
  const byLessonId = new Map<string, ManualLessonRow>();

  const { data: junctionData, error: junctionError } = await supabase
    .from('lessons')
    .select(
      'id, subject, title, date, grade_value, grade_type, lesson_students!inner(student_id)'
    )
    .eq('lesson_students.student_id', studentId)
    .eq('completed', true);

  if (junctionError) {
    throw new Error(junctionError.message);
  }

  (junctionData ?? []).forEach((lesson) => {
    byLessonId.set(lesson.id, {
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
    });
  });

  const { data: directData, error: directError } = await supabase
    .from('lessons')
    .select('id, subject, title, date, grade_value, grade_type')
    .eq('student_id', studentId)
    .eq('completed', true);

  if (directError) {
    throw new Error(directError.message);
  }

  (directData ?? []).forEach((lesson) => {
    if (byLessonId.has(lesson.id)) return;
    byLessonId.set(lesson.id, {
      subject: lesson.subject,
      date: lesson.date,
      title: lesson.title,
      grade: formatLessonGrade(lesson.grade_value, lesson.grade_type),
    });
  });

  return Array.from(byLessonId.values());
}

/**
 * Fetches all-time merged completed lessons for a student.
 * Matches export logic: lesson_completions (non-planned) + manual lessons, deduped by subject|date.
 */
export async function fetchAllMergedCompletedLessons(
  studentId: string
): Promise<MergedCompletedLesson[]> {
  const { data: completionsRaw, error } = await supabase
    .from('lesson_completions')
    .select('*')
    .eq('student_id', studentId)
    .neq('status', 'planned')
    .order('date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const manualLessons = await fetchAllCompletedManualLessons(studentId);
  return mergeCompletedLessons(completionsRaw ?? [], manualLessons);
}

/**
 * Returns lesson_plan_items count per subject when a plan exists with at least one item.
 * Subjects without a curriculum sequence are omitted from the result.
 */
export async function fetchCurriculumItemCountsBySubject(
  studentId: string
): Promise<Record<string, number>> {
  const { data: plans, error: plansError } = await supabase
    .from('lesson_plans')
    .select('id, subject')
    .eq('student_id', studentId);

  if (plansError) {
    throw new Error(plansError.message);
  }

  if (!plans?.length) {
    return {};
  }

  const { data: items, error: itemsError } = await supabase
    .from('lesson_plan_items')
    .select('lesson_plan_id')
    .in(
      'lesson_plan_id',
      plans.map((plan) => plan.id)
    );

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const countsByPlanId = new Map<string, number>();
  (items ?? []).forEach((item) => {
    countsByPlanId.set(
      item.lesson_plan_id,
      (countsByPlanId.get(item.lesson_plan_id) ?? 0) + 1
    );
  });

  const countsBySubject: Record<string, number> = {};
  plans.forEach((plan) => {
    const count = countsByPlanId.get(plan.id) ?? 0;
    if (count > 0) {
      countsBySubject[plan.subject] = (countsBySubject[plan.subject] ?? 0) + count;
    }
  });

  return countsBySubject;
}

function toCompletionRowCompat(merged: MergedCompletedLesson): LessonCompletionRow {
  return {
    subject: merged.subject,
    date: merged.date,
    title_snapshot: merged.title,
    grade: merged.grade,
  } as LessonCompletionRow;
}

/**
 * Sorts distinct completion dates and returns the longest run of
 * consecutive calendar days with at least one completion.
 */
export function calculateLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseISO(sorted[i - 1]);
    const curr = parseISO(sorted[i]);
    const diffMs = curr.getTime() - prev.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (diffMs === oneDayMs) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function calculateBusiestMonth(
  lessons: Array<{ date: string }>
): { month: string | null; count: number } {
  if (lessons.length === 0) {
    return { month: null, count: 0 };
  }

  const counts = new Map<string, number>();

  lessons.forEach((row) => {
    try {
      const monthKey = format(parseISO(row.date), 'yyyy-MM');
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    } catch {
      // skip invalid dates
    }
  });

  let bestKey: string | null = null;
  let bestCount = 0;

  counts.forEach((count, key) => {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  });

  if (!bestKey) {
    return { month: null, count: 0 };
  }

  try {
    return {
      month: format(parseISO(`${bestKey}-01`), 'MMMM'),
      count: bestCount,
    };
  } catch {
    return { month: bestKey, count: bestCount };
  }
}

function parseNumericGrade(grade: string): number | null {
  const cleaned = grade.replace(/%/g, '').trim();
  const value = parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function isLetterGrade(grade: string): boolean {
  return /^[A-F][+-]?$/i.test(grade.trim());
}

export function buildGradesSummary(lessons: MergedCompletedLesson[]): GradeSummaryRow[] {
  const bySubject = new Map<string, string[]>();

  lessons.forEach((row) => {
    if (!row.grade?.trim()) return;
    const existing = bySubject.get(row.subject) ?? [];
    existing.push(row.grade.trim());
    bySubject.set(row.subject, existing);
  });

  return Array.from(bySubject.entries())
    .map(([subject, grades]) => {
      const numeric = grades
        .map(parseNumericGrade)
        .filter((value): value is number => value !== null);

      let display: string;

      if (numeric.length === grades.length && numeric.length > 0) {
        const avg = Math.round(numeric.reduce((sum, v) => sum + v, 0) / numeric.length);
        display = `Avg ${avg}%`;
      } else if (grades.every(isLetterGrade)) {
        const counts: Record<string, number> = {};
        grades.forEach((g) => {
          const letter = g.charAt(0).toUpperCase();
          counts[letter] = (counts[letter] ?? 0) + 1;
        });
        display = Object.entries(counts)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([letter, count]) => `${letter}: ${count}`)
          .join(' · ');
      } else {
        display = grades.join(', ');
      }

      return {
        subject,
        gradedCount: grades.length,
        display,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

function groupLessonsByMonth(lessons: YearInReviewLessonRow[]): YearInReviewMonthGroup[] {
  const byMonth = new Map<string, YearInReviewLessonRow[]>();

  lessons.forEach((lesson) => {
    try {
      const monthKey = format(parseISO(lesson.date), 'yyyy-MM');
      const bucket = byMonth.get(monthKey) ?? [];
      bucket.push(lesson);
      byMonth.set(monthKey, bucket);
    } catch {
      const fallback = 'unknown';
      const bucket = byMonth.get(fallback) ?? [];
      bucket.push(lesson);
      byMonth.set(fallback, bucket);
    }
  });

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthLessons]) => {
      let monthLabel = monthKey;
      try {
        monthLabel = format(parseISO(`${monthKey}-01`), 'MMMM');
      } catch {
        // keep key
      }

      return {
        monthKey,
        monthLabel,
        lessons: monthLessons.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}

function buildSubjectSections(
  lessons: MergedCompletedLesson[],
  curriculumBySubject: Record<string, string | null>,
  photosByKey: Record<string, YearInReviewPhoto[]>
): YearInReviewSubjectSection[] {
  const bySubject = new Map<string, YearInReviewLessonRow[]>();

  lessons.forEach((row) => {
    const subjectLessons = bySubject.get(row.subject) ?? [];
    const key = lessonMatchKey(row.subject, row.date);
    subjectLessons.push({
      title: row.title,
      date: row.date,
      grade: row.grade ?? null,
      photos: photosByKey[key] ?? [],
    });
    bySubject.set(row.subject, subjectLessons);
  });

  return Array.from(bySubject.entries())
    .map(([subject, lessons]) => ({
      subject,
      curriculumName: curriculumBySubject[subject] ?? null,
      months: groupLessonsByMonth(lessons),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

async function fetchCurriculumNames(
  studentId: string,
  subjects: string[]
): Promise<Record<string, string | null>> {
  if (subjects.length === 0) return {};

  const { data, error } = await supabase
    .from('lesson_plans')
    .select('subject, name')
    .eq('student_id', studentId)
    .in('subject', subjects);

  if (error) {
    console.error('Error fetching lesson plans for export:', error);
    return {};
  }

  const map: Record<string, string | null> = {};
  (data ?? []).forEach((plan) => {
    map[plan.subject] = plan.name?.trim() || null;
  });
  return map;
}

type PhotoFetchResult = {
  photosByKey: Record<string, YearInReviewPhoto[]>;
  photoHighlights: YearInReviewPhoto[];
  photosTaken: number;
  placedUrls: Set<string>;
};

async function fetchPhotoData(
  studentId: string,
  startDate: string,
  endDate: string,
  mergedLessons: MergedCompletedLesson[]
): Promise<PhotoFetchResult> {
  const empty: PhotoFetchResult = {
    photosByKey: {},
    photoHighlights: [],
    photosTaken: 0,
    placedUrls: new Set(),
  };

  try {
    let lessons: Array<{ id: string; subject: string; date: string }> = [];

    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('id, subject, date')
        .eq('student_id', studentId)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) {
        console.error('Lessons query failed for photo export (non-blocking):', error);
        return empty;
      }

      lessons = data ?? [];
    } catch (error) {
      console.error('Lessons fetch threw for photo export (non-blocking):', error);
      return empty;
    }

    if (lessons.length === 0) {
      return empty;
    }

    const lessonIdToKey = new Map<string, string>();
    lessons.forEach((lesson) => {
      lessonIdToKey.set(lesson.id, lessonMatchKey(lesson.subject, lesson.date));
    });

    let photoRows: Array<{
      lesson_id: string;
      storage_path: string | null;
      caption: string | null;
    }> = [];

    try {
      const { data, error } = await supabase
        .from('lesson_photos')
        .select('lesson_id, storage_path, caption')
        .in('lesson_id', lessons.map((l) => l.id))
        .not('storage_path', 'is', null);

      if (error) {
        console.error('lesson_photos query failed (non-blocking):', error);
        return empty;
      }

      photoRows = data ?? [];
    } catch (error) {
      console.error('lesson_photos fetch threw (non-blocking):', error);
      return empty;
    }

    const photosByKey: Record<string, YearInReviewPhoto[]> = {};
    const allPhotos: YearInReviewPhoto[] = [];

    photoRows.forEach((row) => {
      try {
        if (!row.storage_path) return;

        const { data } = supabase.storage
          .from('lesson-photos')
          .getPublicUrl(row.storage_path);

        if (!data.publicUrl) return;

        const photo: YearInReviewPhoto = {
          url: data.publicUrl,
          caption: row.caption ?? null,
        };

        allPhotos.push(photo);

        const key = lessonIdToKey.get(row.lesson_id);
        if (key) {
          if (!photosByKey[key]) {
            photosByKey[key] = [];
          }
          photosByKey[key].push(photo);
        }
      } catch (error) {
        console.error('Single photo URL build failed (non-blocking):', error);
      }
    });

    const completionKeys = new Set(
      mergedLessons.map((row) => lessonMatchKey(row.subject, row.date))
    );

    const placedUrls = new Set<string>();
    const photosByKeyForCompletions: Record<string, YearInReviewPhoto[]> = {};

    Object.entries(photosByKey).forEach(([key, photos]) => {
      if (completionKeys.has(key)) {
        photosByKeyForCompletions[key] = photos;
        photos.forEach((p) => placedUrls.add(p.url));
      }
    });

    const unmatched = allPhotos.filter((p) => !placedUrls.has(p.url));
    const photoHighlights = unmatched.slice(0, 9);

    return {
      photosByKey: photosByKeyForCompletions,
      photoHighlights,
      photosTaken: allPhotos.length,
      placedUrls,
    };
  } catch (error) {
    console.error('Photo fetch failed for year-in-review export (non-blocking):', error);
    return empty;
  }
}

/**
 * Fetches all data needed for the year-in-review PDF.
 */
export async function fetchYearInReviewData(
  studentId: string,
  startDate: string,
  endDate: string
): Promise<YearInReviewData> {
  const [completionsResult, manualLessons] = await Promise.all([
    supabase
      .from('lesson_completions')
      .select('*')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('status', 'planned')
      .order('date', { ascending: true }),
    fetchCompletedManualLessons(studentId, startDate, endDate),
  ]);

  if (completionsResult.error) {
    throw new Error(completionsResult.error.message);
  }

  const completions = completionsResult.data ?? [];
  const mergedLessons = mergeCompletedLessons(completions, manualLessons);
  const distinctDates = [...new Set(mergedLessons.map((row) => row.date))];
  const subjects = [...new Set(mergedLessons.map((row) => row.subject))];

  const [curriculumBySubject, finishedBooksResult, photoData] = await Promise.all([
    fetchCurriculumNames(studentId, subjects),
    supabase
      .from('reading_log')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'finished')
      .not('date_finished', 'is', null),
    fetchPhotoData(studentId, startDate, endDate, mergedLessons),
  ]);

  if (finishedBooksResult.error) {
    throw new Error(finishedBooksResult.error.message);
  }

  const finishedBooks = (finishedBooksResult.data ?? []).filter(
    (book) => book.date_finished && isInDateRange(book.date_finished, startDate, endDate)
  );

  const longestStreak = calculateLongestStreak(distinctDates);
  const busiest = calculateBusiestMonth(mergedLessons);
  const gradesSummary = buildGradesSummary(mergedLessons);
  const subjectSections = buildSubjectSections(
    mergedLessons,
    curriculumBySubject,
    photoData.photosByKey
  );

  const schoolDays = distinctDates.length;

  return {
    completions: mergedLessons.map(toCompletionRowCompat),
    finishedBooks,
    photoHighlights: photoData.photoHighlights,
    gradesSummary,
    subjectSections,
    consistency: {
      longestStreak,
      schoolDays,
      busiestMonth: busiest.month,
      busiestMonthCount: busiest.count,
      photosTaken: photoData.photosTaken,
    },
    stats: {
      lessonsCompleted: mergedLessons.length,
      subjectsCovered: subjects.length,
      schoolDays,
      booksRead: finishedBooks.length,
      longestStreak,
      photosTaken: photoData.photosTaken,
    },
  };
}

/**
 * Fetches all data needed for the reading log PDF.
 * Finished books: current calendar year. Currently reading: all active.
 */
export async function fetchReadingLogExportData(
  studentId: string
): Promise<ReadingLogExportData> {
  const { year, start, end } = getCurrentYearBounds();

  const { data, error } = await supabase
    .from('reading_log')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const allBooks = data ?? [];
  const finishedBooks = allBooks
    .filter(
      (book) =>
        book.status === 'finished' &&
        book.date_finished &&
        isInDateRange(book.date_finished, start, end)
    )
    .sort((a, b) => (b.date_finished ?? '').localeCompare(a.date_finished ?? ''));

  const currentlyReading = allBooks
    .filter((book) => book.status === 'reading')
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

  return {
    finishedBooks,
    currentlyReading,
    year,
    stats: {
      total: allBooks.length,
      finished: finishedBooks.length,
      currentlyReading: currentlyReading.length,
    },
  };
}
