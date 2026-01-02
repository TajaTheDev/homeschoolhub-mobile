import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { Lesson, Student } from '@/types';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { CheckCircle, Circle, X } from 'lucide-react-native';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface WeeklySummaryModalProps {
  visible: boolean;
  onClose: () => void;
  students: Student[];
  lessons: Lesson[];
}

export default function WeeklySummaryModal({
  visible,
  onClose,
  students,
  lessons,
}: WeeklySummaryModalProps) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const thisWeekLessons = lessons.filter(l => {
    const lessonDate = new Date(l.date);
    return lessonDate >= weekStart && lessonDate <= weekEnd;
  });

  const getStudentLessons = (studentId: string) => {
    return thisWeekLessons.filter(l => l.student_id === studentId);
  };

  const getCompletedCount = (studentId: string) => {
    return getStudentLessons(studentId).filter(l => l.completed).length;
  };

  const getSubjects = (studentId: string) => {
    const studentLessons = getStudentLessons(studentId);
    const subjects = [...new Set(studentLessons.map(l => l.subject))];
    return subjects;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>This Week&apos;s Summary</Text>
              <Text style={styles.dateRange}>
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Overall Stats */}
            <View style={styles.overallStats}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{thisWeekLessons.length}</Text>
                <Text style={styles.statLabel}>Total Lessons</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: Colors.accent[500] }]}>
                  {thisWeekLessons.filter(l => l.completed).length}
                </Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: Colors.secondary[500] }]}>
                  {thisWeekLessons.filter(l => !l.completed).length}
                </Text>
                <Text style={styles.statLabel}>Incomplete</Text>
              </View>
            </View>

            {/* Per Student */}
            {students.map(student => {
              const studentLessons = getStudentLessons(student.id);
              const completedCount = getCompletedCount(student.id);
              const subjects = getSubjects(student.id);

              if (studentLessons.length === 0) return null;

              const studentColor = Colors.student[student.color_theme];
              
              return (
                <View key={student.id} style={styles.studentSection}>
                  <View style={[styles.studentHeader, { backgroundColor: studentColor + '20' }]}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentStats}>
                      {completedCount}/{studentLessons.length} completed
                    </Text>
                  </View>

                  {/* Subjects covered */}
                  <View style={styles.subjectsRow}>
                    <Text style={styles.subjectsLabel}>Subjects:</Text>
                    <View style={styles.subjectPills}>
                      {subjects.map(subject => (
                        <View key={subject} style={styles.subjectPill}>
                          <Text style={styles.subjectPillText}>{subject}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Lessons list */}
                  {studentLessons.map(lesson => (
                    <View key={lesson.id} style={styles.lessonRow}>
                      <View style={styles.lessonLeft}>
                        {lesson.completed ? (
                          <CheckCircle size={20} color={Colors.accent[500]} />
                        ) : (
                          <Circle size={20} color={Colors.ui.border} />
                        )}
                        <View style={styles.lessonInfo}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          <Text style={styles.lessonMeta}>
                            {lesson.subject} • {format(new Date(lesson.date), 'EEE, MMM d')}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}

            {thisWeekLessons.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No lessons logged this week yet!</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  title: {
    ...Typography.h2,
    marginBottom: 4,
  },
  dateRange: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  closeButton: {
    padding: 4,
  },
  overallStats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    ...Typography.h2,
    fontSize: 28,
    color: Colors.brand[600],
    marginBottom: 4,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  studentSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  studentName: {
    ...Typography.h4,
  },
  studentStats: {
    ...Typography.label,
    color: Colors.ui.textLight,
  },
  subjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  subjectsLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  subjectPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  subjectPill: {
    backgroundColor: Colors.brand[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectPillText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.brand[700],
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  lessonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    ...Typography.body,
    marginBottom: 2,
  },
  lessonMeta: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
});

