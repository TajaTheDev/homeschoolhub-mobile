/**
 * Student and subject store using Zustand
 * Manages student data and their subjects with Supabase operations
 */

import { supabase } from '@/lib/supabase/client';
import { cacheData, getCachedData, isOnline } from '@/lib/offline';
import type { Student, StudentSubject } from '@/types';
import { create } from 'zustand';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let lastFetch = 0;

interface StudentState {
  students: Student[];
  subjects: StudentSubject[];
  loading: boolean;
  fetchStudents: () => Promise<void>;
  fetchSubjects: (studentId?: string) => Promise<void>;
  addStudent: (
    student: Omit<Student, 'id' | 'created_at' | 'updated_at' | 'user_id'>
  ) => Promise<{ success: boolean; error?: string }>;
  updateStudent: (
    id: string,
    updates: Partial<Student>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteStudent: (id: string) => Promise<{ success: boolean; error?: string }>;
  addSubject: (
    subject: Omit<StudentSubject, 'id' | 'created_at'>
  ) => Promise<{ success: boolean; error?: string }>;
  updateSubject: (
    id: string,
    updates: Partial<StudentSubject>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSubject: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useStudentStore = create<StudentState>((set, get) => ({
  students: [],
  subjects: [],
  loading: false,

  fetchStudents: async () => {
    // Check in-memory cache first
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION && get().students.length > 0) {
      console.log('📦 Using in-memory cached students');
      return;
    }

    set({ loading: true });
    try {
      // Check if online
      const online = await isOnline();
      
      if (!online) {
        console.log('📡 Offline - checking local cache');
        const cached = await getCachedData('students', CACHE_DURATION);
        if (cached) {
          set({ students: cached, loading: false });
          return;
        } else {
          console.log('⚠️ No cached students available offline');
          set({ loading: false });
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ loading: false });
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100); // Reasonable limit for student records

      if (error) {
        console.error('Error fetching students:', error);
        // Try to use cached data on error
        const cached = await getCachedData('students', CACHE_DURATION * 2); // Use older cache on error
        if (cached) {
          console.log('📦 Using cached students due to fetch error');
          set({ students: cached, loading: false });
          return;
        }
        set({ loading: false });
        return;
      }

      set({ students: data || [], loading: false });
      lastFetch = now; // Update cache timestamp
      
      // Cache data for offline use
      await cacheData('students', data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      // Try to use cached data on error
      const cached = await getCachedData('students', CACHE_DURATION * 2);
      if (cached) {
        console.log('📦 Using cached students due to exception');
        set({ students: cached, loading: false });
        return;
      }
      set({ loading: false });
    }
  },

  fetchSubjects: async (studentId?: string) => {
    set({ loading: true });
    try {
      let query = supabase.from('student_subjects').select('*');

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(500); // Reasonable limit for subject records

      if (error) {
        console.error('Error fetching subjects:', error);
        set({ loading: false });
        return;
      }

      set({ subjects: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching subjects:', error);
      set({ loading: false });
    }
  },

  addStudent: async (studentData) => {
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        set({ loading: false });
        return { success: false, error: 'Not authenticated' };
      }
      
      const { data, error } = await supabase
        .from('students')
        .insert({
          ...studentData,
          user_id: user.id,  // ← ADD THIS!
          avatar_type: studentData.avatar_type || 'initial',
          avatar_value: studentData.avatar_value || null,
        })
        .select()
        .single();
      
      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }
      
      // Update local state immediately with new student
      set((state) => ({ 
        students: [...state.students, data],
        loading: false,
      }));
      
      return { success: true, data };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  updateStudent: async (id, updates) => {
    set({ loading: true });
    try {
      const updateData: any = { ...updates };
      
      // Explicitly handle avatar fields
      if ('avatar_type' in updates) {
        updateData.avatar_type = updates.avatar_type;
      }
      if ('avatar_value' in updates) {
        updateData.avatar_value = updates.avatar_value ?? null;
      }

      const { error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh students list
      await get().fetchStudents();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteStudent: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh students list
      await get().fetchStudents();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  addSubject: async (subject) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .insert(subject)
        .select()
        .single();

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh subjects list
      await get().fetchSubjects();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  updateSubject: async (id, updates) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('student_subjects')
        .update(updates)
        .eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh subjects list
      await get().fetchSubjects();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteSubject: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('student_subjects')
        .delete()
        .eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh subjects list
      await get().fetchSubjects();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },
}));

