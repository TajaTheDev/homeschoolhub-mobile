/**
 * Main Dashboard Screen
 */

import WeeklySummaryCard from '@/components/dashboard/WeeklySummaryCard';
import LessonModal from '@/components/lessons/LessonModal';
import EditSubjectsModal from '@/components/students/EditSubjectsModal';
import StudentModal from '@/components/students/StudentModal';
import DatePicker from '@/components/ui/DatePicker';
import Colors from '@/constants/Colors';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import { useAuthStore } from '@/store/authStore';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson, Student } from '@/types';
import { format, isSameDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { Edit2, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

export default function Dashboard() {
  const router = useRouter();
  const { students, fetchStudents, deleteStudent, subjects, fetchSubjects, loading } = useStudentStore();
  const lessonStore = useLessonStore();
  const { lessons, fetchLessons, toggleCompleteOptimistic } = lessonStore;
  const { user, signOut } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState<Student | null>(null);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    fetchStudents();
    fetchLessons();
  }, [fetchStudents, fetchLessons]);

  // Fetch subjects when students are loaded
  useEffect(() => {
    if (students.length > 0) {
      console.log('Fetching subjects for', students.length, 'students');
      fetchSubjects();
    }
  }, [students, fetchSubjects]);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('Modal state changed - showEditModal:', showEditModal, 'selectedStudent:', selectedStudent?.name || 'null');
  }, [showEditModal, selectedStudent]);

  // Debug: Log subjects modal state changes
  useEffect(() => {
    console.log('showSubjectsModal changed:', showSubjectsModal);
    console.log('selectedStudentForSubjects:', selectedStudentForSubjects?.name || 'null');
  }, [showSubjectsModal, selectedStudentForSubjects]);

  // Debug: Log when subjects are updated
  useEffect(() => {
    console.log('Subjects updated in store. Total subjects:', subjects.length);
    students.forEach((student) => {
      const count = subjects.filter((s) => s.student_id === student.id).length;
      console.log(`  - ${student.name}: ${count} subjects`);
    });
  }, [subjects, students]);

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

  // Filter lessons by selected date or get recent lessons
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isTodaySelected = isSameDay(selectedDate, new Date());
  const lessonsForSelectedDate = useMemo(() => {
    if (isTodaySelected) {
      // Show most recent 5 lessons when today is selected
      return lessons.slice(0, 5);
    } else {
      // Show lessons for the selected date
      return lessons.filter((l) => l.date === selectedDateStr);
    }
  }, [lessons, selectedDateStr, isTodaySelected]);

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

  const handleLessonComplete = (lessonId: string, isCurrentlyComplete: boolean) => {
    const newStatus = !isCurrentlyComplete;
    
    // Show confetti immediately if marking complete
    if (newStatus) {
      setShowConfetti(true);
      setTimeout(() => {
        if (confettiRef.current) {
          confettiRef.current.start();
        }
      }, 100);
      setTimeout(() => {
        setShowConfetti(false);
      }, 2000);
    }
    
    // Call the optimistic toggle (updates UI instantly, database in background)
    lessonStore.toggleCompleteOptimistic(lessonId);
  };

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
        <View style={styles.header}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeText}>Welcome back! 👋</Text>
            {user?.email && (
              <Text style={styles.emailText}>{user.email}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Date Picker */}
        <DatePicker
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          lessonDates={lessonDates}
        />

        {/* Weekly Summary Card */}
        <WeeklySummaryCard
          thisWeekCount={weeklyStats.thisWeekCount}
          completionRate={weeklyStats.completionRate}
          streak={weeklyStats.streak}
        />

        {/* Recent Lessons Section (or Selected Date Lessons) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.h3, { marginBottom: 0 }]}>
              {isSameDay(selectedDate, new Date()) 
                ? 'Recent Lessons' 
                : format(selectedDate, 'EEEE, MMM d')}
            </Text>
            {lessonsForSelectedDate.length > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/calendar' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {lessonsForSelectedDate.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[Typography.body, { color: Colors.ui.textLight, textAlign: 'center' }]}>
                {isSameDay(selectedDate, new Date())
                  ? 'No lessons yet. Tap "Add Lesson" to get started! 📚'
                  : 'No lessons for this day'}
              </Text>
            </View>
          ) : (
            lessonsForSelectedDate.slice(0, 5).map((lesson) => {
              // Find student for this lesson
              const student = students.find(s => s.id === lesson.student_id);
              const subjectColor = getSubjectColor(lesson.subject);
              
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[
                    styles.lessonCard,
                    { borderLeftColor: subjectColor }
                  ]}
                  onPress={() => {
                    setSelectedLesson(lesson);
                    setShowLessonModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.lessonHeader}>
                    <View style={styles.lessonHeaderLeft}>
                      {/* Student Name Pill */}
                      {student && (
                        <View style={styles.studentPill}>
                          <Text style={styles.studentPillText}>
                            {student.name}
                          </Text>
                        </View>
                      )}
                      
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
                  
                  <Text style={styles.lessonDate}>
                    {formatDate(lesson.date)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
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
          {loading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : students.length === 0 ? (
            <TouchableOpacity
              style={styles.addStudentButton}
              onPress={() => router.push('/onboarding/step1')}
              activeOpacity={0.8}
            >
              <Text style={styles.addStudentButtonText}>Add your first student</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.studentsContainer}>
              {students.map((student) => (
                <View
                  key={student.id}
                  style={[
                    styles.studentCard,
                    { backgroundColor: Colors.student[student.color_theme] },
                  ]}
                >
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteStudent(student)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={20} color={Colors.ui.error} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        console.log('Edit button onPress triggered for:', student.name);
                        handleEditStudent(student);
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit2 size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      // Placeholder for student details
                      console.log('Student tapped:', student.name);
                    }}
                  >
                    <Text style={[Typography.h4, { color: 'white', marginBottom: 4 }]}>{student.name}</Text>
                    <Text style={[Typography.bodySmall, { color: 'white', opacity: 0.9, marginBottom: 12 }]}>{student.grade}</Text>
                  </TouchableOpacity>

                  {/* Edit/Add Subjects Button - Always visible */}
                  <TouchableOpacity
                    style={styles.editSubjectsButton}
                    onPress={() => {
                      console.log('Edit subjects for:', student.name);
                      handleEditSubjects(student);
                    }}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.editSubjectsButtonText}>
                      {getSubjectCount(student.id) > 0 
                        ? `Edit Subjects (${getSubjectCount(student.id)})`
                        : 'Add Subjects'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.addLessonButton}
            onPress={() => router.push('/add-lesson' as any)}
            activeOpacity={0.8}
          >
            <Plus size={24} color="white" />
            <Text style={styles.addLessonButtonText}>Add Lesson</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/add-lesson' as any)}
          activeOpacity={0.8}
        >
          <Plus size={28} color="white" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Student Edit Modal - Outside ScrollView for proper rendering */}
      <StudentModal
        visible={showEditModal}
        student={selectedStudent}
        onClose={handleCloseModal}
        onSave={handleSaveStudent}
      />

      {/* Edit Subjects Modal */}
      {(() => {
        console.log('EditSubjectsModal render - visible:', showSubjectsModal, 'student:', selectedStudentForSubjects?.name || 'null');
        return (
          <EditSubjectsModal
            visible={showSubjectsModal}
            student={selectedStudentForSubjects}
            onClose={handleCloseSubjectsModal}
            onSave={handleSaveSubjects}
          />
        );
      })()}

      {/* Lesson Edit Modal */}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    ...Typography.h3,
    marginBottom: 2,
  },
  emailText: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  signOutText: {
    ...Typography.caption,
    color: Colors.ui.text,
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
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
  loadingText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingVertical: 20,
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
    gap: 12,
  },
  studentCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 0,
    position: 'relative',
  },
  cardActions: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    paddingRight: 80,
  },
  studentGrade: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 8,
  },
  editSubjectsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSubjectsButtonText: {
    ...Typography.buttonSmall,
    color: 'white',
    textAlign: 'center',
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
  studentPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.ui.border,
    marginRight: 8,
  },
  studentPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: Colors.ui.text,
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
  lessonNotes: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 4,
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
  addLessonButton: {
    backgroundColor: Colors.brand[500],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 20,
    minHeight: 52,
  },
  addLessonButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: Colors.brand[50],
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brand[400],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
