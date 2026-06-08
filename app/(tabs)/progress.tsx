/**
 * Progress Tracking Screen
 * Shows lesson completion rates, subject breakdown, goals, and recent activity
 */

import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import * as notificationService from '@/services/notificationService';
import { useLessonStore } from '@/store/lessonStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useBreakStore } from '@/store/breakStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson, StudentSubject } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { useRouter } from 'expo-router';
import { BarChart3, BookMarked, Calendar, Edit2, TrendingUp, X } from 'lucide-react-native';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Lazy load modals - only load when needed
const EditGoalModal = lazy(() => import('@/components/lessons/EditGoalModal'));
const LessonsDetailModal = lazy(() => import('@/components/progress/LessonsDetailModal'));
const EditSubjectsModal = lazy(() => import('@/components/students/EditSubjectsModal'));

// Helper functions
const getLessonsForStudent = (lessons: Lesson[], studentId: string) => {
  return lessons.filter((l) => {
    // Check if this student is in the lesson's students array (many-to-many)
    if (l.students && l.students.length > 0) {
      return l.students.some((s: any) => s.id === studentId);
    }
    // Fallback to student_id for backward compatibility
    return l.student_id === studentId;
  });
};

const getCompletedLessons = (lessons: Lesson[]) => {
  return lessons.filter((l) => l.completed);
};

const getLessonsBySubject = (lessons: Lesson[]) => {
  const bySubject: Record<string, Lesson[]> = {};
  lessons.forEach((lesson) => {
    if (!bySubject[lesson.subject]) {
      bySubject[lesson.subject] = [];
    }
    bySubject[lesson.subject].push(lesson);
  });
  return bySubject;
};

const getLessonsThisWeek = (lessons: Lesson[]) => {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return lessons.filter((l) => new Date(l.date) >= weekAgo);
};

const getLastSevenDays = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date);
  }
  return days;
};

const getLessonsForDate = (date: Date, lessons: Lesson[]) => {
  const dateStr = date.toISOString().split('T')[0];
  return lessons.filter((l) => l.date === dateStr);
};

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
  });
};


const getSubjectEmoji = (subject: string): string => {
  const emojis: Record<string, string> = {
    'Math': '🔢',
    'Reading': '📖',
    'Science': '🔬',
    'History': '🏛️',
    'Writing': '✍️',
    'Art': '🎨',
  };
  return emojis[subject] || '📚';
};

const calculateStreak = (
  lessons: Lesson[],
  selectedStudentId: string,
  getSchoolDays: () => number[],
  isBreakDay: (date: Date) => boolean
): number => {
  // Filter for completed lessons only
  const completedLessons = lessons.filter(l => l.completed);
  if (completedLessons.length === 0) return 0;
  
  // Calculate streak (consecutive SCHOOL days with completed lessons)
  const schoolDays = getSchoolDays(); // e.g., [1,2,3,4,5] for Mon-Fri
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);

  for (let i = 0; i < 90; i++) { // Check up to 90 days back
    const dayOfWeek = checkDate.getDay(); // 0=Sunday, 6=Saturday
    
    // Skip if not a school day
    if (!schoolDays.includes(dayOfWeek)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }
    
    // Skip if it's a break day
    if (isBreakDay(checkDate)) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    }
    
    // Check if this school day has completed lessons
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    const hasCompletedLesson = completedLessons.some(
      l => {
        // Check if student is in lesson's students array
        const isStudentInLesson = l.students?.some((s: any) => s.id === selectedStudentId) || l.student_id === selectedStudentId;
        return isStudentInLesson && l.date === dateStr && l.completed;
      }
    );
    
    if (hasCompletedLesson) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Streak broken - stop counting
      break;
    }
  }
  
  return streak;
};

const getMostProductiveDay = (lessons: Lesson[]): { day: string; count: number } | null => {
  if (lessons.length === 0) return null;
  
  const dayCounts: Record<string, number> = {};
  lessons.forEach(lesson => {
    const date = new Date(lesson.date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
  });
  
  let maxDay = '';
  let maxCount = 0;
  Object.entries(dayCounts).forEach(([day, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxDay = day;
    }
  });
  
  return maxCount > 0 ? { day: maxDay, count: maxCount } : null;
};

const getStrongestSubject = (lessons: Lesson[], subjects: StudentSubject[]): { subject: string; rate: number } | null => {
  if (lessons.length === 0 || subjects.length === 0) return null;
  
  const bySubject = getLessonsBySubject(lessons);
  let strongestSubject: string | null = null;
  let strongestRate = 0;
  
  Object.entries(bySubject).forEach(([subject, subjectLessons]) => {
    if (subjectLessons.length === 0) return;
    const completed = subjectLessons.filter(l => l.completed).length;
    const rate = (completed / subjectLessons.length) * 100;
    
    if (rate > strongestRate) {
      strongestRate = rate;
      strongestSubject = subject;
    }
  });
  
  if (strongestSubject !== null && strongestRate >= 80) {
    return { subject: strongestSubject, rate: strongestRate };
  }
  return null;
};

const getInsight = (
  studentLessons: Lesson[],
  subjects: StudentSubject[],
  lessonsBySubject: Record<string, Lesson[]>,
  selectedStudentId: string,
  getSchoolDays: () => number[],
  isBreakDay: (date: Date) => boolean
): string => {
  if (studentLessons.length === 0) {
    return 'Keep logging lessons to see insights!';
  }
  
  // Calculate streak
  const streak = calculateStreak(studentLessons, selectedStudentId, getSchoolDays, isBreakDay);
  if (streak >= 3) {
    return `🔥 ${streak} school day streak! Keep it up!`;
  }
  
  // Check weekly completion rate
  const thisWeek = getLessonsThisWeek(studentLessons);
  if (thisWeek.length > 0) {
    const weeklyRate = (getCompletedLessons(thisWeek).length / thisWeek.length) * 100;
    if (weeklyRate >= 90) {
      return `⭐ ${Math.round(weeklyRate)}% completion rate this week!`;
    }
  }
  
  // Check goal progress (close to goal)
  for (const subject of subjects) {
    if (subject.goal && subject.goal > 0) {
      const subjectLessons = lessonsBySubject[subject.subject] || [];
      const completed = subjectLessons.filter(l => l.completed).length;
      const remaining = subject.goal - completed;
      if (remaining > 0 && remaining <= 5) {
        return `🎯 Only ${remaining} more ${subject.subject} lesson${remaining === 1 ? '' : 's'} to reach your goal!`;
      }
    }
  }
  
  // Most productive day
  const productiveDay = getMostProductiveDay(studentLessons);
  if (productiveDay && productiveDay.count >= 5) {
    return `📚 Most productive day: ${productiveDay.day} (${productiveDay.count} lessons)`;
  }
  
  // Strongest subject
  const strongest = getStrongestSubject(studentLessons, subjects);
  if (strongest && strongest.rate >= 90) {
    return `💪 ${strongest.subject} is your strongest subject at ${Math.round(strongest.rate)}%!`;
  }
  
  return 'Keep logging lessons to see insights!';
};

// Progress Bar Component
const ProgressBar = ({
  percentage,
  color,
}: {
  percentage: number;
  color: string;
}) => {
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  return (
    <View style={styles.progressBarContainer}>
      <View
        style={[
          styles.progressBarFill,
          { width: `${clampedPercentage}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
};

// Check if goal celebrations are enabled
const isGoalCelebrationsEnabled = async () => {
  try {
    const settings = await AsyncStorage.getItem('notification-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.enabled && parsed.goalCelebrations;
    }
  } catch (error) {
    console.error('Error checking notification settings:', error);
  }
  return false;
};

export default function ProgressScreen() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { students, fetchStudents, subjects, fetchSubjects, updateSubject } = useStudentStore();
  const { lessons, fetchLessons } = useLessonStore();
  const { schedule, getSchoolDays, fetchSchedule } = useScheduleStore();
  const { breaks, isBreakDay, fetchBreaks } = useBreakStore();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalSubject, setGoalSubject] = useState<string | null>(null);
  const [goalValue, setGoalValue] = useState('');
  const [goalLoading, setGoalLoading] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [editGoalSubject, setEditGoalSubject] = useState<string>('');
  const [editGoalCurrentGoal, setEditGoalCurrentGoal] = useState<number>(0);
  const [showLessonsDetail, setShowLessonsDetail] = useState(false);
  const [detailModalTitle, setDetailModalTitle] = useState('');
  const [detailModalLessons, setDetailModalLessons] = useState<Lesson[]>([]);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  // Track previous goal completion status to detect when goals are newly reached
  const previousGoalStatus = useRef<Record<string, number>>({});

  useEffect(() => {
    const loadData = async () => {
      // Show skeletons immediately, no loading state check
      await Promise.all([
        fetchStudents(),
        fetchLessons(),
        fetchSubjects(),
        fetchSchedule(),
        fetchBreaks(),
      ]);
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].id);
    }
  }, [students.length, selectedStudentId]);

  // Calculate stats using useMemo
  const studentLessons = useMemo(() => {
    if (!selectedStudentId) return [];
    return getLessonsForStudent(lessons, selectedStudentId);
  }, [lessons, selectedStudentId]);

  const completedLessons = useMemo(() => {
    return getCompletedLessons(studentLessons);
  }, [studentLessons]);

  const lessonsThisWeek = useMemo(() => {
    return getLessonsThisWeek(studentLessons);
  }, [studentLessons]);

  // Calculate this week's lessons using startOfWeek/endOfWeek
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekLessons = useMemo(() => {
    return studentLessons.filter(l => {
      const lessonDate = new Date(l.date);
      return lessonDate >= weekStart && lessonDate <= weekEnd;
    });
  }, [studentLessons, weekStart, weekEnd]);

  const lessonsBySubject = useMemo(() => {
    return getLessonsBySubject(studentLessons);
  }, [studentLessons]);

  const completionPercentage = useMemo(() => {
    if (studentLessons.length === 0) return 0;
    return Math.round((completedLessons.length / studentLessons.length) * 100);
  }, [studentLessons.length, completedLessons.length]);

  const studentSubjects = useMemo(() => {
    if (!selectedStudentId) return [];
    return subjects.filter((s) => s.student_id === selectedStudentId);
  }, [subjects, selectedStudentId]);

  const insight = useMemo(() => {
    if (!selectedStudentId) return 'Keep logging lessons to see insights!';
    return getInsight(studentLessons, studentSubjects, lessonsBySubject, selectedStudentId, getSchoolDays, isBreakDay);
  }, [studentLessons, studentSubjects, lessonsBySubject, selectedStudentId, getSchoolDays, isBreakDay]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const handleSetGoal = (subject: string) => {
    setGoalSubject(subject);
    setGoalValue('');
    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    if (!goalSubject || !selectedStudentId) return;

    const goal = parseInt(goalValue || '0');
    if (goal <= 0) {
      Alert.alert('Error', 'Please enter a valid goal number greater than 0');
      return;
    }

    setGoalLoading(true);
    const existing = subjects.find(
      (s) => s.student_id === selectedStudentId && s.subject === goalSubject
    );

    if (existing) {
      const result = await updateSubject(existing.id, { goal });
      setGoalLoading(false);
      if (result.success) {
        await fetchSubjects(selectedStudentId);
        setShowGoalModal(false);
        setGoalSubject(null);
        setGoalValue('');
      } else {
        Alert.alert('Error', result.error || 'Failed to set goal');
      }
    } else {
      setGoalLoading(false);
      Alert.alert('Error', 'Subject not found');
    }
  };

  const handleEditGoal = (subject: string, currentGoal: number) => {
    setEditGoalSubject(subject);
    setEditGoalCurrentGoal(currentGoal);
    setShowEditGoalModal(true);
  };

  const handleSaveEditGoal = async (newGoal: number | null) => {
    if (!selectedStudentId || !editGoalSubject) return;

    const subjectRecord = subjects.find(
      (s) => s.student_id === selectedStudentId && s.subject === editGoalSubject
    );

    if (!subjectRecord) {
      Alert.alert('Error', 'Subject not found');
      setShowEditGoalModal(false);
      return;
    }

    setGoalLoading(true);
    const result = await updateSubject(subjectRecord.id, { 
      goal: newGoal === null ? undefined : newGoal 
    });
    setGoalLoading(false);

    if (result.success) {
      await fetchSubjects(selectedStudentId);
      showSnackbar(newGoal === null ? 'Goal removed!' : 'Goal updated!', 'success');
      setShowEditGoalModal(false);
      setEditGoalSubject('');
      setEditGoalCurrentGoal(0);
    } else {
      Alert.alert('Error', result.error || 'Failed to update goal');
    }
  };

  const handleCloseSubjectsModal = () => {
    setShowSubjectsModal(false);
  };

  const handleSaveSubjects = async () => {
    if (selectedStudentId) {
      await fetchSubjects(selectedStudentId);
    }
    setShowSubjectsModal(false);
  };

  // Group lessons by date for recent activity (only last 7 calendar days)
  const recentActivity = useMemo(() => {
    const lastSevenDays = getLastSevenDays();
    const lastSevenDaysStr = lastSevenDays.map(d => d.toISOString().split('T')[0]);
    
    // Filter lessons to only include dates from the last 7 calendar days
    const weekLessons = studentLessons.filter((lesson) => {
      return lastSevenDaysStr.includes(lesson.date);
    });
    
    const byDate: Record<string, number> = {};
    weekLessons.forEach((lesson) => {
      const dateKey = lesson.date;
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    });
    
    // Only return dates that are in the last 7 days, sorted by date (newest first)
    const result = Object.entries(byDate)
      .filter(([date]) => lastSevenDaysStr.includes(date))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7);
    
    // Debug logging
    console.log('📊 Progress page date range:', {
      today: new Date().toISOString().split('T')[0],
      lastSevenDays: lastSevenDaysStr,
      lessonsInRange: weekLessons.length,
      recentActivityDates: result.map(([date]) => date),
      allStudentLessons: studentLessons.length,
    });
    
    return result;
  }, [studentLessons]);

  if (students.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.ui.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress Tracking 📊</Text>
        </View>
        <EmptyState
          icon={BarChart3}
          title="No Students Yet"
          description="Add your first student to start tracking their homeschool progress and see detailed analytics!"
          actionText="+ Add Student"
          onAction={() => router.push('/add-student' as any)}
        />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Progress Skeleton
  const ProgressSkeleton = () => (
    <>
      {/* Student tabs skeleton */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <Skeleton width={80} height={80} borderRadius={16} />
        <Skeleton width={80} height={80} borderRadius={16} />
        <Skeleton width={80} height={80} borderRadius={16} />
      </View>
      
      {/* Stats cards skeleton */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Skeleton width="100%" height={80} borderRadius={16} />
        </View>
      </View>
      
      {/* Subject cards skeleton */}
      <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={120} borderRadius={16} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={120} borderRadius={16} />
    </>
  );

  if (!selectedStudentId && students.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.ui.background }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress Tracking 📊</Text>
        </View>
        <ProgressSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.ui.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Progress Tracking 📊</Text>
      </View>

      {students.length === 0 && lessons.length === 0 ? (
        <ProgressSkeleton />
      ) : (
        <Animated.View style={{ opacity: contentFadeAnim }}>
          <>
          {/* Student Selector Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.studentTabs}
            contentContainerStyle={styles.studentTabsContent}
          >
            {students.map((student) => (
          <TouchableOpacity
            key={student.id}
            style={[
              styles.studentTab,
              selectedStudentId === student.id && styles.studentTabActive,
            ]}
            onPress={() => setSelectedStudentId(student.id)}
            activeOpacity={0.7}
          >
            <Avatar
              type={student.avatar_type || 'initial'}
              value={student.avatar_value}
              name={student.name}
              color={Colors.student[student.color_theme]}
              size={40}
            />
            <Text
              style={[
                styles.studentTabName,
                selectedStudentId === student.id && styles.studentTabNameActive,
              ]}
            >
              {student.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedStudentId ? (
        <TouchableOpacity
          style={styles.sequenceLink}
          onPress={() =>
            router.push(`/reading-log?studentId=${selectedStudentId}` as any)
          }
          activeOpacity={0.7}
        >
          <Text style={styles.sequenceLinkText}>Reading log →</Text>
        </TouchableOpacity>
      ) : null}

      {/* No Lessons Empty State */}
      {studentLessons.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Lessons Yet"
          description={`Add lessons for ${selectedStudent?.name || 'this student'} to see progress tracking, completion rates, and insights!`}
          actionText="+ Add Lesson"
          onAction={() => router.push('/add-lesson' as any)}
        />
      ) : (
        <>
          {/* Overview Stats Card */}
          <View style={styles.statsCard}>
        {/* Total Lessons - Clickable */}
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => {
            setDetailModalTitle('All Lessons');
            setDetailModalLessons(studentLessons);
            setShowLessonsDetail(true);
          }}
          activeOpacity={0.7}
        >
          <BarChart3 size={24} color={Colors.brand[600]} />
          <Text style={styles.statValue}>{studentLessons.length}</Text>
          <Text style={styles.statLabel}>Total Lessons</Text>
          <Text style={styles.tapHint}>Tap for details</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        {/* Completed - Keep as View (has confetti) */}
        <View style={styles.statItem}>
          <TrendingUp size={24} color={Colors.ui.success} />
          <Text style={styles.statValue}>
            {completionPercentage}%
          </Text>
          <Text style={styles.statLabel}>
            {completedLessons.length} Completed
          </Text>
        </View>
        <View style={styles.statDivider} />
        {/* This Week - Clickable */}
        <TouchableOpacity
          style={styles.statItem}
          onPress={() => {
            setDetailModalTitle("This Week's Lessons");
            setDetailModalLessons(thisWeekLessons);
            setShowLessonsDetail(true);
          }}
          activeOpacity={0.7}
        >
          <Calendar size={24} color={Colors.brand[500]} />
          <Text style={styles.statValue}>{lessonsThisWeek.length}</Text>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.tapHint}>Tap for details</Text>
        </TouchableOpacity>
      </View>

      {/* Insights Card */}
      <View style={styles.insightsCard}>
        <Text style={styles.insightsText}>{insight}</Text>
      </View>

      {/* Subject Progress Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subject Progress 📚</Text>
        <Text style={styles.hintText}>Tap any subject to set or edit goal</Text>

        {studentSubjects.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No Subjects Enrolled"
            description="Add subjects to track progress and set goals for this student."
            actionText="Add Subjects"
            onAction={() => {
              setShowSubjectsModal(true);
            }}
          />
        ) : (
          <>
            {studentSubjects.map((subjectRecord) => {
            // Get all lessons for this subject
            const subjectLessons = studentLessons.filter(
              (l) => l.subject === subjectRecord.subject
            );

            // Count total and completed
            const totalCount = subjectLessons.length;
            const completedCount = subjectLessons.filter((l) => l.completed).length;
            const completionPercentage =
              totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            // Count lessons completed this week (past 7 days)
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const thisWeekCount = subjectLessons.filter(
              (l) => l.completed && new Date(l.date) >= weekAgo
            ).length;

            // Get goal (if set)
            const goal = subjectRecord.goal;
            const goalPercentage =
              goal && goal > 0 ? Math.round((completedCount / goal) * 100) : null;
            const remaining = goal ? Math.max(0, goal - completedCount) : null;

            // Check if goal just reached
            const goalKey = `${selectedStudentId}-${subjectRecord.subject}`;
            const previousCount = previousGoalStatus.current[goalKey] || 0;
            
            if (goal && goal > 0 && completedCount >= goal && previousCount < goal) {
              // Goal just reached!
              (async () => {
                const celebrationsEnabled = await isGoalCelebrationsEnabled();
                
                if (celebrationsEnabled && selectedStudent) {
                  await notificationService.sendGoalCelebration(
                    selectedStudent.name,
                    subjectRecord.subject
                  );
                }
              })();
            }
            
            // Update previous count
            previousGoalStatus.current[goalKey] = completedCount;

            const subjectColor = getSubjectColor(subjectRecord.subject);
            const subjectEmoji = getSubjectEmoji(subjectRecord.subject);

            return (
              <TouchableOpacity
                key={subjectRecord.id}
                style={styles.subjectCard}
                onPress={() => handleEditGoal(subjectRecord.subject, goal || 0)}
                activeOpacity={0.7}
              >
                {/* Subject Header */}
                <View style={[styles.subjectHeader, { backgroundColor: subjectColor + '20' }]}>
                  <View style={[styles.subjectPill, { backgroundColor: subjectColor }]}>
                    <Text style={styles.subjectPillText}>
                      {subjectEmoji} {subjectRecord.subject}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditGoal(subjectRecord.subject, goal || 0);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Edit2 size={16} color={Colors.ui.textLight} />
                  </TouchableOpacity>
                </View>

                {/* Lesson Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.subjectStatValue}>{totalCount}</Text>
                    <Text style={styles.subjectStatLabel}>Total</Text>
                  </View>

                  <View style={styles.stat}>
                    <Text style={styles.subjectStatValue}>{completedCount}</Text>
                    <Text style={styles.subjectStatLabel}>Completed</Text>
                  </View>

                  <View style={styles.stat}>
                    <Text style={[styles.subjectStatValue, { color: subjectColor }]}>
                      {thisWeekCount}
                    </Text>
                    <Text style={styles.subjectStatLabel}>This Week</Text>
                  </View>
                </View>

                {/* Completion Progress Bar */}
                <View style={styles.progressSection}>
                  <Text style={styles.progressLabel}>Completion</Text>
                  <ProgressBar percentage={completionPercentage} color={subjectColor} />
                  {totalCount > completedCount && (
                    <Text style={styles.incompleteText}>
                      {totalCount - completedCount} lesson{totalCount - completedCount !== 1 ? 's' : ''} remaining
                    </Text>
                  )}
                </View>

                {/* Goal Section (if goal is set) */}
                {goal && goal > 0 ? (
                  <View style={styles.goalSection}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalLabel}>Goal Progress</Text>
                      <Text style={styles.goalStats}>
                        {completedCount} of {goal}
                      </Text>
                    </View>
                    <ProgressBar
                      percentage={Math.min(goalPercentage || 0, 100)}
                      color={
                        goalPercentage && goalPercentage >= 100
                          ? Colors.ui.success
                          : subjectColor
                      }
                    />
                    {completedCount >= goal ? (
                      <>
                        <ConfettiCannon
                          count={50}
                          origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
                          autoStart={true}
                          fadeOut={true}
                          colors={['#7C3AED', '#F97316', '#10B981', '#F59E0B', '#EC4899', '#3B82F6']}
                        />
                        <View style={styles.goalReachedPill}>
                          <Text style={styles.goalReachedText}>🎉 Goal Reached!</Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.goalRemaining}>
                        {remaining} more to reach goal
                      </Text>
                    )}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.setGoalButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEditGoal(subjectRecord.subject, 0);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.setGoalText}>+ Set Goal</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.sequenceLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    if (!selectedStudentId) return;
                    router.push(
                      `/lesson-sequence?studentId=${selectedStudentId}&subject=${encodeURIComponent(subjectRecord.subject)}` as any
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sequenceLinkText}>Lesson sequence →</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
          </>
        )}
      </View>

          {/* Recent Activity Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            
            {/* Weekly Chart */}
            <View style={styles.chartContainer}>
              {getLastSevenDays().map((date, index) => {
                const dayLessons = getLessonsForDate(date, studentLessons);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })[0];
                const height = Math.min(dayLessons.length * 20, 100); // Max 100px
                const allComplete = dayLessons.length > 0 && dayLessons.every((l) => l.completed);
                const someComplete = dayLessons.length > 0 && dayLessons.some((l) => l.completed) && !allComplete;

                return (
                  <View key={index} style={styles.chartBar}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: height || 4,
                          backgroundColor:
                            dayLessons.length === 0
                              ? Colors.ui.border
                              : allComplete
                                ? Colors.ui.success
                                : someComplete
                                  ? Colors.ui.warning
                                  : Colors.ui.border,
                        },
                      ]}
                    />
                    <Text style={styles.chartLabel}>{dayName}</Text>
                    <Text style={styles.chartValue}>{dayLessons.length}</Text>
                  </View>
                );
              })}
            </View>

            {/* Activity List */}
            {recentActivity.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardText}>
                  No lessons logged in the past week.
                </Text>
              </View>
            ) : (
              recentActivity.map(([date, count]) => (
                <View key={date} style={styles.activityCard}>
                  <Text style={styles.activityDate}>{formatDate(date)}</Text>
                  <View style={styles.activityBadge}>
                    <Text style={styles.activityCount}>{count}</Text>
                    <Text style={styles.activityLabel}>
                      lesson{count === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          </>
        )}
          </>
        </Animated.View>
      )}
      </ScrollView>

      {/* Goal Setting Modal */}
      <Modal
        visible={showGoalModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowGoalModal(false);
          setGoalSubject(null);
          setGoalValue('');
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Goal</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowGoalModal(false);
                  setGoalSubject(null);
                  setGoalValue('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              How many {goalSubject} lessons should {selectedStudent?.name} complete this year?
            </Text>

            <TextInput
              style={styles.goalInput}
              placeholder="Enter goal number"
              placeholderTextColor={Colors.ui.textLight}
              value={goalValue}
              onChangeText={setGoalValue}
              keyboardType="number-pad"
              autoFocus
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowGoalModal(false);
                  setGoalSubject(null);
                  setGoalValue('');
                }}
                disabled={goalLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, goalLoading && styles.modalSaveButtonDisabled]}
                onPress={handleSaveGoal}
                disabled={goalLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.modalSaveButtonText}>
                  {goalLoading ? 'Saving...' : 'Set Goal'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Goal Modal */}
      <Suspense fallback={<View />}>
        <EditGoalModal
          visible={showEditGoalModal}
          subject={editGoalSubject}
          currentGoal={editGoalCurrentGoal}
          studentName={selectedStudent?.name || ''}
          onClose={() => {
            setShowEditGoalModal(false);
            setEditGoalSubject('');
            setEditGoalCurrentGoal(0);
          }}
          onSave={handleSaveEditGoal}
        />
      </Suspense>
      {/* Lessons Detail Modal */}
      <Suspense fallback={<View />}>
        <LessonsDetailModal
          visible={showLessonsDetail}
          onClose={() => setShowLessonsDetail(false)}
          title={detailModalTitle}
          lessons={detailModalLessons}
          studentName={selectedStudent?.name || ''}
        />
      </Suspense>

      {/* Edit Subjects Modal */}
      <Suspense fallback={<View />}>
        <EditSubjectsModal
          visible={showSubjectsModal}
          student={selectedStudent || null}
          onClose={handleCloseSubjectsModal}
          onSave={handleSaveSubjects}
        />
      </Suspense>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[900],
  },
  studentTabs: {
    marginBottom: 24,
  },
  studentTabsContent: {
    gap: 12,
    paddingRight: 20,
  },
  studentTab: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Colors.background.card,
    marginRight: 12,
    minWidth: 80,
  },
  studentTabActive: {
    backgroundColor: Colors.brand[100],
    borderWidth: 2,
    borderColor: Colors.brand[400],
  },
  studentTabName: {
    ...Typography.caption,
    marginTop: 6,
    color: Colors.ui.text,
  },
  studentTabNameActive: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsCard: {
    backgroundColor: Colors.brand[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.brand[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand[900],
    textAlign: 'center',
    lineHeight: 26,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.ui.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  tapHint: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.ui.textLight,
    marginTop: 4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.brand[900],
    marginBottom: 16,
  },
  subjectCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
  },
  subjectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subjectPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: 'white',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 8,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: Colors.background.card,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subjectStatLabel: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginBottom: 6,
  },
  incompleteText: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  goalItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  goalSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  goalStats: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  goalAchieved: {
    fontSize: 12,
    color: Colors.ui.success,
    fontWeight: '600',
    marginTop: 6,
  },
  goalReachedPill: {
    backgroundColor: Colors.accent[400],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  goalReachedText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: 'white',
  },
  goalRemaining: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 6,
  },
  setGoalButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.brand[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  setGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  sequenceLink: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  sequenceLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  hintText: {
    fontSize: 12,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  activityDate: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.ui.text,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activityCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.brand[700],
  },
  activityLabel: {
    fontSize: 12,
    color: Colors.brand[600],
  },
  progressBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  emptyCardText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginBottom: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  chartValue: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.ui.text,
  },
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
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  modalSubtitle: {
    fontSize: 16,
    color: Colors.ui.textLight,
    marginBottom: 20,
    lineHeight: 22,
  },
  goalInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: Colors.ui.text,
    marginBottom: 24,
    minHeight: 44,
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  modalSaveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.6,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});
