import CurriculumPickerStep from '@/components/students/CurriculumPickerStep';
import Colors from '@/constants/Colors';
import { PRESET_SUBJECTS } from '@/constants/Subjects';
import type { StagedCurriculumSelection } from '@/lib/lessonPlanUtils';
import { useLessonPlanStore } from '@/store/lessonPlanStore';
import { useStudentStore } from '@/store/studentStore';
import { Student } from '@/types';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { Pencil, Plus, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface EditSubjectsModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
  onSave: () => void;
}

export default function EditSubjectsModal({
  visible,
  student,
  onClose,
  onSave,
}: EditSubjectsModalProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [curriculumStepSubject, setCurriculumStepSubject] = useState<string | null>(null);
  const [stagedCurricula, setStagedCurricula] = useState<
    Record<string, StagedCurriculumSelection>
  >({});

  const studentStore = useStudentStore();
  const { persistStagedCurriculum } = useLessonPlanStore();
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (visible && student) {
      loadSubjects();
      setEditingSubject(null);
      setCustomSubject('');
      setCurriculumStepSubject(null);
      setStagedCurricula({});
    }
  }, [visible, student?.id]);

  const loadSubjects = async () => {
    if (!student) return;

    await studentStore.fetchSubjects(student.id);

    const studentSubjects = studentStore.subjects
      .filter((s) => s.student_id === student.id)
      .map((s) => s.subject);

    setSelectedSubjects(studentSubjects);
  };

  const clearStagedForSubject = (subject: string) => {
    setStagedCurricula((prev) => {
      if (!prev[subject]) return prev;
      const next = { ...prev };
      delete next[subject];
      return next;
    });
  };

  const openCurriculumStepIfNeeded = (subject: string) => {
    setCurriculumStepSubject(subject);
  };

  const toggleSubject = (subject: string) => {
    if (selectedSubjects.includes(subject)) {
      setCurriculumStepSubject(subject);
      return;
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
      openCurriculumStepIfNeeded(subject);
    }
  };

  const deselectSubject = (subject: string) => {
    setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    clearStagedForSubject(subject);
    if (curriculumStepSubject === subject) {
      setCurriculumStepSubject(null);
    }
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;

    if (editingSubject) {
      const otherSubjects = selectedSubjects.filter((s) => s !== editingSubject);
      if (otherSubjects.includes(trimmed)) {
        Alert.alert('Already Added', 'This subject is already in your list');
        return;
      }

      setStagedCurricula((prev) => {
        if (!prev[editingSubject]) return prev;
        const next = { ...prev };
        next[trimmed] = prev[editingSubject];
        delete next[editingSubject];
        return next;
      });

      if (curriculumStepSubject === editingSubject) {
        setCurriculumStepSubject(trimmed);
      }

      setSelectedSubjects(selectedSubjects.map((s) => (s === editingSubject ? trimmed : s)));
      setEditingSubject(null);
    } else {
      if (selectedSubjects.includes(trimmed)) {
        Alert.alert('Already Added', 'This subject is already in your list');
        return;
      }
      setSelectedSubjects([...selectedSubjects, trimmed]);
      openCurriculumStepIfNeeded(trimmed);
    }

    setCustomSubject('');
  };

  const handleEditSubject = (subject: string) => {
    setEditingSubject(subject);
    setCustomSubject(subject);
  };

  const handleRemoveSubject = (subject: string) => {
    setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    clearStagedForSubject(subject);
    if (editingSubject === subject) {
      setEditingSubject(null);
      setCustomSubject('');
    }
    if (curriculumStepSubject === subject) {
      setCurriculumStepSubject(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingSubject(null);
    setCustomSubject('');
  };

  const handleStageCurriculum = (selection: StagedCurriculumSelection) => {
    if (!curriculumStepSubject) return;

    setStagedCurricula((prev) => ({
      ...prev,
      [curriculumStepSubject]: selection,
    }));
    setCurriculumStepSubject(null);
  };

  const handleSkipCurriculum = () => {
    if (curriculumStepSubject) {
      clearStagedForSubject(curriculumStepSubject);
    }
    setCurriculumStepSubject(null);
  };

  const getStagedLabel = (subject: string): string | null => {
    const staged = stagedCurricula[subject];
    if (!staged) return null;
    if (staged.kind === 'scan') return `${staged.name} (scan)`;
    return staged.name;
  };

  const handleSave = async () => {
    if (!student) return;

    if (selectedSubjects.length === 0) {
      Alert.alert('No Subjects', 'Please select at least one subject');
      return;
    }

    setLoading(true);

    try {
      const existingSubjects = studentStore.subjects.filter(
        (s) => s.student_id === student.id
      );

      for (const subject of existingSubjects) {
        const result = await studentStore.deleteSubject(subject.id);
        if (!result.success) {
          throw new Error(`Failed to delete subject: ${result.error}`);
        }
      }

      for (const subject of selectedSubjects) {
        const result = await studentStore.addSubject({
          student_id: student.id,
          subject,
        });

        if (!result.success) {
          throw new Error(`Failed to add subject ${subject}: ${result.error}`);
        }
      }

      for (const subject of selectedSubjects) {
        const staged = stagedCurricula[subject];
        if (!staged) continue;

        const planResult = await persistStagedCurriculum(student.id, subject, staged);
        if (!planResult.success) {
          throw new Error(
            planResult.error ?? `Failed to save curriculum for ${subject}`
          );
        }
      }

      setLoading(false);
      showSnackbar('Subjects updated!', 'success');
      onSave();
    } catch (error) {
      console.error('❌ SAVE: Error during save:', error);
      setLoading(false);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to save subjects. Please try again.'
      );
    }
  };

  const handleClose = () => {
    setCurriculumStepSubject(null);
    setStagedCurricula({});
    onClose();
  };

  if (!visible || !student) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {curriculumStepSubject ? 'Select Curriculum' : 'Edit Subjects'}
              </Text>
              <Text style={styles.subtitle}>{student.name}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          {curriculumStepSubject ? (
            <CurriculumPickerStep
              studentId={student.id}
              subject={curriculumStepSubject}
              stagedSelection={stagedCurricula[curriculumStepSubject]}
              onStage={handleStageCurriculum}
              onSkip={handleSkipCurriculum}
              onBack={() => setCurriculumStepSubject(null)}
            />
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <Text style={styles.sectionTitle}>Common Subjects</Text>
              <View style={styles.grid}>
                {PRESET_SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects.includes(subject.name);
                  const stagedLabel = getStagedLabel(subject.name);
                  return (
                    <TouchableOpacity
                      key={subject.name}
                      style={[
                        styles.pill,
                        isSelected && {
                          backgroundColor: subject.color,
                          borderColor: subject.color,
                        },
                      ]}
                      onPress={() => toggleSubject(subject.name)}
                      onLongPress={
                        isSelected
                          ? () => deselectSubject(subject.name)
                          : undefined
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.emoji}>{subject.emoji}</Text>
                      <View>
                        <Text
                          style={[styles.pillText, isSelected && styles.pillTextSelected]}
                        >
                          {subject.name}
                        </Text>
                        {stagedLabel ? (
                          <Text
                            style={[
                              styles.stagedPillHint,
                              isSelected && styles.stagedPillHintSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {stagedLabel}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>
                {editingSubject ? 'Edit Custom Subject' : 'Add Custom Subject'}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={customSubject}
                  onChangeText={setCustomSubject}
                  placeholder="e.g., Music, PE, Coding"
                  placeholderTextColor={Colors.ui.textLight}
                  returnKeyType="done"
                  onSubmitEditing={addCustomSubject}
                  autoFocus={editingSubject !== null}
                />
                {editingSubject ? (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={handleCancelEdit}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={Colors.ui.text} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    !customSubject.trim() && styles.addButtonDisabled,
                  ]}
                  onPress={addCustomSubject}
                  activeOpacity={0.7}
                  disabled={!customSubject.trim()}
                >
                  <Plus size={20} color="white" />
                </TouchableOpacity>
              </View>

              {selectedSubjects.filter((s) => !PRESET_SUBJECTS.find((sub) => sub.name === s))
                .length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Your Custom Subjects</Text>
                  <View style={styles.chipContainer}>
                    {selectedSubjects
                      .filter((s) => !PRESET_SUBJECTS.find((sub) => sub.name === s))
                      .map((subject) => {
                        const stagedLabel = getStagedLabel(subject);
                        return (
                          <View key={subject} style={styles.chip}>
                            <TouchableOpacity
                              onPress={() => toggleSubject(subject)}
                              style={styles.chipContent}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.chipText}>{subject}</Text>
                              {stagedLabel ? (
                                <Text style={styles.chipStagedHint} numberOfLines={1}>
                                  {stagedLabel}
                                </Text>
                              ) : null}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleEditSubject(subject)}
                              style={styles.chipEditButton}
                              activeOpacity={0.7}
                              accessibilityLabel={`Rename ${subject}`}
                              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                            >
                              <Pencil size={12} color="#5B4BA8" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleRemoveSubject(subject)}
                              style={styles.chipRemoveButton}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <X size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                  </View>
                </>
              )}

              {selectedSubjects.length > 0 && (
                <Text style={styles.curriculumHint}>
                  Tap a subject to choose curriculum. Tap the pencil to rename a custom subject.
                </Text>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : `Save Subjects (${selectedSubjects.length})`}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    maxWidth: 500,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.ui.textLight,
    marginTop: 4,
    fontWeight: '500',
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: '100%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.text,
    marginTop: 20,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  emoji: {
    fontSize: 18,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.ui.text,
  },
  pillTextSelected: {
    color: 'white',
  },
  stagedPillHint: {
    fontSize: 10,
    color: Colors.ui.textLight,
    marginTop: 2,
    maxWidth: 100,
  },
  stagedPillHintSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.ui.text,
  },
  addButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.ui.border,
    opacity: 0.5,
  },
  cancelButton: {
    backgroundColor: Colors.ui.border,
    borderRadius: 12,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8E4FF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 4,
    borderWidth: 1,
    borderColor: '#D1CCFF',
  },
  chipContent: {
    marginRight: 4,
    paddingRight: 4,
    maxWidth: 140,
  },
  chipText: {
    fontSize: 14,
    color: '#5B4BA8',
    fontWeight: '500',
  },
  chipStagedHint: {
    fontSize: 10,
    color: '#7C6BB8',
    marginTop: 2,
    maxWidth: 120,
  },
  chipEditButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  chipRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B4BA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  curriculumHint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});
