import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useScheduleStore } from '@/store/scheduleStore';
import { SchoolSchedule } from '@/types/database';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = [
  { key: 'sunday', label: 'Sunday', number: 0 },
  { key: 'monday', label: 'Monday', number: 1 },
  { key: 'tuesday', label: 'Tuesday', number: 2 },
  { key: 'wednesday', label: 'Wednesday', number: 3 },
  { key: 'thursday', label: 'Thursday', number: 4 },
  { key: 'friday', label: 'Friday', number: 5 },
  { key: 'saturday', label: 'Saturday', number: 6 },
];

const PRESETS = [
  {
    name: 'Traditional (Mon-Fri)',
    schedule: {
      sunday: false,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
    },
  },
  {
    name: 'Year-Round (Mon-Sat)',
    schedule: {
      sunday: false,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
    },
  },
  {
    name: '4-Day Week (Mon-Thu)',
    schedule: {
      sunday: false,
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: false,
      saturday: false,
    },
  },
];

// Detect which preset matches the current schedule
const detectActivePreset = (schedule: SchoolSchedule | null): string | null => {
  if (!schedule) return null;

  // Traditional (Mon-Fri)
  if (
    !schedule.sunday &&
    schedule.monday &&
    schedule.tuesday &&
    schedule.wednesday &&
    schedule.thursday &&
    schedule.friday &&
    !schedule.saturday
  ) {
    return 'traditional';
  }
  
  // Year-Round (Mon-Sat)
  if (
    !schedule.sunday &&
    schedule.monday &&
    schedule.tuesday &&
    schedule.wednesday &&
    schedule.thursday &&
    schedule.friday &&
    schedule.saturday
  ) {
    return 'yearRound';
  }
  
  // 4-Day Week (Mon-Thu)
  if (
    !schedule.sunday &&
    schedule.monday &&
    schedule.tuesday &&
    schedule.wednesday &&
    schedule.thursday &&
    !schedule.friday &&
    !schedule.saturday
  ) {
    return 'fourDay';
  }
  
  // Custom (doesn't match any preset)
  return null;
};

export default function ScheduleSettingsScreen() {
  const router = useRouter();
  const scheduleStore = useScheduleStore();
  const { schedule, updateSchedule, fetchSchedule } = scheduleStore;
  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    const loadSchedule = async () => {
      await fetchSchedule();
      const currentSchedule = scheduleStore.schedule;
      
      if (currentSchedule) {
        setLocalSchedule(currentSchedule);
        // Detect which preset is active
        const preset = detectActivePreset(currentSchedule);
        setActivePreset(preset);
      }
    };
    
    loadSchedule();
  }, []);

  useEffect(() => {
    if (schedule) {
      setLocalSchedule(schedule);
      // Update active preset when schedule changes
      const preset = detectActivePreset(schedule);
      setActivePreset(preset);
    }
  }, [schedule]);

  const toggleDay = async (day: string) => {
    if (!localSchedule) return;

    const newSchedule = {
      ...localSchedule,
      [day]: !localSchedule[day as keyof typeof localSchedule],
    } as SchoolSchedule;

    setLocalSchedule(newSchedule);
    await updateSchedule({ [day]: !localSchedule[day as keyof typeof localSchedule] });
    
    // Check if new schedule matches a preset
    const preset = detectActivePreset(newSchedule);
    setActivePreset(preset);
    
    // Reschedule attendance reminders if they're enabled
    await rescheduleAttendanceRemindersIfEnabled();
  };

  const applyPreset = async (preset: 'traditional' | 'yearRound' | 'fourDay') => {
    if (!localSchedule) return;
    
    let newSchedule: Partial<SchoolSchedule>;
    
    switch (preset) {
      case 'traditional':
        newSchedule = {
          sunday: false,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
        };
        break;
      case 'yearRound':
        newSchedule = {
          sunday: false,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
        };
        break;
      case 'fourDay':
        newSchedule = {
          sunday: false,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: false,
          saturday: false,
        };
        break;
    }
    
    const updatedSchedule = { ...localSchedule, ...newSchedule } as SchoolSchedule;
    setLocalSchedule(updatedSchedule);
    setActivePreset(preset); // Keep it selected!
    await updateSchedule(newSchedule);
    
    // Reschedule attendance reminders if they're enabled
    await rescheduleAttendanceRemindersIfEnabled();
  };
  
  // Helper function to reschedule attendance reminders if enabled
  const rescheduleAttendanceRemindersIfEnabled = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { scheduleAttendanceReminder } = require('@/utils/notificationManager');
      
      const enabled = await AsyncStorage.getItem('attendanceRemindersEnabled');
      const savedTime = await AsyncStorage.getItem('reminderTime');
      
      if (enabled === 'true' && savedTime) {
        const time = new Date(savedTime);
        await scheduleAttendanceReminder(time);
        console.log('✅ Rescheduled attendance reminders for new school days');
      }
    } catch (error) {
      console.error('Error rescheduling attendance reminders:', error);
    }
  };

  if (!localSchedule) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.ui.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>School Schedule</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loading}>
          <Skeleton width={200} height={20} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>School Schedule</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            Select which days you typically do school. This helps track streaks accurately
            and schedule reminders.
          </Text>
        </View>

        {/* Quick Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <View style={styles.presetsContainer}>
            {/* Traditional Preset */}
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === 'traditional' && styles.presetButtonActive
              ]}
              onPress={() => applyPreset('traditional')}
              activeOpacity={0.7}
            >
              <View style={styles.presetButtonContent}>
                <Text style={[
                  styles.presetButtonText,
                  activePreset === 'traditional' && styles.presetButtonTextActive
                ]}>
                  Traditional (Mon-Fri)
                </Text>
                {activePreset === 'traditional' && (
                  <Check size={20} color="white" />
                )}
              </View>
            </TouchableOpacity>

            {/* Year-Round Preset */}
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === 'yearRound' && styles.presetButtonActive
              ]}
              onPress={() => applyPreset('yearRound')}
              activeOpacity={0.7}
            >
              <View style={styles.presetButtonContent}>
                <Text style={[
                  styles.presetButtonText,
                  activePreset === 'yearRound' && styles.presetButtonTextActive
                ]}>
                  Year-Round (Mon-Sat)
                </Text>
                {activePreset === 'yearRound' && (
                  <Check size={20} color="white" />
                )}
              </View>
            </TouchableOpacity>

            {/* 4-Day Week Preset */}
            <TouchableOpacity
              style={[
                styles.presetButton,
                activePreset === 'fourDay' && styles.presetButtonActive
              ]}
              onPress={() => applyPreset('fourDay')}
              activeOpacity={0.7}
            >
              <View style={styles.presetButtonContent}>
                <Text style={[
                  styles.presetButtonText,
                  activePreset === 'fourDay' && styles.presetButtonTextActive
                ]}>
                  4-Day Week (Mon-Thu)
                </Text>
                {activePreset === 'fourDay' && (
                  <Check size={20} color="white" />
                )}
              </View>
            </TouchableOpacity>

            {/* Custom indicator if no preset matches */}
            {activePreset === null && (
              <View style={styles.customIndicator}>
                <Text style={styles.customIndicatorText}>Custom Schedule</Text>
              </View>
            )}
          </View>
        </View>

        {/* Custom Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Schedule</Text>
          <View style={styles.daysContainer}>
            {DAYS.map((day) => (
              <View key={day.key} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <Switch
                  value={localSchedule[day.key as keyof typeof localSchedule] as boolean}
                  onValueChange={() => toggleDay(day.key)}
                  trackColor={{
                    false: Colors.ui.border,
                    true: Colors.brand[300],
                  }}
                  thumbColor={
                    localSchedule[day.key as keyof typeof localSchedule]
                      ? Colors.brand[500]
                      : '#f4f3f4'
                  }
                />
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your School Week</Text>
          <Text style={styles.summaryText}>
            You school{' '}
            <Text style={styles.summaryBold}>
              {DAYS.filter((d) => localSchedule[d.key as keyof typeof localSchedule]).length}{' '}
              days
            </Text>{' '}
            per week
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  descriptionCard: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  descriptionText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 12,
  },
  presetsContainer: {
    gap: 8,
  },
  presetButton: {
    backgroundColor: Colors.ui.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  presetButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  presetButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetButtonText: {
    ...Typography.label,
    fontSize: 15,
    color: Colors.ui.text,
  },
  presetButtonTextActive: {
    color: 'white',
  },
  customIndicator: {
    backgroundColor: Colors.secondary[100],
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  customIndicatorText: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.secondary[700],
  },
  daysContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  dayLabel: {
    ...Typography.body,
  },
  summaryCard: {
    backgroundColor: Colors.accent[100],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryTitle: {
    ...Typography.h4,
    fontSize: 16,
    marginBottom: 4,
    color: Colors.accent[600],
  },
  summaryText: {
    ...Typography.body,
    color: Colors.accent[600],
  },
  summaryBold: {
    fontFamily: 'Quicksand_700Bold',
  },
});

