/**
 * Onboarding Step 1: Add Your First Student
 */

import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import type { GradeLevel, StudentColor } from '@/types';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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

export default function OnboardingStep1() {
  const router = useRouter();
  const { students, addStudent, loading } = useStudentStore();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel | null>(null);
  const [color, setColor] = useState<StudentColor>('purple');

  const studentsAdded = students.length;

  const clearForm = () => {
    setName('');
    setGrade(null);
    setColor('purple');
  };

  const handleAddAnother = async () => {
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
      Alert.alert('Success', `${name.trim()} has been added!`, [{ text: 'OK' }]);
      clearForm();
    } else {
      Alert.alert('Error', result.error || 'Failed to add student');
    }
  };

  const handleNext = async () => {
    // If form is filled, save the current student first
    if (name.trim() && grade) {
      const result = await addStudent({
        name: name.trim(),
        grade,
        color_theme: color,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to add student');
        return;
      }
    }

    // Navigate to step 2 with all students
    if (students.length > 0) {
      router.push({
        pathname: '/onboarding/step2',
        params: {
          studentName: students[0].name,
          studentGrade: students[0].grade,
          studentColor: students[0].color_theme,
        },
      });
    } else {
      Alert.alert('Error', 'Please add at least one student');
    }
  };

  const canProceed = studentsAdded > 0 || (name.trim().length > 0 && grade !== null);
  const canAddAnother = name.trim().length > 0 && grade !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.stepText}>Step 1 of 2</Text>
        {studentsAdded > 0 && (
          <Text style={styles.counterText}>Students added: {studentsAdded}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Add Your Students 👨‍👩‍👧‍👦</Text>
        <Text style={styles.subtitle}>
          {studentsAdded === 0
            ? "Let's start with your first student"
            : 'Add another student or continue'}
        </Text>
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

      <View style={styles.buttonContainer}>
        {studentsAdded > 0 && canAddAnother && (
          <TouchableOpacity
            style={[styles.addAnotherButton, loading && styles.addAnotherButtonDisabled]}
            onPress={handleAddAnother}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.addAnotherButtonText}>
              {loading ? 'Adding...' : 'Add Another Student'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.push('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>Skip for Now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextButton, (!canProceed || loading) && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {loading ? 'Adding...' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand[50],
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  stepText: {
    fontSize: 16,
    color: Colors.brand[700],
    fontWeight: '500',
  },
  counterText: {
    fontSize: 14,
    color: Colors.brand[600],
    fontWeight: '600',
    marginTop: 4,
  },
  section: {
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
  buttonContainer: {
    marginTop: 32,
    gap: 12,
  },
  addAnotherButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.brand[300],
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAnotherButtonDisabled: {
    opacity: 0.6,
  },
  addAnotherButtonText: {
    color: Colors.brand[700],
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.brand[700],
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

