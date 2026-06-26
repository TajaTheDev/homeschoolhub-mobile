import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

/**
 * Check if device is currently online
 */
export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch (error) {
    console.error('Error checking network status:', error);
    // Default to offline if we can't determine
    return false;
  }
};

/**
 * Cache data to local storage with timestamp
 */
export const cacheData = async (key: string, data: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
      } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
  }
};

/**
 * Get cached data if it exists and is not expired
 * @param key - Cache key
 * @param maxAge - Maximum age in milliseconds (default: 1 hour)
 */
export const getCachedData = async (key: string, maxAge: number = 3600000): Promise<any | null> => {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (!cached) {
            return null;
    }
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age > maxAge) {
            // Clean up expired cache
      await AsyncStorage.removeItem(`cache_${key}`);
      return null;
    }
    
        return data;
  } catch (error) {
    console.error(`Error getting cached data for key ${key}:`, error);
    return null;
  }
};

/**
 * Clear cached data for a specific key
 */
export const clearCache = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`cache_${key}`);
      } catch (error) {
    console.error(`Error clearing cache for key ${key}:`, error);
  }
};

/**
 * Clear all cached data
 */
export const clearAllCache = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('cache_'));
    await AsyncStorage.multiRemove(cacheKeys);
      } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};

