/**
 * Add Lesson Screen
 */

import PhotoUpload from '@/components/lessons/PhotoUpload';
import Avatar from '@/components/ui/Avatar';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useStudentStore } from '@/store/studentStore';
import type { LessonPhoto } from '@/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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

const getPhotoUrl = (path: string) => {
  if (!path) return '';
  
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

export default function AddLessonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const studentId = params.id as string | undefined;
  const { students, fetchStudents, subjects, fetchSubjects } = useStudentStore();
  const lessonStore = useLessonStore();
  const { getSchoolDays, isBreakDay } = useScheduleStore();
  
  // Convert day numbers to day name strings (e.g., [1,2,3,4,5] -> ['monday', 'tuesday', ...])
  const dayNumberToName: { [key: number]: string } = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };
  const schoolDayNumbers = getSchoolDays(); // Returns array like [1,2,3,4,5] for Mon-Fri
  const schoolDays = schoolDayNumbers.map(dayNum => dayNumberToName[dayNum]); // Convert to ['monday', 'tuesday', ...]
  
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    // Check if date was passed from calendar
    if (params.preselectedDate && typeof params.preselectedDate === 'string') {
      return new Date(params.preselectedDate);
    }
    return new Date(); // Default to today
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [photos, setPhotos] = useState<LessonPhoto[]>([]);
  
  // Recurring lesson state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedWeeklyDay, setSelectedWeeklyDay] = useState<string>('monday'); // Default to Monday
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize with current student (if coming from student page)
  useEffect(() => {
    if (studentId) {
      setSelectedStudents([studentId]);
    }
  }, [studentId]);

  useEffect(() => {
    const loadSubjects = async () => {
      if (selectedStudents.length > 0) {
        setLoadingSubjects(true);
        // Fetch subjects for all selected students (use first one for now)
        await fetchSubjects(selectedStudents[0]);
        setLoadingSubjects(false);
        // Reset subject when students change
        setSubject('');
      }
    };
    
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudents.length]);

  // Load photos when lesson ID is available (for editing existing lessons)
  useEffect(() => {
    if (createdLessonId) {
      loadPhotos();
    }
  }, [createdLessonId]);

  const loadPhotos = async () => {
    if (!createdLessonId) return;
    
    try {
      const { data, error } = await supabase
        .from('lesson_photos')
        .select('*')
        .eq('lesson_id', createdLessonId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading photos:', error);
        // If table doesn't exist or permission issue, log but don't crash
        if (error.code === '42P01' || error.code === 'PGRST116') {
          console.warn('lesson_photos table may not exist. Please run migration 005_create_lesson_photos.sql');
        }
        return;
      }

      setPhotos(data || []);
    } catch (err: any) {
      console.error('Unexpected error loading photos:', err);
    }
  };

  const getStudentSubjects = () => {
    if (selectedStudents.length === 0) return [];
    // Get subjects from first selected student (or combine all if needed)
    return subjects.filter(s => selectedStudents.includes(s.student_id));
  };

  const canSave = selectedStudents.length > 0 && subject.trim() !== ''; // Title is now optional

  const generateRecurringLessons = (
    baseLesson: any,
    startDate: Date,
    endDate: Date,
    pattern: 'daily' | 'weekly' | 'custom',
    days: string[], // For custom pattern
    weeklyDay: string, // For weekly pattern
    schoolDays: string[],
    isBreakDay: (date: Date) => boolean
  ) => {
    const lessons = [];
    let skippedBreaks = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    // Don't go more than 1 year out (safety limit)
    const maxDate = new Date(startDate);
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    const finalEndDate = end > maxDate ? maxDate : end;
    
    console.log(`📅 Generating recurring lessons from ${current.toDateString()} to ${finalEndDate.toDateString()}`);
    console.log(`🏫 School days:`, schoolDays);
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    while (current <= finalEndDate) {
      let shouldCreate = false;
      const currentDayName = dayNames[current.getDay()];
      
      // CHECK 1: Is it a school day?
      const isSchoolDay = schoolDays.includes(currentDayName);
      
      if (!isSchoolDay) {
        // Skip non-school days entirely
        current.setDate(current.getDate() + 1);
        continue;
      }
      
      // CHECK 2: Is it during a break?
      if (isBreakDay(current)) {
        skippedBreaks++;
        current.setDate(current.getDate() + 1);
        continue; // Skip break days
      }
      
      if (pattern === 'daily') {
        // "Daily" means every school day
        shouldCreate = true; // Already checked isSchoolDay above
      } else if (pattern === 'weekly') {
        // Create on the selected weekly day
        const weeklyDayIndex = {
          'sunday': 0,
          'monday': 1,
          'tuesday': 2,
          'wednesday': 3,
          'thursday': 4,
          'friday': 5,
          'saturday': 6
        }[weeklyDay];
        
        if (current.getDay() === weeklyDayIndex) {
          shouldCreate = true;
        }
      } else if (pattern === 'custom') {
        // Check if current day is in selected days
        shouldCreate = days.includes(currentDayName);
      }
      
      if (shouldCreate) {
        lessons.push({
          ...baseLesson,
          date: current.toISOString().split('T')[0], // YYYY-MM-DD
          is_recurring: true,
          recurrence_pattern: pattern,
          recurrence_days: pattern === 'custom' ? JSON.stringify(days) : null,
          recurrence_end_date: finalEndDate.toISOString().split('T')[0],
        });
      }
      
      // Move to next day
      current.setDate(current.getDate() + 1);
    }
    
    console.log(`✅ Generated ${lessons.length} recurring lessons (only on school days)`);
    console.log(`⏭️  Skipped ${skippedBreaks} days due to breaks/holidays`);
    return lessons;
  };

  const handleSave = async () => {
    // Validate required fields
    if (selectedStudents.length === 0) {
      Alert.alert('Error', 'Please select at least one student');
      return;
    }

    if (!subject.trim()) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }

    // Title is optional - auto-generate from subject if empty
    const finalTitle = title.trim() || subject;

    try {
      setLoading(true);

      // Get user ID first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in');
        setLoading(false);
        return;
      }

      // Base lesson object with user_id
      const baseLesson = {
        student_id: selectedStudents[0], // Primary student (for backward compatibility)
        subject: subject.trim(),
        title: finalTitle,
        notes: notes.trim() || null,
        completed: completed,
        user_id: user.id,  // ← ADD THIS!
      };

      if (isRecurring) {
        // RECURRING LESSON PATH
        
        // Validate recurring fields
        if (!recurrenceEndDate) {
          Alert.alert('Error', 'Please select an end date for recurring lessons');
          setLoading(false);
          return;
        }

        if (recurrencePattern === 'weekly' && !selectedWeeklyDay) {
          Alert.alert('Error', 'Please select a day for weekly recurring lessons');
          setLoading(false);
          return;
        }

        if (recurrencePattern === 'custom' && selectedDays.length === 0) {
          Alert.alert('Error', 'Please select at least one day for custom recurring lessons');
          setLoading(false);
          return;
        }

        // Generate all recurring lessons
        const recurringLessons = generateRecurringLessons(
          baseLesson,
          selectedDate,
          recurrenceEndDate,
          recurrencePattern,
          selectedDays,
          selectedWeeklyDay, // Add this!
          schoolDays,
          isBreakDay
        );

        if (recurringLessons.length === 0) {
          Alert.alert('Error', 'No lessons would be created with these settings');
          setLoading(false);
          return;
        }

        // Confirm with user
        const confirmMessage = `This will create ${recurringLessons.length} lessons from ${format(selectedDate, 'MMM d')} to ${format(recurrenceEndDate, 'MMM d, yyyy')}. Continue?`;
        
        Alert.alert(
          'Create Recurring Lessons?',
          confirmMessage,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setLoading(false),
            },
            {
              text: 'Create',
              onPress: async () => {
                try {
                  // user_id is already in baseLesson, so recurringLessons already have it
                  // No need to check user again - already checked at start of handleSave
                  console.log('✅ Recurring lessons already include user_id from baseLesson');
                  console.log('📝 Sample lesson data:', recurringLessons[0]);
                  console.log(`📚 Total lessons to insert: ${recurringLessons.length}`);

                  // Use recurringLessons directly (user_id already included in baseLesson)
                  const recurringLessonsWithUserId = recurringLessons;

                  // VERIFY: Check that user_id is present in all lessons
                  const missingUserId = recurringLessonsWithUserId.some(lesson => !lesson.user_id);
                  if (missingUserId) {
                    console.error('❌ CRITICAL: Some recurring lessons are missing user_id!');
                    Alert.alert('Error', 'Internal error: Missing user ID in lessons');
                    setLoading(false);
                    return;
                  }
                  console.log('✅ Verified: All recurring lessons have user_id');

                  // Insert all lessons at once
                  const { data: insertedLessons, error } = await supabase
        .from('lessons')
                    .insert(recurringLessonsWithUserId)
                    .select();

                  if (error) {
                    console.error('❌ Error creating recurring lessons:', error);
                    Alert.alert('Error', `Failed to create lessons: ${error.message}`);
                    setLoading(false);
                    return;
                  }

                  if (!insertedLessons || insertedLessons.length === 0) {
                    Alert.alert('Error', 'No lessons were created');
                    setLoading(false);
                    return;
                  }

                  // Link all selected students to all created lessons
                  const lessonStudentRecords: Array<{ lesson_id: string; student_id: string }> = [];
                  insertedLessons.forEach(lesson => {
                    selectedStudents.forEach(studentId => {
                      lessonStudentRecords.push({
                        lesson_id: lesson.id,
                        student_id: studentId,
                      });
                    });
                  });

                  console.log('Linking students to recurring lessons:', lessonStudentRecords.length, 'records');

                  const { error: linkError } = await supabase
                    .from('lesson_students')
                    .insert(lessonStudentRecords);

                  if (linkError) {
                    console.error('❌ Student linking error:', linkError);
                    Alert.alert(
                      'Warning',
                      `${insertedLessons.length} lessons created but some students may not be linked. Error: ${linkError.message}`
                    );
                  } else {
                    console.log('✅ Students linked to recurring lessons');
                  }

                  // Refresh lessons in store
                  await lessonStore.fetchLessons();

                  // Success!
                  Alert.alert(
                    'Success! 🎉',
                    `Created ${insertedLessons.length} recurring lessons!`,
                    [{ text: 'OK', onPress: () => router.back() }]
                  );
                  
                  setLoading(false);
                } catch (err: any) {
                  console.error('Error saving recurring lessons:', err);
                  Alert.alert('Error', err.message || 'Something went wrong');
                  setLoading(false);
                }
              },
            },
          ]
        );
      } else {
        // SINGLE LESSON PATH
        
        // Get user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert('Error', 'Please log in');
          setLoading(false);
          return;
        }

        const singleLesson = {
          ...baseLesson,
          date: format(selectedDate, 'yyyy-MM-dd'),
          is_recurring: false,
          user_id: user.id, // Add user_id (also in baseLesson, but explicit for clarity)
        };

        // VERIFY: Check that user_id is present
        if (!singleLesson.user_id) {
          console.error('❌ CRITICAL: Single lesson is missing user_id!');
          Alert.alert('Error', 'Internal error: Missing user ID in lesson');
          setLoading(false);
          return;
        }
        console.log('✅ Verified: Single lesson has user_id:', singleLesson.user_id);

        const { data: lesson, error } = await supabase
          .from('lessons')
          .insert([singleLesson])
        .select()
        .single();

        if (error) {
          console.error('Error creating lesson:', error);
          Alert.alert('Error', 'Failed to create lesson');
          setLoading(false);
          return;
      }

      if (!lesson) {
          Alert.alert('Error', 'No lesson returned');
          setLoading(false);
          return;
      }

      console.log('✅ Lesson created:', lesson.id);

      // Set the lesson ID so PhotoUpload component can be used
      setCreatedLessonId(lesson.id);

        // Link ALL selected students (including the first one)
      const lessonStudentRecords = selectedStudents.map(studentId => ({
        lesson_id: lesson.id,
        student_id: studentId,
      }));

      console.log('Linking students:', lessonStudentRecords);

      const { data: linkedData, error: linkError } = await supabase
        .from('lesson_students')
        .insert(lessonStudentRecords)
        .select();

      if (linkError) {
        console.error('❌ Student linking error:', linkError);
        Alert.alert(
          'Warning',
          'Lesson created but some students may not be linked. Error: ' + linkError.message
        );
      } else {
        console.log('✅ Students linked:', linkedData?.length);
      }

        // Refresh lesson data
      await lessonStore.fetchLessons();

      Alert.alert('Success', 'Lesson created!', [
        { text: 'OK', onPress: () => router.back() },
      ]);

        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error creating lesson:', error);
      Alert.alert('Error', error.message || 'Something went wrong');
      setLoading(false);
    }
  };

  // Photo upload disabled for now
  // const loadLessonPhotos = async (lessonId: string) => {
  //   const { data, error } = await supabase
  //     .from('lesson_photos')
  //     .select('*')
  //     .eq('lesson_id', lessonId)
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

  const allStudents = students;
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

        {/* Student Multi-Select */}
        <View style={styles.section}>
          <Text style={styles.label}>Students *</Text>
          <Text style={styles.fieldDescription}>Select all students for this group activity</Text>
          
          <View style={styles.studentCheckboxList}>
            {allStudents.map(student => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.studentCheckbox,
                  selectedStudents.includes(student.id) && styles.studentCheckboxSelected
                ]}
                onPress={() => {
                  if (selectedStudents.includes(student.id)) {
                    setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                  } else {
                    setSelectedStudents([...selectedStudents, student.id]);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.checkboxLeft}>
                  <Avatar
                    type={student.avatar_type || 'initial'}
                    value={student.avatar_value}
                    name={student.name}
                    color={Colors.student[student.color_theme]}
                    size={40}
                  />
                  <View style={styles.studentCheckboxInfo}>
                    <Text style={styles.studentCheckboxName}>{student.name}</Text>
                    <Text style={styles.studentCheckboxGrade}>{student.grade}</Text>
                  </View>
                </View>
                
                <View style={[
                  styles.checkbox,
                  selectedStudents.includes(student.id) && styles.checkboxChecked
                ]}>
                  {selectedStudents.includes(student.id) && (
                    <Check size={16} color="white" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subject Selector */}
        {selectedStudents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Subject *</Text>
            {loadingSubjects ? (
              <View style={styles.loadingSubjects}>
                <Skeleton width="100%" height={40} borderRadius={8} />
                <Skeleton width="80%" height={40} borderRadius={8} style={{ marginTop: 8 }} />
              </View>
            ) : studentSubjects.length === 0 ? (
              <View style={styles.emptySubjectsContainer}>
                <Text style={styles.emptySubjectsText}>
                  Selected students have no subjects yet.{'\n'}
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
          <Text style={styles.label}>Lesson Title (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional - leave blank to auto-generate"
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
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <CalendarIcon size={20} color={Colors.brand[600]} />
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

        {/* Recurring Lesson Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.recurringToggle}
            onPress={() => setIsRecurring(!isRecurring)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, isRecurring && styles.checkboxChecked]}>
              {isRecurring && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.recurringLabel}>Make this a recurring lesson</Text>
          </TouchableOpacity>

          {isRecurring && (
            <View style={styles.recurringOptions}>
              {/* Pattern Selection */}
              <Text style={styles.recurringSubLabel}>Repeat:</Text>
              <View style={styles.patternButtons}>
                <TouchableOpacity
                  style={[
                    styles.patternButton,
                    recurrencePattern === 'daily' && styles.patternButtonActive
                  ]}
                  onPress={() => setRecurrencePattern('daily')}
                >
                  <Text style={[
                    styles.patternButtonText,
                    recurrencePattern === 'daily' && styles.patternButtonTextActive
                  ]}>
                    Every School Day
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.patternButton,
                    recurrencePattern === 'weekly' && styles.patternButtonActive
                  ]}
                  onPress={() => setRecurrencePattern('weekly')}
                >
                  <Text style={[
                    styles.patternButtonText,
                    recurrencePattern === 'weekly' && styles.patternButtonTextActive
                  ]}>
                    Once a Week
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.patternButton,
                    recurrencePattern === 'custom' && styles.patternButtonActive
                  ]}
                  onPress={() => setRecurrencePattern('custom')}
                >
                  <Text style={[
                    styles.patternButtonText,
                    recurrencePattern === 'custom' && styles.patternButtonTextActive
                  ]}>
                    Custom Days
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Weekly Day Selector */}
              {recurrencePattern === 'weekly' && (
                <View style={styles.daysSelector}>
                  <Text style={styles.recurringSubLabel}>Which day?</Text>
                  <View style={styles.weeklyDaysGrid}>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const dayLower = day.toLowerCase();
                      const isSelected = selectedWeeklyDay === dayLower;
                      
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.weeklyDayButton,
                            isSelected && styles.weeklyDayButtonActive
                          ]}
                          onPress={() => setSelectedWeeklyDay(dayLower)}
                        >
                          <Text style={[
                            styles.weeklyDayButtonText,
                            isSelected && styles.weeklyDayButtonTextActive
                          ]}>
                            Every {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Custom Days Selector */}
              {recurrencePattern === 'custom' && (
                <View style={styles.daysSelector}>
                  <Text style={styles.recurringSubLabel}>Select days:</Text>
                  <View style={styles.daysGrid}>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const isSelected = selectedDays.includes(day.toLowerCase());
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayButton,
                            isSelected && styles.dayButtonActive
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedDays(selectedDays.filter(d => d !== day.toLowerCase()));
                            } else {
                              setSelectedDays([...selectedDays, day.toLowerCase()]);
                            }
                          }}
                        >
                          <Text style={[
                            styles.dayButtonText,
                            isSelected && styles.dayButtonTextActive
                          ]}>
                            {day.substring(0, 3)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* End Date */}
              <View style={styles.endDateSection}>
                <Text style={styles.recurringSubLabel}>Repeat until:</Text>
                <TouchableOpacity
                  style={styles.endDateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <CalendarIcon size={18} color={Colors.brand[600]} />
                  <Text style={styles.endDateButtonText}>
                    {recurrenceEndDate 
                      ? format(recurrenceEndDate, 'MMM d, yyyy')
                      : 'Select end date'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showEndDatePicker && (
                <>
                  {Platform.OS === 'ios' ? (
                    <Modal
                      transparent={true}
                      animationType="slide"
                      visible={showEndDatePicker}
                      onRequestClose={() => setShowEndDatePicker(false)}
                    >
                      <Pressable 
                        style={styles.datePickerOverlay}
                        onPress={() => setShowEndDatePicker(false)}
                      >
                        <Pressable 
                          style={styles.datePickerContainer}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <View style={styles.datePickerHeader}>
                            <TouchableOpacity 
                              onPress={() => setShowEndDatePicker(false)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.datePickerCancel}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <Text style={styles.datePickerTitle}>End Date</Text>
                            
                            <TouchableOpacity 
                              onPress={() => setShowEndDatePicker(false)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.datePickerDone}>Done</Text>
                            </TouchableOpacity>
                          </View>
                          
                          <View style={{ backgroundColor: '#FFFFFF', paddingVertical: 20 }}>
                            <DateTimePicker
                              value={recurrenceEndDate || new Date()}
                              mode="date"
                              display="spinner"
                              onChange={(event, date) => {
                                if (date) {
                                  setRecurrenceEndDate(date);
                                }
                              }}
                              textColor="#000000"
                              accentColor={Colors.brand[500]}
                              themeVariant="light"
                              minimumDate={selectedDate}
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
                    <DateTimePicker
                      value={recurrenceEndDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        setShowEndDatePicker(false);
                        if (event.type === 'set' && date) {
                          setRecurrenceEndDate(date);
              }
            }}
                      minimumDate={selectedDate}
          />
        )}
                </>
              )}

              <Text style={styles.recurringHint}>
                💡 Recurring lessons will be created automatically
              </Text>
            </View>
          )}
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

        {/* Photos Section - Only show if lesson already exists */}
        {createdLessonId ? (
          <PhotoUpload
            lessonId={createdLessonId}
            photos={photos}
            onPhotosChange={setPhotos}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>
              💡 Save the lesson first to add photos
            </Text>
          </View>
        )}

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
  fieldDescription: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginBottom: 8,
  },
  studentCheckboxList: {
    gap: 12,
  },
  studentCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.ui.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  studentCheckboxSelected: {
    borderColor: Colors.brand[400],
    backgroundColor: Colors.brand[50],
  },
  checkboxLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  studentCheckboxInfo: {
    flex: 1,
  },
  studentCheckboxName: {
    ...Typography.label,
    marginBottom: 2,
  },
  studentCheckboxGrade: {
    ...Typography.caption,
    color: Colors.ui.textLight,
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
  loadingSubjects: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
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
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  dateButtonText: {
    ...Typography.body,
    color: Colors.brand[700],
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    justifyContent: 'center',
    alignItems: 'center',
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
  photoPlaceholder: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  photoPlaceholderText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    textAlign: 'center',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recurringLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    marginLeft: 12,
  },
  recurringOptions: {
    backgroundColor: Colors.brand[50],
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  recurringSubLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  patternButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  patternButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
  },
  patternButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  patternButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  patternButtonTextActive: {
    color: 'white',
  },
  daysSelector: {
    marginBottom: 16,
  },
  weeklyDaysGrid: {
    gap: 8,
  },
  weeklyDayButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    marginBottom: 8,
    alignItems: 'center',
  },
  weeklyDayButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  weeklyDayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  weeklyDayButtonTextActive: {
    color: 'white',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    minWidth: 50,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  dayButtonTextActive: {
    color: 'white',
  },
  endDateSection: {
    marginBottom: 16,
  },
  endDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  endDateButtonText: {
    fontSize: 15,
    color: Colors.ui.text,
    flex: 1,
  },
  recurringHint: {
    fontSize: 13,
    color: Colors.brand[700],
    fontStyle: 'italic',
    textAlign: 'center',
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

