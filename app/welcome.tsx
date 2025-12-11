import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    // Go straight to onboarding
    const timeout = setTimeout(() => {
      router.replace('/onboarding/welcome');
    }, 100);

    return () => clearTimeout(timeout);
  }, []);

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
