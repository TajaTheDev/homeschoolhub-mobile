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
    console.log('📚 Fetching lessons from database...', { studentId, date, forceRefresh });
    
    // Always fetch fresh during active session (bypass cache)
    // Only use cache if explicitly not forcing refresh AND we're offline
    const now = Date.now();
    const filters = { studentId, date };
    const cacheKey = JSON.stringify(filters);
    const cachedKey = JSON.stringify(cachedFilters);
    
    // Skip cache if force refresh is requested
    if (!forceRefresh && 
        now - lastFetch < CACHE_DURATION && 
        cacheKey === cachedKey && 
        get().lessons.length > 0) {
      console.log('📦 Using in-memory cached lessons');
      return;
    }

    set({ loading: true });
    try {
      // Check if online
      const online = await isOnline();
      const cacheKeyForStorage = `lessons_${cacheKey}`;
      
      if (!online && !forceRefresh) {
        console.log('📡 Offline - checking local cache');
        const cached = await getCachedData(cacheKeyForStorage, CACHE_DURATION);
        if (cached) {
          set({ lessons: cached, loading: false });
          lastFetch = now;
          cachedFilters = filters;
          return;
        } else {
          console.log('⚠️ No cached lessons available offline');
          set({ loading: false });
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false });
        return;
      }
      
      // Always fetch fresh from database (no caching during active session)
      console.log('🔄 Fetching fresh lessons from database (cache bypassed)');

      // First, let's see what columns actually exist
      console.log('🔍 Testing lessons table schema...');
      const { data: schemaTest, error: schemaError } = await supabase
        .from('lessons')
        .select('*')
        .limit(1);
      
      console.log('🔍 Lessons table schema test:', {
        hasData: !!schemaTest,
        sampleRow: schemaTest?.[0] || null,
        columns: schemaTest && schemaTest[0] ? Object.keys(schemaTest[0]) : [],
        columnCount: schemaTest && schemaTest[0] ? Object.keys(schemaTest[0]).length : 0,
        error: schemaError ? {
          code: schemaError.code,
          message: schemaError.message,
          details: schemaError.details,
          hint: schemaError.hint
        } : null,
      });
      
      if (schemaError) {
        console.error('❌ Even basic query fails:', {
          code: schemaError.code,
          message: schemaError.message,
          details: schemaError.details,
          hint: schemaError.hint,
          fullError: schemaError
        });
        set({ lessons: [], loading: false });
        return;
      }
      
      if (schemaTest && schemaTest[0]) {
        // Only log column details if there are few columns
        const columns = Object.keys(schemaTest[0]);
        console.log('✅ Lessons table columns:', columns.length);
        if (columns.length < 30) {
          console.log('📋 Column details:', columns.map(col => ({
            name: col,
            type: typeof schemaTest[0][col]
          })));
        }
      }

      console.log('🔍 Fetching lessons with pagination...', { studentId, date });

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

      console.log('📦 STEP 1 Result:', { 
        dataCount: data?.length || 0, 
        error: error ? { 
          code: error.code, 
          message: error.message,
          details: error.details,
          hint: error.hint
        } : null,
        firstLesson: data?.[0] ? {
          id: data[0].id,
          date: data[0].date,
          title: data[0].title,
          student_id: data[0].student_id,
        } : null
      });

      if (error) {
        console.error('❌ STEP 1 Failed - Column name error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
        
        // Check for specific column errors
        if (error.code === '42703') {
          console.error('❌❌❌ COLUMN DOES NOT EXIST ERROR (42703)');
          console.error('❌❌❌ This means a column name in the query is wrong.');
          console.error('❌❌❌ Check the error.hint for the exact column name.');
        }
        
        set({ lessons: [], loading: false });
        return;
      }

      // If simple query works, proceed to STEP 2
      console.log('✅ STEP 1 Success! Proceeding to STEP 2...');

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
        console.log('⚠️ STEP 2a failed, trying STEP 2b with explicit foreign key...');
        
        // Try 2b: Explicit foreign key syntax
        const step2b = await supabase
          .from('lessons')
          .select('*, lesson_students!lesson_students_lesson_id_fkey(*)')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(10000); // Increased from 500 to fetch all lessons

        if (step2b.error) {
          console.log('⚠️ STEP 2b failed, trying STEP 2c with reverse relationship...');
          
          // Try 2c: Query from lesson_students side
          const lessonIds = (data || []).map((l: any) => l.id);
          if (lessonIds.length === 0) {
            console.log('📦 No lessons to fetch junction data for');
            set({ lessons: data || [], loading: false });
            return;
          }

          const { data: junctionData, error: junctionError } = await supabase
            .from('lesson_students')
            .select('lesson_id, student_id')
            .in('lesson_id', lessonIds);

          if (junctionError) {
            console.error('❌ STEP 2c (separate query) also failed:', junctionError);
            
            // Check if the error is due to missing table
            if (junctionError.message?.includes('does not exist') || 
                junctionError.message?.includes('relation') ||
                junctionError.code === '42P01') {
              console.error('❌❌❌ CRITICAL: lesson_students table does not exist!');
              console.error('❌❌❌ Please run the migration in scripts/apply-lesson-students-migration.sql');
              console.error('❌❌❌ See MIGRATION_INSTRUCTIONS.md for details');
              console.error('❌❌❌ Using lessons without multi-student support for now...');
            }
            
            // Use simple data without relationships
            set({ lessons: data || [], loading: false });
            lastFetch = Date.now();
            cachedFilters = filters;
            return;
          }

          console.log('✅ STEP 2c Success (separate query)! Junction data:', junctionData?.length || 0);
          dataWithJunction = data;
          errorJunction = null;
          
          // Store junction data for later processing
          (dataWithJunction as any).__junctionData = junctionData;
        } else {
          console.log('✅ STEP 2b Success (explicit foreign key)!');
          dataWithJunction = step2b.data;
          errorJunction = null;
        }
      } else {
        console.log('✅ STEP 2a Success (simple syntax)!');
        dataWithJunction = step2a.data;
        errorJunction = null;
      }

      console.log('📦 STEP 2 Final Result:', { 
        dataCount: dataWithJunction?.length || 0, 
        error: errorJunction ? { code: errorJunction.code, message: errorJunction.message } : null,
        hasJunctionData: !!(dataWithJunction as any)?.[0]?.lesson_students || !!(dataWithJunction as any)?.__junctionData,
      });

      if (errorJunction || !dataWithJunction) {
        console.error('❌ STEP 2 Failed completely');
        // Fall back to simple data without relationships
        set({ lessons: data || [], loading: false });
        return;
      }

      // STEP 3: Fetch students separately and join (since nested queries aren't working)
      console.log('✅ STEP 2 Success! Proceeding to STEP 3 - fetching students separately...');

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

      console.log('📦 Found', studentIds.size, 'unique student IDs');

      // Fetch all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, name, color_theme, grade, avatar_type, avatar_value')
        .in('id', Array.from(studentIds))
        .eq('user_id', user.id);

      console.log('📦 STEP 3 Result (students fetch):', {
        studentsCount: studentsData?.length || 0,
        error: studentsError ? { code: studentsError.code, message: studentsError.message } : null,
      });

      if (studentsError) {
        console.error('❌ STEP 3 Failed to fetch students:', studentsError);
      }

      // STEP 4: Fetch photos separately and join
      console.log('✅ STEP 3 Complete! Proceeding to STEP 4 - fetching photos separately...');

      const lessonIds = (dataWithJunction || []).map((l: any) => l.id);
      let photosData: any[] = [];

      if (lessonIds.length > 0) {
        const { data: photos, error: photosError } = await supabase
          .from('lesson_photos')
          .select('id, lesson_id, storage_path, caption, created_at')
          .in('lesson_id', lessonIds)
          .order('created_at', { ascending: true });

        console.log('📦 STEP 4 Result (photos fetch):', {
          photosCount: photos?.length || 0,
          error: photosError ? { code: photosError.code, message: photosError.message } : null,
        });

        if (photosError) {
          console.error('❌ STEP 4 Failed to fetch photos:', photosError);
          // Check if it's a table/column not found error
          if (photosError.code === '42P01' || photosError.code === 'PGRST116') {
            console.warn('⚠️ lesson_photos table may not exist. Please run migration 005_create_lesson_photos.sql');
          } else if (photosError.code === '42703' || photosError.message?.includes('does not exist')) {
            console.warn('⚠️ lesson_photos table exists but storage_path column is missing. Please run migration 007_add_storage_path_to_lesson_photos.sql');
          }
          // Continue without photos if fetch fails
          photosData = [];
        } else {
          photosData = photos || [];
        }
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

      // Combine lessons with students
      console.log('✅ Combining lessons with students...');

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

      console.log('✅ Processed lessons with students and photos:', lessonsWithStudents.length);

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

      console.log('✅ Final processed lessons:', filteredLessons.length);
      console.log('📊 LESSON FETCH SUMMARY:', {
        totalCount: filteredLessons.length,
        firstLesson: filteredLessons[0] ? {
          id: filteredLessons[0].id,
          title: filteredLessons[0].title,
          date: filteredLessons[0].date,
          subject: filteredLessons[0].subject
        } : null,
        lastLesson: filteredLessons[filteredLessons.length - 1] ? {
          id: filteredLessons[filteredLessons.length - 1].id,
          title: filteredLessons[filteredLessons.length - 1].title,
          date: filteredLessons[filteredLessons.length - 1].date,
        } : null,
        dateRange: filteredLessons.length > 0 ? {
          earliest: filteredLessons[filteredLessons.length - 1]?.date,
          latest: filteredLessons[0]?.date
        } : null
      });
      
      set({ lessons: filteredLessons, loading: false });
      lastFetch = Date.now(); // Update cache timestamp
      cachedFilters = filters; // Update cached filters
      
      // Cache data for offline use (reuse cacheKeyForStorage declared at line 55)
      await cacheData(cacheKeyForStorage, filteredLessons);
    } catch (error) {
      console.error('❌ Error fetching lessons:', error);
      // Try to use cached data on error (cacheKey is available in catch scope)
      const cacheKeyForError = `lessons_${cacheKey}`;
      const cached = await getCachedData(cacheKeyForError, CACHE_DURATION * 2);
      if (cached) {
        console.log('📦 Using cached lessons due to error');
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

