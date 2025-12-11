/**
 * Lesson store using Zustand
 * Manages lesson data with Supabase operations
 */

import { supabase } from '@/lib/supabase/client';
import type { Lesson } from '@/types';
import { create } from 'zustand';

interface LessonState {
  lessons: Lesson[];
  loading: boolean;
  fetchLessons: (studentId?: string, date?: string) => Promise<void>;
  addLesson: (
    lesson: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<{ success: boolean; error?: string }>;
  updateLesson: (
    id: string,
    updates: Partial<Lesson>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteLesson: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleComplete: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleCompleteOptimistic: (id: string) => void;
  updateLessonOptimistic: (id: string, updates: Partial<Lesson>) => void;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: [],
  loading: false,

  fetchLessons: async (studentId?: string, date?: string) => {
    set({ loading: true });
    try {
      let query = supabase.from('lessons').select('*');

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      if (date) {
        query = query.eq('date', date);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('Error fetching lessons:', error);
        set({ loading: false });
        return;
      }

      set({ lessons: data || [], loading: false });
    } catch (error) {
      console.error('Error fetching lessons:', error);
      set({ loading: false });
    }
  },

  addLesson: async (lesson) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('lessons')
        .insert(lesson)
        .select()
        .single();

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh lessons list
      await get().fetchLessons();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  updateLesson: async (id, updates) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh lessons list
      await get().fetchLessons();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteLesson: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh lessons list
      await get().fetchLessons();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  toggleComplete: async (id) => {
    set({ loading: true });
    try {
      // Find the lesson in current state
      const lesson = get().lessons.find((l) => l.id === id);

      if (!lesson) {
        set({ loading: false });
        return { success: false, error: 'Lesson not found' };
      }

      // Toggle completed status
      const { error } = await supabase
        .from('lessons')
        .update({ completed: !lesson.completed })
        .eq('id', id);

      if (error) {
        set({ loading: false });
        return { success: false, error: error.message };
      }

      // Refresh lessons list
      await get().fetchLessons();
      return { success: true };
    } catch (error) {
      set({ loading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  toggleCompleteOptimistic: (id) => {
    const lesson = get().lessons.find((l) => l.id === id);
    if (!lesson) return;

    const newStatus = !lesson.completed;
    const oldStatus = lesson.completed;

    // Update UI immediately
    set((state) => ({
      lessons: state.lessons.map((l) =>
        l.id === id ? { ...l, completed: newStatus } : l
      ),
    }));

    // Update database in background
    supabase
      .from('lessons')
      .update({ completed: newStatus })
      .eq('id', id)
      .then(({ error }) => {
        if (error) {
          console.error('Error updating lesson:', error);
          // Revert on error
          set((state) => ({
            lessons: state.lessons.map((l) =>
              l.id === id ? { ...l, completed: oldStatus } : l
            ),
          }));
        }
      });
  },

  updateLessonOptimistic: (id, updates) => {
    set((state) => ({
      lessons: state.lessons.map((lesson) =>
        lesson.id === id ? { ...lesson, ...updates } : lesson
      ),
    }));
  },
}));

