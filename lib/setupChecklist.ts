/**
 * First-run setup checklist — persistence and auto-check logic.
 */

import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'setup_checklist';

export type OptionalChecklistItemId = 'pick_curriculum' | 'add_lesson' | 'log_book';

export type ChecklistItemId =
  | 'add_student'
  | 'create_subject'
  | 'pick_curriculum'
  | 'add_lesson'
  | 'log_book';

export type SetupChecklistStorage = {
  dismissed: boolean;
  autoHidden: boolean;
  skippedOptional: OptionalChecklistItemId[];
};

export type ChecklistItemStatus = {
  id: ChecklistItemId;
  label: string;
  optional: boolean;
  complete: boolean;
};

export type ChecklistStatus = {
  visible: boolean;
  items: ChecklistItemStatus[];
  completedCount: number;
  totalCount: number;
  shouldPersistAutoHidden: boolean;
};

const DEFAULT_STORAGE: SetupChecklistStorage = {
  dismissed: false,
  autoHidden: false,
  skippedOptional: [],
};

const CHECKLIST_DEFINITION: Array<{
  id: ChecklistItemId;
  label: string;
  optional: boolean;
}> = [
  { id: 'add_student', label: 'Add your first student', optional: false },
  { id: 'create_subject', label: 'Create your first subject', optional: false },
  { id: 'pick_curriculum', label: 'Pick a curriculum for a subject', optional: true },
  { id: 'add_lesson', label: 'Add your first lesson', optional: true },
  { id: 'log_book', label: 'Log your first book', optional: true },
];

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

/**
 * Loads persisted checklist state for a user.
 */
export async function loadSetupChecklistState(
  userId: string
): Promise<SetupChecklistStorage> {
  try {
    const raw = await AsyncStorage.getItem(getStorageKey(userId));
    if (!raw) return { ...DEFAULT_STORAGE };

    const parsed = JSON.parse(raw) as Partial<SetupChecklistStorage>;
    return {
      dismissed: parsed.dismissed === true,
      autoHidden: parsed.autoHidden === true,
      skippedOptional: Array.isArray(parsed.skippedOptional)
        ? parsed.skippedOptional.filter(
            (id): id is OptionalChecklistItemId =>
              id === 'pick_curriculum' || id === 'add_lesson' || id === 'log_book'
          )
        : [],
    };
  } catch {
    return { ...DEFAULT_STORAGE };
  }
}

/**
 * Persists checklist state for a user.
 */
export async function saveSetupChecklistState(
  userId: string,
  state: SetupChecklistStorage
): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(state));
}

/**
 * Permanently hides the checklist after the user taps dismiss.
 */
export async function dismissSetupChecklist(
  userId: string,
  incompleteOptional: OptionalChecklistItemId[]
): Promise<void> {
  const current = await loadSetupChecklistState(userId);
  await saveSetupChecklistState(userId, {
    ...current,
    dismissed: true,
    skippedOptional: incompleteOptional,
  });
}

/**
 * Permanently hides the checklist after required items or all items complete.
 */
export async function persistAutoHiddenChecklist(userId: string): Promise<void> {
  const current = await loadSetupChecklistState(userId);
  if (current.autoHidden) return;
  await saveSetupChecklistState(userId, {
    ...current,
    autoHidden: true,
  });
}

type CompletionFlags = {
  hasStudent: boolean;
  hasSubject: boolean;
  hasCurriculum: boolean;
  hasLesson: boolean;
  hasReadingLog: boolean;
};

async function fetchCompletionFlags(userId: string): Promise<CompletionFlags> {
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id')
    .eq('user_id', userId);

  if (studentsError) {
    throw new Error(studentsError.message);
  }

  const studentIds = (students ?? []).map((row) => row.id);
  const hasStudent = studentIds.length > 0;

  if (!hasStudent) {
    return {
      hasStudent: false,
      hasSubject: false,
      hasCurriculum: false,
      hasLesson: false,
      hasReadingLog: false,
    };
  }

  const [subjectsResult, plansResult, lessonsResult, readingResult] = await Promise.all([
    supabase.from('student_subjects').select('id').in('student_id', studentIds).limit(1),
    supabase.from('lesson_plans').select('id').in('student_id', studentIds).limit(1),
    supabase.from('lessons').select('id').eq('user_id', userId).limit(1),
    supabase.from('reading_log').select('id').in('student_id', studentIds).limit(1),
  ]);

  if (subjectsResult.error) throw new Error(subjectsResult.error.message);
  if (plansResult.error) throw new Error(plansResult.error.message);
  if (lessonsResult.error) throw new Error(lessonsResult.error.message);
  if (readingResult.error) throw new Error(readingResult.error.message);

  return {
    hasStudent: true,
    hasSubject: (subjectsResult.data ?? []).length > 0,
    hasCurriculum: (plansResult.data ?? []).length > 0,
    hasLesson: (lessonsResult.data ?? []).length > 0,
    hasReadingLog: (readingResult.data ?? []).length > 0,
  };
}

function buildItems(flags: CompletionFlags): ChecklistItemStatus[] {
  const completionById: Record<ChecklistItemId, boolean> = {
    add_student: flags.hasStudent,
    create_subject: flags.hasSubject,
    pick_curriculum: flags.hasCurriculum,
    add_lesson: flags.hasLesson,
    log_book: flags.hasReadingLog,
  };

  return CHECKLIST_DEFINITION.map((item) => ({
    ...item,
    complete: completionById[item.id],
  }));
}

function hiddenStatus(): ChecklistStatus {
  return {
    visible: false,
    items: CHECKLIST_DEFINITION.map((item) => ({ ...item, complete: false })),
    completedCount: 0,
    totalCount: CHECKLIST_DEFINITION.length,
    shouldPersistAutoHidden: false,
  };
}

/**
 * Returns checklist visibility and item completion.
 * Skips Supabase when the card is permanently hidden in AsyncStorage.
 */
export async function fetchChecklistStatus(userId: string): Promise<ChecklistStatus> {
  const storage = await loadSetupChecklistState(userId);

  if (storage.dismissed || storage.autoHidden) {
    return hiddenStatus();
  }

  const flags = await fetchCompletionFlags(userId);
  const items = buildItems(flags);
  const completedCount = items.filter((item) => item.complete).length;
  const requiredComplete = flags.hasStudent && flags.hasSubject;
  const allComplete = completedCount === items.length;
  const shouldHide = requiredComplete || allComplete;

  return {
    visible: !shouldHide,
    items,
    completedCount,
    totalCount: items.length,
    shouldPersistAutoHidden: shouldHide,
  };
}

/**
 * Returns optional item ids that are still incomplete.
 */
export function getIncompleteOptionalItems(
  items: ChecklistItemStatus[]
): OptionalChecklistItemId[] {
  return items
    .filter((item) => item.optional && !item.complete)
    .map((item) => item.id as OptionalChecklistItemId);
}
