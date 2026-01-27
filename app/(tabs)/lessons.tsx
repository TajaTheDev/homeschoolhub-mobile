/**
 * All Lessons Screen
 * View and edit ALL lessons across all students and dates
 */

import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import type { Lesson } from '@/types';
import { getGradeDisplay } from '@/utils/gradeHelpers';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { BookOpen, Calendar, CheckCircle2, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Modal, Platform } from 'react-native';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Lazy load modal
const LessonModal = lazy(() => import('@/components/lessons/LessonModal'));

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return format(date, 'MMM d, yyyy');
};

export default function AllLessonsScreen() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [filterStudent, setFilterStudent] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { lessons, fetchLessons, loading, deleteLessons, toggleCompleteOptimistic } = useLessonStore();
  const { students } = useStudentStore();

  // Debug logging at component level (only log when lessons change significantly)
  useEffect(() => {
    console.log('📊 ALL LESSONS TAB - Total lessons:', lessons.length);
    // Only log sample lessons if there are few lessons
    if (lessons.length > 0 && lessons.length < 10) {
      console.log('  Sample lessons:', lessons.slice(0, 3).map(l => ({
        id: l.id,
        title: l.title,
        subject: l.subject,
        date: l.date
      })));
    }
  }, [lessons.length]);

  useEffect(() => {
    // Only log on initial mount
    fetchLessons(); // Fetch ALL lessons (no filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch once on mount

  // Refresh lessons when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reduced logging - only log if needed for debugging
      fetchLessons(); // Fetch ALL lessons (no filters)
    }, [fetchLessons])
  );

  // Get unique subjects from ALL lessons (dynamically)
  const allSubjects = useMemo(() => {
    const subjectSet = new Set<string>();
    
    lessons.forEach(lesson => {
      if (lesson.subject) {
        subjectSet.add(lesson.subject);
      }
    });
    
    // Convert to sorted array
    return Array.from(subjectSet).sort();
  }, [lessons]);

  // Log subject count (not full array)
  useEffect(() => {
    console.log('📚 Total unique subjects:', allSubjects.length);
  }, [allSubjects.length]);

  // Debug: Compare subjects from lessons vs student profiles
  useEffect(() => {
    // Get subjects from lessons
    const lessonSubjects = new Set<string>();
    lessons.forEach(l => {
      if (l.subject) lessonSubjects.add(l.subject);
    });
    
    // Get subjects from student profiles
    const studentSubjects = new Set<string>();
    students.forEach(s => {
      if (s.subjects) {
        s.subjects.forEach(sub => studentSubjects.add(sub));
      }
    });
    
    // Only log subject comparison if there are few subjects
    const lessonSubjectsArray = Array.from(lessonSubjects).sort();
    const studentSubjectsArray = Array.from(studentSubjects).sort();
    if (lessonSubjectsArray.length < 20 && studentSubjectsArray.length < 20) {
      console.log('📊 SUBJECT COMPARISON:', {
        lessonSubjectsCount: lessonSubjectsArray.length,
        studentSubjectsCount: studentSubjectsArray.length,
        lessonsCount: lessons.length,
        studentsCount: students.length
      });
    }
  }, [lessons, students]);

  // Filter and sort lessons
  const today = format(new Date(), 'yyyy-MM-dd');

  // Log total lessons (reduced frequency)
  useEffect(() => {
    console.log('📚 All Lessons - Total:', lessons.length, 'Active tab:', activeTab);
  }, [lessons.length, activeTab]);

  // Split into upcoming and past
  const upcomingLessons = useMemo(() => {
    const filtered = lessons
      .filter(lesson => lesson.date >= today)
      .filter((lesson) => {
        // Student filter - only apply if not 'all'
        if (filterStudent !== 'all' && lesson.student_id !== filterStudent) {
          return false;
        }
        
        // Subject filter - only apply if not 'all'
        if (filterSubject !== 'all' && lesson.subject !== filterSubject) {
          return false;
        }
        
        // Date range filter - only apply if not 'all'
        if (filterDateRange !== 'all') {
          const lessonDate = new Date(lesson.date);
          const now = new Date();
          
          if (filterDateRange === 'today') {
            const todayStr = format(now, 'yyyy-MM-dd');
            if (lesson.date !== todayStr) return false;
          } 
          else if (filterDateRange === 'this_week') {
            const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
            const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
            if (lessonDate < weekStart || lessonDate > weekEnd) return false;
          }
          else if (filterDateRange === 'this_month') {
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            if (lessonDate < monthStart || lessonDate > monthEnd) return false;
          }
          else if (filterDateRange === 'custom') {
            if (customStartDate) {
              const startDateStr = format(customStartDate, 'yyyy-MM-dd');
              if (lesson.date < startDateStr) return false;
            }
            if (customEndDate) {
              const endDateStr = format(customEndDate, 'yyyy-MM-dd');
              if (lesson.date > endDateStr) return false;
            }
          }
        }
        
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Closest first
    
    // Only log if count changed significantly
    return filtered;
  }, [lessons, filterStudent, filterSubject, filterDateRange, customStartDate, customEndDate, today]);

  const pastLessons = useMemo(() => {
    const filtered = lessons
      .filter(lesson => lesson.date < today)
      .filter((lesson) => {
        // Student filter - only apply if not 'all'
        if (filterStudent !== 'all' && lesson.student_id !== filterStudent) {
          return false;
        }
        
        // Subject filter - only apply if not 'all'
        if (filterSubject !== 'all' && lesson.subject !== filterSubject) {
          return false;
        }
        
        // Date range filter - only apply if not 'all'
        if (filterDateRange !== 'all') {
          const lessonDate = new Date(lesson.date);
          const now = new Date();
          
          if (filterDateRange === 'today') {
            const todayStr = format(now, 'yyyy-MM-dd');
            if (lesson.date !== todayStr) return false;
          } 
          else if (filterDateRange === 'this_week') {
            const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
            const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
            if (lessonDate < weekStart || lessonDate > weekEnd) return false;
          }
          else if (filterDateRange === 'this_month') {
            const monthStart = startOfMonth(now);
            const monthEnd = endOfMonth(now);
            if (lessonDate < monthStart || lessonDate > monthEnd) return false;
          }
          else if (filterDateRange === 'custom') {
            if (customStartDate) {
              const startDateStr = format(customStartDate, 'yyyy-MM-dd');
              if (lesson.date < startDateStr) return false;
            }
            if (customEndDate) {
              const endDateStr = format(customEndDate, 'yyyy-MM-dd');
              if (lesson.date > endDateStr) return false;
            }
          }
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Most recent first
    
    // Only log if count changed significantly
    return filtered;
  }, [lessons, filterStudent, filterSubject, filterDateRange, customStartDate, customEndDate, today]);

  const filteredLessons = activeTab === 'upcoming' ? upcomingLessons : pastLessons;

  // Debug logging for filtered results (only log when filters change)
  useEffect(() => {
    console.log('📊 FILTERED RESULTS:', {
      count: filteredLessons.length,
      upcoming: upcomingLessons.length,
      past: pastLessons.length,
      activeTab,
      filters: {
        student: filterStudent === 'all' ? 'all' : 'filtered',
        subject: filterSubject === 'all' ? 'all' : 'filtered',
        dateRange: filterDateRange === 'all' ? 'all' : filterDateRange
      }
    });
    // Only log sample lessons if there are few filtered results
    if (filteredLessons.length > 0 && filteredLessons.length < 10) {
      console.log('  Sample filtered lessons:', filteredLessons.slice(0, 3).map(l => ({
        id: l.id,
        title: l.title,
        subject: l.subject,
        date: l.date
      })));
    }
  }, [filteredLessons.length, upcomingLessons.length, pastLessons.length, activeTab, filterStudent, filterSubject, filterDateRange]);

  // Log final filtered count
  useEffect(() => {
    console.log(`📚 All Lessons - Showing ${filteredLessons.length} lessons (${activeTab} tab)`);
  }, [filteredLessons.length, activeTab]);

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setShowLessonModal(true);
  };

  const handleCloseModal = () => {
    setShowLessonModal(false);
    setSelectedLesson(null);
    fetchLessons(); // Refresh after edit
  };

  const getStudentName = (lesson: Lesson): string => {
    const student = students.find((s) => s.id === lesson.student_id);
    return student?.name || 'Unknown Student';
  };

  // Delete selected lessons (multi-select)
  const handleDeleteSelected = () => {
    const count = selectedLessonIds.length;
    
    Alert.alert(
      'Delete Selected Lessons?',
      `Are you sure you want to delete ${count} selected lesson${count > 1 ? 's' : ''}?\n\nThis cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: `Delete ${count}`,
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting lessons:', selectedLessonIds.length);
              
              // Delete using store method (updates store automatically)
              const result = await deleteLessons(selectedLessonIds);
              
              if (!result.success) {
                console.error('❌ Delete failed:', result.error);
                Alert.alert('Error', result.error || 'Failed to delete lessons');
                return;
              }
              
              console.log('✅ Deleted from database');
              
              // CRITICAL: Clear selection FIRST
              setSelectedLessonIds([]);
              setSelectionMode(false);
              
              // CRITICAL: Force fresh fetch from database
              console.log('🔄 Force refreshing lessons from database...');
              await fetchLessons();
              
              console.log('✅ Store refreshed, current count:', lessons.length);
              
              // Success
              showSnackbar(`Successfully deleted ${count} lesson${count > 1 ? 's' : ''}!`, 'success');
            } catch (error) {
              console.error('❌ Delete error:', error);
              Alert.alert('Error', 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  // Delete all filtered lessons (bulk operation)
  const handleDeleteAllFiltered = () => {
    const count = filteredLessons.length;
    const lessonIds = filteredLessons.map(l => l.id);
    
    // Build description of what will be deleted
    let description = `This will delete ${count} lesson${count > 1 ? 's' : ''}:\n\n`;
    
    if (filterStudent !== 'all') {
      const student = students.find(s => s.id === filterStudent);
      description += `• Student: ${student?.name}\n`;
    }
    
    if (filterSubject !== 'all') {
      description += `• Subject: ${filterSubject}\n`;
    }
    
    if (filterDateRange !== 'all') {
      if (filterDateRange === 'today') {
        description += `• Date: Today\n`;
      } else if (filterDateRange === 'this_week') {
        description += `• Date: This Week\n`;
      } else if (filterDateRange === 'this_month') {
        description += `• Date: This Month\n`;
      } else if (filterDateRange === 'custom' && customStartDate && customEndDate) {
        description += `• Date: ${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d, yyyy')}\n`;
      }
    }
    
    description += '\nThis cannot be undone.';
    
    Alert.alert(
      '⚠️ Delete All Filtered Lessons?',
      description,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: `Delete All ${count}`,
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting filtered lessons:', lessonIds.length);
              
              // Delete using store method (updates store automatically)
              const result = await deleteLessons(lessonIds);
              
              if (!result.success) {
                console.error('❌ Delete failed:', result.error);
                Alert.alert('Error', result.error || 'Failed to delete lessons');
                return;
              }
              
              console.log('✅ Deleted from database');
              
              // CRITICAL: Force fresh fetch from database
              console.log('🔄 Force refreshing lessons from database...');
              await fetchLessons();
              
              console.log('✅ Store refreshed, current count:', lessons.length);
              
              // Success
              showSnackbar(`Successfully deleted all ${count} filtered lesson${count > 1 ? 's' : ''}!`, 'success');
              // Reset filters
              setFilterStudent('all');
                    setFilterSubject('all');
                    setFilterDateRange('all');
                    setCustomStartDate(null);
                    setCustomEndDate(null);
            } catch (error) {
              console.error('Error in handleDeleteAllFiltered:', error);
              Alert.alert('Error', 'Something went wrong');
            }
          },
        },
      ]
    );
  };

  // Loading skeleton
  if (loading && lessons.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>All Lessons</Text>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="100%" height={120} borderRadius={16} style={{ marginBottom: 12 }} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredLessons}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.scrollableHeader}>
            {/* Title Row */}
            <View style={styles.titleRow}>
        <Text style={styles.title}>All Lessons</Text>
              
              <View style={styles.headerButtons}>
                {/* Delete All Filtered button */}
                {!selectionMode && (filterStudent !== 'all' || filterSubject !== 'all' || filterDateRange !== 'all') && filteredLessons.length > 0 && (
                  <TouchableOpacity
                    style={styles.deleteAllButton}
                    onPress={handleDeleteAllFiltered}
                  >
                    <Trash2 size={16} color={Colors.ui.error} />
                    <Text style={styles.deleteAllButtonText}>
                      Delete All ({filteredLessons.length})
                    </Text>
                  </TouchableOpacity>
                )}
                
                {/* Select/Cancel button */}
                {!selectionMode ? (
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setSelectionMode(true)}
                  >
                    <Text style={styles.selectButtonText}>Select</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setSelectionMode(false);
                      setSelectedLessonIds([]);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
      </View>
            
            {/* Tab Selector */}
            <View style={styles.tabSelector}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
                onPress={() => setActiveTab('upcoming')}
              >
                <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                  Upcoming ({upcomingLessons.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.tab, activeTab === 'past' && styles.tabActive]}
                onPress={() => setActiveTab('past')}
              >
                <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                  Past ({pastLessons.length})
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Selection mode banner */}
            {selectionMode && (
              <View style={styles.selectionBanner}>
                <Text style={styles.selectionBannerText}>
                  💡 Tap lessons to select • Use filters above to narrow down
                </Text>
              </View>
            )}

      {/* Filters */}
      <View style={styles.filters}>
        {/* Student Filter */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Student</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                filterStudent === 'all' && styles.filterPillActive,
              ]}
              onPress={() => setFilterStudent('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterStudent === 'all' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {students.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={[
                  styles.filterPill,
                  filterStudent === student.id && styles.filterPillActive,
                ]}
                onPress={() => setFilterStudent(student.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterStudent === student.id && styles.filterPillTextActive,
                  ]}
                >
                  {student.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subject Filter */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Subject</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                filterSubject === 'all' && styles.filterPillActive,
              ]}
              onPress={() => setFilterSubject('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  filterSubject === 'all' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
                  {allSubjects.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.filterPill,
                  filterSubject === subject && styles.filterPillActive,
                  filterSubject === subject && {
                    backgroundColor: getSubjectColor(subject),
                  },
                ]}
                onPress={() => setFilterSubject(subject)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterSubject === subject && styles.filterPillTextActive,
                  ]}
                >
                  {subject}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
              </View>

              {/* Date Range Filter */}
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Date Range</Text>
                <View style={styles.dateFilterButtons}>
                  <TouchableOpacity
                    style={[
                      styles.dateFilterButton,
                      filterDateRange === 'all' && styles.dateFilterButtonActive,
                    ]}
                    onPress={() => {
                      setFilterDateRange('all');
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFilterButtonText,
                        filterDateRange === 'all' && styles.dateFilterButtonTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.dateFilterButton,
                      filterDateRange === 'today' && styles.dateFilterButtonActive,
                    ]}
                    onPress={() => setFilterDateRange('today')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFilterButtonText,
                        filterDateRange === 'today' && styles.dateFilterButtonTextActive,
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.dateFilterButton,
                      filterDateRange === 'this_week' && styles.dateFilterButtonActive,
                    ]}
                    onPress={() => setFilterDateRange('this_week')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFilterButtonText,
                        filterDateRange === 'this_week' && styles.dateFilterButtonTextActive,
                      ]}
                    >
                      This Week
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.dateFilterButton,
                      filterDateRange === 'this_month' && styles.dateFilterButtonActive,
                    ]}
                    onPress={() => setFilterDateRange('this_month')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFilterButtonText,
                        filterDateRange === 'this_month' && styles.dateFilterButtonTextActive,
                      ]}
                    >
                      This Month
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.dateFilterButton,
                      filterDateRange === 'custom' && styles.dateFilterButtonActive,
                    ]}
                    onPress={() => setFilterDateRange('custom')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dateFilterButtonText,
                        filterDateRange === 'custom' && styles.dateFilterButtonTextActive,
                      ]}
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
        </View>
      </View>

              {/* Custom Date Range Picker */}
              {filterDateRange === 'custom' && (
                <View style={styles.customDateRange}>
                  <View style={styles.datePickerRow}>
                    <Text style={styles.datePickerLabel}>From:</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDatePicker('start')}
                    >
                      <Calendar size={16} color={Colors.brand[600]} />
                      <Text style={styles.datePickerButtonText}>
                        {customStartDate 
                          ? format(customStartDate, 'MMM d, yyyy')
                          : 'Select start date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.datePickerRow}>
                    <Text style={styles.datePickerLabel}>To:</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDatePicker('end')}
                    >
                      <Calendar size={16} color={Colors.brand[600]} />
                      <Text style={styles.datePickerButtonText}>
                        {customEndDate 
                          ? format(customEndDate, 'MMM d, yyyy')
                          : 'Select end date'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {customStartDate && customEndDate && (
                    <TouchableOpacity
                      style={styles.clearDatesButton}
                      onPress={() => {
                        setCustomStartDate(null);
                        setCustomEndDate(null);
                      }}
                    >
                      <Text style={styles.clearDatesButtonText}>Clear Dates</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            
            {/* Results count */}
            {filteredLessons.length > 0 && (
              <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                  {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''} found
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
        <EmptyState
          icon={BookOpen}
          title="No Lessons Found"
          description={
              filterStudent !== 'all' || filterSubject !== 'all' || filterDateRange !== 'all'
              ? 'Try adjusting your filters to see more lessons.'
              : 'Add lessons to start tracking your homeschooling progress!'
          }
          actionText={
            filterStudent !== 'all' || filterSubject !== 'all' || filterDateRange !== 'all'
              ? undefined
              : students.length === 0
              ? '+ Add Student First'
              : '+ Add Your First Lesson'
          }
          onAction={
            filterStudent !== 'all' || filterSubject !== 'all' || filterDateRange !== 'all'
              ? undefined
              : students.length === 0
              ? () => {
                  router.push('/add-student' as any);
                }
              : () => {
                  router.push('/add-lesson' as any);
                }
          }
        />
        }
        contentContainerStyle={[
          selectionMode && selectedLessonIds.length > 0 
            ? { paddingBottom: 100 } // Space for bottom bar
            : { paddingBottom: 20 }
        ]}
        showsVerticalScrollIndicator={true}
          renderItem={({ item }) => {
            const isSelected = selectedLessonIds.includes(item.id);
            const subjectColor = getSubjectColor(item.subject);
            const studentName = getStudentName(item);

            return (
              <TouchableOpacity
                style={[
                  styles.lessonCard,
                  isSelected && styles.lessonCardSelected
                ]}
                onPress={() => {
                  if (selectionMode) {
                    // Toggle selection
                    if (isSelected) {
                      setSelectedLessonIds(selectedLessonIds.filter(id => id !== item.id));
                    } else {
                      setSelectedLessonIds([...selectedLessonIds, item.id]);
                    }
                  } else {
                    // Normal edit
                    handleEditLesson(item);
                  }
                }}
                activeOpacity={0.7}
              >
                {/* Selection mode: Show checkbox */}
                {selectionMode && (
                  <View style={styles.checkboxContainer}>
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxChecked
                    ]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </View>
                )}
                
                {/* Lesson content */}
                <View style={styles.lessonContent}>
                <View style={styles.lessonHeader}>
                  <View style={styles.lessonHeaderLeft}>
                    <View
                      style={[
                        styles.subjectPill,
                        { backgroundColor: subjectColor + '20' },
                      ]}
                    >
                      <Text
                        style={[styles.subjectText, { color: subjectColor }]}
                      >
                        {item.subject}
                      </Text>
                    </View>
                    {item.completed && (
                      <View style={styles.completedBadge}>
                        <CheckCircle2 size={16} color={Colors.ui.success} />
                        <Text style={styles.completedText}>Completed</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.lessonHeaderRight}>
                    <Text style={styles.date}>{formatDate(item.date)}</Text>
                    {/* Completion toggle for past lessons (only when not in selection mode) */}
                    {activeTab === 'past' && !selectionMode && (
                      <TouchableOpacity
                        style={styles.completionToggle}
                        onPress={(e) => {
                          e.stopPropagation(); // Prevent triggering parent TouchableOpacity
                          const willBeCompleted = !item.completed;
                          toggleCompleteOptimistic(item.id);
                          showSnackbar(
                            willBeCompleted 
                              ? 'Marked as complete' 
                              : 'Marked as incomplete',
                            'success'
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.completionCheckbox,
                          item.completed && styles.completionCheckboxChecked
                        ]}>
                          {item.completed && (
                            <CheckCircle2 size={18} color="white" />
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>

                  {/* Grade Badge */}
                  {(() => {
                    const gradeDisplay = getGradeDisplay(
                      item.grade_type,
                      item.grade_value,
                      item.grade_max_points
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

                <View style={styles.lessonFooter}>
                  <Text style={styles.student}>{studentName}</Text>
                  {item.notes && (
                    <Text style={styles.notes} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
      />

      {/* Bottom Action Bar - Multi-select mode */}
      {selectionMode && selectedLessonIds.length > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <Text style={styles.selectedCount}>
              {selectedLessonIds.length} selected
            </Text>
            
            <View style={styles.bottomBarActions}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={() => {
                  if (selectedLessonIds.length === filteredLessons.length) {
                    // Deselect all
                    setSelectedLessonIds([]);
                  } else {
                    // Select all visible (filtered) lessons
                    setSelectedLessonIds(filteredLessons.map(l => l.id));
                  }
                }}
              >
                <Text style={styles.selectAllButtonText}>
                  {selectedLessonIds.length === filteredLessons.length 
                    ? 'Deselect All' 
                    : `Select All (${filteredLessons.length})`}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.deleteSelectedButton}
                onPress={handleDeleteSelected}
              >
                <Trash2 size={18} color="white" />
                <Text style={styles.deleteSelectedButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Date Pickers */}
      {showDatePicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={showDatePicker !== null}>
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>
                  {showDatePicker === 'start' ? 'Start Date' : 'End Date'}
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(null)}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={showDatePicker === 'start' 
                  ? (customStartDate || new Date())
                  : (customEndDate || new Date())}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    if (showDatePicker === 'start') {
                      setCustomStartDate(date);
                    } else {
                      setCustomEndDate(date);
                    }
                  }
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={showDatePicker === 'start' 
            ? (customStartDate || new Date())
            : (customEndDate || new Date())}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(null);
            if (event.type === 'set' && date) {
              if (showDatePicker === 'start') {
                setCustomStartDate(date);
              } else {
                setCustomEndDate(date);
              }
            }
          }}
        />
      )}

      {/* Edit Modal */}
      <Suspense fallback={<View />}>
        <LessonModal
          visible={showLessonModal}
          lesson={selectedLesson}
          onClose={handleCloseModal}
          onSave={handleCloseModal}
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
  header: {
    marginBottom: 20,
  },
  scrollableHeader: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subtitle: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  filters: {
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  filterPillActive: {
    backgroundColor: Colors.brand[100],
    borderColor: Colors.brand[400],
  },
  filterPillText: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.ui.text,
  },
  filterPillTextActive: {
    color: Colors.brand[700],
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  lessonCard: {
    flexDirection: 'row',
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
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subject: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  date: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '500',
  },
  lessonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lessonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentName: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 15,
    color: Colors.ui.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  lessonNotes: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 8,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  completionToggle: {
    marginLeft: 8,
  },
  completionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionCheckboxChecked: {
    backgroundColor: Colors.ui.success,
    borderColor: Colors.ui.success,
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
  skeletonContainer: {
    padding: 20,
  },
  tabSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginHorizontal: 20,
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
  tabTextActive: {
    color: Colors.brand[600],
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteAllButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.error,
  },
  selectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.brand[500],
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.ui.border,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  selectionBanner: {
    backgroundColor: Colors.brand[50],
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  selectionBannerText: {
    fontSize: 13,
    color: Colors.brand[700],
    textAlign: 'center',
  },
  lessonCardSelected: {
    backgroundColor: Colors.brand[50],
    borderWidth: 2,
    borderColor: Colors.brand[500],
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lessonContent: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.textLight,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCount: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  bottomBarActions: {
    flexDirection: 'row',
    gap: 12,
  },
  selectAllButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  selectAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  deleteSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: Colors.ui.error,
  },
  deleteSelectedButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
  },
  filterItem: {
    marginBottom: 16,
  },
  dateFilterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateFilterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  dateFilterButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  dateFilterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  dateFilterButtonTextActive: {
    color: 'white',
  },
  customDateRange: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    width: 50,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  datePickerButtonText: {
    fontSize: 14,
    color: Colors.ui.text,
    flex: 1,
  },
  clearDatesButton: {
    backgroundColor: Colors.ui.error,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  clearDatesButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  datePickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  datePickerCancel: {
    fontSize: 16,
    color: Colors.ui.error,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  resultsCount: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand[50],
    borderRadius: 10,
    marginBottom: 16,
  },
  resultsCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[700],
    textAlign: 'center',
  },
});

