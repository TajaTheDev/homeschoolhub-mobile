import BrandLoadingScreen from '@/components/ui/BrandLoadingScreen';
import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

/** Delay so cold-start initializeAuth in _layout can route first. */
const STUCK_REDIRECT_DELAY_MS = 2000;

/**
 * Placeholder route while root layout resolves auth routing.
 * Matches the pre-Stack brand splash so nothing flashes before the carousel.
 * If still mounted with no session after the delay, redirect (safety net).
 */
export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const redirectIfStuckWithoutSession = async () => {
      if (!supabase) {
        router.replace('/(auth)/onboarding');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || session) {
        return;
      }

      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      if (cancelled) {
        return;
      }

      if (hasSeenOnboarding === 'true') {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(auth)/onboarding');
      }
    };

    timeoutId = setTimeout(() => {
      void redirectIfStuckWithoutSession();
    }, STUCK_REDIRECT_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router]);

  return <BrandLoadingScreen />;
}
