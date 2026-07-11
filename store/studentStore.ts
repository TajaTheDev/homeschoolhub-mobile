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
    subject: Omit<StudentSubject, 'id' | 'created_at'>,
    options?: { skipRefetch?: boolean }
  ) => Promise<{ success: boolean; error?: string; data?: StudentSubject }>;
  ensureSubjectEnrolled: (
    studentId: string,
    subject: string
  ) => Promise<{ success: boolean; error?: string }>;
  updateSubject: (
    id: string,
    updates: Partial<StudentSubject>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSubject: (
    id: string,
    options?: { skipRefetch?: boolean }
  ) => Promise<{ success: boolean; error?: string }>;
}

export const useStudentStore = create<StudentState>((set, get) => ({
  students: [],
  subjects: [],
  loading: false,

  fetchStudents: async () => {
    // Check in-memory cache first (instant)
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION && get().students.length > 0) {
            return;
    }

    // STEP 1: Load cached data immediately (instant UI)
    const cached = await getCachedData('students', CACHE_DURATION * 24); // Use cache up to 24 hours old
    if (cached && cached.length > 0) {
            set({ students: cached, loading: false }); // Show cached data instantly
    } else {
      set({ loading: true });
    }

    // STEP 2: Refresh from server in background
    try {
      const online = await isOnline();
      
      if (!online) {
                if (!cached || cached.length === 0) {
          set({ loading: false });
        }
        return;
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
        .select(`
          *,
          student_subjects (
            id,
            subject,
            goal
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('❌ Error fetching students:', error);
        // Keep cached data if available, otherwise clear loading
        if (!cached || cached.length === 0) {
          set({ loading: false });
        }
        return;
      }

            
      // Update with fresh data
      set({ students: data || [], loading: false });
      lastFetch = now;
      
      // Cache fresh data
      await cacheData('students', data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      // Keep cached data if available
      if (!cached || cached.length === 0) {
        set({ loading: false });
      }
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

  addSubject: async (subject, options) => {
    const skipRefetch = options?.skipRefetch ?? false;

    if (!skipRefetch) {
      set({ loading: true });
    }

    try {
      const { data, error } = await supabase
        .from('student_subjects')
        .upsert(
          {
            student_id: subject.student_id,
            subject: subject.subject,
            goal: subject.goal,
          },
          { onConflict: 'student_id,subject', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '23505') {
          if (!skipRefetch) {
            await get().fetchStudents();
            await get().fetchSubjects(subject.student_id);
            set({ loading: false });
          }
          return { success: true };
        }
        console.error('❌ Add subject error:', error);
        if (!skipRefetch) {
          set({ loading: false });
        }
        return { success: false, error: error.message };
      }

      if (!skipRefetch) {
        await get().fetchStudents();
        await get().fetchSubjects(subject.student_id);
        set({ loading: false });
      }

      return { success: true, data: data ?? undefined };
    } catch (error) {
      console.error('❌ Add subject exception:', error);
      if (!skipRefetch) {
        set({ loading: false });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  ensureSubjectEnrolled: async (studentId, subject) => {
    try {
      const { error } = await supabase.from('student_subjects').upsert(
        {
          student_id: studentId,
          subject,
        },
        { onConflict: 'student_id,subject', ignoreDuplicates: true }
      );

      if (error) {
        if (error.code === '23505') {
          await get().fetchSubjects(studentId);
          await get().fetchStudents();
          return { success: true };
        }
        console.error('ensureSubjectEnrolled error:', error);
        return { success: false, error: error.message };
      }

      await get().fetchSubjects(studentId);
      await get().fetchStudents();
      return { success: true };
    } catch (error) {
      console.error('ensureSubjectEnrolled exception:', error);
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
        console.error('❌ Update subject error:', error);
        set({ loading: false });
        return { success: false, error: error.message };
      }

            
      // Refresh students to get updated subjects
      await get().fetchStudents();
      
      // Also refresh subjects list for compatibility
      await get().fetchSubjects();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Update subject exception:', error);
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteSubject: async (id, options) => {
    const skipRefetch = options?.skipRefetch ?? false;

    if (!skipRefetch) {
      set({ loading: true });
    }

    try {
      const { error } = await supabase
        .from('student_subjects')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Delete subject error:', error);
        if (!skipRefetch) {
          set({ loading: false });
        }
        return { success: false, error: error.message };
      }

      if (!skipRefetch) {
        await get().fetchStudents();
        await get().fetchSubjects();
        set({ loading: false });
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Delete subject exception:', error);
      if (!skipRefetch) {
        set({ loading: false });
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },
}));

