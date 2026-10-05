import Colors from './Colors';

export const PRESET_SUBJECTS = [
  // Core
  { name: 'Math', color: Colors.subject.math, emoji: '🔢' },
  { name: 'Reading', color: Colors.subject.reading, emoji: '📖' },
  { name: 'Writing', color: Colors.subject.writing, emoji: '✍️' },
  { name: 'Science', color: Colors.subject.science, emoji: '🔬' },
  { name: 'History', color: Colors.subject.history, emoji: '🏛️' },
  { name: 'Social Studies', color: '#0EA5E9', emoji: '🌍' },
  { name: 'Geography', color: '#14B8A6', emoji: '🗺️' },
  { name: 'Civics/Government', color: '#6366F1', emoji: '⚖️' },
  { name: 'Spelling', color: '#F97316', emoji: '🔤' },
  { name: 'Grammar', color: '#A855F7', emoji: '📝' },
  { name: 'Literature', color: '#3B82F6', emoji: '📚' },
  { name: 'Handwriting', color: '#78716C', emoji: '✒️' },
  // Electives
  { name: 'Art', color: Colors.subject.art, emoji: '🎨' },
  { name: 'Music', color: '#EC4899', emoji: '🎵' },
  { name: 'Physical Education', color: '#22C55E', emoji: '⚽' },
  { name: 'Foreign Language', color: '#8B5CF6', emoji: '🗣️' },
  { name: 'Bible/Religion', color: '#D97706', emoji: '✝️' },
  { name: 'Health', color: '#EF4444', emoji: '❤️' },
  { name: 'Economics', color: '#059669', emoji: '💰' },
  { name: 'Computer Science', color: '#64748B', emoji: '💻' },
];

export function getSubjectColor(subjectName: string): string {
  const preset = PRESET_SUBJECTS.find(s => s.name === subjectName);
  return preset ? preset.color : Colors.ui.textLight;
}

export function isPresetSubject(subjectName: string): boolean {
  return PRESET_SUBJECTS.some(s => s.name === subjectName);
}

const SUBJECT_ALIASES: Record<string, string> = {
  sciences: 'Science',
};

/**
 * Title-cases a custom subject so latin / LATIN / Latin share one library bucket.
 */
export function toTitleCaseSubject(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) =>
      word
        .split('/')
        .map((part) =>
          part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
        )
        .join('/')
    )
    .join(' ');
}

/**
 * Canonical library category for a subject. Presets keep their exact names;
 * custom names are title-cased. Use on both write and read before `.eq()`.
 */
export function canonicalizeLibrarySubject(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const preset = PRESET_SUBJECTS.find((subject) => subject.name.toLowerCase() === lower);
  if (preset) return preset.name;

  const alias = SUBJECT_ALIASES[lower];
  if (alias) return alias;

  return toTitleCaseSubject(trimmed);
}
