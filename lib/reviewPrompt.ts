/**
 * Native in-app review prompt at win moments.
 * Fails silently — never surfaces errors to the user.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as StoreReview from 'expo-store-review';

/**
 * Requests an App Store / Play Store review if available and not yet prompted this version.
 */
export async function requestReviewAtWinMoment(): Promise<void> {
  try {
    const version = Application.nativeApplicationVersion ?? 'unknown';
    const storageKey = `review_prompted:${version}`;

    const alreadyPrompted = await AsyncStorage.getItem(storageKey);
    if (alreadyPrompted === 'true') {
      return;
    }

    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) {
      return;
    }

    await StoreReview.requestReview();
    await AsyncStorage.setItem(storageKey, 'true');
  } catch {
    // Silent — review prompt must never affect app behavior
  }
}
