/**
 * Main Dashboard Screen
 */

import LessonModal from '@/components/lessons/LessonModal';
import EditSubjectsModal from '@/components/students/EditSubjectsModal';
import StudentModal from '@/components/students/StudentModal';
import Colors from '@/constants/Colors';
import { useAuthStore } from '@/store/authStore';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson, Student } from '@/types';
import { useRouter } from 'expo-router';
import { Edit2, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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

const getSubjectColor = (subject: string) => {
  const colors: Record<string, string> = {
    'Math': '#EF4444',
    'Reading': '#3B82F6',
    'Science': '#10B981',
    'History': '#F59E0B',
    'Writing': '#8B5CF6',
    'Art': '#EC4899',
  };
  return colors[subject] || Colors.ui.textLight;
};

export default function Dashboard() {
  const router = useRouter();
  const { students, fetchStudents, deleteStudent, subjects, fetchSubjects, loading } = useStudentStore();
  const { lessons, fetchLessons } = useLessonStore();
  const { user, signOut } = useAuthStore();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudentForSubjects, setSelectedStudentForSubjects] = useState<Student | null>(null);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);

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

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
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
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Your Students Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Students</Text>
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
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentGrade}>{student.grade}</Text>
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

        {/* Recent Lessons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Lessons</Text>
          
          {lessons.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No lessons yet. Tap "Add Lesson" to get started! 📚
              </Text>
            </View>
          ) : (
            lessons.slice(0, 5).map((lesson) => {
              // Find student for this lesson
              const student = students.find(s => s.id === lesson.student_id);
              
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={styles.lessonCard}
                  onPress={() => {
                    setSelectedLesson(lesson);
                    setShowLessonModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.lessonHeader}>
                    <Text style={styles.lessonStudent}>
                      {student?.name || 'Unknown'}
                    </Text>
                    <Text style={styles.lessonDate}>
                      {formatDate(lesson.date)}
                    </Text>
                  </View>
                  
                  <View style={styles.lessonContent}>
                    <View 
                      style={[
                        styles.subjectBadge, 
                        { backgroundColor: getSubjectColor(lesson.subject) }
                      ]}
                    >
                      <Text style={styles.subjectBadgeText}>{lesson.subject}</Text>
                    </View>
                    
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  </View>
                  
                  {lesson.completed && (
                    <Text style={styles.completedBadge}>✓ Completed</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {/* Prominent Add Lesson Button */}
          <TouchableOpacity
            style={styles.addLessonButton}
            onPress={() => router.push('/add-lesson' as any)}
            activeOpacity={0.8}
          >
            <Plus size={24} color="white" />
            <Text style={styles.addLessonButtonText}>Add Lesson</Text>
          </TouchableOpacity>

          <View style={styles.actionsContainer}>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Navigate to calendar tab
                router.push('/calendar' as any);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>View Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                // Navigate to progress tab
                router.push('/progress' as any);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Check Progress</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

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
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.brand[900],
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  signOutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.ui.backgroundLight,
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.brand[700],
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    borderRadius: 16,
    padding: 20,
    minHeight: 80,
    justifyContent: 'center',
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
    backgroundColor: Colors.brand[500],
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSubjectsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  lessonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lessonStudent: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  lessonDate: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  lessonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  lessonTitle: {
    fontSize: 15,
    color: Colors.ui.text,
    flex: 1,
  },
  completedBadge: {
    fontSize: 12,
    color: Colors.ui.success,
    fontWeight: '600',
    marginTop: 4,
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
});
