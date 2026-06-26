import PhotoUpload from '@/components/lessons/PhotoUpload';
import PhotoGallery from '@/components/lessons/PhotoGallery';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { PRESET_SUBJECTS, getSubjectColor } from '@/constants/Subjects';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson } from '@/types';
import { LessonPhoto } from '@/types/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Calendar, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

export default function LessonModal({ visible, lesson, onClose, onSave }: LessonModalProps) {
  const { showSnackbar } = useSnackbar();
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);
  const [photos, setPhotos] = useState<LessonPhoto[]>([]);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  // Grade state
  const [gradeType, setGradeType] = useState<'letter' | 'percentage' | 'pass_fail' | 'points' | 'custom' | null>(null);
  const [gradeValue, setGradeValue] = useState('');
  const [gradeMaxPoints, setGradeMaxPoints] = useState('');
  const [showGradeInput, setShowGradeInput] = useState(false);

  const lessonStore = useLessonStore();
  const { students, subjects, fetchSubjects } = useStudentStore();

  const loadLessonPhotos = useCallback(async (lessonId: string) => {
    try {
      const { data, error } = await supabase
        .from('lesson_photos')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading photos:', error);
        return;
      }

      // Merge database photos with existing photos (from lesson object)
      setPhotos(prev => {
        const dbPhotos = data || [];
        const existingPaths = new Set(prev.map(p => p.storage_path || p.photo_path));
        const newDbPhotos = dbPhotos.filter(p => !existingPaths.has(p.storage_path || p.photo_path));
        return [...prev, ...newDbPhotos];
      });
    } catch (err: any) {
      console.error('Unexpected error loading photos:', err);
    }
  }, []);

  useEffect(() => {
    if (visible && lesson) {
      setSubject(lesson.subject);
      setTitle(lesson.title);
      setNotes(lesson.notes || '');
      setCompleted(lesson.completed);
      setSelectedDate(new Date(lesson.date));
      
      // Load grade data
      setGradeType(lesson.grade_type || null);
      setGradeValue(lesson.grade_value || '');
      setGradeMaxPoints(lesson.grade_max_points?.toString() || '');
      setShowGradeInput(!!lesson.grade_type); // Show if grade exists
      
      // Fetch subjects for this student
      fetchSubjects(lesson.student_id);
      
      // Handle photos from lesson object - support all formats
      const lessonPhotos: LessonPhoto[] = [];
      
      // Add from photo_url field (single photo - legacy)
      if (lesson.photo_url && typeof lesson.photo_url === 'string') {
        lessonPhotos.push({
          id: `temp-${Date.now()}`,
          lesson_id: lesson.id,
          storage_path: lesson.photo_url,
          photo_path: lesson.photo_url,
          created_at: new Date().toISOString(),
        } as LessonPhoto);
      }
      
      // Add from photos array
      if (lesson.photos && Array.isArray(lesson.photos)) {
        lesson.photos.forEach((photo: any, index: number) => {
          let storagePath = '';
          
          if (typeof photo === 'string') {
            storagePath = photo;
          } else if (photo && typeof photo === 'object') {
            // Use storage_path (NEW FORMAT)
            if (photo.storage_path) {
              storagePath = photo.storage_path;
            }
            // Legacy formats
            else if (photo.photo_url) {
              storagePath = photo.photo_url;
            } else if (photo.url) {
              storagePath = photo.url;
            }
          }
          
          if (storagePath && !lessonPhotos.find(p => p.storage_path === storagePath || p.photo_path === storagePath)) {
            lessonPhotos.push({
              id: `temp-${Date.now()}-${index}`,
              lesson_id: lesson.id,
              storage_path: storagePath,
              photo_path: storagePath,
              created_at: new Date().toISOString(),
            } as LessonPhoto);
          }
        });
      }
      
      // Set lesson object photos first, then load database photos (which will merge)
      if (lessonPhotos.length > 0) {
        setPhotos(lessonPhotos);
      } else {
        setPhotos([]);
      }
      
      // Load photos from database (will merge with lesson object photos)
      loadLessonPhotos(lesson.id);
    } else {
      setPhotos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lesson?.id]); // Only depend on lesson.id to avoid re-running on lesson object changes

  // useEffect(() => {
  //     //     //     //   if (photos.length > 0) {
  //       //       //       //   }
  //     // }, [photos]);

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

    // Validate grade if provided
    if (showGradeInput && gradeType) {
      if (!gradeValue.trim()) {
        Alert.alert('Error', 'Please enter a grade value or remove the grade');
        return;
      }

      // Validate percentage range
      if (gradeType === 'percentage') {
        const percentage = parseInt(gradeValue);
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          Alert.alert('Error', 'Percentage must be between 0 and 100');
          return;
        }
      }

      // Validate points
      if (gradeType === 'points') {
        const points = parseInt(gradeValue);
        const maxPoints = parseInt(gradeMaxPoints);
        if (isNaN(points) || isNaN(maxPoints)) {
          Alert.alert('Error', 'Please enter valid numbers for points');
          return;
        }
        if (points > maxPoints) {
          Alert.alert('Error', 'Points earned cannot exceed total points');
          return;
        }
        if (maxPoints <= 0) {
          Alert.alert('Error', 'Total points must be greater than 0');
          return;
        }
      }
    }

    // Prepare grade data
    let gradeData = {};
    if (showGradeInput && gradeType && gradeValue.trim()) {
      gradeData = {
        grade_type: gradeType,
        grade_value: gradeValue.trim(),
        grade_max_points: gradeType === 'points' ? parseInt(gradeMaxPoints) : null,
        graded_at: new Date().toISOString(),
      };
    } else {
      // Clear grade data if removed
      gradeData = {
        grade_type: null,
        grade_value: null,
        grade_max_points: null,
        graded_at: null,
      };
    }

    // Update lesson optimistically (UI updates instantly, modal closes immediately)
    const result = await lessonStore.updateLesson(lesson.id, {
      subject: subject.trim(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      date: format(selectedDate, 'yyyy-MM-dd'),
      completed,
      ...gradeData, // Include grade data
    });

    // Close modal immediately (optimistic UX)
    onSave();

    // Handle errors in background (if any)
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to update lesson. Changes may not have been saved.');
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
            // Delete optimistically (UI updates instantly, modal closes immediately)
            const result = await lessonStore.deleteLesson(lesson.id);
            
            // Close modal immediately (optimistic UX)
            onSave();
            
            // Handle errors in background (if any)
            if (!result.success) {
              Alert.alert('Error', result.error || 'Failed to delete lesson. It may still appear in the list.');
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
        
        // Trigger confetti with slight delay to ensure component is mounted
        setTimeout(() => {
          confettiRef.current?.start();
        }, 100);
        
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

  const getPhotoUrl = (path: string) => {
    if (!path) {
      return '';
    }
    
    // Clean the path - remove leading/trailing slashes
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }
    if (cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    const { data } = supabase.storage
      .from('lesson-photos')
      .getPublicUrl(cleanPath);
    return data.publicUrl;
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    try {
            
      // Remove from local state
      const updatedPhotos = photos.filter(p => {
        // Check if this photo matches the URL we're deleting
        if (p.storage_path) {
          const { data } = supabase.storage
            .from('lesson-photos')
            .getPublicUrl(p.storage_path);
          return data.publicUrl !== photoUrl;
        }
        return true; // Keep photos without storage_path
      });
      setPhotos(updatedPhotos);
      
      // If this is an existing lesson, update in database
      if (lesson?.id) {
        // Find the photo record by matching the URL
        // Since photos are stored with storage_path, we need to find by lesson_id
        // and match the generated URL
        
        // Get all photos for this lesson
        const { data: lessonPhotos, error: fetchError } = await supabase
          .from('lesson_photos')
          .select('*')
          .eq('lesson_id', lesson.id);
        
        if (fetchError) throw fetchError;
        
        // Find which photo matches the URL we're deleting
        const photoToDelete = lessonPhotos?.find(p => {
          if (p.storage_path) {
            const { data } = supabase.storage
              .from('lesson-photos')
              .getPublicUrl(p.storage_path);
            return data.publicUrl === photoUrl;
          }
          return false;
        });
        
        if (photoToDelete) {
                    
          // Delete from database
          const { error: deleteError } = await supabase
            .from('lesson_photos')
            .delete()
            .eq('id', photoToDelete.id);
          
          if (deleteError) throw deleteError;
          
          // Delete from storage
          if (photoToDelete.storage_path) {
            const { error: storageError } = await supabase.storage
              .from('lesson-photos')
              .remove([photoToDelete.storage_path]);
            
            if (storageError) {
              console.error('⚠️ Storage delete error:', storageError);
              // Don't throw - database record is already deleted
            } else {
                          }
          }
          
          showSnackbar('Photo deleted', 'success');
        } else {
          console.warn('⚠️ Could not find photo record to delete');
          showSnackbar('Photo removed from lesson', 'success');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Delete photo error:', error);
      Alert.alert('Error', 'Failed to delete photo: ' + error.message);
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
          ref={confettiRef}
          count={100}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut={true}
          fallSpeed={2000}
          colors={['#7C3AED', '#F97316', '#10B981', '#F59E0B', '#EC4899', '#3B82F6']}
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
                activeOpacity={0.7}
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
                        activeOpacity={0.7}
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

            {/* Date Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Calendar size={20} color={Colors.brand[600]} />
                <Text style={styles.dateButtonText}>
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Date Picker */}
            {showDatePicker && (
              <>
                {Platform.OS === 'ios' ? (
                  // iOS: Show in Modal with proper visibility
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showDatePicker}
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <Pressable 
                      style={styles.datePickerOverlay}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Pressable 
                        style={styles.datePickerContainer}
                        onPress={(e) => e.stopPropagation()}
                      >
                        {/* Header with Cancel/Done */}
                        <View style={styles.datePickerHeader}>
                          <TouchableOpacity
                            onPress={() => setShowDatePicker(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.datePickerCancel}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <Text style={styles.datePickerTitle}>Select Date</Text>
                          
                          <TouchableOpacity
                            onPress={() => setShowDatePicker(false)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text style={styles.datePickerDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Picker with explicit styling for visibility */}
                        <View style={{
                          backgroundColor: '#FFFFFF',
                          paddingVertical: 20,
                        }}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setSelectedDate(selectedDate);
                              }
                            }}
                            textColor="#000000"
                            accentColor={Colors.brand[500]}
                            themeVariant="light"
                            style={{
                              height: 200,
                              width: '100%',
                              backgroundColor: '#FFFFFF',
                            }}
                          />
                        </View>
                      </Pressable>
                    </Pressable>
                  </Modal>
                ) : (
                  // Android: Native picker
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                      if (event.type === 'set' && selectedDate) {
                        setSelectedDate(selectedDate);
                  }
                }}
              />
                )}
              </>
            )}

            {/* Notes Input */}
            <View style={styles.section}>
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes (Optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about this lesson...

Examples:
- What went well
- Areas to review
- Homework assigned
- Materials needed"
                  placeholderTextColor={Colors.ui.textLight}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
                
                {/* Character count */}
                <Text style={styles.characterCount}>
                  {notes.length} characters
                </Text>
                
                {/* Quick formatting tips */}
                <View style={styles.formattingTips}>
                  <Text style={styles.tipText}>💡 Tip: Use • for bullets, --- for sections</Text>
                </View>
              </View>
            </View>

            {/* Photos Section */}
            {lesson && (
              <View style={styles.section}>
                <PhotoUpload
                  lessonId={lesson.id}
                  photos={photos}
                  onPhotosChange={setPhotos}
                />
              </View>
            )}

            {/* Grade Section */}
            <View style={styles.section}>
              {!showGradeInput ? (
                // Show "Add Grade" button
                <TouchableOpacity
                  style={styles.addGradeButton}
                  onPress={() => setShowGradeInput(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addGradeButtonText}>📊 Add Grade (Optional)</Text>
                </TouchableOpacity>
              ) : (
                // Show grade input
                <View style={styles.gradeInputSection}>
                  <View style={styles.gradeHeader}>
                    <Text style={styles.label}>Grade</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowGradeInput(false);
                        setGradeType(null);
                        setGradeValue('');
                        setGradeMaxPoints('');
                      }}
                    >
                      <Text style={styles.removeGradeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Grade Type Selector */}
                  <Text style={styles.gradeTypeLabel}>Type:</Text>
                  <View style={styles.gradeTypeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.gradeTypeButton,
                        gradeType === 'letter' && styles.gradeTypeButtonActive
                      ]}
                      onPress={() => {
                        setGradeType('letter');
                        setGradeValue(''); // Reset value when changing type
                      }}
                    >
                      <Text
                        style={[
                          styles.gradeTypeButtonText,
                          gradeType === 'letter' && styles.gradeTypeButtonTextActive
                        ]}
                        numberOfLines={1}
                      >
                        Letter
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.gradeTypeButton,
                        gradeType === 'percentage' && styles.gradeTypeButtonActive
                      ]}
                      onPress={() => {
                        setGradeType('percentage');
                        setGradeValue('');
                      }}
                    >
                      <Text
                        style={[
                          styles.gradeTypeButtonText,
                          gradeType === 'percentage' && styles.gradeTypeButtonTextActive
                        ]}
                        numberOfLines={1}
                      >
                        %
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.gradeTypeButton,
                        gradeType === 'pass_fail' && styles.gradeTypeButtonActive
                      ]}
                      onPress={() => {
                        setGradeType('pass_fail');
                        setGradeValue('');
                      }}
                    >
                      <Text
                        style={[
                          styles.gradeTypeButtonText,
                          gradeType === 'pass_fail' && styles.gradeTypeButtonTextActive
                        ]}
                        numberOfLines={1}
                      >
                        Pass/Fail
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.gradeTypeButton,
                        gradeType === 'points' && styles.gradeTypeButtonActive
                      ]}
                      onPress={() => {
                        setGradeType('points');
                        setGradeValue('');
                      }}
                    >
                      <Text
                        style={[
                          styles.gradeTypeButtonText,
                          gradeType === 'points' && styles.gradeTypeButtonTextActive
                        ]}
                        numberOfLines={1}
                      >
                        Points
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Grade Value Input - Changes based on type */}
                  {gradeType === 'letter' && (
                    <View style={styles.letterGradeButtons}>
                      {['A', 'B', 'C', 'D', 'F'].map((letter) => (
                        <TouchableOpacity
                          key={letter}
                          style={[
                            styles.letterButton,
                            gradeValue === letter && styles.letterButtonActive
                          ]}
                          onPress={() => setGradeValue(letter)}
                        >
                          <Text style={[
                            styles.letterButtonText,
                            gradeValue === letter && styles.letterButtonTextActive
                          ]}>
                            {letter}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {gradeType === 'percentage' && (
                    <View style={styles.gradeInputRow}>
                      <Text style={styles.gradeInputLabel}>Score:</Text>
                      <TextInput
                        style={styles.gradeInput}
                        value={gradeValue}
                        onChangeText={setGradeValue}
                        placeholder="0-100"
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <Text style={styles.gradeInputSuffix}>%</Text>
                    </View>
                  )}

                  {gradeType === 'pass_fail' && (
                    <View style={styles.gradeInputRow}>
                      <TouchableOpacity
                        style={[
                          styles.passFailButton,
                          gradeValue === 'Pass' && styles.passButton
                        ]}
                        onPress={() => setGradeValue('Pass')}
                      >
                        <Text style={[
                          styles.passFailButtonText,
                          gradeValue === 'Pass' && styles.passButtonText
                        ]}>
                          ✓ Pass
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.passFailButton,
                          gradeValue === 'Fail' && styles.failButton
                        ]}
                        onPress={() => setGradeValue('Fail')}
                      >
                        <Text style={[
                          styles.passFailButtonText,
                          gradeValue === 'Fail' && styles.failButtonText
                        ]}>
                          ✗ Fail
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {gradeType === 'points' && (
                    <View style={styles.gradeInputRow}>
                      <TextInput
                        style={styles.gradeInput}
                        value={gradeValue}
                        onChangeText={setGradeValue}
                        placeholder="Points earned"
                        keyboardType="number-pad"
                      />
                      <Text style={styles.gradeInputDivider}>/</Text>
                      <TextInput
                        style={styles.gradeInput}
                        value={gradeMaxPoints}
                        onChangeText={setGradeMaxPoints}
                        placeholder="Total"
                        keyboardType="number-pad"
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Completed Toggle */}
            <View style={styles.completedToggle}>
              <TouchableOpacity
                style={[styles.checkbox, completed && styles.checkboxChecked]}
                onPress={handleToggleComplete}
                disabled={loading}
                activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={Colors.ui.error} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Photo Gallery Viewer */}
      <PhotoGallery
        visible={showPhotoGallery}
        photos={photos.map(p => getPhotoUrl(p.storage_path)).filter(url => url)}
        initialIndex={selectedPhotoIndex}
        onClose={() => setShowPhotoGallery(false)}
        onDelete={lesson?.id ? handleDeletePhoto : undefined}
      />
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
  notesContainer: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: Colors.ui.text,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 4,
    textAlign: 'right',
  },
  formattingTips: {
    marginTop: 8,
    padding: 8,
    backgroundColor: Colors.brand[50],
    borderRadius: 8,
  },
  tipText: {
    fontSize: 12,
    color: Colors.brand[700],
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.brand[700],
    flex: 1,
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
  // Grade Section Styles
  addGradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderStyle: 'dashed',
  },
  addGradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  gradeInputSection: {
    backgroundColor: Colors.brand[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  gradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  removeGradeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.error,
  },
  gradeTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gradeTypeButton: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeTypeButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  gradeTypeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
    textAlign: 'center',
  },
  gradeTypeButtonTextActive: {
    color: 'white',
  },
  gradeTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
    marginTop: 4,
  },
  gradeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  gradeInputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  gradeInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: Colors.ui.text,
    textAlign: 'center',
    minWidth: 80,
  },
  gradeInputSuffix: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  gradeInputDivider: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  letterGradeButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  letterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  letterButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  letterButtonTextActive: {
    color: 'white',
  },
  passFailButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  failButton: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  passFailButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  passButtonText: {
    color: 'white',
  },
  failButtonText: {
    color: 'white',
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  datePickerCancel: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
});

