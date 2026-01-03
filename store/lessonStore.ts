/**
 * Lesson store using Zustand
 * Manages lesson data with Supabase operations
 */

import { supabase } from '@/lib/supabase/client';
import { cacheData, getCachedData, isOnline } from '@/lib/offline';
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

// Cache configuration
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
let lastFetch = 0;
let cachedFilters: { studentId?: string; date?: string } | null = null;

export const useLessonStore = create<LessonState>((set, get) => ({
  lessons: [],
  loading: false,

  fetchLessons: async (studentId?: string, date?: string) => {
    // Check in-memory cache first
    const now = Date.now();
    const filters = { studentId, date };
    const cacheKey = JSON.stringify(filters);
    const cachedKey = JSON.stringify(cachedFilters);
    
    if (now - lastFetch < CACHE_DURATION && 
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
      
      if (!online) {
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
        console.log('✅ Lessons table columns found:', Object.keys(schemaTest[0]));
        console.log('📋 Column details:', Object.keys(schemaTest[0]).map(col => ({
          name: col,
          type: typeof schemaTest[0][col],
          sampleValue: schemaTest[0][col]
        })));
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
        .order('date', { ascending: false })
        .limit(500);

      if (step2a.error) {
        console.log('⚠️ STEP 2a failed, trying STEP 2b with explicit foreign key...');
        
        // Try 2b: Explicit foreign key syntax
        const step2b = await supabase
          .from('lessons')
          .select('*, lesson_students!lesson_students_lesson_id_fkey(*)')
          .order('date', { ascending: false })
          .limit(500);

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

      // Apply date filtering if needed
      let filteredLessons = lessonsWithStudents;
      if (date) {
        filteredLessons = filteredLessons.filter((l: any) => l.date === date);
      } else {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const dateThreshold = threeMonthsAgo.toISOString().split('T')[0];
        filteredLessons = filteredLessons.filter((l: any) => l.date >= dateThreshold);
      }

      // Apply student filtering if needed
      if (studentId) {
        filteredLessons = filteredLessons.filter((l: any) =>
          l.student_id === studentId ||
          l.students?.some((s: any) => s.id === studentId)
        );
      }

      console.log('✅ Final processed lessons:', filteredLessons.length);
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
    set({ loading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        set({ loading: false });
        return { success: false, error: 'Not authenticated' };
      }
      
      const { data, error } = await supabase
        .from('lessons')
        .insert({
          ...lessonData,
          user_id: user.id,  // ← ADD THIS!
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding lesson:', error);
        set({ loading: false });
        return { success: false, error: error.message };
      }
      
      // Update local state immediately with new lesson
      set((state) => ({ 
        lessons: [...state.lessons, data],
        loading: false,
      }));
      
      return { success: true, data };
    } catch (error) {
      console.error('Error adding lesson:', error);
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

