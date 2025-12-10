/**
 * Onboarding Step 2: Select Subjects
 */

import Colors from '@/constants/Colors';
import {
  PRESET_SUBJECTS,
  getSubjectColor,
  isPresetSubject,
} from '@/constants/Subjects';
import { useStudentStore } from '@/store/studentStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COMMON_CORE_SUBJECT_NAMES = ['Math', 'Reading', 'Science', 'History', 'Writing'];

const COMMON_EXTRACURRICULARS = ['PE (Physical Education)', 'Music', 'Spanish', 'Art'];

export default function OnboardingStep2() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { students, addSubject, loading } = useStudentStore();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Get the most recently added student (from step 1)
  const student = students.length > 0 ? students[students.length - 1] : null;
  const studentName = params.studentName as string || student?.name || 'your student';

  useEffect(() => {
    if (students.length === 0) {
      // If no students, redirect back to step 1
      router.replace('/onboarding/step1');
    }
  }, [students, router]);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    if (customSubjects.includes(trimmed) || isPresetSubject(trimmed)) {
      Alert.alert('Error', 'This subject already exists');
      return;
    }

    setCustomSubjects((prev) => [...prev, trimmed]);
    setCustomSubjectInput('');
    setShowCustomInput(false);
    // Automatically select the new custom subject
    setSelectedSubjects((prev) => [...prev, trimmed]);
  };

  const handleCommonCore = () => {
    setSelectedSubjects(COMMON_CORE_SUBJECT_NAMES);
  };

  const handleAddCommonExtras = () => {
    const newExtras = COMMON_EXTRACURRICULARS.filter(
      (extra) =>
        !customSubjects.includes(extra) &&
        !isPresetSubject(extra) &&
        !selectedSubjects.includes(extra)
    );

    if (newExtras.length === 0) {
      Alert.alert('Info', 'All common extracurriculars are already added');
      return;
    }

    setCustomSubjects((prev) => [...prev, ...newExtras]);
    // Automatically select the new extracurriculars
    setSelectedSubjects((prev) => [...prev, ...newExtras]);
  };

  const handleFinish = async () => {
    if (selectedSubjects.length === 0) {
      Alert.alert('Error', 'Please select at least one subject');
      return;
    }

    if (!student) {
      Alert.alert('Error', 'Student not found');
      return;
    }

    // Add all selected subjects
    const results = await Promise.all(
      selectedSubjects.map((subject) =>
        addSubject({
          student_id: student.id,
          subject,
        })
      )
    );

    const hasError = results.some((result) => !result.success);
    if (hasError) {
      Alert.alert('Error', 'Failed to save some subjects. Please try again.');
      return;
    }

    // Navigate to main app
    router.replace('/(tabs)');
  };

  if (!student) {
    return null; // Will redirect in useEffect
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push('/onboarding/step1')}
        activeOpacity={0.7}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.stepText}>Step 2 of 2</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Select Subjects 📚</Text>
        <Text style={styles.subtitle}>
          What subjects will {studentName} be studying?
        </Text>
      </View>

      <View style={styles.subjectContainer}>
        {/* Preset subjects */}
        {PRESET_SUBJECTS.map((presetSubject) => {
          const isSelected = selectedSubjects.includes(presetSubject.name);
          return (
            <TouchableOpacity
              key={presetSubject.name}
              style={[
                styles.subjectPill,
                isSelected && {
                  backgroundColor: presetSubject.color,
                },
                !isSelected && {
                  backgroundColor: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: Colors.ui.border,
                },
              ]}
              onPress={() => toggleSubject(presetSubject.name)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subjectPillText,
                  isSelected && styles.subjectPillTextSelected,
                ]}
              >
                {presetSubject.emoji} {presetSubject.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add Common Extras button */}
        <TouchableOpacity
          style={styles.addCommonExtrasButton}
          onPress={handleAddCommonExtras}
          activeOpacity={0.7}
        >
          <Text style={styles.addCommonExtrasButtonText}>+ Add Common Extras</Text>
        </TouchableOpacity>

        {/* Custom subjects */}
        {customSubjects.map((subject) => {
          const isSelected = selectedSubjects.includes(subject);
          return (
            <TouchableOpacity
              key={`custom-${subject}`}
              style={[
                styles.subjectPill,
                styles.customSubjectPill,
                isSelected && {
                  backgroundColor: getSubjectColor(subject),
                },
                !isSelected && {
                  backgroundColor: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: Colors.ui.border,
                },
              ]}
              onPress={() => toggleSubject(subject)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.subjectPillText,
                  isSelected && styles.subjectPillTextSelected,
                ]}
              >
                {subject}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Add Custom Subject button */}
        {!showCustomInput && (
          <TouchableOpacity
            style={styles.addCustomButton}
            onPress={() => setShowCustomInput(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addCustomButtonText}>+ Add Custom Subject</Text>
          </TouchableOpacity>
        )}

      </View>

      {/* Custom subject input - outside the flexWrap container */}
      {showCustomInput && (
        <View style={styles.customInputContainer}>
          <TextInput
            style={styles.customInput}
            placeholder="Enter subject name"
            placeholderTextColor={Colors.ui.textLight}
            value={customSubjectInput}
            onChangeText={setCustomSubjectInput}
            autoCapitalize="words"
            autoFocus
          />
          <TouchableOpacity
            style={styles.addCustomInputButton}
            onPress={handleAddCustomSubject}
            activeOpacity={0.8}
          >
            <Text style={styles.addCustomInputButtonText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelCustomInputButton}
            onPress={() => {
              setShowCustomInput(false);
              setCustomSubjectInput('');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelCustomInputButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.commonCoreButton}
          onPress={handleCommonCore}
          activeOpacity={0.7}
        >
          <Text style={styles.commonCoreButtonText}>Use Common Core</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.finishButton,
            (selectedSubjects.length === 0 || loading) && styles.finishButtonDisabled,
          ]}
          onPress={handleFinish}
          disabled={selectedSubjects.length === 0 || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.finishButtonText}>
            {loading ? 'Saving...' : 'Finish Setup'}
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
  backButton: {
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
  stepText: {
    fontSize: 16,
    color: Colors.brand[700],
    fontWeight: '500',
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
  subjectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  subjectPill: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectPillText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  subjectPillTextSelected: {
    color: '#FFFFFF',
  },
  customSubjectPill: {
    opacity: 0.9,
  },
  addCommonExtrasButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCommonExtrasButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.brand[600],
    textDecorationLine: 'underline',
  },
  addCustomButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.brand[300],
  },
  addCustomButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  customInputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
    color: Colors.ui.text,
  },
  addCustomInputButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCustomInputButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelCustomInputButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCustomInputButtonText: {
    color: Colors.brand[700],
    fontSize: 16,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 12,
  },
  commonCoreButton: {
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.brand[300],
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonCoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  finishButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonDisabled: {
    opacity: 0.6,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

