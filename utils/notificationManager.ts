import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications behave when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async () => {
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for notifications');
    return false;
  }
  
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B5CF6',
    });
  }
  
  return true;
};

export const scheduleAttendanceReminder = async (hour: number = 9, minute: number = 0) => {
  try {
    // Cancel any existing attendance reminders
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduledNotifications) {
      if (notification.content.data?.type === 'attendance') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    
    // Schedule new daily reminder
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 Time to Take Attendance!',
        body: 'Don\'t forget to mark today\'s attendance for your students.',
        data: { type: 'attendance' },
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });
    
    console.log('✅ Attendance reminder scheduled:', identifier);
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const cancelAttendanceReminder = async () => {
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduledNotifications) {
    if (notification.content.data?.type === 'attendance') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
  console.log('✅ Attendance reminders cancelled');
};

export const sendImmediateNotification = async (title: string, body: string) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null, // Send immediately
  });
};

