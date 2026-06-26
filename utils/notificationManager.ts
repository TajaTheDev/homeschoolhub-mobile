import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useScheduleStore } from '@/store/scheduleStore';
import { useBreakStore } from '@/store/breakStore';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return { success: false, error: 'Permission not granted' };
  }
  
  // For Android, set up notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendance', {
      name: 'Attendance Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }
  
  return { success: true };
}

/**
 * Check if a given date is a school day
 * Returns true only if:
 * 1. The day of week matches a configured school day
 * 2. The date is NOT within a break/holiday
 */
export async function isSchoolDay(date: Date): Promise<boolean> {
  try {
    // Get schedule and breaks from stores
    // Note: We need to ensure stores are initialized
    const scheduleStore = useScheduleStore.getState();
    const breakStore = useBreakStore.getState();
    
    // Fetch latest data if not loaded
    if (!scheduleStore.schedule) {
      await scheduleStore.fetchSchedule();
    }
    if (breakStore.breaks.length === 0) {
      await breakStore.fetchBreaks();
    }
    
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Convert JavaScript dayOfWeek to our format (0=Sunday, 1=Monday, etc.)
    // This matches the format returned by getSchoolDays() [0,1,2,3,4,5,6]
    const schoolDays = scheduleStore.getSchoolDays();
    const isConfiguredSchoolDay = schoolDays.includes(dayOfWeek);
    
    // Check if it's a break day
    const isBreak = breakStore.isBreakDay(date);
    
    const isSchoolDayResult = isConfiguredSchoolDay && !isBreak;

    return isSchoolDayResult;
  } catch (error: any) {
    console.error('❌ Error checking school day:', error);
    // Default to true (allow notification) if check fails
    return true;
  }
}

// Schedule attendance reminder for school days only
export async function scheduleAttendanceReminder(time: Date) {
  try {
    // First check permissions
    const permissionResult = await requestNotificationPermissions();
    if (!permissionResult.success) {
      throw new Error('Notification permissions not granted');
    }
    
    // Cancel existing reminders first
    await cancelAttendanceReminder();
    
    const hour = time.getHours();
    const minute = time.getMinutes();

    // Get school days configuration
    const scheduleStore = useScheduleStore.getState();
    if (!scheduleStore.schedule) {
      await scheduleStore.fetchSchedule();
    }
    
    const schoolDays = scheduleStore.getSchoolDays();
    
    if (schoolDays.length === 0) {
      // Default to Mon-Fri if no schedule
      schoolDays.push(1, 2, 3, 4, 5);
    }
    
    // Expo notifications use: 1=Sunday, 2=Monday, ..., 7=Saturday
    // Our format uses: 0=Sunday, 1=Monday, ..., 6=Saturday
    // Convert: our 0→1, 1→2, ..., 6→7
    const notificationIds: string[] = [];
    
    for (const day of schoolDays) {
      const expoWeekday = day + 1; // Convert our format to Expo format
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `attendance-reminder-${day}`, // Unique ID per day
        content: {
          title: "📚 Attendance Reminder",
          body: "Don't forget to mark today's attendance!",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: { type: 'attendance', dayOfWeek: day },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour: hour,
          minute: minute,
          channelId: Platform.OS === 'android' ? 'attendance' : undefined,
        },
      });
      
      notificationIds.push(notificationId);
    }

    return { success: true, ids: notificationIds };
    
  } catch (error: any) {
    console.error('❌ Error scheduling notification:', error);
    return { success: false, error: error.message };
  }
}

// Cancel attendance reminders
export async function cancelAttendanceReminder() {
  try {
    // Cancel only attendance-related notifications
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const attendanceNotifications = allNotifications.filter(n => 
      n.identifier.startsWith('attendance-reminder-')
    );
    
    for (const notification of attendanceNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Error cancelling notifications:', error);
    return { success: false, error: error.message };
  }
}

// Get all scheduled notifications (for debugging)
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

export default {
  requestNotificationPermissions,
  scheduleAttendanceReminder,
  cancelAttendanceReminder,
  getScheduledNotifications,
  isSchoolDay,
};
