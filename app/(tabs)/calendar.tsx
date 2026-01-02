/**
 * Calendar Screen
 * Modern, colorful calendar inspired by Pinterest examples
 * Matching onboarding aesthetic with vibrant colors and pill-style badges
 */

import PhotoGalleryModal from '@/components/lessons/PhotoGalleryModal';
import PhotoGallery from '@/components/lessons/PhotoGallery';
import LessonModal from '@/components/lessons/LessonModal';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useStudentStore } from '@/store/studentStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import type { Lesson } from '@/types';
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
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
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
const getPhotoUrl = (path: string) => {
  if (!path) return '';
  
  // Clean the path - remove leading/trailing slashes
  let cleanPath = path.trim();
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  if (cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  
  const { data } = supabase.storage
    .from('lesson-photos')
    .getPublicUrl(cleanPath);
  return data.publicUrl;
};

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

export default function CalendarScreen() {
  const router = useRouter();
  const { students, fetchStudents } = useStudentStore();
  const lessonStore = useLessonStore();
  const { lessons, fetchLessons, toggleCompleteOptimistic } = lessonStore;
  const { breaks, isBreakDay, fetchBreaks } = useScheduleStore();
  const { attendance, hasAttendanceForDate, fetchAttendance } = useAttendanceStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  // Photo gallery state
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  // Day lessons modal state
  const [showDayLessonsModal, setShowDayLessonsModal] = useState(false);
  const [selectedDayLessons, setSelectedDayLessons] = useState<Lesson[]>([]);
  const [selectedEmptyDate, setSelectedEmptyDate] = useState<Date | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [showEditLessonModal, setShowEditLessonModal] = useState(false);
  // Photo gallery for day lessons modal
  const [showDayPhotoGallery, setShowDayPhotoGallery] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      // Show skeletons immediately, no loading state check
      await Promise.all([
        fetchStudents(),
        fetchLessons(),
        fetchBreaks(),
        fetchAttendance(),
      ]);
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Check attendance data
  useEffect(() => {
    console.log('📅 CALENDAR ATTENDANCE:', {
      attendanceCount: attendance.length,
      sample: attendance.slice(0, 3).map(a => ({
        date: a.date,
        student_id: a.student_id,
        present: a.present
      }))
    });
  }, [attendance]);

  // Debug: Check if breaks exist
  useEffect(() => {
    console.log('📅 Calendar - Loaded breaks:', breaks);
    if (breaks.length > 0) {
      const testDate = breaks[0].start_date;
      console.log(`Testing break check for ${testDate}:`, isBreakDay(testDate));
      console.log('Should be TRUE');
    }
  }, [breaks, isBreakDay]);

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

  const calendarDays = useMemo(() => getCalendarDays(currentDate), [currentDate]);

  const getLessonsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessons.filter((l) => l.date === dateStr);
  };

  const selectedDateLessons = useMemo(() => {
    if (!selectedDate) return [];
    return getLessonsForDate(selectedDate);
  }, [selectedDate, lessons]);

  // Calculate attendance status for a date
  const getAttendanceStatus = (dateString: string) => {
    const records = attendance.filter(a => a.date === dateString);
    
    if (records.length === 0) {
      return null; // No attendance taken
    }
    
    const totalStudents = students.length;
    const presentCount = records.filter(r => r.present).length;
    
    if (presentCount === totalStudents) {
      return 'all_present'; // Green
    } else if (presentCount === 0) {
      return 'all_absent'; // Red
    } else {
      return 'mixed'; // Yellow/Orange
    }
  };

  // Handle date tap to show lessons
  const handleDatePress = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    
    // Get all lessons for this date
    const dayLessons = lessons.filter(lesson => lesson.date === dateString);
    
    console.log(`📅 Tapped ${dateString}, found ${dayLessons.length} lessons`);
    
    if (dayLessons.length > 0) {
      // Show lessons
      setSelectedDayLessons(dayLessons);
      setSelectedEmptyDate(null);
      setShowDayLessonsModal(true);
    } else {
      // Show empty day modal
      setSelectedEmptyDate(date);
      setSelectedDayLessons([]);
      setShowDayLessonsModal(true);
    }
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

  // Calendar Skeleton
  const CalendarSkeleton = () => (
    <View style={styles.calendar}>
      {/* Month header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
        <Skeleton width={120} height={24} />
        <Skeleton width={80} height={32} borderRadius={16} />
      </View>
      
      {/* Calendar grid */}
      <View>
        {[...Array(5)].map((_, row) => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
            {[...Array(7)].map((_, col) => (
              <Skeleton key={col} width={40} height={40} borderRadius={20} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <Text style={styles.headerSubtitle}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
        </View>

        {/* Month Navigation Header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => setCurrentDate(subMonths(currentDate, 1))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.navButton}
            activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <Text style={styles.todayButtonText}>Today</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setCurrentDate(addMonths(currentDate, 1))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.navButton}
            activeOpacity={0.7}
          >
            <ChevronRight size={24} color={Colors.ui.text} />
          </TouchableOpacity>
        </View>

        {/* Calendar Container */}
        {lessons.length === 0 && students.length === 0 ? (
          <CalendarSkeleton />
        ) : (
          <Animated.View style={[styles.calendar, { opacity: contentFadeAnim }]}>
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
                const isTodayDate = isToday(day);
                const isOtherMonth = !isSameMonth(day, currentDate);
                const dateString = format(day, 'yyyy-MM-dd');
                
                // Check if this date is during a break
                const isBreak = isBreakDay(day);
                const attendanceStatus = getAttendanceStatus(dateString);
                
                // Find which break this date belongs to
                const breakInfo = breaks.find(b => 
                  dateString >= b.start_date && dateString <= b.end_date
                );
                
                // Debug first few days
                if (index < 5 && breaks.length > 0) {
                  console.log(`Day ${format(day, 'MMM d')}: isBreak=${isBreak}`, breakInfo?.name);
                }

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      isBreak && styles.dayCellBreak
                    ]}
                    onPress={() => handleDatePress(day)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        dayLessons.length > 0 && !isTodayDate && !isSelected && !isBreak && styles.dayCellWithLessons,
                        isTodayDate && styles.todayCell,
                        isSelected && !isTodayDate && styles.selectedCell,
                        isOtherMonth && styles.otherMonthCell,
                        isBreak && styles.dayCellInnerBreak,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          isTodayDate && styles.dayNumberToday,
                          isSelected && !isTodayDate && styles.dayNumberSelected,
                          isOtherMonth && styles.otherMonthText,
                          isBreak && styles.dayTextBreak,
                        ]}
                      >
                        {format(day, 'd')}
                      </Text>
                    </View>

                    {/* Break Indicator - top right */}
                    {isBreak && breakInfo && (
                      <View style={styles.breakIndicator}>
                        <Text style={styles.breakIndicatorText}>
                          {breakInfo.emoji || '🎄'}
                        </Text>
                      </View>
                    )}

                    {/* Attendance Indicator - bottom right */}
                    {attendanceStatus && !isBreak && (
                      <View style={[
                        styles.attendanceIndicator,
                        attendanceStatus === 'all_present' && styles.attendanceAllPresent,
                        attendanceStatus === 'mixed' && styles.attendanceMixed,
                        attendanceStatus === 'all_absent' && styles.attendanceAllAbsent,
                      ]}>
                        <Text style={styles.attendanceIcon}>
                          {attendanceStatus === 'all_present' ? '✓' : 
                           attendanceStatus === 'mixed' ? '⚠' : 
                           '✗'}
                        </Text>
                      </View>
                    )}

                    {/* Lesson Indicators */}
                    {dayLessons.length > 0 && !isBreak && (
                      <View style={styles.lessonIndicators}>
                        {dayLessons
                          .slice(0, 3)
                          .map((lesson, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.lessonDot,
                                { backgroundColor: getSubjectColor(lesson.subject) }
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
          </Animated.View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Legend:</Text>
          
          <View style={styles.legendItems}>
            {/* All present */}
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.legendBadgeText}>✓</Text>
              </View>
              <Text style={styles.legendText}>All Present</Text>
            </View>
            
            {/* Mixed attendance */}
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.legendBadgeText}>⚠</Text>
              </View>
              <Text style={styles.legendText}>Mixed</Text>
            </View>
            
            {/* All absent */}
            <View style={styles.legendItem}>
              <View style={[styles.legendBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.legendBadgeText}>✗</Text>
              </View>
              <Text style={styles.legendText}>All Absent</Text>
            </View>
            
            {/* Break days */}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FEE2E2' }]} />
              <Text style={styles.legendText}>Break</Text>
            </View>
          </View>
        </View>

        {/* Selected Date Lessons Section */}
        {selectedDate && (
          <View style={styles.selectedDateSection}>
            <Text style={styles.selectedDateTitle}>
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </Text>

            {selectedDateLessons.length === 0 ? (
              <EmptyState
                icon={CalendarIcon}
                title="No Lessons Today"
                description={`No lessons scheduled for ${format(selectedDate, 'MMMM d, yyyy')}`}
                actionText="Add Lesson"
                onAction={() => {
                  // Navigate to add lesson
                  if (students[0]) {
                    router.push(`/students/${students[0].id}/add-lesson` as any);
                  }
                }}
              />
            ) : (
              <View style={styles.lessonList}>
                {selectedDateLessons.map((lesson) => {
                  const student = students.find((s) => s.id === lesson.student_id);
                  const subjectColor = getSubjectColor(lesson.subject);

                  return (
                    <TouchableOpacity
                      key={lesson.id}
                      style={[
                        styles.lessonCard,
                        { borderLeftColor: subjectColor }
                      ]}
                      onPress={() => {
                        // Open lesson detail modal
                        console.log('Tap to edit lesson:', lesson.id);
                      }}
                      activeOpacity={0.7}
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-lesson' as any)}
        activeOpacity={0.8}
      >
        <Plus size={28} color="white" />
      </TouchableOpacity>

      {/* Confetti - ABSOLUTELY LAST, after everything else */}
      {showConfetti && (
        <View style={styles.confettiWrapper}>
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

      {/* Day Lessons Modal */}
      <Modal
        visible={showDayLessonsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowDayLessonsModal(false);
          setSelectedEmptyDate(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dayLessonsModal}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDayLessons.length > 0 
                  ? format(new Date(selectedDayLessons[0].date), 'MMMM d, yyyy')
                  : selectedEmptyDate 
                    ? format(selectedEmptyDate, 'MMMM d, yyyy')
                    : ''
                }
              </Text>
              <TouchableOpacity onPress={() => {
                setShowDayLessonsModal(false);
                setSelectedEmptyDate(null);
              }}>
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>
            
            {/* Attendance Summary */}
            {(() => {
              const dateString = selectedDayLessons.length > 0 
                ? selectedDayLessons[0].date 
                : format(selectedEmptyDate || new Date(), 'yyyy-MM-dd');
              
              const attendanceRecords = attendance.filter(a => a.date === dateString);
              
              if (attendanceRecords.length > 0) {
                const presentCount = attendanceRecords.filter(r => r.present).length;
                const totalCount = students.length;
                const status = presentCount === totalCount ? 'all_present' 
                             : presentCount === 0 ? 'all_absent' 
                             : 'mixed';
                
                return (
                  <View style={[
                    styles.attendanceSummary,
                    status === 'all_present' && styles.attendanceSummaryGreen,
                    status === 'mixed' && styles.attendanceSummaryYellow,
                    status === 'all_absent' && styles.attendanceSummaryRed,
                  ]}>
                    <Text style={styles.attendanceSummaryIcon}>
                      {status === 'all_present' ? '✓' : status === 'mixed' ? '⚠' : '✗'}
                    </Text>
                    <Text style={styles.attendanceSummaryText}>
                      Attendance: {presentCount}/{totalCount} present
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
            
            {/* Content */}
            <ScrollView style={styles.modalContent}>
              {selectedDayLessons.length > 0 ? (
                // Show lessons
                <>
                  <Text style={styles.modalSubtitle}>
                    {selectedDayLessons.length} lesson{selectedDayLessons.length !== 1 ? 's' : ''} scheduled
                  </Text>
                  
                  {selectedDayLessons.map((lesson) => {
                    const student = students.find(s => s.id === lesson.student_id);
                    
                    return (
                      <TouchableOpacity
                        key={lesson.id}
                        style={styles.dayLessonCard}
                        onPress={() => {
                          setEditingLesson(lesson);
                          setShowDayLessonsModal(false);
                          setShowEditLessonModal(true);
                        }}
                      >
                        <View style={styles.lessonCardHeader}>
                          <View style={styles.subjectBadge}>
                            <Text style={styles.subjectBadgeText}>{lesson.subject}</Text>
                          </View>
                          {lesson.completed && (
                            <View style={styles.completedBadge}>
                              <Text style={styles.completedBadgeText}>✓</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={styles.studentName}>{student?.name}</Text>
                        
                        {lesson.title && (
                          <Text style={styles.lessonTitle}>{lesson.title}</Text>
                        )}
                        
                        {lesson.grade_value && (
                          <View style={styles.gradeBadgeSmall}>
                            <Text style={styles.gradeBadgeSmallText}>
                              {lesson.grade_value}
                              {lesson.grade_type === 'percentage' && '%'}
                              {lesson.grade_type === 'points' && `/${lesson.grade_max_points}`}
                            </Text>
                          </View>
                        )}

                        {/* Display first photo from lesson */}
                        {(() => {
                          let photoUrl = null;
                          const allPhotos: string[] = [];
                          
                          // Check photo_url field (single photo - legacy)
                          if (lesson.photo_url) {
                            photoUrl = lesson.photo_url;
                            allPhotos.push(lesson.photo_url);
                          }
                          
                          // Check photos array
                          if (lesson.photos && Array.isArray(lesson.photos) && lesson.photos.length > 0) {
                            lesson.photos.forEach((photo: any) => {
                              let url = '';
                              
                              if (typeof photo === 'string') {
                                url = photo;
                              } else if (photo && typeof photo === 'object') {
                                // Build from storage_path (NEW FORMAT)
                                if (photo.storage_path) {
                                  const { data } = supabase.storage
                                    .from('lesson-photos')
                                    .getPublicUrl(photo.storage_path);
                                  url = data.publicUrl;
                                }
                                // Legacy formats
                                else if (photo.photo_url) {
                                  url = photo.photo_url;
                                } else if (photo.url) {
                                  url = photo.url;
                                }
                              }
                              
                              if (url) {
                                if (!photoUrl) photoUrl = url; // First photo
                                allPhotos.push(url);
                              }
                            });
                          }
                          
                          if (!photoUrl) return null;
                          
                          return (
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                setSelectedPhotos(allPhotos);
                                setSelectedPhotoIndex(0);
                                setShowDayPhotoGallery(true);
                              }}
                              activeOpacity={0.8}
                              style={styles.lessonPhotoContainer}
                            >
                              <Image
                                source={{ uri: photoUrl }}
                                style={styles.lessonPhoto}
                                contentFit="cover"
                              />
                              {allPhotos.length > 1 && (
                                <View style={styles.photoOverlay}>
                                  <Text style={styles.photoOverlayText}>
                                    {allPhotos.length} photos - Tap to view
                                  </Text>
                                </View>
                              )}
                              {allPhotos.length === 1 && (
                                <View style={styles.photoOverlay}>
                                  <Text style={styles.photoOverlayText}>Tap to view full size</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })()}
                        
                        <Text style={styles.tapToEdit}>Tap to edit →</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                // Empty state
                <View style={styles.emptyDayState}>
                  <Text style={styles.emptyDayIcon}>📅</Text>
                  <Text style={styles.emptyDayText}>No lessons scheduled</Text>
                  <TouchableOpacity
                    style={styles.addLessonButton}
                    onPress={() => {
                      setShowDayLessonsModal(false);
                      const dateToPass = selectedEmptyDate;
                      setSelectedEmptyDate(null);
                      // Navigate to add lesson with pre-selected date
                      router.push({
                        pathname: '/add-lesson',
                        params: { 
                          preselectedDate: format(dateToPass!, 'yyyy-MM-dd')
                        }
                      } as any);
                    }}
                  >
                    <Text style={styles.addLessonButtonText}>+ Add Lesson</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Lesson Modal (reuse existing LessonModal component) */}
      {showEditLessonModal && editingLesson && (
        <LessonModal
          visible={showEditLessonModal}
          lesson={editingLesson}
          onClose={() => {
            setShowEditLessonModal(false);
            setEditingLesson(null);
          }}
          onSave={() => {
            setShowEditLessonModal(false);
            setEditingLesson(null);
            fetchLessons(); // Refresh lessons
          }}
        />
      )}

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        visible={showPhotoGallery}
        onClose={() => setShowPhotoGallery(false)}
        photos={galleryPhotos}
        initialIndex={galleryStartIndex}
      />

      {/* Photo Gallery for Day Lessons Modal */}
      <PhotoGallery
        visible={showDayPhotoGallery}
        photos={selectedPhotos}
        initialIndex={selectedPhotoIndex}
        onClose={() => setShowDayPhotoGallery(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    position: 'relative', // Important!
  },
  confettiWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: 'none', // Allow taps to pass through
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    ...Typography.h1,
    fontSize: 32,
    marginBottom: 4,
  },
  headerSubtitle: {
    ...Typography.body,
    color: Colors.ui.textLight,
    fontSize: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    ...Typography.h3,
    fontSize: 20,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.brand[100],
    borderRadius: 16,
  },
  todayButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: Colors.brand[700],
  },
  calendar: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 0,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  weekdayLabel: {
    width: '14.28%',
    textAlign: 'center',
    ...Typography.caption,
    color: Colors.ui.textLight,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  dayCellInner: {
    width: '85%',
    height: '85%',
    borderRadius: 20, // Circular
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dayCellWithLessons: {
    backgroundColor: Colors.brand[100], // Light purple tint
  },
  todayCell: {
    backgroundColor: Colors.brand[400],
    borderWidth: 2,
    borderColor: Colors.brand[600],
  },
  selectedCell: {
    backgroundColor: Colors.brand[300],
    borderWidth: 2,
    borderColor: Colors.brand[500],
  },
  otherMonthCell: {
    opacity: 0.3,
  },
  dayNumber: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: Colors.ui.text,
  },
  dayNumberToday: {
    color: 'white',
    fontWeight: 'bold',
  },
  dayNumberSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  otherMonthText: {
    color: Colors.ui.textLight,
  },
  lessonIndicators: {
    position: 'absolute',
    bottom: 2,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  moreIndicator: {
    fontSize: 8,
    color: Colors.ui.textLight,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  dayCellBreak: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dayCellInnerBreak: {
    backgroundColor: '#FEE2E2',
  },
  dayTextBreak: {
    color: '#991B1B',
    fontWeight: 'bold',
  },
  breakIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  breakIndicatorText: {
    fontSize: 10,
  },
  attendanceIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'white',
  },
  attendanceAllPresent: {
    backgroundColor: '#10B981',  // Green
  },
  attendanceMixed: {
    backgroundColor: '#F59E0B',  // Amber/Orange
  },
  attendanceAllAbsent: {
    backgroundColor: '#EF4444',  // Red
  },
  attendanceIcon: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
    lineHeight: 14,
  },
  legend: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    marginHorizontal: 16,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  legendText: {
    fontSize: 12,
    color: Colors.ui.textLight,
  },
  selectedDateSection: {
    paddingHorizontal: 0,
  },
  selectedDateTitle: {
    ...Typography.h3,
    marginBottom: 16,
  },
  lessonList: {
    gap: 12,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lessonHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  subjectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subjectPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: 'white',
  },
  studentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.ui.border,
  },
  studentPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: Colors.ui.text,
  },
  studentNameText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  lessonTitle: {
    ...Typography.body,
    marginBottom: 4,
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
  emptyText: {
    ...Typography.bodyLarge,
    textAlign: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  addButtonText: {
    ...Typography.button,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dayLessonsModal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  attendanceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 10,
    gap: 8,
  },
  attendanceSummaryGreen: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  attendanceSummaryYellow: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  attendanceSummaryRed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  attendanceSummaryIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  attendanceSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  modalContent: {
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
  dayLessonCard: {
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  lessonCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  subjectBadgeText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: 'white',
  },
  completedBadge: {
    backgroundColor: '#10B981',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadgeText: {
    fontSize: 16,
    color: 'white',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginBottom: 8,
  },
  gradeBadgeSmall: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brand[100],
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
  },
  gradeBadgeSmallText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.brand[700],
  },
  tapToEdit: {
    fontSize: 13,
    color: Colors.brand[600],
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
  },
  lessonPhotoContainer: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  lessonPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  photoOverlayText: {
    fontSize: 11,
    color: 'white',
    textAlign: 'center',
  },
  emptyDayState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDayIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyDayText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    marginBottom: 24,
  },
  addLessonButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addLessonButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
