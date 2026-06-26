import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Configure how notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
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

// Schedule daily reminder (school days only)
export async function scheduleDailyReminder(
  hour: number = 18,
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
        body: "Keep your homeschool streak going!",
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
        hour,
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

// Cancel all notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get scheduled notifications (for debugging)
export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

