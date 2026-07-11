
import { ErrorBoundary } from '@/components/ErrorBoundary';
import BrandLoadingScreen from '@/components/ui/BrandLoadingScreen';
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

SplashScreen.preventAutoHideAsync();

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
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const [appReady, setAppReady] = useState(false);
  const [authRoutingReady, setAuthRoutingReady] = useState(false);
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
    if (!supabase) {
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }
      await useSubscriptionStore.getState().checkSubscription();
    } catch (error) {
      console.error('Error initializing trial:', error);
    }
  };

  /** Routes unauthenticated users from initializeAuth sync paths. */
  const routeInitializeAuthNoSession = async () => {
    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
    if (hasSeenOnboarding === 'true') {
      router.replace('/(auth)/login');
    } else {
      router.replace('/(auth)/onboarding');
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
      if (currentSegment !== 'setup') {
        router.replace('/setup');
      }
      return;
    }

    try {
      const subscriptionInfo = await useSubscriptionStore.getState().checkSubscription();
      const redirectToSubscribe =
        !subscriptionInfo.hasAccess ||
        subscriptionInfo.subscriptionStatus === 'expired';

      if (redirectToSubscribe) {
        if (currentSegment !== 'subscribe') {
          router.replace('/subscribe');
        }
        return;
      }
    } catch (error) {
      console.error('Subscription check failed during auth routing:', error);
      if (currentSegment !== 'subscribe') {
        router.replace('/subscribe');
      }
      return;
    }

    if (currentSegment !== '(tabs)' && currentSegment !== 'subscribe') {
      router.replace('/(tabs)');
    }
  };

  /**
   * Deferred no-session redirect — re-checks live segment, session, and flags
   * before navigating so a stale timeout cannot override signup/onboarding.
   * Skips entirely once the marketing carousel has been seen; login/signup/index own routing.
   */
  const runDeferredAuthRedirect = async () => {
    const currentSegment = segmentsRef.current[0];
    if (
      currentSegment === '(tabs)' ||
      currentSegment === 'setup' ||
      currentSegment === '(auth)' ||
      currentSegment === 'welcome'
    ) {
      return;
    }

    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
    if (hasSeenOnboarding === 'true') {
      return;
    }

    if (!supabase) {
      router.replace('/(auth)/onboarding');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          await checkUser();
        } catch (checkError) {
          console.error('Error checking user:', checkError);
        }
        const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
        await routeAuthenticatedUser(hasCompletedOnboarding, currentSegment);
        return;
      }

      router.replace('/(auth)/onboarding');
    } catch (error) {
      console.error('🚨 Deferred auth redirect error:', error);
      router.replace('/(auth)/onboarding');
    }
  };

  /** Cold-start routing when there is no session — login if carousel already seen, else carousel. */
  const routeColdStartNoSession = async () => {
    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
    if (hasSeenOnboarding === 'true') {
      router.replace('/(auth)/login');
      return;
    }
    router.replace('/(auth)/onboarding');
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
                //                 // try {
                //   await Promise.all([
                //     useStudentStore.getState().fetchStudents(),
                //     useLessonStore.getState().fetchLessons(),
                //   ]);
                //                   // } catch (prefetchError) {
                //   console.error('Data prefetch failed (non-critical):', prefetchError);
                // }
              }
            } else {
              // No session - this is normal during onboarding, don't log as error
                          }
          }
        } catch (error) {
          console.error('User check failed (non-critical):', error);
        }
        
        setAppReady(true);
      } catch (error) {
        console.error('Critical error initializing app:', error);
        setAppReady(true);
      }
    };

    if (fontsLoaded) {
      initializeApp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && appReady && authRoutingReady) {
      SplashScreen.hideAsync();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [fontsLoaded, appReady, authRoutingReady, fadeAnim]);

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
                            
              // Log package details for debugging
              if (packageCount > 0) {
                offering.availablePackages.forEach(pkg => {
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
      try {
        await new Promise(resolve => InteractionManager.runAfterInteractions(() => resolve(undefined)));

        const currentSegment = segments[0];
        if (currentSegment === '(tabs)' || currentSegment === 'setup' || currentSegment === '(auth)') {
          return;
        }

        if (!supabase) {
          await routeInitializeAuthNoSession();
          return;
        }

        const sessionPromise = supabase.auth.getSession();
        const sessionTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 2000)
        );

        let sessionResult;
        try {
          sessionResult = await Promise.race([sessionPromise, sessionTimeoutPromise]) as Awaited<
            ReturnType<NonNullable<typeof supabase.auth.getSession>>
          >;
        } catch (sessionError: unknown) {
          const message = sessionError instanceof Error ? sessionError.message : '';
          if (message.includes('Network') || message.includes('timeout')) {
            try {
              sessionResult = await supabase.auth.getSession();
            } catch (cacheError) {
              console.error('🚨 Could not get cached session:', cacheError);
              await routeInitializeAuthNoSession();
              return;
            }
          } else {
            throw sessionError;
          }
        }

        const { data: { session } } = sessionResult;

        if (session) {
          const userPromise = supabase.auth.getUser();
          const userTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('User check timeout')), 5000)
          );

          let userResult;
          try {
            userResult = await Promise.race([userPromise, userTimeoutPromise]) as Awaited<
              ReturnType<NonNullable<typeof supabase.auth.getUser>>
            >;
          } catch (userError: unknown) {
            const message = userError instanceof Error ? userError.message : '';
            if (message.includes('Network') || message.includes('timeout')) {
              try {
                await checkUser();
              } catch (checkError) {
                console.error('Error checking user:', checkError);
              }
              const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
              await routeAuthenticatedUser(hasCompletedOnboarding, segments[0]);
              return;
            }
            throw userError;
          }

          const { data: { user }, error } = userResult;

          if (error) {
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            await routeInitializeAuthNoSession();
          } else if (!user) {
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.error('Error signing out:', signOutError);
            }
            await routeInitializeAuthNoSession();
          } else {
            try {
              await checkUser();
            } catch (checkError) {
              console.error('Error checking user:', checkError);
            }

            const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
            await routeAuthenticatedUser(hasCompletedOnboarding, segments[0]);
          }
        } else {
          await routeColdStartNoSession();
        }
      } catch (error) {
        console.error('🚨 Auth error:', error);
        await routeColdStartNoSession();
      } finally {
        setAuthRoutingReady(true);
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
      
            
      // Navigate based on notification type
      if (data.type === 'daily-reminder') {
        router.push('/(tabs)/' as Parameters<typeof router.push>[0]);
      } else if (data.type === 'goal-celebration') {
        router.push('/(tabs)/progress');
      } else if (data.type === 'streak-reminder') {
        router.push('/(tabs)/calendar');
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
          
                  }
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  // Show brand splash until fonts, app init, and auth routing are ready
  if (!fontsLoaded || !appReady) {
    return <BrandLoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: Colors.brand[100] }}>
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
                    name="setup"
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
          {!authRoutingReady && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <BrandLoadingScreen />
            </View>
          )}
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
