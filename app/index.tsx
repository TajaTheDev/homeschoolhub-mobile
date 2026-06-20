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

      console.log('🔍 User status:', {
        hasSeenOnboarding,
        hasCompletedOnboarding,
        hasSession: !!session,
      });

      if (!hasSeenOnboarding) {
        console.log('→ Going to Canva welcome');
        router.replace('/onboarding/welcome');
        return;
      }

      if (hasSeenOnboarding && !session) {
        console.log('→ Going to signup');
        router.replace('/(auth)/signup');
        return;
      }

      if (session && !hasCompletedOnboarding) {
        console.log('→ Going to interactive onboarding');
        router.replace('/onboarding');
        return;
      }

      setStatusMessage('Checking subscription...');
      const subscriptionInfo = await checkSubscription();

      const redirectToSubscribe =
        !subscriptionInfo.hasAccess ||
        subscriptionInfo.subscriptionStatus === 'expired';

      console.log('[GATE DEBUG]', {
        source: 'index',
        status: subscriptionInfo.subscriptionStatus,
        hasAccess: subscriptionInfo.hasAccess,
        redirectToSubscribe,
      });

      if (!redirectToSubscribe) {
        console.log('→ Going to main app');
        router.replace('/(tabs)');
        return;
      }

      console.log('→ Trial expired, going to subscribe');
      router.replace('/subscribe');
    } catch (error) {
      console.error('Error checking user status:', error);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/subscribe');
      } else {
        router.replace('/onboarding/welcome');
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
