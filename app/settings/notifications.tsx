import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import * as notificationService from '@/services/notificationService';
import { useScheduleStore } from '@/store/scheduleStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Bell, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const router = useRouter();
  const { getSchoolDays } = useScheduleStore();
  
  const [enabled, setEnabled] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(true);
  const [streakReminder, setStreakReminder] = useState(true);
  const [goalCelebrations, setGoalCelebrations] = useState(true);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('notification-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setEnabled(parsed.enabled ?? false);
        setDailyReminder(parsed.dailyReminder ?? true);
        setStreakReminder(parsed.streakReminder ?? true);
        setGoalCelebrations(parsed.goalCelebrations ?? true);
        if (parsed.reminderTime) {
          setReminderTime(new Date(parsed.reminderTime));
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveSettings = async (updates: any) => {
    try {
      const settings = {
        enabled,
        dailyReminder,
        streakReminder,
        goalCelebrations,
        reminderTime: reminderTime.toISOString(),
        ...updates,
      };
      await AsyncStorage.setItem('notification-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const handleEnableToggle = async (value: boolean) => {
    if (value) {
      // Request permissions
      const hasPermission = await notificationService.requestNotificationPermissions();
      
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      
      // Schedule notifications
      await scheduleNotifications();
    } else {
      // Cancel all notifications
      await notificationService.cancelAllNotifications();
    }
    
    setEnabled(value);
    await saveSettings({ enabled: value });
  };

  const scheduleNotifications = async () => {
    const schoolDays = getSchoolDays();
    const hour = reminderTime.getHours();
    const minute = reminderTime.getMinutes();

    if (dailyReminder) {
      await notificationService.scheduleDailyReminder(hour, minute, schoolDays);
    }

    if (streakReminder) {
      // Get current streak from somewhere
      await notificationService.scheduleStreakReminder(0, hour + 1, minute);
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setReminderTime(selectedDate);
      await saveSettings({ reminderTime: selectedDate.toISOString() });
      
      if (enabled && dailyReminder) {
        await scheduleNotifications();
      }
    }
    if (Platform.OS === 'ios') {
      setShowTimePicker(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Toggle */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Bell size={24} color={Colors.brand[500]} />
            <Text style={styles.cardTitle}>Enable Notifications</Text>
          </View>
          <Text style={styles.cardDescription}>
            Get reminders to log lessons and celebrate achievements
          </Text>
          <Switch
            value={enabled}
            onValueChange={handleEnableToggle}
            trackColor={{ false: Colors.ui.border, true: Colors.brand[300] }}
            thumbColor={enabled ? Colors.brand[500] : '#f4f3f4'}
          />
        </View>

        {/* Daily Reminder */}
        <View style={[styles.section, !enabled && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Daily Reminders</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Lesson Reminder</Text>
              <Text style={styles.settingDescription}>
                Reminds you to log lessons (school days only)
              </Text>
            </View>
            <Switch
              value={dailyReminder}
              onValueChange={async (value) => {
                setDailyReminder(value);
                await saveSettings({ dailyReminder: value });
                if (enabled) await scheduleNotifications();
              }}
              disabled={!enabled}
              trackColor={{ false: Colors.ui.border, true: Colors.brand[300] }}
              thumbColor={dailyReminder ? Colors.brand[500] : '#f4f3f4'}
            />
          </View>

          {dailyReminder && (
            <TouchableOpacity
              style={[styles.timeButton, !enabled && styles.timeButtonDisabled]}
              onPress={() => setShowTimePicker(true)}
              disabled={!enabled}
            >
              <Text style={styles.timeButtonLabel}>Reminder Time</Text>
              <Text style={styles.timeButtonValue}>
                {reminderTime.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </Text>
            </TouchableOpacity>
          )}

          {showTimePicker && (
            <DateTimePicker
              value={reminderTime}
              mode="time"
              is24Hour={false}
              onChange={handleTimeChange}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            />
          )}
        </View>

        {/* Other Notifications */}
        <View style={[styles.section, !enabled && styles.sectionDisabled]}>
          <Text style={styles.sectionTitle}>Celebrations</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Streak Reminders</Text>
              <Text style={styles.settingDescription}>
                Keep your learning streak alive
              </Text>
            </View>
            <Switch
              value={streakReminder}
              onValueChange={async (value) => {
                setStreakReminder(value);
                await saveSettings({ streakReminder: value });
                if (enabled) await scheduleNotifications();
              }}
              disabled={!enabled}
              trackColor={{ false: Colors.ui.border, true: Colors.brand[300] }}
              thumbColor={streakReminder ? Colors.brand[500] : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Goal Achievements</Text>
              <Text style={styles.settingDescription}>
                Celebrate when goals are reached
              </Text>
            </View>
            <Switch
              value={goalCelebrations}
              onValueChange={async (value) => {
                setGoalCelebrations(value);
                await saveSettings({ goalCelebrations: value });
              }}
              disabled={!enabled}
              trackColor={{ false: Colors.ui.border, true: Colors.brand[300] }}
              thumbColor={goalCelebrations ? Colors.brand[500] : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Notifications respect your school schedule. Reminders only appear on school days!
          </Text>
        </View>

        {/* Test button removed - notifications working */}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.background.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  cardDescription: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionDisabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    ...Typography.label,
    fontSize: 15,
    marginBottom: 4,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  timeButtonDisabled: {
    opacity: 0.5,
  },
  timeButtonLabel: {
    ...Typography.label,
    color: Colors.brand[700],
  },
  timeButtonValue: {
    ...Typography.h4,
    fontSize: 16,
    color: Colors.brand[600],
  },
  infoCard: {
    backgroundColor: Colors.secondary[100],
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    ...Typography.bodySmall,
    color: Colors.secondary[700],
    lineHeight: 20,
  },
});

