import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // User is logged in, go to dashboard
      router.replace('/(tabs)');
    } else {
      // Check if user has seen onboarding
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      
      if (hasSeenOnboarding === 'true') {
        // Skip onboarding, go straight to login
        router.replace('/login');
      } else {
        // First time user, show onboarding
        router.replace('/onboarding/welcome');
      }
    }
  };

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#E8DEFF', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }}>
      <ActivityIndicator size="large" color={Colors.brand[400]} />
    </View>
  );
}
