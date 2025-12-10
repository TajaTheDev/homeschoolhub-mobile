/**
 * Add Student Screen
 */

import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import type { GradeLevel, StudentColor } from '@/types';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const GRADE_LEVELS: GradeLevel[] = [
  'Pre-K',
  'Kindergarten',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

const STUDENT_COLORS: StudentColor[] = ['purple', 'blue', 'green', 'pink', 'orange'];

export default function AddStudentScreen() {
  const router = useRouter();
  const { addStudent, fetchStudents, loading } = useStudentStore();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel | null>(null);
  const [color, setColor] = useState<StudentColor>('purple');

  const handleAddStudent = async () => {
    if (!name.trim() || !grade) {
      Alert.alert('Error', 'Please enter a name and select a grade');
      return;
    }

    const result = await addStudent({
      name: name.trim(),
      grade,
      color_theme: color,
    });

    if (result.success) {
      // Refresh the student list
      await fetchStudents();
      
      const studentName = name.trim();
      
      // Show success alert and optionally ask about subjects
      Alert.alert(
        'Student Added!',
        `${studentName} has been added successfully. Would you like to add subjects for ${studentName}?`,
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => router.back(),
          },
          {
            text: 'Add Subjects',
            onPress: () => {
              // Navigate back - subjects can be added via edit modal later
              // TODO: Navigate to subject selection screen when implemented
              router.back();
            },
          },
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to add student');
    }
  };

  const canAdd = name.trim().length > 0 && grade !== null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.brand[700]} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Add Student</Text>
          <Text style={styles.subtitle}>Add a new student to your homeschool</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Student Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter student's name"
              placeholderTextColor={Colors.ui.textLight}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Grade Level</Text>
            <View style={styles.gradeGrid}>
              {GRADE_LEVELS.map((gradeLevel) => (
                <TouchableOpacity
                  key={gradeLevel}
                  style={[
                    styles.gradeButton,
                    grade === gradeLevel && styles.gradeButtonSelected,
                  ]}
                  onPress={() => setGrade(gradeLevel)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.gradeButtonText,
                      grade === gradeLevel && styles.gradeButtonTextSelected,
                    ]}
                  >
                    {gradeLevel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color Theme</Text>
            <View style={styles.colorPicker}>
              {STUDENT_COLORS.map((studentColor) => (
                <TouchableOpacity
                  key={studentColor}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: Colors.student[studentColor],
                      borderWidth: color === studentColor ? 4 : 2,
                      borderColor:
                        color === studentColor
                          ? Colors.brand[700]
                          : Colors.ui.border,
                    },
                  ]}
                  onPress={() => setColor(studentColor)}
                  activeOpacity={0.7}
                >
                  {color === studentColor && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addButton, (!canAdd || loading) && styles.addButtonDisabled]}
          onPress={handleAddStudent}
          disabled={!canAdd || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>
            {loading ? 'Adding...' : 'Add Student'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand[50],
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.brand[700],
    fontWeight: '500',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.brand[700],
  },
  form: {
    gap: 24,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[900],
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 44,
    color: Colors.ui.text,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gradeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeButtonSelected: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  gradeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.brand[900],
  },
  gradeButtonTextSelected: {
    color: '#FFFFFF',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

