import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { Lesson } from '@/types';
import { format } from 'date-fns';
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

interface LessonsDetailModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  lessons: Lesson[];
  studentName: string;
}

export default function LessonsDetailModal({
  visible,
  onClose,
  title,
  lessons,
  studentName,
}: LessonsDetailModalProps) {
  const completedLessons = lessons.filter(l => l.completed);
  const incompleteLessons = lessons.filter(l => !l.completed);
  
  // Group by subject
  const subjectGroups = lessons.reduce((acc, lesson) => {
    if (!acc[lesson.subject]) {
      acc[lesson.subject] = [];
    }
    acc[lesson.subject].push(lesson);
    return acc;
  }, {} as Record<string, Lesson[]>);

  const subjects = Object.keys(subjectGroups);

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
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{studentName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Summary Stats */}
            <View style={styles.summaryStats}>
              <View style={styles.summaryStatBox}>
                <Text style={styles.summaryStatNumber}>{lessons.length}</Text>
                <Text style={styles.summaryStatLabel}>Total</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={[styles.summaryStatNumber, { color: Colors.accent[500] }]}>
                  {completedLessons.length}
                </Text>
                <Text style={styles.summaryStatLabel}>Completed</Text>
              </View>
              <View style={styles.summaryStatBox}>
                <Text style={[styles.summaryStatNumber, { color: Colors.secondary[500] }]}>
                  {incompleteLessons.length}
                </Text>
                <Text style={styles.summaryStatLabel}>Incomplete</Text>
              </View>
            </View>

            {/* By Subject */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Subject</Text>
              {subjects.map(subject => {
                const subjectLessons = subjectGroups[subject];
                const completed = subjectLessons.filter(l => l.completed).length;
                
                return (
                  <View key={subject} style={styles.subjectCard}>
                    <View style={styles.subjectHeader}>
                      <Text style={styles.subjectName}>{subject}</Text>
                      <Text style={styles.subjectCount}>
                        {completed}/{subjectLessons.length}
                      </Text>
                    </View>
                    
                    {subjectLessons.map(lesson => (
                      <View key={lesson.id} style={styles.lessonRow}>
                        {lesson.completed ? (
                          <CheckCircle size={18} color={Colors.accent[500]} />
                        ) : (
                          <Circle size={18} color={Colors.ui.border} />
                        )}
                        <View style={styles.lessonInfo}>
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                          <Text style={styles.lessonDate}>
                            {format(new Date(lesson.date), 'MMM d, yyyy')}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>

            {lessons.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No lessons found</Text>
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
  subtitle: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  closeButton: {
    padding: 4,
  },
  summaryStats: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  summaryStatBox: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryStatNumber: {
    ...Typography.h2,
    fontSize: 28,
    color: Colors.brand[600],
    marginBottom: 4,
  },
  summaryStatLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 16,
  },
  subjectCard: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  subjectName: {
    ...Typography.h4,
    fontSize: 16,
  },
  subjectCount: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    ...Typography.body,
    fontSize: 14,
    marginBottom: 2,
  },
  lessonDate: {
    ...Typography.caption,
    fontSize: 12,
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

