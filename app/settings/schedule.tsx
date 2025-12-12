import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useScheduleStore } from '@/store/scheduleStore';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
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

export default function ScheduleSettingsScreen() {
  const router = useRouter();
  const { schedule, updateSchedule, fetchSchedule } = useScheduleStore();
  const [localSchedule, setLocalSchedule] = useState(schedule);

  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  const toggleDay = async (day: string) => {
    if (!localSchedule) return;

    const newSchedule = {
      ...localSchedule,
      [day]: !localSchedule[day as keyof typeof localSchedule],
    };

    setLocalSchedule(newSchedule);
    await updateSchedule({ [day]: !localSchedule[day as keyof typeof localSchedule] });
  };

  const applyPreset = async (preset: typeof PRESETS[0]) => {
    setLocalSchedule({ ...localSchedule, ...preset.schedule });
    await updateSchedule(preset.schedule);
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
          <Text style={styles.loadingText}>Loading...</Text>
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
            {PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                style={styles.presetButton}
                onPress={() => applyPreset(preset)}
              >
                <Text style={styles.presetButtonText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
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
    backgroundColor: Colors.background.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[300],
  },
  presetButtonText: {
    ...Typography.label,
    color: Colors.brand[600],
    textAlign: 'center',
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

