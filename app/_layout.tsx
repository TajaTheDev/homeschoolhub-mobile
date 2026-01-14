
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, InteractionManager, View } from 'react-native';
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
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeRevenueCat } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase/client';
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
  const segments = useSegments();
  const [appReady, setAppReady] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'trial' | 'expired' | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  const checkSubscriptionStatus = async () => {
    // For beta testing, allow all users access
    // Everyone is in trial mode during beta
    setSubscriptionStatus('trial');
  };

  const initializeTrial = async () => {
    try {
      const trialStart = await AsyncStorage.getItem('trial_start_date');
      
      if (!trialStart) {
        // First time opening app - start 30-day trial
        const now = new Date();
        await AsyncStorage.setItem('trial_start_date', now.toISOString());
        console.log('✅ Trial started:', now.toISOString());
      } else {
        console.log('Trial already started:', trialStart);
      }
    } catch (error) {
      console.error('Error initializing trial:', error);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // RevenueCat disabled for beta testing
        // await initializeRevenueCat();
        
        // Check subscription status (disabled for beta - everyone gets trial access)
        try {
          await checkSubscriptionStatus();
        } catch (error) {
          console.error('Subscription check failed (non-critical):', error);
        }
        
        // Initialize trial (runs on every app start, but only sets date if not exists)
        try {
          await initializeTrial();
        } catch (error) {
          console.error('Trial initialization failed (non-critical):', error);
        }
        
        // Check authentication first
        try {
          await checkUser();
        } catch (error) {
          console.error('Auth check failed (non-critical):', error);
        }
        
        // Check if user is authenticated (wrap in try-catch)
        try {
          if (supabase) {
            // First check if there's a session before calling getUser()
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
              // Only call getUser() if we have a session
              const { data: { user }, error: userError } = await supabase.auth.getUser();
              
              if (userError) {
                console.error('Error getting user:', userError);
              } else if (user) {
                // User is authenticated - prefetch data immediately
                // console.log('🚀 Prefetching data for authenticated user...');
                // try {
                //   await Promise.all([
                //     useStudentStore.getState().fetchStudents(),
                //     useLessonStore.getState().fetchLessons(),
                //   ]);
                //   console.log('✅ Data prefetch complete');
                // } catch (prefetchError) {
                //   console.error('Data prefetch failed (non-critical):', prefetchError);
                // }
              }
            } else {
              // No session - this is normal during onboarding, don't log as error
              console.log('📝 No active session (user not logged in)');
            }
          }
        } catch (error) {
          console.error('User check failed (non-critical):', error);
        }
        
        setAppReady(true);
        
        // Fade in the app
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error('Critical error initializing app:', error);
        // Still allow app to render on error - better than crashing
        setAppReady(true);
        
        // Fade in even on error
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    };

    if (fontsLoaded) {
      initializeApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, appReady]);

  // Initialize RevenueCat on app start
  useEffect(() => {
    const init = async () => {
      const success = await initializeRevenueCat();
      if (!success) {
        console.warn('RevenueCat initialization failed - subscriptions may not work');
      }
    };
    
    init();
  }, []);

  useEffect(() => {
    initializeNotifications();
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      // Wait for all interactions to complete before checking auth
      // This ensures native modules are fully initialized
      await new Promise(resolve => InteractionManager.runAfterInteractions(() => resolve(undefined)));
      
      console.log('🔍 Checking authentication...');
      
      try {
        if (!supabase) {
          console.log('❌ Supabase not initialized, routing to onboarding');
          router.replace('/(auth)/onboarding');
          return;
        }

        // getSession() works offline - reads from SecureStore
        // Use a shorter timeout since it should be fast (local storage)
        const sessionPromise = supabase.auth.getSession();
        const sessionTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 2000)
        );
        
        let sessionResult;
        try {
          sessionResult = await Promise.race([sessionPromise, sessionTimeoutPromise]) as any;
        } catch (sessionError: any) {
          // If getSession fails, check if it's a network error
          if (sessionError?.message?.includes('Network') || sessionError?.message?.includes('timeout')) {
            console.log('⚠️ Network unavailable, checking cached session...');
            // Try to get session without timeout (should be instant from cache)
            try {
              sessionResult = await supabase.auth.getSession();
            } catch (cacheError) {
              console.error('🚨 Could not get cached session:', cacheError);
              router.replace('/(auth)/onboarding');
              return;
            }
          } else {
            throw sessionError;
          }
        }
        
        const { data: { session } } = sessionResult;
        console.log('📱 Session exists:', !!session);
        
        if (session) {
          console.log('✅ Session found, verifying...');
          
          // getUser() requires network - handle offline gracefully
          // Use a longer timeout for network calls
          const userPromise = supabase.auth.getUser();
          const userTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('User check timeout')), 5000)
          );
          
          let userResult;
          try {
            userResult = await Promise.race([userPromise, userTimeoutPromise]) as any;
          } catch (userError: any) {
            // If network is unavailable, use cached session
            if (userError?.message?.includes('Network') || userError?.message?.includes('timeout')) {
              console.log('⚠️ Network unavailable, using cached session');
              // If we have a session, trust it (offline mode)
              // The session will be validated when network is available
              console.log('✅ Using cached session (offline mode)');
              try {
                await checkUser();
              } catch (checkError) {
                console.error('Error checking user:', checkError);
              }
              // Check onboarding status even in offline mode
              const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
              if (hasCompletedOnboarding === 'true') {
                router.replace('/(tabs)');
              } else {
                router.replace('/onboarding');
              }
              return;
            } else {
              throw userError;
            }
          }
          
          const { data: { user }, error } = userResult;
          
          if (error) {
            console.log('❌ Session invalid:', error.message);
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            router.replace('/(auth)/onboarding');
          } else if (!user) {
            console.log('❌ No user found in session');
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            router.replace('/(auth)/onboarding');
          } else {
            console.log('✅ Valid user:', user?.email);
            // Valid session, ensure user is in auth store
            try {
              await checkUser();
            } catch (checkError) {
              console.error('Error checking user:', checkError);
            }
            
            // Check if user has completed interactive onboarding
            const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
            if (hasCompletedOnboarding === 'true') {
              console.log('✅ User has completed onboarding, going to main app');
              router.replace('/(tabs)');
            } else {
              console.log('📝 User needs to complete interactive onboarding');
              router.replace('/onboarding');
            }
          }
        } else {
          console.log('📝 No session, checking onboarding status');
          // Check if user has seen Canva welcome
          const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
          if (hasSeenOnboarding === 'true') {
            console.log('✅ User has seen welcome, going to signup');
            router.replace('/(auth)/signup');
          } else {
            console.log('📝 New user, showing Canva welcome');
            router.replace('/(auth)/onboarding');
          }
        }
      } catch (error) {
        console.error('🚨 Auth error:', error);
        // On error, always route to onboarding to prevent crashes
        router.replace('/(auth)/onboarding');
      }
    };
    
    // Run auth initialization after fonts are loaded AND React Native is ready
    if (fontsLoaded) {
      // Use InteractionManager to ensure native modules are ready
      InteractionManager.runAfterInteractions(() => {
        initializeAuth();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

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

  // Show nothing while initializing (very brief)
  if (!fontsLoaded || !appReady) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: Colors.brand[100],
      }} />
    );
  }

  // Fade in the actual app
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Animated.View style={{ flex: 1, backgroundColor: Colors.ui.background, opacity: fadeAnim }}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <SubscriptionProvider>
              <Stack initialRouteName="welcome">
              <Stack.Screen
                name="welcome"
                options={{ title: 'Welcome', headerShown: false }}
              />
              <Stack.Screen
                name="(auth)"
                options={{ 
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="onboarding"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="onboarding/welcome"
                options={{
                  headerShown: false,
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="subscribe"
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
            </SubscriptionProvider>
          </ThemeProvider>
        </Animated.View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
