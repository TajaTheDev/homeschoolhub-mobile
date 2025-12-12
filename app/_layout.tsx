import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts
} from '@expo-google-fonts/quicksand';
import * as SplashScreen from 'expo-splash-screen';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as notificationService from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useScheduleStore } from '@/store/scheduleStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { checkUser } = useAuthStore();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    initializeNotifications();
  }, []);

  useEffect(() => {
    // Listen for notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      
      console.log('Notification tapped:', data);
      
      // Navigate based on notification type
      if (data.type === 'daily-reminder') {
        // Navigate to dashboard
        router.push('/(tabs)/' as any);
      } else if (data.type === 'goal-celebration') {
        // Navigate to progress
        router.push('/(tabs)/progress' as any);
      } else if (data.type === 'streak-reminder') {
        // Navigate to calendar
        router.push('/(tabs)/calendar' as any);
      }
    });

    return () => subscription.remove();
  }, [router]);

  const initializeNotifications = async () => {
    try {
      // Load notification settings
      const settings = await AsyncStorage.getItem('notification-settings');
      
      if (settings) {
        const parsed = JSON.parse(settings);
        
        if (parsed.enabled && parsed.dailyReminder) {
          // Fetch schedule first to ensure it's loaded
          const scheduleStore = useScheduleStore.getState();
          await scheduleStore.fetchSchedule();
          
          // Get school days from schedule store
          const schoolDays = scheduleStore.getSchoolDays();
          
          // Schedule daily reminders
          const reminderTime = parsed.reminderTime 
            ? new Date(parsed.reminderTime) 
            : new Date();
          await notificationService.scheduleDailyReminder(
            reminderTime.getHours(),
            reminderTime.getMinutes(),
            schoolDays
          );
          
          console.log('✅ Notifications initialized');
        }
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.ui.background }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName="welcome">
            <Stack.Screen
              name="welcome"
              options={{ title: 'Welcome', headerShown: false }}
            />
            <Stack.Screen
              name="login"
              options={{ title: 'Log In', headerShown: false }}
            />
            <Stack.Screen
              name="signup"
              options={{ title: 'Sign Up', headerShown: false }}
            />
            <Stack.Screen
              name="onboarding/welcome"
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                title: 'Home',
                headerShown: false,
                contentStyle: { backgroundColor: Colors.ui.background },
              }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: 'modal', title: 'Modal' }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
