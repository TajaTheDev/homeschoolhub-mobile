import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function Index() {
  const router = useRouter();
  const { checkSubscription, loading: subscriptionLoading } = useSubscriptionStore();
  const [checking, setChecking] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Loading...');

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      setChecking(true);
      setStatusMessage('Checking your account...');

      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      const { data: { session } } = await supabase.auth.getSession();

      if (!hasSeenOnboarding) {
        console.log('[REDIRECT]', {
          source: 'index:checkUserStatus',
          destination: '/(auth)/onboarding',
          hasSession: !!session,
          hasSeenOnboarding,
          hasCompletedOnboarding,
        });
        router.replace('/(auth)/onboarding');
        return;
      }

      if (hasSeenOnboarding && !session) {
        router.replace('/(auth)/login');
        return;
      }

      if (session && !hasCompletedOnboarding) {
        router.replace('/setup');
        return;
      }

      setStatusMessage('Checking subscription...');
      const subscriptionInfo = await checkSubscription();

      const redirectToSubscribe =
        !subscriptionInfo.hasAccess ||
        subscriptionInfo.subscriptionStatus === 'expired';

      if (!redirectToSubscribe) {
        router.replace('/(tabs)');
        return;
      }

      router.replace('/subscribe');
    } catch (error) {
      console.error('Error checking user status:', error);

      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/subscribe');
      } else {
        console.log('[REDIRECT]', {
          source: 'index:checkUserStatus:catch',
          destination: '/(auth)/onboarding',
          hasSession: !!session,
          hasSeenOnboarding,
          hasCompletedOnboarding,
        });
        router.replace('/(auth)/onboarding');
      }
    } finally {
      setChecking(false);
    }
  };

  const isLoading = checking || subscriptionLoading;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.ui.background,
        gap: 16,
      }}
    >
      {isLoading && (
        <>
          <ActivityIndicator size="large" color={Colors.brand[500]} />
          <Text style={{ color: Colors.ui.text, fontSize: 16 }}>{statusMessage}</Text>
        </>
      )}
    </View>
  );
}
