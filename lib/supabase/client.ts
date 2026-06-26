import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClientOptions } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// AsyncStorage adapter for Supabase auth storage
// SIMPLER and more reliable than SecureStore
const AsyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error: any) {
      console.error('AsyncStorage getItem error:', error);
      if (error.message?.includes('quota')) {
        console.error('Storage quota exceeded!');
      }
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error: any) {
      console.error('AsyncStorage setItem error:', error);
      if (error.message?.includes('quota')) {
        console.error('Storage quota exceeded - clearing old data');
        try {
          await AsyncStorage.clear();
          await AsyncStorage.setItem(key, value);
        } catch (clearError) {
          console.error('Failed to clear and retry:', clearError);
        }
      }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
    }
  },
};

// Read from environment variables (EAS secrets)
const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || 
                    process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate credentials exist
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials missing!');
  console.error('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('Key:', supabaseAnonKey ? 'Found' : 'Missing');
}

// Create Supabase client options
const supabaseOptions: SupabaseClientOptions<'public'> = {
  auth: {
    storage: AsyncStorageAdapter,  // ← Using AsyncStorage instead!
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
};

// Create and export Supabase client
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || '',
  supabaseOptions
);

