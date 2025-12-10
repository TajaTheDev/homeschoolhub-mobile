/**
 * Calendar Screen
 * Shows lessons organized by date with month navigation
 */

import Colors from '@/constants/Colors';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import {
    addMonths,
    endOfMonth,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    subMonths,
} from 'date-fns';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const getCalendarDays = (date: Date) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  // Get day of week for first day (0 = Sunday)
  const startDay = start.getDay();

  // Calculate start date (including previous month days)
  const calendarStart = new Date(start);
  calendarStart.setDate(calendarStart.getDate() - startDay);

  // Get all days to display (42 days = 6 weeks)
  const days = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(calendarStart);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  return days;
};

const getSubjectColor = (subject: string): string => {
  const colors: Record<string, string> = {
    Math: '#EF4444',
    Reading: '#3B82F6',
    Science: '#10B981',
    History: '#F59E0B',
    Writing: '#8B5CF6',
    Art: '#EC4899',
  };
  return colors[subject] || Colors.ui.textLight;
};

export default function CalendarScreen() {
  const router = useRouter();
  const { students, fetchStudents } = useStudentStore();
  const { lessons, fetchLessons, toggleComplete } = useLessonStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchLessons();
  }, [fetchStudents, fetchLessons]);

  const calendarDays = useMemo(() => getCalendarDays(currentDate), [currentDate]);

  const getLessonsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessons.filter((l) => l.date === dateStr);
  };

  const hasLessonsOnDate = (date: Date) => {
    return getLessonsForDate(date).length > 0;
  };

  const selectedDateLessons = useMemo(() => {
    if (!selectedDate) return [];
    return getLessonsForDate(selectedDate);
  }, [selectedDate, lessons]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Month Navigation Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setCurrentDate(subMonths(currentDate, 1))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={Colors.ui.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.monthTitle}>{format(currentDate, 'MMMM yyyy')}</Text>
            {!isSameMonth(currentDate, new Date()) && (
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(new Date());
                }}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setCurrentDate(addMonths(currentDate, 1))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronRight size={24} color={Colors.ui.text} />
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdayRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.weekdayLabel}>
              {day}
            </Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            const dayLessons = getLessonsForDate(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  isToday(day) && styles.todayCell,
                  isSelected && styles.selectedCell,
                  !isSameMonth(day, currentDate) && styles.otherMonthCell,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    isToday(day) && styles.todayText,
                    isSelected && styles.selectedText,
                    !isSameMonth(day, currentDate) && styles.otherMonthText,
                  ]}
                >
                  {format(day, 'd')}
                </Text>

                {/* Lesson Indicators */}
                {hasLessonsOnDate(day) && (
                  <View style={styles.indicatorRow}>
                    {dayLessons
                      .slice(0, 3) // Max 3 dots
                      .map((lesson, lessonIndex) => (
                        <View
                          key={lessonIndex}
                          style={[
                            styles.indicator,
                            { backgroundColor: getSubjectColor(lesson.subject) },
                          ]}
                        />
                      ))}
                    {dayLessons.length > 3 && (
                      <Text style={styles.moreIndicator}>+</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Lessons Section */}
        {selectedDate && (
          <View style={styles.lessonSection}>
            <Text style={styles.selectedDateTitle}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>

            {selectedDateLessons.length > 0 ? (
              <View style={styles.lessonList}>
                {selectedDateLessons.map((lesson) => {
                  const student = students.find((s) => s.id === lesson.student_id);

                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      style={styles.lessonCard}
                      onPress={() => {
                        // Open lesson detail modal (reuse LessonModal from dashboard)
                        // For now, just log
                        console.log('Tap to edit lesson:', lesson.id);
                      }}
                    >
                      <View style={styles.lessonHeader}>
                        <Text style={styles.studentName}>
                          {student?.name || 'Unknown'}
                        </Text>
                        <TouchableOpacity
                          onPress={async (e) => {
                            e.stopPropagation();
                            await toggleComplete(lesson.id);
                            await fetchLessons();
                          }}
                        >
                          {lesson.completed ? (
                            <View style={styles.checkbox}>
                              <Text style={styles.checkmark}>✓</Text>
                            </View>
                          ) : (
                            <View style={[styles.checkbox, styles.checkboxEmpty]} />
                          )}
                        </TouchableOpacity>
                      </View>

                      <View style={styles.lessonContent}>
                        <View
                          style={[
                            styles.subjectBadge,
                            { backgroundColor: getSubjectColor(lesson.subject) },
                          ]}
                        >
                          <Text style={styles.subjectText}>{lesson.subject}</Text>
                        </View>
                        <Text style={styles.lessonTitle}>{lesson.title}</Text>
                      </View>

                      {lesson.notes && (
                        <Text style={styles.lessonNotes} numberOfLines={2}>
                          {lesson.notes}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  No lessons scheduled for this day
                </Text>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => router.push('/add-lesson' as any)}
                >
                  <Text style={styles.addButtonText}>Add Lesson</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-lesson' as any)}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 100, // Space for FAB
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  monthTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.brand[100],
    borderRadius: 12,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.ui.textLight,
    textAlign: 'center',
    paddingVertical: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  todayCell: {
    backgroundColor: Colors.brand[50],
    borderColor: Colors.brand[400],
    borderWidth: 2,
  },
  selectedCell: {
    backgroundColor: Colors.brand[100],
  },
  otherMonthCell: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.ui.text,
    marginBottom: 2,
  },
  todayText: {
    fontWeight: 'bold',
    color: Colors.brand[700],
  },
  selectedText: {
    fontWeight: 'bold',
  },
  otherMonthText: {
    color: Colors.ui.textLight,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  moreIndicator: {
    fontSize: 8,
    color: Colors.ui.textLight,
    fontWeight: 'bold',
  },
  lessonSection: {
    marginTop: 16,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 12,
  },
  lessonList: {
    gap: 12,
  },
  lessonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.ui.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxEmpty: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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
  subjectText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  lessonTitle: {
    fontSize: 15,
    color: Colors.ui.text,
    flex: 1,
  },
  lessonNotes: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
