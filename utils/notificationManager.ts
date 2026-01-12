import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

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

// Schedule daily attendance reminder
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
    
    console.log(`⏰ Scheduling daily reminder for ${hour}:${minute}`);
    
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "📚 Attendance Reminder",
        body: "Don't forget to mark today's attendance!",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: 'attendance' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hour,
        minute: minute,
        repeats: true,
        channelId: Platform.OS === 'android' ? 'attendance' : undefined,
      },
    });
    
    console.log('✅ Notification scheduled:', notificationId);
    return { success: true, id: notificationId };
    
  } catch (error: any) {
    console.error('❌ Error scheduling notification:', error);
    return { success: false, error: error.message };
  }
}

// Cancel attendance reminders
export async function cancelAttendanceReminder() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All scheduled notifications cancelled');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error cancelling notifications:', error);
    return { success: false, error: error.message };
  }
}

// Get all scheduled notifications (for debugging)
export async function getScheduledNotifications() {
  const notifications = await Notifications.getAllScheduledNotificationsAsync();
  console.log('📋 Scheduled notifications:', notifications);
  return notifications;
}

export default {
  requestNotificationPermissions,
  scheduleAttendanceReminder,
  cancelAttendanceReminder,
  getScheduledNotifications,
};
