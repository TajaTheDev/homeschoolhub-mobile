import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { Student } from '@/types';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { Plus, X } from 'lucide-react-native';
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

// Hardcoded subjects for now to guarantee it works
const SUBJECTS = [
  { name: 'Math', emoji: '🔢', color: '#EF4444' },
  { name: 'Reading', emoji: '📖', color: '#3B82F6' },
  { name: 'Science', emoji: '🔬', color: '#10B981' },
  { name: 'History', emoji: '🏛️', color: '#F59E0B' },
  { name: 'Writing', emoji: '✍️', color: '#8B5CF6' },
  { name: 'Art', emoji: '🎨', color: '#EC4899' },
];

export default function EditSubjectsModal({ 
  visible, 
  student, 
  onClose, 
  onSave 
}: EditSubjectsModalProps) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const studentStore = useStudentStore();
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (visible && student) {
      console.log('🔄 MODAL: Loading subjects for:', student.name, student.id);
      loadSubjects();
      // Reset editing state when modal opens
      setEditingSubject(null);
      setCustomSubject('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, student?.id]);

  const loadSubjects = async () => {
    if (!student) {
      console.log('❌ MODAL: No student in loadSubjects');
      return;
    }
    
    console.log('📥 MODAL: Fetching subjects from store for student:', student.id);
    await studentStore.fetchSubjects(student.id);
    
    const allSubjects = studentStore.subjects;
    console.log('📦 MODAL: Total subjects in store:', allSubjects.length);
    
    const studentSubjects = allSubjects
      .filter(s => s.student_id === student.id)
      .map(s => s.subject);
    
    console.log('✅ MODAL: Loaded subjects for student:', studentSubjects);
    console.log('📋 MODAL: Setting selectedSubjects state to:', studentSubjects);
    setSelectedSubjects(studentSubjects);
  };

  const toggleSubject = (subject: string) => {
    console.log('Toggle subject:', subject);
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  const addCustomSubject = () => {
    const trimmed = customSubject.trim();
    if (!trimmed) return;
    
    // If editing, replace the old subject
    if (editingSubject) {
      // Check if the new name already exists (excluding the one we're editing)
      const otherSubjects = selectedSubjects.filter(s => s !== editingSubject);
      if (otherSubjects.includes(trimmed)) {
        Alert.alert('Already Added', 'This subject is already in your list');
        return;
      }
      setSelectedSubjects(selectedSubjects.map(s => s === editingSubject ? trimmed : s));
      setEditingSubject(null);
    } else {
      // Adding new subject - check if it already exists
      if (selectedSubjects.includes(trimmed)) {
        Alert.alert('Already Added', 'This subject is already in your list');
        return;
      }
      setSelectedSubjects([...selectedSubjects, trimmed]);
    }
    
    setCustomSubject('');
  };

  const handleEditSubject = (subject: string) => {
    setEditingSubject(subject);
    setCustomSubject(subject);
    // Scroll to input (handled by ScrollView)
  };

  const handleRemoveSubject = (subject: string) => {
    setSelectedSubjects(selectedSubjects.filter(s => s !== subject));
    // If we were editing this subject, clear the edit state
    if (editingSubject === subject) {
      setEditingSubject(null);
      setCustomSubject('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSubject(null);
    setCustomSubject('');
  };

  const handleSave = async () => {
    if (!student) {
      console.log('❌ SAVE: No student provided');
      return;
    }
    
    console.log('🔍 SAVE: Starting save...');
    console.log('📋 SAVE: Student ID:', student.id);
    console.log('✅ SAVE: Selected subjects:', selectedSubjects);
    
    if (selectedSubjects.length === 0) {
      Alert.alert('No Subjects', 'Please select at least one subject');
      return;
    }

    setLoading(true);

    try {
      // Delete existing subjects
      const existingSubjects = studentStore.subjects.filter(
        s => s.student_id === student.id
      );
      
      console.log('🗑️ SAVE: Deleting', existingSubjects.length, 'existing subjects');
      
      for (const subject of existingSubjects) {
        const result = await studentStore.deleteSubject(subject.id);
        if (!result.success) {
          console.error('❌ SAVE: Failed to delete subject', subject.id, result.error);
          throw new Error(`Failed to delete subject: ${result.error}`);
        }
      }

      console.log('✅ SAVE: All existing subjects deleted');

      // Add new subjects
      console.log('➕ SAVE: Adding', selectedSubjects.length, 'new subjects');
      
      for (const subject of selectedSubjects) {
        const result = await studentStore.addSubject({
          student_id: student.id,
          subject: subject,
        });
        
        if (!result.success) {
          console.error('❌ SAVE: Failed to add subject', subject, result.error);
          throw new Error(`Failed to add subject ${subject}: ${result.error}`);
        }
      }

      console.log('✅ SAVE: All subjects added successfully');
      console.log('✅ SAVE: Save complete!');

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

  if (!visible || !student) {
    return null;
  }

  console.log('Rendering modal JSX');

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Edit Subjects</Text>
              <Text style={styles.subtitle}>{student.name}</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* Common Subjects */}
            <Text style={styles.sectionTitle}>Common Subjects</Text>
            <View style={styles.grid}>
              {SUBJECTS.map((subject) => {
                const isSelected = selectedSubjects.includes(subject.name);
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
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emoji}>{subject.emoji}</Text>
                    <Text style={[
                      styles.pillText,
                      isSelected && styles.pillTextSelected,
                    ]}>
                      {subject.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Subject Input */}
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
                  !customSubject.trim() && styles.addButtonDisabled
                ]}
                onPress={addCustomSubject}
                activeOpacity={0.7}
                disabled={!customSubject.trim()}
              >
                <Plus size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Custom Subjects Display */}
            {selectedSubjects
              .filter(s => !SUBJECTS.find(sub => sub.name === s))
              .length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Your Custom Subjects</Text>
                <View style={styles.chipContainer}>
                  {selectedSubjects
                    .filter(s => !SUBJECTS.find(sub => sub.name === s))
                    .map(subject => (
                      <View key={subject} style={styles.chip}>
                        <TouchableOpacity
                          onPress={() => handleEditSubject(subject)}
                          style={styles.chipContent}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.chipText}>{subject}</Text>
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
                    ))}
                </View>
              </>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.saveButtonText}>
                {loading 
                  ? 'Saving...' 
                  : `Save Subjects (${selectedSubjects.length})`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
    maxWidth: 500, // Prevent too wide on tablets
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
    paddingBottom: 20, // Extra padding at bottom for keyboard
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
  customPill: {
    backgroundColor: Colors.ui.textLight,
    borderColor: Colors.ui.textLight,
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
  },
  chipText: {
    fontSize: 14,
    color: '#5B4BA8',
    fontWeight: '500',
  },
  chipRemoveButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5B4BA8',
    alignItems: 'center',
    justifyContent: 'center',
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