import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { format, parseISO } from 'date-fns';
import Colors from '@/constants/Colors';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';

interface GradeTrendsProps {
  studentId: string;
  subject?: string;
}

export default function GradeTrends({ studentId, subject }: GradeTrendsProps) {
  const { lessons } = useLessonStore();
  const { students } = useStudentStore();
  
  const student = students.find(s => s.id === studentId);
  
  const gradeData = useMemo(() => {
    // Filter lessons for this student with grades
    const filtered = lessons.filter(lesson => 
      lesson.student_id === studentId &&
      lesson.grade_value !== null &&
      lesson.grade_value !== undefined &&
      (!subject || lesson.subject === subject)
    );
    
    // Sort by date
    const sorted = filtered.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Group by subject
    const bySubject: Record<string, any[]> = {};
    sorted.forEach(lesson => {
      if (!bySubject[lesson.subject]) {
        bySubject[lesson.subject] = [];
      }
      bySubject[lesson.subject].push(lesson);
    });
    
    // Calculate stats per subject
    const subjectStats = Object.entries(bySubject).map(([subj, lessons]) => {
      const letterGrades = lessons.filter(l => l.grade_type === 'letter');
      const percentGrades = lessons.filter(l => l.grade_type === 'percentage');
      
      let average = 'N/A';
      let trend = 'stable';
      
      if (percentGrades.length >= 2) {
        const avg = percentGrades.reduce((sum, l) => sum + parseInt(l.grade_value), 0) / percentGrades.length;
        average = Math.round(avg) + '%';
        
        // Simple trend: compare first half to second half
        const mid = Math.floor(percentGrades.length / 2);
        const firstHalf = percentGrades.slice(0, mid);
        const secondHalf = percentGrades.slice(mid);
        
        const firstAvg = firstHalf.reduce((sum, l) => sum + parseInt(l.grade_value), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, l) => sum + parseInt(l.grade_value), 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 5) trend = 'improving';
        else if (secondAvg < firstAvg - 5) trend = 'declining';
      } else if (letterGrades.length > 0) {
        // Most common grade
        const gradeCounts: Record<string, number> = {};
        letterGrades.forEach(l => {
          gradeCounts[l.grade_value] = (gradeCounts[l.grade_value] || 0) + 1;
        });
        average = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0][0];
      }
      
      return {
        subject: subj,
        total: lessons.length,
        average,
        trend,
        recentGrades: lessons.slice(-5),
      };
    });
    
    return {
      bySubject: subjectStats,
      totalGraded: sorted.length,
      recentGrades: sorted.slice(-10),
    };
  }, [lessons, studentId, subject]);
  
  if (gradeData.totalGraded === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyText}>No Graded Lessons</Text>
        <Text style={styles.emptySubtext}>
          {subject 
            ? `No grades recorded for ${subject}`
            : 'Start grading lessons to see trends'}
        </Text>
      </View>
    );
  }
  
  const getGradeBadgeStyle = (gradeType: string, gradeValue: string) => {
    if (gradeType === 'letter') {
      const grade = gradeValue.toUpperCase().replace(/[+-]/g, '');
      return styles[`grade${grade}` as keyof typeof styles] || styles.gradeDefault;
    } else if (gradeType === 'percentage') {
      const percent = parseInt(gradeValue);
      if (percent >= 90) return styles.gradeA;
      if (percent >= 80) return styles.gradeB;
      if (percent >= 70) return styles.gradeC;
      if (percent >= 60) return styles.gradeD;
      return styles.gradeF;
    } else if (gradeType === 'pass_fail') {
      return gradeValue === 'pass' ? styles.gradePass : styles.gradeFail;
    }
    return styles.gradeDefault;
  };
  
  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return '📈';
    if (trend === 'declining') return '📉';
    return '➡️';
  };
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Grade Trends: {student?.name}</Text>
        <Text style={styles.headerSubtitle}>
          {gradeData.totalGraded} graded lesson{gradeData.totalGraded !== 1 ? 's' : ''}
        </Text>
      </View>
      
      {/* Subject Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By Subject</Text>
        {gradeData.bySubject.map(subj => (
          <View key={subj.subject} style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subj.subject}</Text>
                <Text style={styles.subjectCount}>{subj.total} graded</Text>
              </View>
              <View style={styles.subjectStats}>
                <Text style={styles.trendIcon}>{getTrendIcon(subj.trend)}</Text>
                <View style={[styles.gradeBadge, getGradeBadgeStyle('letter', subj.average)]}>
                  <Text style={styles.gradeBadgeText}>{subj.average}</Text>
                </View>
              </View>
            </View>
            
            {/* Recent grades */}
            <View style={styles.recentGrades}>
              <Text style={styles.recentLabel}>Recent:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {subj.recentGrades.map((lesson: any) => (
                  <View 
                    key={lesson.id} 
                    style={[styles.miniGrade, getGradeBadgeStyle(lesson.grade_type, lesson.grade_value)]}
                  >
                    <Text style={styles.miniGradeText}>{lesson.grade_value}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        ))}
      </View>
      
      {/* Recent Grades Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Grades</Text>
        {gradeData.recentGrades.map((lesson: any) => (
          <View key={lesson.id} style={styles.gradeItem}>
            <View style={styles.gradeDate}>
              <Text style={styles.gradeDateText}>
                {format(parseISO(lesson.date), 'MMM d')}
              </Text>
            </View>
            <View style={styles.gradeInfo}>
              <Text style={styles.gradeSubject}>{lesson.subject}</Text>
              <Text style={styles.gradeTitle}>{lesson.title || 'Lesson'}</Text>
            </View>
            <View style={[styles.gradeBadge, getGradeBadgeStyle(lesson.grade_type, lesson.grade_value)]}>
              <Text style={styles.gradeBadgeText}>{lesson.grade_value}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 12,
  },
  subjectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 2,
  },
  subjectCount: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  subjectStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendIcon: {
    fontSize: 20,
  },
  recentGrades: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recentLabel: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  miniGrade: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  miniGradeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  gradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  gradeDate: {
    width: 50,
    alignItems: 'center',
    marginRight: 12,
  },
  gradeDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  gradeInfo: {
    flex: 1,
  },
  gradeSubject: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 2,
  },
  gradeTitle: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  gradeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  gradeBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  gradeA: { backgroundColor: '#10B981' },
  gradeB: { backgroundColor: '#3B82F6' },
  gradeC: { backgroundColor: '#F59E0B' },
  gradeD: { backgroundColor: '#F97316' },
  gradeF: { backgroundColor: '#EF4444' },
  gradePass: { backgroundColor: '#10B981' },
  gradeFail: { backgroundColor: '#EF4444' },
  gradeDefault: { backgroundColor: '#6B7280' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
});

