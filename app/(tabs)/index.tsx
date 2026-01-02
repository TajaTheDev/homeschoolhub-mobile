/**
 * Main Dashboard Screen
 */

import WeeklySummaryCard from '@/components/dashboard/WeeklySummaryCard';
import Avatar from '@/components/ui/Avatar';
import DatePicker from '@/components/ui/DatePicker';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { Lesson, Student } from '@/types';
import { getGradeDisplay } from '@/utils/gradeHelpers';
// import { LessonPhoto } from '@/types/database';
import PhotoGalleryModal from '@/components/lessons/PhotoGalleryModal';
import { useFocusEffect } from '@react-navigation/native';
import { addDays, format, subDays } from 'date-fns';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, Edit2, Plus, Settings, TrendingUp, Users } from 'lucide-react-native';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get photo URL from storage
const getPhotoUrl = (path: string): string => {
  if (!path) return '';
  
  try {
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }
    if (cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    if (!cleanPath) return '';
    
    const result = supabase.storage
      .from('lesson-photos')
      .getPublicUrl(cleanPath);
    
    if (!result || !result.data) {
      console.warn('Failed to get photo URL for:', cleanPath);
      return '';
    }
    
    return result.data.publicUrl || '';
  } catch (error) {
    console.error('Error getting photo URL:', error);
    return '';
  }
};

import AttendanceModal from '@/components/attendance/AttendanceModal';

// Lazy load modals - only load when needed
const WeeklySummaryModal = lazy(() => import('@/components/dashboard/WeeklySummaryModal'));
const LessonModal = lazy(() => import('@/components/lessons/LessonModal'));
const EditSubjectsModal = lazy(() => import('@/components/students/EditSubjectsModal'));
const StudentModal = lazy(() => import('@/components/students/StudentModal'));
const StudentSummaryModal = lazy(() => import('@/components/students/StudentSummaryModal'));

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
};

// Photo upload disabled for now
// const getPhotoUrl = (path: string) => {
//   if (!path) return '';
//   
//   const { data } = supabase.storage
//     .from('student-avatars')
//     .getPublicUrl(path);
//   
//   return data.publicUrl;
// };

// Animated Card Component with scale animation
const AnimatedCard = ({ children, onPress, style }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const { hasSubscription, isLoading } = useSubscription();
  const { students, fetchStudents, deleteStudent, subjects, fetchSubjects, loading: studentsLoading } = useStudentStore();
  const lessonStore = useLessonStore();
  const { lessons, fetchLessons, toggleCompleteOptimistic } = lessonStore;
  const { user, signOut } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState<Student | null>(null);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showWeeklySummaryModal, setShowWeeklySummaryModal] = useState(false);
  const [showStudentSummary, setShowStudentSummary] = useState(false);
  const [selectedStudentForSummary, setSelectedStudentForSummary] = useState<Student | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);
  const [parentAvatar, setParentAvatar] = useState<{
    type: 'initial' | 'photo' | 'illustration';
    value?: string | null;
    name: string;
  }>({
    type: 'initial',
    value: null,
    name: '',
  });
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  // Photo gallery state
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const { hasAttendanceForDate } = useAttendanceStore();

  useEffect(() => {
    // Wait for subscription check to complete
    if (!isLoading) {
      if (!hasSubscription) {
        // No active subscription, redirect to subscribe screen
        router.replace('/subscribe' as any);
      }
    }
  }, [hasSubscription, isLoading, router]);

  useEffect(() => {
    const loadData = async () => {
      // Show skeletons immediately, no loading state check
      await Promise.all([
        fetchStudents(),
        fetchLessons(),
        loadParentData(),
      ]);
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check onboarding status after successful login
  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      
      if (!hasCompletedOnboarding) {
        // First time after sign up - show onboarding
        router.push('/onboarding' as any);
      }
    } catch (error) {
      console.error('Error checking onboarding:', error);
    }
  };

  // Fade in content when data loads
  useEffect(() => {
    if (students.length > 0 || lessons.length > 0) {
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [students.length, lessons.length, contentFadeAnim]);

  const loadParentData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const metadata = user.user_metadata || {};
      setParentAvatar({
        type: metadata.avatar_type || 'initial',
        value: metadata.avatar_value || null,
        name: metadata.display_name || user.email?.split('@')[0] || 'Parent',
      });
    }
  };

  // Reload parent data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadParentData();
    }, [])
  );

  // Fetch subjects when students are loaded
  useEffect(() => {
    if (students.length > 0) {
      console.log('Fetching subjects for', students.length, 'students');
      fetchSubjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students.length]);

  // Debug: Log modal state changes
  // useEffect(() => {
  //   console.log('Modal state changed - showEditModal:', showEditModal, 'selectedStudent:', selectedStudent?.name || 'null');
  // }, [showEditModal, selectedStudent]);

  // Debug: Log subjects modal state changes
  // useEffect(() => {
  //   console.log('showSubjectsModal changed:', showSubjectsModal);
  //   console.log('selectedStudentForSubjects:', selectedStudentForSubjects?.name || 'null');
  // }, [showSubjectsModal, selectedStudentForSubjects]);

  // Debug: Log when subjects are updated
  // useEffect(() => {
  //   console.log('Subjects updated in store. Total subjects:', subjects.length);
  //   students.forEach((student) => {
  //     const count = subjects.filter((s) => s.student_id === student.id).length;
  //     console.log(`  - ${student.name}: ${count} subjects`);
  //   });
  // }, [subjects, students]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/welcome');
  };

  const handleEditStudent = (student: Student) => {
    console.log('Edit button tapped for student:', student.name, student.id);
    setSelectedStudent(student);
    setShowEditModal(true);
    console.log('Modal state updated - showEditModal:', true, 'selectedStudent:', student.name);
  };

  const handleCloseModal = () => {
    console.log('Closing edit modal');
    setShowEditModal(false);
    setSelectedStudent(null);
  };

  const handleSaveStudent = async () => {
    console.log('Saving student changes, refreshing list');
    await fetchStudents();
    await fetchSubjects();
    setShowEditModal(false);
    setSelectedStudent(null);
  };

  const handleEditSubjects = (student: Student) => {
    console.log('SUBJECTS BUTTON TAPPED for:', student.name, student.id);
    console.log('Setting showSubjectsModal to true');
    setSelectedStudentForSubjects(student);
    setShowSubjectsModal(true);
    console.log('State updated - showSubjectsModal: true, selectedStudentForSubjects:', student.name);
  };

  const handleCloseSubjectsModal = () => {
    console.log('Closing subjects modal');
    setShowSubjectsModal(false);
    setSelectedStudentForSubjects(null);
  };

  const handleSaveSubjects = async () => {
    console.log('Saving subjects, refreshing list');
    await fetchSubjects();
    setShowSubjectsModal(false);
    setSelectedStudentForSubjects(null);
  };

  // Helper to get subject count for a student
  const getSubjectCount = (studentId: string) => {
    return subjects.filter((s) => s.student_id === studentId).length;
  };

  // Weekly stats calculations
  const weeklyStats = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const thisWeekLessons = lessons.filter(
      (l) => new Date(l.date) >= weekAgo
    );
    
    const completedThisWeek = thisWeekLessons.filter((l) => l.completed).length;
    const completionRate = thisWeekLessons.length > 0
      ? Math.round((completedThisWeek / thisWeekLessons.length) * 100)
      : 0;
    
    // Calculate streak (consecutive days with completed lessons)
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const hasLesson = lessons.some((l) => l.date === dateStr && l.completed);
      if (hasLesson) {
        streak++;
      } else {
        break;
      }
    }
    
    return {
      thisWeekCount: thisWeekLessons.length,
      completionRate,
      streak,
    };
  }, [lessons]);

  // Filter lessons for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateLessons = useMemo(() => {
    const filtered = lessons.filter(l => l.date === selectedDateStr);
    
    console.log('=== TODAY LESSONS DEBUG ===');
    console.log('Selected date:', selectedDateStr);
    console.log('Total lessons in store:', lessons.length);
    console.log('Filtered lessons:', filtered.length);
    console.log('First 3 lessons:', lessons.slice(0, 3).map(l => ({
      id: l.id,
      date: l.date,
      title: l.title,
      students: l.students?.length
    })));
    console.log('Filtered lessons details:', filtered.map(l => ({
      id: l.id,
      title: l.title,
      date: l.date,
      students: l.students?.map((s: any) => s.name || s.id)
    })));
    console.log('=========================');
    
    return filtered;
  }, [lessons, selectedDateStr]);

  // Generate dynamic section title based on selected date
  const getLessonSectionTitle = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    if (selectedDateStr === today) {
      return "Today's Lessons";
    } else if (selectedDateStr === yesterday) {
      return "Yesterday's Lessons";
    } else if (selectedDateStr === tomorrow) {
      return "Tomorrow's Lessons";
    } else if (new Date(selectedDateStr) < new Date(today)) {
      return "Past Lessons";
    } else {
      return "Future Lessons";
    }
  };

  // Get unique lesson dates for date picker indicators
  const lessonDates = useMemo(() => {
    return [...new Set(lessons.map((l) => l.date))];
  }, [lessons]);

  const handleDeleteStudent = (student: Student) => {
    Alert.alert(
      'Delete Student',
      `Delete ${student.name}? This will delete all their lessons.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteStudent(student.id);
            if (result.success) {
              await fetchStudents();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  const triggerConfetti = () => {
    setShowConfetti(true);
    
    // Trigger confetti with slight delay
    setTimeout(() => {
      if (confettiRef.current) {
        confettiRef.current.start();
      }
    }, 100);
    
    // Hide confetti after animation
    setTimeout(() => {
      setShowConfetti(false);
    }, 2500);
  };

  const handleLessonComplete = (lessonId: string, isCurrentlyComplete: boolean) => {
    const newStatus = !isCurrentlyComplete;
    
    // Show confetti if marking complete
    if (newStatus) {
      triggerConfetti();
    }
    
    // Call the optimistic toggle (updates UI instantly, database in background)
    lessonStore.toggleCompleteOptimistic(lessonId);
  };

  // Student Cards Skeleton
  const StudentCardSkeleton = () => (
    <View style={styles.studentCard}>
      <View style={styles.studentCardContent}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <View style={styles.studentCardRight}>
          <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginBottom: 12 }} />
          <View style={styles.studentCardStats}>
            <Skeleton width={90} height={32} borderRadius={10} />
            <Skeleton width={70} height={32} borderRadius={10} />
            <Skeleton width={70} height={32} borderRadius={10} />
          </View>
        </View>
      </View>
    </View>
  );

  // Lesson Card Skeleton
  const LessonCardSkeleton = () => (
    <View style={styles.lessonCard}>
      <View style={styles.lessonHeader}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={60} height={24} borderRadius={12} />
          <Skeleton width={80} height={24} borderRadius={12} />
        </View>
      </View>
      <Skeleton width="80%" height={18} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={14} />
    </View>
  );

  // Weekly Summary Card Skeleton
  const WeeklySummaryCardSkeleton = () => (
    <View style={[styles.lessonCard, { marginBottom: 24 }]}>
      <Skeleton width={120} height={20} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Skeleton width={56} height={56} borderRadius={28} style={{ marginBottom: 10 }} />
          <Skeleton width={40} height={20} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={14} />
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Skeleton width={56} height={56} borderRadius={28} style={{ marginBottom: 10 }} />
          <Skeleton width={40} height={20} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={14} />
        </View>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Skeleton width={56} height={56} borderRadius={28} style={{ marginBottom: 10 }} />
          <Skeleton width={40} height={20} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={14} />
        </View>
      </View>
    </View>
  );

  // Show loading while checking
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand[500]} />
        <Text style={styles.loadingText}>Checking subscription...</Text>
      </View>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={['top']}>
        {showConfetti && (
          <View style={styles.confettiContainer}>
            <ConfettiCannon
              ref={confettiRef}
              count={40}
              origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
              autoStart={false}
              fadeOut={true}
              explosionSpeed={350}
              fallSpeed={2000}
              colors={['#7C3AED', '#F97316', '#10B981', '#F59E0B', '#EC4899', '#3B82F6']}
            />
          </View>
        )}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            {/* Left: Parent Avatar + Greeting */}
            <TouchableOpacity 
              style={styles.headerLeft}
              onPress={() => router.push('/settings/profile' as any)}
              activeOpacity={0.7}
            >
              <Avatar
                type={parentAvatar.type}
                value={parentAvatar.value}
                name={parentAvatar.name}
                color={Colors.brand[400]}
                size={44}
              />
              <View style={styles.greetingContainer}>
                <Text style={styles.greetingText}>Hello, {parentAvatar.name.split(' ')[0]}</Text>
                <Text style={styles.dateText}>{format(new Date(), 'EEEE, dd MMM')}</Text>
              </View>
            </TouchableOpacity>

            {/* Attendance Section */}
            <View style={styles.attendanceSection}>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  hasAttendanceForDate(format(new Date(), 'yyyy-MM-dd')) && styles.attendanceButtonTaken
                ]}
                onPress={() => setShowAttendanceModal(true)}
                activeOpacity={0.7}
              >
                {hasAttendanceForDate(format(new Date(), 'yyyy-MM-dd')) ? (
                  <>
                    <Text style={styles.attendanceButtonIcon}>✓</Text>
                    <Text style={styles.attendanceButtonText}>Attendance Taken</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.attendanceButtonIcon}>📋</Text>
                    <Text style={styles.attendanceButtonText}>Take Attendance</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => router.push('/attendance-history' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.historyButtonText}>View History →</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Right: Settings Gear */}
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => router.push('/settings' as any)}
            activeOpacity={0.7}
          >
            <Settings size={24} color={Colors.ui.text} />
          </TouchableOpacity>
        </View>

        {/* Horizontal Date Picker */}
        <DatePicker
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          lessonDates={lessonDates}
        />

        {/* Weekly Summary Card */}
        {weeklyStats.thisWeekCount === 0 && lessons.length === 0 ? (
          <WeeklySummaryCardSkeleton />
        ) : (
          <Animated.View style={{ opacity: contentFadeAnim }}>
            <WeeklySummaryCard
              thisWeekCount={weeklyStats.thisWeekCount}
              completionRate={weeklyStats.completionRate}
              streak={weeklyStats.streak}
              onPress={() => setShowWeeklySummaryModal(true)}
            />
          </Animated.View>
        )}

        {/* Dynamic Lessons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{getLessonSectionTitle()}</Text>
          
          {selectedDateLessons.length === 0 && lessons.length === 0 ? (
            <>
              <LessonCardSkeleton />
              <LessonCardSkeleton />
            </>
          ) : selectedDateLessons.length === 0 ? (
            <Animated.View style={{ opacity: contentFadeAnim }}>
              <EmptyState
                icon={BookOpen}
                title={`No Lessons ${selectedDateStr === format(new Date(), 'yyyy-MM-dd') ? 'Today' : 'on This Day'}`}
                description="Add a lesson to get started!"
              />
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: contentFadeAnim }}>
              {selectedDateLessons.map((lesson, index) => {
              // Get subject color
              const subjectColor = getSubjectColor(lesson.subject);
              
              return (
                <AnimatedCard
                  key={lesson.id}
                  style={[
                    styles.lessonCard,
                    { borderLeftColor: subjectColor }
                  ]}
                  onPress={() => {
                    setSelectedLesson(lesson);
                    setShowLessonModal(true);
                  }}
                >
                  <View style={styles.lessonHeader}>
                    <View style={styles.lessonHeaderLeft}>
                      {/* Subject Pill */}
                      <View
                        style={[
                          styles.subjectPill,
                          { backgroundColor: subjectColor }
                        ]}
                      >
                        <Text style={styles.subjectPillText}>{lesson.subject}</Text>
                      </View>
                    </View>
                    
                    {/* Completion Checkbox + Status */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLessonComplete(lesson.id, lesson.completed);
                      }}
                      style={styles.completionRow}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox */}
                      <View style={[
                        styles.checkbox,
                        lesson.completed && styles.checkboxChecked
                      ]}>
                        {lesson.completed && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      
                      {/* Status Text */}
                      <Text style={[
                        styles.statusText,
                        lesson.completed && styles.statusTextComplete
                      ]}>
                        {lesson.completed ? 'Done' : 'Todo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  
                  {/* Grade Badge */}
                  {(() => {
                    const gradeDisplay = getGradeDisplay(
                      lesson.grade_type,
                      lesson.grade_value,
                      lesson.grade_max_points
                    );
                    
                    if (gradeDisplay) {
                      return (
                        <View style={[
                          styles.gradeBadge,
                          { backgroundColor: gradeDisplay.backgroundColor }
                        ]}>
                          <Text style={[
                            styles.gradeBadgeText,
                            { color: gradeDisplay.color }
                          ]}>
                            {gradeDisplay.display}
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Multiple Student Avatars */}
                  {lesson.students && lesson.students.length > 0 && (
                    <View style={styles.lessonStudents}>
                      <View style={styles.avatarStack}>
                        {lesson.students.slice(0, 3).map((student: any, index: number) => {
                          const colorTheme = student.color_theme || 'purple';
                          const studentColor = Colors.student[colorTheme as keyof typeof Colors.student] || Colors.student.purple;
                          return (
                            <View
                              key={student.id}
                              style={[
                                styles.avatarStackItem,
                                { marginLeft: index > 0 ? -12 : 0, zIndex: (lesson.students?.length || 0) - index }
                              ]}
                            >
                              <Avatar
                                type={student.avatar_type || 'initial'}
                                value={student.avatar_value}
                                name={student.name || 'Student'}
                                color={studentColor}
                                size={28}
                              />
                            </View>
                          );
                        })}
                      </View>
                      <Text style={styles.lessonStudentNames}>
                        {lesson.students.length === 1
                          ? lesson.students[0]?.name || 'Student'
                          : lesson.students.length === 2
                          ? `${lesson.students[0]?.name || 'Student'} & ${lesson.students[1]?.name || 'Student'}`
                          : `${lesson.students.slice(0, 2).map((s: any) => s.name || 'Student').join(', ')} +${lesson.students.length - 2}`
                        }
                      </Text>
                    </View>
                  )}
                  
                  {lesson.notes && (
                    <Text style={styles.lessonNotes} numberOfLines={2}>
                      {lesson.notes}
                    </Text>
                  )}

                  {/* Photo Thumbnails - CLICKABLE */}
                  {lesson.photos && lesson.photos.length > 0 && (
                    <TouchableOpacity
                      style={styles.lessonPhotos}
                      onPress={(e) => {
                        e.stopPropagation();
                        setGalleryPhotos(lesson.photos || []);
                        setGalleryStartIndex(0);
                        setShowPhotoGallery(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.photoThumbnails}>
                        {lesson.photos.slice(0, 3).map((photo, index) => {
                          const photoUrl = getPhotoUrl(photo.storage_path);
                          if (!photoUrl) return null;
                          
                          return (
                            <Image
                              key={photo.id}
                              source={{ uri: photoUrl }}
                              style={[
                                styles.photoThumbnail,
                                { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index }
                              ]}
                              contentFit="cover"
                              transition={200}
                              cachePolicy="memory-disk"
                              onError={() => {
                                console.warn('Failed to load photo thumbnail:', photo.storage_path);
                              }}
                            />
                          );
                        })}
                      </View>
                      {lesson.photos.length > 3 && (
                        <Text style={styles.photoCount}>+{lesson.photos.length - 3}</Text>
                      )}
                      {/* Visual hint that it's tappable */}
                      <Text style={styles.viewPhotosHint}>Tap to view</Text>
                    </TouchableOpacity>
                  )}
                  
                  <Text style={styles.lessonDate}>
                    {formatDate(lesson.date)}
                  </Text>
                </AnimatedCard>
              );
            })}
            </Animated.View>
          )}
        </View>

        {/* Add Lesson Button */}
        <View style={styles.addLessonSection}>
          <TouchableOpacity
            style={styles.addLessonButton}
            onPress={() => {
              if (students.length === 0) {
                Alert.alert('No Students', 'Add a student first!');
                return;
              }
              // Navigate to add lesson for first student or show student picker
              if (students.length === 1) {
                router.push(`/add-lesson` as any);
              } else {
                // Show student picker modal or navigate to first student
                router.push(`/add-lesson` as any);
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.addLessonButtonContent}>
              <View style={styles.addLessonIconCircle}>
                <Plus size={24} color="white" />
              </View>
              <View style={styles.addLessonText}>
                <Text style={styles.addLessonTitle}>Add Lesson</Text>
                <Text style={styles.addLessonDescription}>Log a new lesson for today</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Your Students Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.h3, { marginBottom: 16 }]}>Your Students</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/add-student' as any)}
              activeOpacity={0.7}
            >
              <Plus size={20} color={Colors.brand[600]} />
            </TouchableOpacity>
          </View>
          {students.length === 0 && lessonStore.loading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.studentsContainer}
              contentContainerStyle={styles.studentsContainerContent}
            >
              <StudentCardSkeleton />
              <StudentCardSkeleton />
            </ScrollView>
          ) : students.length === 0 ? (
            <Animated.View style={{ opacity: contentFadeAnim }}>
              <EmptyState
                icon={Users}
                title="No Students Yet"
                description="Add your first student to start tracking their homeschool progress!"
                actionText="Add Student"
                onAction={() => setShowStudentForm(true)}
              />
            </Animated.View>
          ) : (
            <Animated.View style={{ opacity: contentFadeAnim }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.studentsContainer}
                contentContainerStyle={styles.studentsContainerContent}
              >
                {students.map((student) => (
                <AnimatedCard
                  key={student.id}
                  style={[
                    styles.studentCard,
                    { borderLeftColor: Colors.student[student.color_theme] },
                  ]}
                  onPress={() => {
                    // Placeholder for student details
                    console.log('Student tapped:', student.name);
                  }}
                >
                  <View style={styles.studentCardContent}>
                    {/* Left: Avatar (NOT clickable) */}
                    <Avatar
                      type={student.avatar_type || 'initial'}
                      value={student.avatar_value}
                      name={student.name}
                      color={Colors.student[student.color_theme]}
                      size={80}
                    />
                    
                    {/* Right: Info */}
                    <View style={styles.studentCardRight}>
                      <View style={styles.studentCardHeader}>
                        <View style={styles.studentCardNameSection}>
                          <Text style={styles.studentCardName}>{student.name}</Text>
                          <Text style={styles.studentCardGrade}>{student.grade}</Text>
                        </View>
                        
                        {/* Edit Button */}
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEditStudent(student);
                          }}
                          activeOpacity={0.7}
                        >
                          <Edit2 size={16} color={Colors.brand[600]} />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Stats Row */}
                      <View style={styles.studentCardStats}>
                        {/* Subjects Count with Edit */}
                        <TouchableOpacity
                          style={styles.statPill}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEditSubjects(student);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.statPillNumber}>
                            {getSubjectCount(student.id)}
                          </Text>
                          <Text style={styles.statPillLabel}>Subjects</Text>
                          <Edit2 size={12} color={Colors.brand[500]} />
                        </TouchableOpacity>
                        
                        {/* Today's Lessons */}
                        <View style={styles.statPill}>
                          <Text style={styles.statPillNumber}>
                            {lessonStore.lessons.filter(
                              l => l.student_id === student.id && 
                              l.date === format(new Date(), 'yyyy-MM-dd')
                            ).length}
                          </Text>
                          <Text style={styles.statPillLabel}>Today</Text>
                        </View>
                        
                        {/* Total Completed */}
                        <View style={styles.statPill}>
                          <Text style={styles.statPillNumber}>
                            {lessonStore.lessons.filter(
                              l => l.student_id === student.id && l.completed
                            ).length}
                          </Text>
                          <Text style={styles.statPillLabel}>Done</Text>
                        </View>
                      </View>
                      
                      {/* Action Buttons */}
                      <View style={styles.studentActionButtons}>
                        <TouchableOpacity
                          style={styles.studentActionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/grade-trends?studentId=${student.id}` as any);
                          }}
                          activeOpacity={0.7}
                        >
                          <TrendingUp size={18} color={Colors.brand[600]} />
                          <Text style={styles.studentActionText}>Grades</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Student Summary Button */}
                  <TouchableOpacity
                    style={styles.studentSummaryButton}
                    onPress={() => {
                      setSelectedStudentForSummary(student);
                      setShowStudentSummary(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.studentSummaryButtonText}>Student Summary</Text>
                  </TouchableOpacity>
                </AnimatedCard>
              ))}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        visible={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        photos={galleryPhotos}
        initialIndex={galleryStartIndex}
      />

      {/* Student Edit Modal - Outside ScrollView for proper rendering */}
      <Suspense fallback={<View />}>
        <StudentModal
          visible={showEditModal || showStudentForm}
          student={showStudentForm ? null : selectedStudent}
          onClose={() => {
            if (showStudentForm) {
              setShowStudentForm(false);
            } else {
              handleCloseModal();
            }
          }}
          onSave={async () => {
            await handleSaveStudent();
            setShowStudentForm(false);
          }}
        />
      </Suspense>

      {/* Edit Subjects Modal */}
      <Suspense fallback={<View />}>
        <EditSubjectsModal
          visible={showSubjectsModal}
          student={selectedStudentForSubjects}
          onClose={handleCloseSubjectsModal}
          onSave={handleSaveSubjects}
        />
      </Suspense>

      {/* Lesson Edit Modal */}
      <Suspense fallback={<View />}>
        <LessonModal
          visible={showLessonModal}
          lesson={selectedLesson}
          onClose={() => {
            setShowLessonModal(false);
            setSelectedLesson(null);
          }}
          onSave={() => {
            fetchLessons();
            setShowLessonModal(false);
            setSelectedLesson(null);
          }}
        />
      </Suspense>

      {/* Weekly Summary Modal */}
      <Suspense fallback={<View />}>
        <WeeklySummaryModal
          visible={showWeeklySummaryModal}
          onClose={() => setShowWeeklySummaryModal(false)}
          students={students}
          lessons={lessons}
        />
      </Suspense>

      {/* Student Summary Modal */}
      <Suspense fallback={<View />}>
        <StudentSummaryModal
          visible={showStudentSummary}
          onClose={() => {
            setShowStudentSummary(false);
            setSelectedStudentForSummary(null);
          }}
          student={selectedStudentForSummary}
          lessons={lessons}
        />
      </Suspense>

      {/* Attendance Modal */}
      <AttendanceModal
        visible={showAttendanceModal}
        date={new Date()} // Today's date
        onClose={() => setShowAttendanceModal(false)}
        onSave={() => {
          // Refresh attendance data
          useAttendanceStore.getState().fetchAttendance();
          setShowAttendanceModal(false);
        }}
      />

      {/* Photo Gallery Modal - Disabled for now */}
      {/* <PhotoGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        photos={galleryPhotos}
        initialIndex={galleryIndex}
      /> */}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    position: 'relative', // Add this for confetti positioning
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999, // For Android
    pointerEvents: 'none', // Allow touches to pass through
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: Colors.background.card,
    marginBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  attendanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  attendanceButtonTaken: {
    backgroundColor: '#10B981', // Green when taken
  },
  attendanceButtonIcon: {
    fontSize: 18,
  },
  attendanceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  attendanceSection: {
    gap: 8,
  },
  historyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    alignItems: 'center',
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    ...Typography.label,
    fontSize: 15,
    color: Colors.ui.text,
    marginBottom: 2,
  },
  dateText: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.ui.background,
  },
  section: {
    marginBottom: 32,
  },
  quickActionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  quickActionButton: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
    marginTop: 4,
  },
  viewAllText: {
    ...Typography.caption,
    color: Colors.brand[400],
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.brand[900],
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  addStudentButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  addStudentButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  studentsContainer: {
    marginBottom: 16,
  },
  studentsContainerContent: {
    paddingRight: 20,
  },
  studentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 16,
    marginRight: 16,
    width: 280,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  studentCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  studentCardRight: {
    flex: 1,
  },
  studentActionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  studentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.brand[50],
  },
  studentActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  studentSummaryButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  studentSummaryButtonText: {
    ...Typography.button,
    fontSize: 14,
    color: 'white',
  },
  studentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentCardNameSection: {
    flex: 1,
  },
  studentCardName: {
    ...Typography.h4,
    fontSize: 17,
    marginBottom: 2,
  },
  studentCardGrade: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    fontSize: 13,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brand[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentCardStats: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statPill: {
    backgroundColor: Colors.ui.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPillNumber: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    color: Colors.brand[600],
  },
  statPillLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.ui.textLight,
    marginRight: 2,
  },
  lessonCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  studentNameText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  subjectPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: 'white',
  },
  lessonTitle: {
    ...Typography.body,
    marginBottom: 4,
  },
  lessonDate: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  gradeBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  gradeBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  lessonNotes: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  lessonPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  lessonStudents: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarStackItem: {
    borderWidth: 2,
    borderColor: Colors.background.card,
    borderRadius: 14,
  },
  lessonStudentNames: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    flex: 1,
  },
  photoThumbnails: {
    flexDirection: 'row',
  },
  photoThumbnail: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.ui.border,
    borderWidth: 2,
    borderColor: Colors.background.card,
  },
  photoCount: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.ui.textLight,
    marginLeft: 4,
  },
  viewPhotosHint: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.ui.textLight,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background.light,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6, // Slightly rounded square
    borderWidth: 2,
    borderColor: Colors.ui.border,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent[400],
    borderColor: Colors.accent[400],
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  statusTextComplete: {
    color: Colors.accent[600],
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  addLessonSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  addLessonButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addLessonButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addLessonIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addLessonText: {
    flex: 1,
  },
  addLessonTitle: {
    ...Typography.h4,
    color: 'white',
    marginBottom: 2,
  },
  addLessonDescription: {
    ...Typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
