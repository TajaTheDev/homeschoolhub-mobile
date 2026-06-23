import Colors from '@/constants/Colors';
import { View } from 'react-native';

/**
 * Placeholder route while root layout resolves auth routing.
 * Matches the pre-Stack brand splash so nothing flashes before the carousel.
 */
export default function Welcome() {
  return (
    <View style={{
      flex: 1,
      backgroundColor: Colors.brand[100],
    }} />
  );
}
