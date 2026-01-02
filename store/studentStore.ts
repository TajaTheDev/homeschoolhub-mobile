/**
 * Student and subject store using Zustand
 * Manages student data and their subjects with Supabase operations
 */

import { supabase } from '@/lib/supabase/client';
import type { Student, StudentSubject } from '@/types';
import { create } from 'zustand';

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
    set({ loading: true });
    try {
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
        set({ loading: false });
        return;
      }

      set({ students: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching students:', error);
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

  addStudent: async (student) => {
    set({ loading: true });
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ loading: false });
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('students')
        .insert({
          ...student,
          user_id: user.id,
          avatar_type: student.avatar_type || 'initial',
          avatar_value: student.avatar_value || null,
        })
        .select()
        .single();

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

