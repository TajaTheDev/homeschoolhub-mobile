/**
 * Helpers for building lesson plan item lists in the UI.
 */

export type WorkingItem = {
  id: string;
  title: string;
};

export const LIBRARY_CATEGORIES = [
  { key: 'math', label: 'Math' },
  { key: 'language_arts', label: 'Language Arts' },
  { key: 'handwriting_writing', label: 'Handwriting & Writing' },
] as const;

export type LibraryCategoryKey = (typeof LIBRARY_CATEGORIES)[number]['key'];

export type CurriculumCategoryKey = LibraryCategoryKey | 'other';

/**
 * Creates a stable local id for list keys before items are saved.
 */
export function createWorkingItem(title: string): WorkingItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
  };
}

/**
 * Parses a multiline paste into non-empty lesson titles.
 */
export function parsePasteLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Generates numbered titles from a pattern containing `{n}`.
 */
export function generateAutoNumberItems(pattern: string, count: number): string[] {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) return [];

  const safeCount = Math.max(0, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) =>
    trimmedPattern.replace(/\{n\}/gi, String(index + 1))
  );
}

/**
 * Appends new titles to an existing working list.
 */
export function appendWorkingItems(
  existing: WorkingItem[],
  titles: string[]
): WorkingItem[] {
  if (titles.length === 0) return existing;
  return [...existing, ...titles.map((title) => createWorkingItem(title))];
}

/**
 * Replaces the working list with titles from a library copy.
 */
export function replaceWorkingItems(titles: string[]): WorkingItem[] {
  return titles.map((title) => createWorkingItem(title));
}

/**
 * Returns a human-readable category label for a library category key.
 */
export function getCategoryLabel(category: string): string {
  if (category === 'other') return 'Other';
  const match = LIBRARY_CATEGORIES.find((entry) => entry.key === category);
  return match?.label ?? category;
}

const SUBJECT_CATEGORY_MAP: Record<string, LibraryCategoryKey> = {
  Math: 'math',
  Reading: 'language_arts',
  Writing: 'handwriting_writing',
};

/**
 * Maps a display subject name to a curriculum category key.
 * Unmapped subjects return 'other' so the curriculum step still appears.
 */
export function getCurriculumCategoryForSubject(subject: string): CurriculumCategoryKey {
  return SUBJECT_CATEGORY_MAP[subject] ?? 'other';
}

export type StagedLibraryCurriculum = {
  kind: 'library';
  name: string;
  edition: string | null;
  items: { title: string }[];
};

export type StagedScanCurriculum = {
  kind: 'scan';
  name: string;
  tocImagePath: string;
  lessonCount?: number;
};

export type StagedCurriculumSelection = StagedLibraryCurriculum | StagedScanCurriculum;

/**
 * Builds a staged library selection from a curriculum_library entry (no DB write).
 */
export function stageLibraryCurriculum(curriculum: {
  name: string;
  edition: string | null;
  items: { title: string; order_index: number }[];
}): StagedLibraryCurriculum {
  const sortedItems = curriculum.items
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((item) => ({ title: item.title }));

  return {
    kind: 'library',
    name: curriculum.name,
    edition: curriculum.edition,
    items: sortedItems,
  };
}
