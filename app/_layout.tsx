
import { ErrorBoundary } from '@/components/ErrorBoundary';
import TrialExpiringModal from '@/components/TrialExpiringModal';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, InteractionManager, Platform, View } from 'react-native';
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
import { SnackbarProvider } from '@/contexts/SnackbarContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { initializeRevenueCat } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase/client';
import * as notificationService from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Track auth initialization to prevent infinite loops
  const authInitializedRef = useRef(false);

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  const initializeTrial = async () => {
    try {
      await useSubscriptionStore.getState().checkSubscription();
    } catch (error) {
      console.error('Error initializing trial:', error);
    }
  };

  /**
   * Routes authenticated users based on onboarding and subscription/trial status.
   */
  const routeAuthenticatedUser = async (
    hasCompletedOnboarding: string | null,
    currentSegment: string | undefined
  ) => {
    if (hasCompletedOnboarding !== 'true') {
      console.log('📝 User needs to complete interactive onboarding');
      if (currentSegment !== 'onboarding') {
        router.replace('/onboarding');
      }
      return;
    }

    try {
      const subscriptionInfo = await useSubscriptionStore.getState().checkSubscription();
      const redirectToSubscribe =
        !subscriptionInfo.hasAccess ||
        subscriptionInfo.subscriptionStatus === 'expired';

      console.log('[GATE DEBUG]', {
        source: 'routeAuthenticatedUser',
        status: subscriptionInfo.subscriptionStatus,
        hasAccess: subscriptionInfo.hasAccess,
        redirectToSubscribe,
        currentSegment,
      });

      if (redirectToSubscribe) {
        if (currentSegment !== 'subscribe') {
          router.replace('/subscribe');
        }
        return;
      }
    } catch (error) {
      console.error('Subscription check failed during auth routing:', error);
      console.log('[GATE DEBUG]', {
        source: 'routeAuthenticatedUser',
        status: 'error',
        hasAccess: false,
        redirectToSubscribe: true,
        currentSegment,
      });
      if (currentSegment !== 'subscribe') {
        router.replace('/subscribe');
      }
      return;
    }

    console.log('✅ User has access, going to main app');
    if (currentSegment !== '(tabs)' && currentSegment !== 'subscribe') {
      router.replace('/(tabs)');
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // RevenueCat is initialized in a separate useEffect below
        // Check authentication before trial init (trial requires logged-in user)
        try {
          await checkUser();
        } catch (error) {
          console.error('Auth check failed (non-critical):', error);
        }

        // Initialize trial from Supabase (creates record if missing)
        try {
          await initializeTrial();
        } catch (error) {
          console.error('Trial initialization failed (non-critical):', error);
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

  // Initialize RevenueCat on app start (production builds only)
  useEffect(() => {
    const initRevenueCat = async () => {
      try {
        // Initialize RevenueCat (will skip in Expo Go/dev mode automatically)
        const success = await initializeRevenueCat();
        
        if (!success) {
          // This is expected in Expo Go/development - function already logs the skip message
          return;
        }
        
        // Verify initialization by fetching offerings (iOS only)
        if (Platform.OS === 'ios') {
          try {
            const { getOfferings } = await import('@/lib/revenuecat');
            const offering = await getOfferings();
            
            if (offering && offering.availablePackages) {
              const packageCount = offering.availablePackages.length;
              console.log('📦 Offerings loaded:', packageCount, 'packages');
              
              // Log package details for debugging
              if (packageCount > 0) {
                offering.availablePackages.forEach(pkg => {
                  console.log(`   - ${pkg.identifier}: ${pkg.product.priceString}`);
                });
              } else {
                console.warn('⚠️ No packages available in current offering');
              }
            } else {
              console.warn('⚠️ No current offering found');
            }
          } catch (offeringsError: any) {
            console.error('❌ Error fetching offerings:', offeringsError?.message || offeringsError);
            // Don't fail initialization - offerings might not be configured yet
          }
        }
      } catch (error: any) {
        console.error('❌ RevenueCat initialization error:', error?.message || error);
        // Don't crash app - continue without subscriptions
      }
    };
    
    initRevenueCat();
  }, []);

  useEffect(() => {
    initializeNotifications();
  }, []);

  useEffect(() => {
    // CRITICAL: Only run auth check once - prevent infinite loops
    if (authInitializedRef.current || !fontsLoaded) {
      return;
    }

    // Mark as initialized IMMEDIATELY (before async operations) to prevent re-runs
    authInitializedRef.current = true;

    const initializeAuth = async () => {
      // Wait for all interactions to complete before checking auth
      // This ensures native modules are fully initialized
      await new Promise(resolve => InteractionManager.runAfterInteractions(() => resolve(undefined)));
      
      console.log('🔍 Checking authentication...');
      
      // Check if we're already navigating to avoid duplicate navigation
      const currentSegment = segments[0];
      if (currentSegment === '(tabs)' || currentSegment === 'onboarding' || currentSegment === '(auth)') {
        console.log('📍 Already navigating, skipping auth check');
        return;
      }
      
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
              const currentSegment = segments[0];
              await routeAuthenticatedUser(hasCompletedOnboarding, currentSegment);
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
            
            const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
            const currentSegment = segments[0];
            await routeAuthenticatedUser(hasCompletedOnboarding, currentSegment);
          }
        } else {
          console.log('📝 No session, checking onboarding status');
          // Check if user has seen Canva welcome
          const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
          if (hasSeenOnboarding === 'true') {
            console.log('✅ User has seen welcome, going to signup');
            setTimeout(() => {
              router.replace('/(auth)/signup');
            }, 100);
          } else {
            console.log('📝 New user, showing Canva welcome');
            setTimeout(() => {
              router.replace('/(auth)/onboarding');
            }, 100);
          }
        }
      } catch (error) {
        console.error('🚨 Auth error:', error);
        // On error, always route to onboarding to prevent crashes
        setTimeout(() => {
          router.replace('/(auth)/onboarding');
        }, 100);
      }
    };
    
    // Run auth initialization after fonts are loaded AND React Native is ready
    // Use InteractionManager to ensure native modules are ready
    InteractionManager.runAfterInteractions(() => {
      initializeAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]); // Only depend on fontsLoaded - ref prevents re-runs

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
            <SnackbarProvider>
              <SubscriptionProvider>
                <>
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
                      title: 'Premium Subscription',
                      headerShown: true,
                      headerBackTitle: 'Settings',
                      gestureEnabled: true,
                      headerStyle: {
                        backgroundColor: Colors.ui.background,
                      },
                      headerTintColor: Colors.ui.text,
                      headerTitleStyle: {
                        fontFamily: 'Quicksand_600SemiBold',
                        fontSize: 18,
                      },
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
                  <TrialExpiringModal />
                  <StatusBar style="auto" />
                </>
              </SubscriptionProvider>
            </SnackbarProvider>
          </ThemeProvider>
        </Animated.View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
