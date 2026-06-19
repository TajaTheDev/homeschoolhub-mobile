/**
 * Lesson store using Zustand
 * Manages lesson data with Supabase operations
 */

import { supabase } from '@/lib/supabase/client';
import { cacheData, getCachedData, isOnline, clearAllCache } from '@/lib/offline';
import type { Lesson } from '@/types';
import { create } from 'zustand';

interface LessonState {
  lessons: Lesson[];
  loading: boolean;
  fetchLessons: (studentId?: string, date?: string, forceRefresh?: boolean) => Promise<void>;
  addLesson: (
    lesson: Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<{ success: boolean; error?: string }>;
  updateLesson: (
    id: string,
    updates: Partial<Lesson>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteLesson: (id: string) => Promise<{ success: boolean; error?: string }>;
  deleteLessons: (ids: string[]) => Promise<{ success: boolean; error?: string }>;
  toggleComplete: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleCompleteOptimistic: (id: string) => void;
  updateLessonOptimistic: (id: string, updates: Partial<Lesson>) => void;
  clearCache: () => Promise<void>;
  forceRefresh: () => Promise<void>;
}

// Cache configuration
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let lastFetch = 0;
let cachedFilters: { studentId?: string; date?: string } | null = null;

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: [],
  loading: false,

  fetchLessons: async (studentId?: string, date?: string, forceRefresh: boolean = false) => {
    const now = Date.now();
    const filters = { studentId, date };
    const cacheKey = JSON.stringify(filters);
    const cachedKey = JSON.stringify(cachedFilters);

    if (
      !forceRefresh &&
      now - lastFetch < CACHE_DURATION &&
      cacheKey === cachedKey &&
      get().lessons.length > 0
    ) {
      return;
    }

    set({ loading: true });
    try {
      const online = await isOnline();
      const cacheKeyForStorage = `lessons_${cacheKey}`;

      if (!online && !forceRefresh) {
        const cached = await getCachedData(cacheKeyForStorage, CACHE_DURATION);
        if (cached) {
          set({ lessons: cached, loading: false });
          lastFetch = now;
          cachedFilters = filters;
          return;
        }
        set({ loading: false });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false });
        return;
      }

      // STEP 1: Simple query first (no relationships) - isolate column name issues
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(50);

      // Apply filters if provided
      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      if (date) {
        query = query.eq('date', date);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch lessons:', error);
        set({ lessons: [], loading: false });
        return;
      }

      // STEP 2: Try different syntaxes for lesson_students relationship
      // Try 2a: Simple syntax
      let dataWithJunction: any = null;
      let errorJunction: any = null;

      const step2a = await supabase
        .from('lessons')
        .select('*, lesson_students(*)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10000); // Increased from 500 to fetch all lessons (Supabase default max is 1000, but we use a higher limit for safety)

      if (step2a.error) {
        // Try 2b: Explicit foreign key syntax
        const step2b = await supabase
          .from('lessons')
          .select('*, lesson_students!lesson_students_lesson_id_fkey(*)')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(10000); // Increased from 500 to fetch all lessons

        if (step2b.error) {
          // Try 2c: Query from lesson_students side
          const lessonIds = (data || []).map((l: any) => l.id);
          if (lessonIds.length === 0) {
            set({ lessons: data || [], loading: false });
            return;
          }

          const { data: junctionData, error: junctionError } = await supabase
            .from('lesson_students')
            .select('lesson_id, student_id')
            .in('lesson_id', lessonIds);

          if (junctionError) {
            console.error('Failed to fetch lesson_students junction data:', junctionError);
            set({ lessons: data || [], loading: false });
            lastFetch = Date.now();
            cachedFilters = filters;
            return;
          }

          dataWithJunction = data;
          errorJunction = null;

          // Store junction data for later processing
          (dataWithJunction as any).__junctionData = junctionData;
        } else {
          dataWithJunction = step2b.data;
          errorJunction = null;
        }
      } else {
        dataWithJunction = step2a.data;
        errorJunction = null;
      }

      if (errorJunction || !dataWithJunction) {
        console.error('Failed to fetch lessons with student relationships');
        set({ lessons: data || [], loading: false });
        return;
      }

      // Collect all student IDs from lessons and junction data
      const studentIds = new Set<string>();
      const junctionDataFromStep2 = (dataWithJunction as any).__junctionData;
      
      (dataWithJunction || []).forEach((l: any) => {
        if (l.student_id) studentIds.add(l.student_id);
        
        // Check if junction data is embedded or separate
        if (l.lesson_students && Array.isArray(l.lesson_students)) {
          l.lesson_students.forEach((ls: any) => {
            if (ls.student_id) studentIds.add(ls.student_id);
          });
        }
      });

      // Also check separate junction data if we fetched it that way
      if (junctionDataFromStep2) {
        junctionDataFromStep2.forEach((js: any) => {
          if (js.student_id) studentIds.add(js.student_id);
        });
      }

      const studentIdsArray = Array.from(studentIds);
      const lessonIds = (dataWithJunction || []).map((l: any) => l.id);

      const studentsQuery =
        studentIdsArray.length > 0
          ? supabase
              .from('students')
              .select('id, name, color_theme, grade, avatar_type, avatar_value')
              .in('id', studentIdsArray)
              .eq('user_id', user.id)
          : Promise.resolve({ data: [] as any[], error: null });

      const photosQuery =
        lessonIds.length > 0
          ? supabase
              .from('lesson_photos')
              .select('id, lesson_id, storage_path, caption, created_at')
              .in('lesson_id', lessonIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null });

      const [studentsResult, photosResult] = await Promise.all([
        studentsQuery,
        photosQuery,
      ]);

      const { data: studentsData, error: studentsError } = studentsResult;
      if (studentsError) {
        console.error('Failed to fetch students for lessons:', studentsError);
      }

      let photosData: any[] = [];
      const { data: photos, error: photosError } = photosResult;
      if (photosError) {
        console.error('Failed to fetch lesson photos:', photosError);
      } else {
        photosData = photos || [];
      }

      // Create photos map by lesson_id
      const photosMap = new Map<string, any[]>();
      photosData.forEach((photo: any) => {
        if (!photosMap.has(photo.lesson_id)) {
          photosMap.set(photo.lesson_id, []);
        }
        photosMap.get(photo.lesson_id)?.push(photo);
      });

      // Create students map
      const studentsMap = new Map(
        (studentsData || []).map((s: any) => [s.id, s])
      );

      // Create junction map if we have separate junction data
      const lessonStudentsMap = new Map<string, string[]>();
      if (junctionDataFromStep2) {
        junctionDataFromStep2.forEach((js: any) => {
          if (!lessonStudentsMap.has(js.lesson_id)) {
            lessonStudentsMap.set(js.lesson_id, []);
          }
          lessonStudentsMap.get(js.lesson_id)?.push(js.student_id);
        });
      }

      const lessonsWithStudents = (dataWithJunction || []).map((lesson: any) => {
        let junctionStudentIds: string[] = [];

        // Check if junction data is embedded
        if (lesson.lesson_students && Array.isArray(lesson.lesson_students)) {
          junctionStudentIds = lesson.lesson_students.map((ls: any) => ls.student_id).filter(Boolean);
        }
        // Or if we have separate junction data
        else if (lessonStudentsMap.has(lesson.id)) {
          junctionStudentIds = lessonStudentsMap.get(lesson.id) || [];
        }

        // Get student objects from junction
        const junctionStudents = junctionStudentIds
          .map((sid: string) => studentsMap.get(sid))
          .filter(Boolean);

        // Fallback to primary student_id if no junction students
        const students = junctionStudents.length > 0
          ? junctionStudents
          : lesson.student_id && studentsMap.has(lesson.student_id)
          ? [studentsMap.get(lesson.student_id)]
          : [];

        // Get photos for this lesson
        const lessonPhotos = photosMap.get(lesson.id) || [];

        return {
          ...lesson,
          students,
          photos: lessonPhotos.length > 0 ? lessonPhotos : undefined,
          // Remove temporary junction data property
          __junctionData: undefined,
        };
      });

      // Apply student filtering if needed (date filtering is handled at display level, not in store)
      let filteredLessons = lessonsWithStudents;
      if (studentId) {
        filteredLessons = filteredLessons.filter((l: any) =>
          l.student_id === studentId ||
          l.students?.some((s: any) => s.id === studentId)
        );
      }

      // NOTE: We store ALL lessons in the store (no date filtering here)
      // Date filtering should only be applied at the display/UI level for specific views
      // The 'date' parameter is kept for backward compatibility but we don't filter by it in the store
      // Components should filter lessons locally when displaying them for a specific date

      set({ lessons: filteredLessons, loading: false });
      lastFetch = Date.now(); // Update cache timestamp
      cachedFilters = filters; // Update cached filters
      
      // Cache data for offline use (reuse cacheKeyForStorage declared at line 55)
      await cacheData(cacheKeyForStorage, filteredLessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      const cacheKeyForError = `lessons_${cacheKey}`;
      const cached = await getCachedData(cacheKeyForError, CACHE_DURATION * 2);
      if (cached) {
        set({ lessons: cached, loading: false });
        lastFetch = now;
        cachedFilters = filters;
        return;
      }
      set({ loading: false });
    }
  },

  addLesson: async (lessonData) => {
    console.log('➕ Creating lesson:', {
      title: lessonData.title,
      subject: lessonData.subject,
      date: lessonData.date,
      student_id: lessonData.student_id
    });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Create optimistic lesson object
    const optimisticLesson: Lesson = {
      ...lessonData,
      id: tempId,
      created_at: now,
      updated_at: now,
      completed: lessonData.completed || false,
    } as Lesson;
    
    // IMMEDIATELY update local state (UI updates instantly)
    set((state) => ({ 
      lessons: [...state.lessons, optimisticLesson],
      loading: false,
    }));
    
    console.log('➕ Lesson added optimistically with temp ID:', tempId);
    
    // Save to database in background
    try {
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          ...lessonData,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error saving lesson to database:', error);
        // Rollback: Remove the optimistic lesson
        set((state) => ({
          lessons: state.lessons.filter((l) => l.id !== tempId),
        }));
        return { success: false, error: error.message };
      }
      
      // Replace temp lesson with real one (with real ID)
      set((state) => ({
        lessons: state.lessons.map((l) => l.id === tempId ? data : l),
      }));
      
      console.log('✅ Lesson saved to database, replaced temp with real ID:', data.id);
      return { success: true, data };
    } catch (error) {
      console.error('❌ Unexpected error saving lesson:', error);
      // Rollback: Remove the optimistic lesson
      set((state) => ({
        lessons: state.lessons.filter((l) => l.id !== tempId),
      }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  updateLesson: async (id, updates) => {
    // Find the lesson to update
    const lesson = get().lessons.find((l) => l.id === id);
    if (!lesson) {
      return { success: false, error: 'Lesson not found' };
    }
    
    // Store previous state for rollback
    const previousLesson = { ...lesson };
    
    // IMMEDIATELY update local state (UI updates instantly)
    set((state) => ({
      lessons: state.lessons.map((l) =>
        l.id === id ? { ...l, ...updates, updated_at: new Date().toISOString() } : l
      ),
      loading: false,
    }));
    
    console.log('✏️ Lesson updated optimistically:', id);
    
    // Save to database in background
    try {
      const { error } = await supabase
        .from('lessons')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('❌ Error saving lesson update to database:', error);
        // Rollback: Restore previous lesson state
        set((state) => ({
          lessons: state.lessons.map((l) => l.id === id ? previousLesson : l),
        }));
        return { success: false, error: error.message };
      }

      console.log('✅ Lesson update saved to database:', id);
      return { success: true };
    } catch (error) {
      console.error('❌ Unexpected error saving lesson update:', error);
      // Rollback: Restore previous lesson state
      set((state) => ({
        lessons: state.lessons.map((l) => l.id === id ? previousLesson : l),
      }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteLesson: async (id) => {
    console.log('🗑️ Deleting lesson:', id);
    
    // Store the lesson for potential rollback
    const lessonToDelete = get().lessons.find((l) => l.id === id);
    if (!lessonToDelete) {
      return { success: false, error: 'Lesson not found' };
    }
    
    // IMMEDIATELY update local state (UI updates instantly)
    set((state) => ({
      lessons: state.lessons.filter((l) => l.id !== id),
      loading: false,
    }));
    
    console.log('🗑️ Lesson removed optimistically from store');
    
    // Delete from database in background
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', id);

      if (error) {
        console.error('❌ Error deleting lesson from database:', error);
        // Rollback: Restore the lesson
        set((state) => ({
          lessons: [...state.lessons, lessonToDelete].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }));
        return { success: false, error: error.message };
      }

      console.log('✅ Lesson deleted from database:', id);
      return { success: true };
    } catch (error) {
      console.error('❌ Unexpected error deleting lesson:', error);
      // Rollback: Restore the lesson
      set((state) => ({
        lessons: [...state.lessons, lessonToDelete].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }));
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  },

  deleteLessons: async (ids) => {
    console.log('🗑️ Deleting lessons (bulk):', ids.length, 'lessons');
    // Only log IDs if there are few lessons
    if (ids.length < 10) {
      console.log('  Lesson IDs:', ids);
    }
    
    if (ids.length === 0) {
      return { success: false, error: 'No lessons to delete' };
    }
    
    // Store the lessons for potential rollback
    const lessonsToDelete = get().lessons.filter((l) => ids.includes(l.id));
    
    // IMMEDIATELY update local state (UI updates instantly)
    set((state) => ({
      lessons: state.lessons.filter((l) => !ids.includes(l.id)),
      loading: false,
    }));
    
    console.log(`🗑️ ${ids.length} lessons removed optimistically from store`);
    
    // Delete from database in background
    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .in('id', ids);

      if (error) {
        console.error('❌ Error deleting lessons from database:', error);
        // Rollback: Restore the lessons
        set((state) => ({
          lessons: [...state.lessons, ...lessonsToDelete].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          ),
        }));
        return { success: false, error: error.message };
      }

      console.log(`✅ ${ids.length} lessons deleted from database`);
      return { success: true };
    } catch (error) {
      console.error('❌ Unexpected error deleting lessons:', error);
      // Rollback: Restore the lessons
      set((state) => ({
        lessons: [...state.lessons, ...lessonsToDelete].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }));
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

  clearCache: async () => {
    console.log('🗑️ Clearing all lesson cache...');
    try {
      // Clear AsyncStorage cache (all cache_ keys)
      await clearAllCache();
      
      // Reset in-memory cache variables
      lastFetch = 0;
      cachedFilters = null;
      
      // Clear lessons from store
      set({ lessons: [], loading: false });
      
      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  },

  forceRefresh: async () => {
    console.log('🔄 Force refreshing lessons (clearing cache and fetching fresh)...');
    try {
      // Clear cache first
      await get().clearCache();
      
      // Force fresh fetch (no cache)
      await get().fetchLessons(undefined, undefined, true);
      
      console.log('✅ Force refresh complete');
    } catch (error) {
      console.error('❌ Error during force refresh:', error);
    }
  },
}));

