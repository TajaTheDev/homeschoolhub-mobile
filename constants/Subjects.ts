import Colors from './Colors';

export const PRESET_SUBJECTS = [
  { name: 'Math', color: Colors.subject.math, emoji: '🔢' },
  { name: 'Reading', color: Colors.subject.reading, emoji: '📖' },
  { name: 'Science', color: Colors.subject.science, emoji: '🔬' },
  { name: 'History', color: Colors.subject.history, emoji: '🏛️' },
  { name: 'Writing', color: Colors.subject.writing, emoji: '✍️' },
  { name: 'Art', color: Colors.subject.art, emoji: '🎨' },
];

export function getSubjectColor(subjectName: string): string {
  const preset = PRESET_SUBJECTS.find(s => s.name === subjectName);
  return preset ? preset.color : Colors.ui.textLight;
}

export function isPresetSubject(subjectName: string): boolean {
  return PRESET_SUBJECTS.some(s => s.name === subjectName);
}
