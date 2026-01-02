import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Welcome screen - simple loading screen
 * Auth checking is handled exclusively by app/_layout.tsx
 * This screen just shows a loading indicator while _layout.tsx routes the user
 */
export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    // Let _layout.tsx handle all auth routing
    // This screen just shows loading while routing happens
    // No auth check needed here - _layout.tsx handles it
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
