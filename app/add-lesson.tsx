/**
 * Add Lesson Screen
 */

import Colors from '@/constants/Colors';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  if (isToday) return `Today, ${formattedDate}`;
  
  return formattedDate;
};

export default function AddLessonScreen() {
  const router = useRouter();
  const { students, fetchStudents, subjects, fetchSubjects } = useStudentStore();
  const { addLesson, loading } = useLessonStore();
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    if (selectedStudentId) {
      fetchSubjects(selectedStudentId);
      // Reset subject when student changes
      setSubject('');
    }
  }, [selectedStudentId, fetchSubjects]);

  const getStudentSubjects = () => {
    if (!selectedStudentId) return [];
    return subjects.filter(s => s.student_id === selectedStudentId);
  };

  const canSave = selectedStudentId !== null && subject.trim() !== '' && title.trim() !== '';

  const handleSave = async () => {
    if (!selectedStudentId) {
      Alert.alert('Error', 'Please select a student');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a lesson title');
      return;
    }

    const result = await addLesson({
      student_id: selectedStudentId,
      subject: subject.trim(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      date,
      completed,
    });

    if (result.success) {
      Alert.alert('Success', 'Lesson added successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to add lesson');
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentSubjects = getStudentSubjects();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.brand[700]} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Add Lesson 📚</Text>
          <Text style={styles.subtitle}>Record a new lesson for your student</Text>
        </View>

        {/* Student Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Student *</Text>
          <View style={styles.studentGrid}>
            {students.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentButton,
                  {
                    backgroundColor: selectedStudentId === student.id
                      ? Colors.student[student.color_theme]
                      : '#FFFFFF',
                    borderColor: selectedStudentId === student.id
                      ? Colors.student[student.color_theme]
                      : Colors.ui.border,
                  },
                ]}
                onPress={() => setSelectedStudentId(student.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.studentButtonText,
                    selectedStudentId === student.id && styles.studentButtonTextSelected,
                  ]}
                >
                  {student.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subject Selector */}
        {selectedStudentId && (
          <View style={styles.section}>
            <Text style={styles.label}>Subject *</Text>
            {studentSubjects.length === 0 ? (
              <View style={styles.emptySubjectsContainer}>
                <Text style={styles.emptySubjectsText}>
                  {selectedStudent?.name} has no subjects yet.{'\n'}
                  Add subjects in the student edit screen.
                </Text>
              </View>
            ) : (
              <View style={styles.subjectGrid}>
                {studentSubjects.map((studentSubject) => (
                  <TouchableOpacity
                    key={studentSubject.id}
                    style={[
                      styles.subjectPill,
                      {
                        backgroundColor: subject === studentSubject.subject
                          ? Colors.brand[500]
                          : '#FFFFFF',
                        borderColor: subject === studentSubject.subject
                          ? Colors.brand[500]
                          : Colors.ui.border,
                      },
                    ]}
                    onPress={() => setSubject(studentSubject.subject)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.subjectPillText,
                        subject === studentSubject.subject && styles.subjectPillTextSelected,
                      ]}
                    >
                      {studentSubject.subject}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Lesson Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Chapter 5: Fractions"
            placeholderTextColor={Colors.ui.textLight}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
          />
        </View>

        {/* Date Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              // TODO: Open date picker
              Alert.alert('Date Picker', 'Date picker will be implemented soon');
            }}
            activeOpacity={0.7}
          >
            <CalendarIcon size={20} color={Colors.brand[600]} />
            <Text style={styles.dateButtonText}>{formatDate(date)}</Text>
          </TouchableOpacity>
        </View>

        {/* Notes Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Add any notes about this lesson..."
            placeholderTextColor={Colors.ui.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Completed Toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setCompleted(!completed)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.checkbox,
                completed && styles.checkboxChecked,
              ]}
            >
              {completed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Mark as Completed</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (!canSave || loading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Adding Lesson...' : 'Add Lesson'}
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
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[900],
    marginBottom: 12,
  },
  studentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  studentButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  studentButtonTextSelected: {
    color: '#FFFFFF',
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectPill: {
    borderWidth: 2,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  subjectPillTextSelected: {
    color: '#FFFFFF',
  },
  emptySubjectsContainer: {
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptySubjectsText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
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
  notesInput: {
    minHeight: 100,
    paddingTop: 16,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    padding: 16,
    minHeight: 44,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

