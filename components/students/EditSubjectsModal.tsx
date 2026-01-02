import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { Student } from '@/types';
import { Plus, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
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
  const [loading, setLoading] = useState(false);
  
  const studentStore = useStudentStore();

  useEffect(() => {
    if (visible && student) {
      console.log('🔄 MODAL: Loading subjects for:', student.name, student.id);
      loadSubjects();
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
    
    if (selectedSubjects.includes(trimmed)) {
      Alert.alert('Already Added', 'This subject is already in your list');
      return;
    }
    
    setSelectedSubjects([...selectedSubjects, trimmed]);
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
      Alert.alert('Success', 'Subjects updated!');
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
      <View style={styles.overlay}>
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

          <ScrollView style={styles.scrollView}>
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
            <Text style={styles.sectionTitle}>Add Custom Subject</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={customSubject}
                onChangeText={setCustomSubject}
                placeholder="e.g., Music, PE, Coding"
                placeholderTextColor={Colors.ui.textLight}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addCustomSubject}
                activeOpacity={0.7}
              >
                <Plus size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Custom Subjects Display */}
            {selectedSubjects
              .filter(s => !SUBJECTS.find(sub => sub.name === s))
              .length > 0 && (
              <View style={styles.grid}>
                {selectedSubjects
                  .filter(s => !SUBJECTS.find(sub => sub.name === s))
                  .map(subject => (
                    <TouchableOpacity
                      key={subject}
                      style={[styles.pill, styles.customPill]}
                      onPress={() => toggleSubject(subject)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pillTextSelected}>{subject}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
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
      </View>
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