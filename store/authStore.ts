/**
 * Authentication store using Zustand
 * Manages user authentication state and Supabase auth operations
 */

import { supabase } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface SignInResult {
  success: boolean;
  error?: string;
  session?: Session | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  checkUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  signUp: async (email: string, password: string) => {
    set({ loading: true });
    try {
      if (!supabase) {
        set({ loading: false });
        return { success: false, error: 'Supabase client not initialized' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        set({ user: data.user, loading: false });
        return { success: true };
      }

      set({ loading: false });
      return { success: false, error: 'Failed to create user' };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      if (!supabase) {
        set({ loading: false });
        return { success: false, error: 'Supabase client not initialized' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      if (data.user) {
        set({ user: data.session?.user ?? data.user, loading: false });
        return { success: true, session: data.session ?? null };
      }

      set({ loading: false });
      return { success: false, error: 'Failed to sign in' };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        set({ user: null, loading: false });
        return;
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Sign out error:', error);
      }

      set({ user: null, loading: false });
    } catch (error) {
      console.error('Sign out error:', error);
      set({ user: null, loading: false });
    }
  },

  checkUser: async () => {
    set({ loading: true });
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        set({ user: null, loading: false, initialized: true });
        return;
      }

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Session check error:', error);
        set({ user: null, loading: false, initialized: true });
        return;
      }

      if (session?.user) {
        set({ user: session.user, loading: false, initialized: true });
      } else {
        set({ user: null, loading: false, initialized: true });
      }
    } catch (error) {
      console.error('Session check error:', error);
      set({ user: null, loading: false, initialized: true });
    }
  },
}));

