import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase/client';
import Colors from '@/constants/Colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      // Check if user has seen Canva welcome
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      
      // Check if user has completed interactive onboarding
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      
      // Check if user is signed in
      const { data: { session } } = await supabase.auth.getSession();

      console.log('🔍 User status:', {
        hasSeenOnboarding,
        hasCompletedOnboarding,
        hasSession: !!session,
      });

      // Brand new user - show Canva welcome
      if (!hasSeenOnboarding) {
        console.log('→ Going to Canva welcome');
        router.replace('/onboarding/welcome');
        return;
      }

      // Saw welcome but not signed in - go to signup
      if (hasSeenOnboarding && !session) {
        console.log('→ Going to signup');
        router.replace('/(auth)/signup');
        return;
      }

      // Signed in but hasn't completed interactive onboarding
      if (session && !hasCompletedOnboarding) {
        console.log('→ Going to interactive onboarding');
        router.replace('/onboarding');
        return;
      }

      // Fully set up - go to app
      console.log('→ Going to main app');
      router.replace('/(tabs)');

    } catch (error) {
      console.error('Error checking user status:', error);
      // Fallback to welcome
      router.replace('/onboarding/welcome');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.ui.background }}>
      <ActivityIndicator size="large" color={Colors.brand[500]} />
    </View>
  );
}

