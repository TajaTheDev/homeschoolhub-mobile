import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSubscriptionStore, type SubscriptionInfo } from '@/store/subscriptionStore';
import { scheduleAttendanceReminder } from '@/utils/notificationManager';

// Configure how notifications appear (single app-wide handler)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted');
    return false;
  }

  return true;
}

/**
 * Use a stored reminder time when it parses to a real Date.
 * Missing or invalid values fall back to 9:00 AM and are not written back.
 */
export function parseStoredReminderTime(value?: string | null): Date {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const fallback = new Date();
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// Schedule daily reminder (school days only)
export async function scheduleDailyReminder(
  hour: number = 9,
  minute: number = 0,
  schoolDays: number[] = [1, 2, 3, 4, 5]
) {
  // Cancel existing daily reminders
  const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const dailyReminders = allNotifications.filter(n => 
    n.identifier.startsWith('daily-reminder')
  );
  
  for (const reminder of dailyReminders) {
    await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
  }

  // Schedule for each school day
  // Note: Expo uses 1=Sunday, 2=Monday, 3=Tuesday, etc.
  // But we receive [1,2,3,4,5] for Mon-Fri from scheduleStore
  // So we need to add 1 to convert: Mon(1)→2, Tue(2)→3, etc.
  
  for (const day of schoolDays) {
    const expoWeekday = day === 0 ? 1 : day + 1; // Convert to Expo format
    
    await Notifications.scheduleNotificationAsync({
      identifier: `daily-reminder-${day}`,
      content: {
        title: "Time to log today's lessons! 📚",
        body: "A quiet nudge to write down what you did today.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'daily-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: expoWeekday,
        hour,
        minute,
      },
    });
  }
}

// Schedule streak reminder
export async function scheduleStreakReminder(
  currentStreak: number,
  hour: number = 19,
  minute: number = 0
) {
  await Notifications.cancelScheduledNotificationAsync('streak-reminder');

  // Callers pass hour+1; wrap past midnight so 11 PM + 1h is 12 AM, not 11 PM again.
  const wrappedHour = hour % 24;

  if (currentStreak > 0) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'streak-reminder',
      content: {
        title: `🔥 ${currentStreak}-day streak!`,
        body: "Don't break it! Log a lesson today.",
        sound: true,
        data: { type: 'streak-reminder', streak: currentStreak },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: wrappedHour,
        minute,
      },
    });
  }
}

// Send goal celebration notification (immediate)
export async function sendGoalCelebration(studentName: string, subject: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🎉 Goal Reached!`,
      body: `${studentName} completed their ${subject} goal!`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: { type: 'goal-celebration' },
    },
    trigger: null, // Send immediately
  });
}

/**
 * Cancel lesson-notification schedules only (daily-reminder-* and streak-reminder).
 * Does not cancel attendance-reminder-*, orphan attendance, or trial-reminder-*.
 * Sign-out uses a separate full cancel — do not reuse this for that path.
 */
export async function cancelAllNotifications() {
  const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = allNotifications.filter(
    (n) =>
      n.identifier.startsWith('daily-reminder') ||
      n.identifier === 'streak-reminder'
  );

  for (const notification of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
}

/**
 * Cancel every scheduled notification for this app.
 * Use on sign-out only. Lesson master toggle must keep using cancelAllNotifications.
 */
export async function cancelEveryScheduledNotification() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancel trial countdown reminders only (trial-reminder-*).
 */
export async function cancelTrialReminders() {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const trialReminders = existing.filter((n) =>
    n.identifier.startsWith('trial-reminder')
  );
  for (const reminder of trialReminders) {
    await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
  }
}

/**
 * Schedule 7/3/1-day trial countdown reminders. Identifiers and DATE triggers unchanged.
 */
export async function scheduleTrialReminders(endDate: Date) {
  try {
    await cancelTrialReminders();

    const now = new Date();

    const sevenDaysBefore = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (sevenDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'trial-reminder-7',
        content: {
          title: '7 Days Left in Your Trial',
          body: 'Keep tracking your homeschool journey - subscribe to continue!',
          sound: true,
          data: { type: 'trial-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: sevenDaysBefore,
        },
      });
    }

    const threeDaysBefore = new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (threeDaysBefore > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'trial-reminder-3',
        content: {
          title: '3 Days Left in Your Trial',
          body: "Don't lose access! Subscribe today for just $4.99/month",
          sound: true,
          data: { type: 'trial-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: threeDaysBefore,
        },
      });
    }

    const oneDayBefore = new Date(endDate.getTime() - 1 * 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: 'trial-reminder-1',
        content: {
          title: 'Last Day of Your Trial!',
          body: 'Subscribe now to keep all your homeschool data and memories',
          sound: true,
          data: { type: 'trial-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: oneDayBefore,
        },
      });
    }
  } catch (error) {
    console.error('Error scheduling trial reminders:', error);
  }
}

/**
 * Schedule trial reminders for an active trial; cancel them when paid or expired.
 */
export async function syncTrialRemindersFromSubscription(info: SubscriptionInfo) {
  const trialEndDate = info.trialEndDate ? new Date(info.trialEndDate) : null;
  const shouldSchedule =
    !!trialEndDate &&
    info.subscriptionStatus !== 'active' &&
    info.daysRemaining > 0;

  if (shouldSchedule && trialEndDate) {
    await scheduleTrialReminders(trialEndDate);
    return;
  }

  await cancelTrialReminders();
}

/**
 * Restore lesson, attendance, and trial schedules from retained prefs / trial state.
 * Idempotent. Safe on cold start and after sign-in. Skips trial when there is no session.
 */
export async function restoreScheduledRemindersFromPrefs() {
  try {
    const settings = await AsyncStorage.getItem('notification-settings');

    if (settings) {
      const parsed = JSON.parse(settings);

      if (parsed.enabled && parsed.dailyReminder) {
        const scheduleStore = useScheduleStore.getState();
        await scheduleStore.fetchSchedule();
        const schoolDays = scheduleStore.getSchoolDays();
        const reminderTime = parseStoredReminderTime(parsed.reminderTime);
        await scheduleDailyReminder(
          reminderTime.getHours(),
          reminderTime.getMinutes(),
          schoolDays
        );
      }
    }
  } catch (error) {
    console.error('Error restoring lesson reminders:', error);
  }

  try {
    const attendanceEnabled = await AsyncStorage.getItem('attendanceRemindersEnabled');
    if (attendanceEnabled === 'true') {
      const savedTime = await AsyncStorage.getItem('reminderTime');
      const time = parseStoredReminderTime(savedTime);
      await scheduleAttendanceReminder(time);
    }
  } catch (error) {
    console.error('Error restoring attendance reminders:', error);
  }

  try {
    if (!supabase) {
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return;
    }
    const info = await useSubscriptionStore.getState().checkSubscription();
    await syncTrialRemindersFromSubscription(info);
  } catch (error) {
    console.error('Error restoring trial reminders:', error);
  }
}

// Get scheduled notifications (for debugging)
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

