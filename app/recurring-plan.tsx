/**
 * Recurring Plan Screen — schedule curriculum lessons across school days
 */

import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useBreakStore } from '@/store/breakStore';
import {
  useLessonPlanStore,
  type LessonPlan,
  type LessonPlanItem,
} from '@/store/lessonPlanStore';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const WEEKDAY_OPTIONS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
] as const;

type WeekdayKey = (typeof WEEKDAY_OPTIONS)[number]['key'];

function hasUsableCurriculumPlan(
  plan: LessonPlan | null,
  items: LessonPlanItem[]
): boolean {
  if (!plan || items.length === 0) return false;
  return plan.source === 'library' || plan.source === 'manual';
}

function getAvailableSchoolDates(
  startDate: Date,
  endDate: Date,
  selectedDayNames: string[],
  isBreakDay: (date: Date) => boolean
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const final = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  final.setHours(23, 59, 59, 999);

  while (current <= final) {
    const dayName = format(current, 'EEEE').toLowerCase();
    if (selectedDayNames.includes(dayName) && !isBreakDay(current)) {
      dates.push(format(current, 'yyyy-MM-dd'));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function RecurringPlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; subject?: string }>();
  const studentId = typeof params.studentId === 'string' ? params.studentId : '';
  const subject = params.subject ? decodeURIComponent(params.subject) : '';

  const { students, fetchStudents } = useStudentStore();
  const { fetchPlan, fetchNextLesson } = useLessonPlanStore();
  const { fetchLessons } = useLessonStore();
  const { fetchBreaks, isBreakDay } = useBreakStore();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [planItems, setPlanItems] = useState<LessonPlanItem[]>([]);
  const [startItemId, setStartItemId] = useState<string | null>(null);
  const [endItemId, setEndItemId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<WeekdayKey[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d;
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const student = students.find((s) => s.id === studentId);
  const sortedItems = useMemo(
    () => planItems.slice().sort((a, b) => a.order_index - b.order_index),
    [planItems]
  );

  const startItem = sortedItems.find((item) => item.id === startItemId) ?? null;
  const endItem = sortedItems.find((item) => item.id === endItemId) ?? null;

  const endItemOptions = useMemo(() => {
    if (!startItem) return sortedItems;
    return sortedItems.filter((item) => item.order_index >= startItem.order_index);
  }, [sortedItems, startItem]);

  const lessonCount = useMemo(() => {
    if (!startItem || !endItem) return 0;
    return sortedItems.filter(
      (item) =>
        item.order_index >= startItem.order_index &&
        item.order_index <= endItem.order_index
    ).length;
  }, [sortedItems, startItem, endItem]);

  const selectedDayNames = useMemo(
    () => selectedDays.map((day) => day.toLowerCase()),
    [selectedDays]
  );

  const availableDates = useMemo(
    () => getAvailableSchoolDates(startDate, endDate, selectedDayNames, isBreakDay),
    [startDate, endDate, selectedDayNames, isBreakDay]
  );

  const availableDayCount = availableDates.length;
  const lessonsToCreate = Math.min(lessonCount, availableDayCount);

  const previewDetail = useMemo(() => {
    if (lessonCount > availableDayCount) {
      return `Not all lessons will fit — ${lessonCount - availableDayCount} will not be scheduled.`;
    }
    if (availableDayCount > lessonCount) {
      return `All ${lessonCount} lessons scheduled · ${availableDayCount - lessonCount} days left over.`;
    }
    if (lessonCount > 0 && lessonCount === availableDayCount) {
      return `Perfect fit — all ${lessonCount} lessons scheduled.`;
    }
    return null;
  }, [lessonCount, availableDayCount]);

  const loadPlanData = useCallback(async () => {
    if (!studentId || !subject) {
      setLoadError('Missing student or subject.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      await Promise.all([fetchStudents(), fetchBreaks()]);
      const [{ plan: loadedPlan, items }, next] = await Promise.all([
        fetchPlan(studentId, subject),
        fetchNextLesson(studentId, subject),
      ]);

      if (!hasUsableCurriculumPlan(loadedPlan, items)) {
        setLoadError('No curriculum with lessons found for this subject.');
        setPlan(null);
        setPlanItems([]);
        return;
      }

      const ordered = items.slice().sort((a, b) => a.order_index - b.order_index);
      setPlan(loadedPlan);
      setPlanItems(ordered);

      const defaultStartId =
        next?.item_id && ordered.some((item) => item.id === next.item_id)
          ? next.item_id
          : ordered[0]?.id ?? null;
      const defaultEndId = ordered[ordered.length - 1]?.id ?? null;

      setStartItemId(defaultStartId);
      setEndItemId(defaultEndId);
    } catch (error) {
      console.error('Failed to load recurring plan:', error);
      setLoadError('Could not load curriculum for this subject.');
    } finally {
      setLoading(false);
    }
  }, [studentId, subject, fetchStudents, fetchBreaks, fetchPlan, fetchNextLesson]);

  useEffect(() => {
    loadPlanData();
  }, [loadPlanData]);

  useEffect(() => {
    if (!startItem || !endItem) return;
    if (endItem.order_index < startItem.order_index) {
      setEndItemId(startItem.id);
    }
  }, [startItem, endItem]);

  const toggleDay = (day: WeekdayKey) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const handleStartItemSelect = (itemId: string) => {
    setStartItemId(itemId);
    const item = sortedItems.find((entry) => entry.id === itemId);
    const currentEnd = sortedItems.find((entry) => entry.id === endItemId);
    if (item && currentEnd && currentEnd.order_index < item.order_index) {
      setEndItemId(itemId);
    }
  };

  const runGenerate = async (count: number) => {
    if (!studentId || !subject || !startItem || !endItem || !plan) return;

    setGenerating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in');
        return;
      }

      const rangeItems = sortedItems.filter(
        (item) =>
          item.order_index >= startItem.order_index &&
          item.order_index <= endItem.order_index
      );
      const paired = rangeItems.slice(0, count).map((item, index) => ({
        item,
        date: availableDates[index],
      }));

      const lessonRows = paired.map(({ item, date }) => ({
        student_id: studentId,
        subject: subject.trim(),
        title: item.title,
        notes: null,
        completed: false,
        date,
        is_recurring: false,
        user_id: user.id,
      }));

      const { data: insertedLessons, error: insertError } = await supabase
        .from('lessons')
        .insert(lessonRows)
        .select();

      if (insertError || !insertedLessons?.length) {
        Alert.alert('Error', insertError?.message ?? 'Failed to create lessons');
        return;
      }

      const lessonStudentRecords = insertedLessons.map((lesson) => ({
        lesson_id: lesson.id,
        student_id: studentId,
      }));

      const { error: linkError } = await supabase
        .from('lesson_students')
        .insert(lessonStudentRecords);

      if (linkError) {
        console.error('Student linking error:', linkError);
      }

      const completionRows = paired.map(({ item, date }) => ({
        student_id: studentId,
        lesson_plan_item_id: item.id,
        subject: subject.trim(),
        title_snapshot: item.title,
        date,
        status: 'planned',
      }));

      const { error: completionError } = await supabase
        .from('lesson_completions')
        .insert(completionRows);

      if (completionError) {
        console.error('lesson_completions insert failed (non-blocking):', completionError);
      }

      await fetchLessons(undefined, undefined, true);

      Alert.alert('Success', `Created ${insertedLessons.length} lessons!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Generate recurring plan failed:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Something went wrong'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (generating || lessonsToCreate === 0) return;

    if (lessonCount > availableDayCount) {
      Alert.alert(
        'Not all lessons will fit',
        `Only ${lessonsToCreate} of ${lessonCount} lessons can be scheduled in this date range. Create ${lessonsToCreate} lessons?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create', onPress: () => runGenerate(lessonsToCreate) },
        ]
      );
      return;
    }

    runGenerate(lessonsToCreate);
  };

  const canGenerate =
    !generating &&
    !loading &&
    !loadError &&
    lessonsToCreate > 0 &&
    selectedDays.length > 0 &&
    endDate >= startDate;

  const renderDatePicker = (
    visible: boolean,
    value: Date,
    onChange: (date: Date) => void,
    onClose: () => void,
    title: string,
    minimumDate?: Date
  ) => {
    if (!visible) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal transparent animationType="slide" visible onRequestClose={onClose}>
          <Pressable style={styles.datePickerOverlay} onPress={onClose}>
            <Pressable style={styles.datePickerContainer} onPress={(e) => e.stopPropagation()}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.datePickerCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.datePickerTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerBody}>
                <DateTimePicker
                  value={value}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) onChange(date);
                  }}
                  minimumDate={minimumDate}
                  textColor="#000000"
                  accentColor={Colors.brand[500]}
                  themeVariant="light"
                  style={styles.datePickerSpinner}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="default"
        minimumDate={minimumDate}
        onChange={(event, date) => {
          onClose();
          if (event.type === 'set' && date) onChange(date);
        }}
      />
    );
  };

  const renderItemList = (
    items: LessonPlanItem[],
    selectedId: string | null,
    onSelect: (id: string) => void
  ) => (
    <ScrollView style={styles.itemListScroll} nestedScrollEnabled showsVerticalScrollIndicator>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.itemRow, selected && styles.itemRowSelected]}
            onPress={() => onSelect(item.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.itemRowText, selected && styles.itemRowTextSelected]}>
              {item.order_index}. {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.brand[500]} size="large" />
          <Text style={styles.loadingText}>Loading curriculum…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={Colors.brand[700]} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Cannot create recurring plan</Text>
          <Text style={styles.errorText}>
            {loadError ?? 'No curriculum with lessons found for this subject.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            disabled={generating}
          >
            <ArrowLeft size={20} color={Colors.brand[700]} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Recurring Plan</Text>
            <Text style={styles.subtitle}>
              {student?.name ?? 'Student'} · {subject} · {plan.name?.trim() || subject}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Start lesson</Text>
            {renderItemList(sortedItems, startItemId, handleStartItemSelect)}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>End lesson</Text>
            {renderItemList(endItemOptions, endItemId, setEndItemId)}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Schedule days</Text>
            <View style={styles.daysGrid}>
              {WEEKDAY_OPTIONS.map((day) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={[styles.dayButton, isSelected && styles.dayButtonActive]}
                    onPress={() => toggleDay(day.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.dayButtonText, isSelected && styles.dayButtonTextActive]}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Date range</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
              activeOpacity={0.7}
              disabled={generating}
            >
              <CalendarIcon size={20} color={Colors.brand[600]} />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonLabel}>Start</Text>
                <Text style={styles.dateButtonText}>
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateButton, styles.dateButtonSpaced]}
              onPress={() => setShowEndDatePicker(true)}
              activeOpacity={0.7}
              disabled={generating}
            >
              <CalendarIcon size={20} color={Colors.brand[600]} />
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonLabel}>End</Text>
                <Text style={styles.dateButtonText}>
                  {format(endDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>
              {lessonCount} lessons selected · {availableDayCount} available school days
            </Text>
            {previewDetail ? (
              <Text style={styles.previewDetail}>{previewDetail}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
            onPress={handleGenerate}
            disabled={!canGenerate}
            activeOpacity={0.8}
          >
            <Text style={styles.generateButtonText}>
              Create {lessonsToCreate} lesson{lessonsToCreate === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {renderDatePicker(
        showStartDatePicker,
        startDate,
        setStartDate,
        () => setShowStartDatePicker(false),
        'Start Date'
      )}
      {renderDatePicker(
        showEndDatePicker,
        endDate,
        setEndDate,
        () => setShowEndDatePicker(false),
        'End Date',
        startDate
      )}

      {generating ? (
        <View style={styles.generatingOverlay}>
          <ActivityIndicator color={Colors.brand[500]} size="large" />
          <Text style={styles.generatingText}>Creating lessons…</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.brand[50],
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.brand[700],
    fontWeight: '500',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.brand[700],
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[900],
    marginBottom: 12,
  },
  itemListScroll: {
    maxHeight: 200,
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  itemRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  itemRowSelected: {
    backgroundColor: Colors.brand[50],
  },
  itemRowText: {
    ...Typography.body,
    color: Colors.ui.text,
  },
  itemRowTextSelected: {
    color: Colors.brand[700],
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    minWidth: 52,
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  dayButtonTextActive: {
    color: 'white',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  dateButtonSpaced: {
    marginTop: 12,
  },
  dateButtonContent: {
    flex: 1,
  },
  dateButtonLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginBottom: 2,
  },
  dateButtonText: {
    ...Typography.body,
    color: Colors.brand[700],
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
    padding: 16,
    marginBottom: 24,
  },
  previewTitle: {
    ...Typography.label,
    color: Colors.brand[900],
    marginBottom: 6,
  },
  previewDetail: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 20,
  },
  generateButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    ...Typography.h3,
    color: Colors.brand[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  generatingText: {
    ...Typography.body,
    color: Colors.brand[700],
    fontWeight: '600',
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  datePickerCancel: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  datePickerBody: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
  },
  datePickerSpinner: {
    height: 200,
    width: '100%',
    backgroundColor: '#FFFFFF',
  },
});
