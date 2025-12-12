// PhotoUpload disabled for now
// import PhotoUpload from '@/components/lessons/PhotoUpload';
import Colors from '@/constants/Colors';
import { PRESET_SUBJECTS, getSubjectColor } from '@/constants/Subjects';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson } from '@/types';
// import { LessonPhoto } from '@/types/database';
import { Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
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
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LessonModalProps {
  visible: boolean;
  lesson: Lesson | null;
  onClose: () => void;
  onSave: () => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Photo upload disabled for now
// const getPhotoUrl = (path: string) => {
//   if (!path) return '';
//   const { data } = supabase.storage
//     .from('student-avatars')
//     .getPublicUrl(path);
//   return data.publicUrl;
// };

export default function LessonModal({ visible, lesson, onClose, onSave }: LessonModalProps) {
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  // Photo upload disabled for now
  // const [photos, setPhotos] = useState<LessonPhoto[]>([]);

  const lessonStore = useLessonStore();
  const { students, subjects, fetchSubjects } = useStudentStore();

  useEffect(() => {
    if (visible && lesson) {
      setSubject(lesson.subject);
      setTitle(lesson.title);
      setNotes(lesson.notes || '');
      setCompleted(lesson.completed);
      
      // Fetch subjects for this student
      fetchSubjects(lesson.student_id);
      
      // Photo upload disabled for now
      // Load photos for this lesson
      // loadLessonPhotos();
    }
  }, [visible, lesson, fetchSubjects]);

  // Photo upload disabled for now
  // const loadLessonPhotos = async () => {
  //   if (!lesson) return;
  //   
  //   const { data, error } = await supabase
  //     .from('lesson_photos')
  //     .select('*')
  //     .eq('lesson_id', lesson.id)
  //     .order('created_at', { ascending: true });

  //   if (error) {
  //     console.error('Error loading photos:', error);
  //     return;
  //   }

  //   setPhotos(data || []);
  // };

  // useEffect(() => {
  //   console.log('=== PHOTOS STATE ===');
  //   console.log('Photos array:', photos);
  //   console.log('Photos count:', photos.length);
  //   if (photos.length > 0) {
  //     console.log('First photo:', photos[0]);
  //     console.log('First photo path:', photos[0].photo_path);
  //     console.log('First photo URL:', getPhotoUrl(photos[0].photo_path));
  //   }
  //   console.log('===================');
  // }, [photos]);

  if (!visible || !lesson) return null;

  const student = students.find((s) => s.id === lesson.student_id);
  const studentSubjects = subjects
    .filter((s) => s.student_id === lesson.student_id)
    .map((s) => s.subject);

  const handleSave = async () => {
    if (!subject.trim()) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a lesson title');
      return;
    }

    setLoading(true);
    const result = await lessonStore.updateLesson(lesson.id, {
      subject: subject.trim(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      completed,
    });
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Lesson updated!');
      onSave();
    } else {
      Alert.alert('Error', result.error || 'Failed to update lesson');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Lesson?',
      `Are you sure you want to delete "${lesson.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await lessonStore.deleteLesson(lesson.id);
            setLoading(false);
            if (result.success) {
              onSave();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const handleToggleComplete = async () => {
    const wasCompleted = completed;
    setLoading(true);
    const result = await lessonStore.toggleComplete(lesson.id);
    setLoading(false);
    if (result.success) {
      const newCompleted = !wasCompleted;
      setCompleted(newCompleted);
      
      // If marking as complete (was false, now true), show confetti
      if (!wasCompleted && newCompleted) {
        setShowConfetti(true);
        setConfettiKey(prev => prev + 1); // Force new confetti instance
        
        // Hide confetti after animation
        setTimeout(() => {
          setShowConfetti(false);
        }, 3000);
      }
      
      onSave();
    } else {
      Alert.alert('Error', result.error || 'Failed to update completion status');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {showConfetti && (
        <ConfettiCannon
          key={confettiKey}
          count={30}
          origin={{ x: SCREEN_WIDTH / 2, y: 100 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={2500}
        />
      )}
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Lesson</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            {/* Student Name (Read-only) */}
            <View style={styles.section}>
              <Text style={styles.label}>Student</Text>
              <View style={styles.studentDisplay}>
                <Text style={styles.studentName}>
                  {student?.name || 'Unknown'}
                </Text>
              </View>
            </View>

            {/* Subject Selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Subject</Text>
              {studentSubjects.length > 0 ? (
                <View style={styles.subjectGrid}>
                  {studentSubjects.map((subjectName) => {
                    const isSelected = subject === subjectName;
                    const subjectColor = getSubjectColor(subjectName);
                    const presetSubject = PRESET_SUBJECTS.find((s) => s.name === subjectName);
                    const emoji = presetSubject?.emoji || '📚';

                    return (
                      <TouchableOpacity
                        key={subjectName}
                        style={[
                          styles.subjectPill,
                          isSelected && {
                            backgroundColor: subjectColor,
                            borderColor: subjectColor,
                          },
                          !isSelected && {
                            backgroundColor: Colors.ui.background,
                            borderColor: Colors.ui.border,
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => setSubject(subjectName)}
                      >
                        <Text style={styles.subjectEmoji}>{emoji}</Text>
                        <Text
                          style={[
                            styles.subjectPillText,
                            isSelected && styles.subjectPillTextSelected,
                          ]}
                        >
                          {subjectName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.noSubjectsText}>
                  No subjects available for this student.
                </Text>
              )}
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Lesson Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Chapter 5: Fractions"
                placeholderTextColor={Colors.ui.textLight}
                autoCapitalize="sentences"
              />
            </View>

            {/* Date Display (Read-only for now) */}
            <View style={styles.section}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateDisplay}>
                <Text style={styles.dateText}>{formatDate(lesson.date)}</Text>
              </View>
            </View>

            {/* Notes Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this lesson..."
                placeholderTextColor={Colors.ui.textLight}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* 
              TODO: Re-enable photo attachments in v2.0
              - Issue: Supabase Storage permission problems
              - Alternative: Use Cloudinary or other service
              - Database tables exist: lesson_photos
              - Storage bucket exists: student-avatars (or lesson-photos)
            */}
            {/* {lesson && (
              <PhotoUpload
                lessonId={lesson.id}
                photos={photos}
                onPhotosChange={setPhotos}
              />
            )} */}

            {/* Completed Toggle */}
            <View style={styles.completedToggle}>
              <TouchableOpacity
                style={[styles.checkbox, completed && styles.checkboxChecked]}
                onPress={handleToggleComplete}
                disabled={loading}
              >
                {completed && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.label}>
                {completed ? 'Mark as Incomplete' : 'Mark as Complete'}
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={loading}
              >
                <Trash2 size={20} color={Colors.ui.error} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  studentDisplay: {
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  subjectEmoji: {
    fontSize: 18,
  },
  subjectPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.ui.text,
  },
  subjectPillTextSelected: {
    color: 'white',
  },
  noSubjectsText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.ui.text,
    minHeight: 44,
  },
  notesInput: {
    minHeight: 120,
  },
  dateDisplay: {
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  dateText: {
    fontSize: 16,
    color: Colors.ui.text,
  },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.brand[300],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.error,
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  photoInfoCard: {
    backgroundColor: Colors.brand[50],
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  photoInfoText: {
    fontSize: 14,
    color: Colors.brand[700],
    textAlign: 'center',
    fontWeight: '500',
  },
});

