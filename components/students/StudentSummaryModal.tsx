import Avatar from '@/components/ui/Avatar';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { Lesson, Student } from '@/types';
import { format, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { Award, Calendar, CheckCircle, Circle, TrendingUp, X } from 'lucide-react-native';
import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface StudentSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  student: Student | null;
  lessons: Lesson[];
}

export default function StudentSummaryModal({
  visible,
  onClose,
  student,
  lessons,
}: StudentSummaryModalProps) {
  if (!student) return null;

  const studentLessons = lessons.filter(l => l.student_id === student.id);
  
  // Time period filters
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const thisWeek = studentLessons.filter(l => new Date(l.date) >= weekStart);
  const thisMonth = studentLessons.filter(l => new Date(l.date) >= monthStart);
  const thisYear = studentLessons.filter(l => new Date(l.date) >= yearStart);

  // Get subjects
  const allSubjects = [...new Set(studentLessons.map(l => l.subject))];
  const weekSubjects = [...new Set(thisWeek.map(l => l.subject))];
  const monthSubjects = [...new Set(thisMonth.map(l => l.subject))];

  // Completion rates
  const weekCompleted = thisWeek.filter(l => l.completed).length;
  const monthCompleted = thisMonth.filter(l => l.completed).length;
  const yearCompleted = thisYear.filter(l => l.completed).length;
  const totalCompleted = studentLessons.filter(l => l.completed).length;

  const weekRate = thisWeek.length > 0 ? Math.round((weekCompleted / thisWeek.length) * 100) : 0;
  const monthRate = thisMonth.length > 0 ? Math.round((monthCompleted / thisMonth.length) * 100) : 0;

  // Most active subject
  const subjectCounts = studentLessons.reduce((acc, lesson) => {
    acc[lesson.subject] = (acc[lesson.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostActiveSubject = Object.entries(subjectCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

  const studentColor = Colors.student[student.color_theme];

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
            <View style={styles.headerLeft}>
              <Avatar
                type={student.avatar_type || 'initial'}
                value={student.avatar_value}
                name={student.name}
                color={studentColor}
                size={56}
              />
              <View style={styles.headerInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentGrade}>{student.grade}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <View style={styles.quickStatBox}>
                <TrendingUp size={20} color={Colors.brand[500]} />
                <Text style={styles.quickStatNumber}>{totalCompleted}</Text>
                <Text style={styles.quickStatLabel}>Total Completed</Text>
              </View>
              <View style={styles.quickStatBox}>
                <Award size={20} color={Colors.accent[500]} />
                <Text style={styles.quickStatNumber}>{allSubjects.length}</Text>
                <Text style={styles.quickStatLabel}>Subjects</Text>
              </View>
              <View style={styles.quickStatBox}>
                <Calendar size={20} color={Colors.secondary[500]} />
                <Text style={styles.quickStatNumber}>{studentLessons.length}</Text>
                <Text style={styles.quickStatLabel}>All Lessons</Text>
              </View>
            </View>

            {/* This Week */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Week</Text>
              <View style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <Text style={styles.periodCount}>{thisWeek.length} lessons</Text>
                  <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{weekCompleted} completed</Text>
                  </View>
                </View>
                
                {weekRate > 0 && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${weekRate}%` }]} />
                  </View>
                )}

                {weekSubjects.length > 0 && (
                  <View style={styles.subjectsRow}>
                    <Text style={styles.subjectsLabel}>Subjects:</Text>
                    {weekSubjects.map(subject => (
                      <View key={subject} style={styles.subjectPill}>
                        <Text style={styles.subjectPillText}>{subject}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recent lessons this week */}
                {thisWeek.slice(0, 5).map(lesson => (
                  <View key={lesson.id} style={styles.lessonRow}>
                    {lesson.completed ? (
                      <CheckCircle size={16} color={Colors.accent[500]} />
                    ) : (
                      <Circle size={16} color={Colors.ui.border} />
                    )}
                    <View style={styles.lessonInfo}>
                      <Text style={styles.lessonTitle}>{lesson.title}</Text>
                      <Text style={styles.lessonMeta}>
                        {lesson.subject} • {format(new Date(lesson.date), 'EEE')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* This Month */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Month</Text>
              <View style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <Text style={styles.periodCount}>{thisMonth.length} lessons</Text>
                  <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{monthCompleted} completed</Text>
                  </View>
                </View>

                {monthRate > 0 && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${monthRate}%` }]} />
                  </View>
                )}

                {monthSubjects.length > 0 && (
                  <View style={styles.subjectsRow}>
                    <Text style={styles.subjectsLabel}>Subjects:</Text>
                    {monthSubjects.map(subject => (
                      <View key={subject} style={styles.subjectPill}>
                        <Text style={styles.subjectPillText}>{subject}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* This Year */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Year</Text>
              <View style={styles.periodCard}>
                <View style={styles.periodHeader}>
                  <Text style={styles.periodCount}>{thisYear.length} lessons</Text>
                  <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{yearCompleted} completed</Text>
                  </View>
                </View>

                <View style={styles.insightRow}>
                  <Text style={styles.insightLabel}>Most Active Subject:</Text>
                  <Text style={styles.insightValue}>{mostActiveSubject}</Text>
                </View>

                <View style={styles.insightRow}>
                  <Text style={styles.insightLabel}>Total Subjects Studied:</Text>
                  <Text style={styles.insightValue}>{allSubjects.length}</Text>
                </View>
              </View>
            </View>

            {/* All Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Time</Text>
              <View style={styles.periodCard}>
                <View style={styles.allTimeStats}>
                  <View style={styles.allTimeStat}>
                    <Text style={styles.allTimeNumber}>{studentLessons.length}</Text>
                    <Text style={styles.allTimeLabel}>Total Lessons</Text>
                  </View>
                  <View style={styles.allTimeStat}>
                    <Text style={[styles.allTimeNumber, { color: Colors.accent[500] }]}>
                      {totalCompleted}
                    </Text>
                    <Text style={styles.allTimeLabel}>Completed</Text>
                  </View>
                  <View style={styles.allTimeStat}>
                    <Text style={[styles.allTimeNumber, { color: Colors.secondary[500] }]}>
                      {studentLessons.length - totalCompleted}
                    </Text>
                    <Text style={styles.allTimeLabel}>Incomplete</Text>
                  </View>
                </View>
              </View>
            </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerInfo: {
    flex: 1,
  },
  studentName: {
    ...Typography.h3,
    marginBottom: 2,
  },
  studentGrade: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    paddingBottom: 40,
  },
  quickStats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  quickStatBox: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 6,
  },
  quickStatNumber: {
    ...Typography.h3,
    fontSize: 24,
    color: Colors.brand[600],
  },
  quickStatLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 12,
  },
  periodCard: {
    backgroundColor: Colors.ui.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  periodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  periodCount: {
    ...Typography.h4,
    fontSize: 16,
  },
  completionBadge: {
    backgroundColor: Colors.accent[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  completionText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.accent[600],
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.ui.border,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent[500],
  },
  subjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  subjectsLabel: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  subjectPill: {
    backgroundColor: Colors.brand[100],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectPillText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.brand[700],
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    ...Typography.body,
    fontSize: 13,
    marginBottom: 2,
  },
  lessonMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  insightLabel: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  insightValue: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.brand[600],
  },
  allTimeStats: {
    flexDirection: 'row',
    gap: 12,
  },
  allTimeStat: {
    flex: 1,
    alignItems: 'center',
  },
  allTimeNumber: {
    ...Typography.h2,
    fontSize: 28,
    color: Colors.brand[600],
    marginBottom: 4,
  },
  allTimeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
});

