/**
 * Calendar Screen
 * Modern, colorful calendar inspired by Pinterest examples
 * Matching onboarding aesthetic with vibrant colors and pill-style badges
 */

// PhotoGallery disabled for now
// import PhotoGallery from '@/components/lessons/PhotoGallery';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import { getSubjectColor } from '@/constants/Subjects';
import Typography from '@/constants/Typography';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
// import { LessonPhoto } from '@/types/database';
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
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // Photo gallery disabled for now
  // const [galleryVisible, setGalleryVisible] = useState(false);
  // const [galleryPhotos, setGalleryPhotos] = useState<LessonPhoto[]>([]);
  // const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchLessons(),
      ]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchStudents, fetchLessons]);

  const calendarDays = useMemo(() => getCalendarDays(currentDate), [currentDate]);

  const getLessonsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessons.filter((l) => l.date === dateStr);
  };

  const selectedDateLessons = useMemo(() => {
    if (!selectedDate) return [];
    return getLessonsForDate(selectedDate);
  }, [selectedDate, lessons]);

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
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
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
            style={styles.navButton}
          >
            <ChevronRight size={24} color={Colors.ui.text} />
          </TouchableOpacity>
        </View>

        {/* Calendar Container */}
        {loading ? (
          <CalendarSkeleton />
        ) : (
          <View style={styles.calendar}>
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

                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.dayCell}
                    onPress={() => setSelectedDate(day)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayCellInner,
                        dayLessons.length > 0 && !isTodayDate && !isSelected && styles.dayCellWithLessons,
                        isTodayDate && styles.todayCell,
                        isSelected && !isTodayDate && styles.selectedCell,
                        isOtherMonth && styles.otherMonthCell,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          isTodayDate && styles.dayNumberToday,
                          isSelected && !isTodayDate && styles.dayNumberSelected,
                          isOtherMonth && styles.otherMonthText,
                        ]}
                      >
                        {format(day, 'd')}
                      </Text>
                    </View>

                    {/* Lesson Indicators */}
                    {dayLessons.length > 0 && (
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
          </View>
        )}

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
                      activeOpacity={0.8}
                    >
                      <View style={styles.lessonHeader}>
                        <View style={styles.lessonHeaderLeft}>
                          {/* Small Avatar */}
                          {student && (
                            <Avatar
                              type={student.avatar_type || 'initial'}
                              value={student.avatar_value}
                              name={student.name}
                              color={Colors.student[student.color_theme]}
                              size={24}
                            />
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

                          {/* Student Name */}
                          {student && (
                            <Text style={styles.studentNameText}>{student.name}</Text>
                          )}
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

                      {lesson.notes && (
                        <Text style={styles.lessonNotes} numberOfLines={2}>
                          {lesson.notes}
                        </Text>
                      )}

                      {/* 
                        TODO: Re-enable photo attachments in v2.0
                        - Issue: Supabase Storage permission problems
                        - Alternative: Use Cloudinary or other service
                        - Database tables exist: lesson_photos
                        - Storage bucket exists: student-avatars (or lesson-photos)
                      */}
                      {/* {lesson.photos && lesson.photos.length > 0 && (
                        <TouchableOpacity
                          style={styles.photoIndicator}
                          onPress={() => {
                            setGalleryPhotos(lesson.photos || []);
                            setGalleryIndex(0);
                            setGalleryVisible(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.photoThumbnails}>
                            {lesson.photos.slice(0, 3).map((photo, index) => (
                              <Image
                                key={photo.id}
                                source={{ uri: getPhotoUrl(photo.photo_path) }}
                                style={[styles.photoThumbnail, { marginLeft: index > 0 ? -8 : 0 }]}
                                onError={() => console.error('Thumbnail load failed:', photo.photo_path)}
                              />
                            ))}
                          </View>
                          {lesson.photos.length > 3 && (
                            <Text style={styles.photoCount}>+{lesson.photos.length - 3}</Text>
                          )}
                        </TouchableOpacity>
                      )} */}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}
        </ScrollView>
      </Animated.View>

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

      {/* Photo Gallery Modal - Disabled for now */}
      {/* <PhotoGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        photos={galleryPhotos}
        initialIndex={galleryIndex}
      /> */}
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
  photoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  photoThumbnails: {
    flexDirection: 'row',
    marginRight: 8,
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
});
