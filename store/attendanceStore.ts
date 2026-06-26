import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { AttendanceRecord, DailyAttendance, AttendanceStats } from '@/types';
import { useStudentStore } from './studentStore';

import type { Student } from '@/types';

type MarkAttendanceOptions = {
  persistInBackground?: boolean;
  onPersistError?: (error: string) => void;
};

interface AttendanceStore {
  attendance: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  
  // Fetch all attendance records
  fetchAttendance: () => Promise<void>;
  
  // Get attendance for a specific date
  getAttendanceForDate: (date: string) => AttendanceRecord[];
  
  // Check if a date has any attendance records
  hasAttendanceForDate: (date: string) => boolean;
  
  // Mark attendance for multiple students on a date
  markAttendance: (
    date: string,
    presentStudentIds: string[],
    notes?: string,
    options?: MarkAttendanceOptions
  ) => Promise<{ success: boolean; error?: string }>;
  
  // Update attendance for a student on a date
  updateAttendance: (studentId: string, date: string, present: boolean, notes?: string) => Promise<{ success: boolean; error?: string }>;
  
  // Delete attendance for a date
  deleteAttendanceForDate: (date: string) => Promise<{ success: boolean; error?: string }>;
  
  // Get attendance stats for a student
  getStudentStats: (studentId: string, startDate?: string, endDate?: string) => AttendanceStats | null;
}

// Track last local modification to prevent fetch from overwriting recent changes
let lastLocalModification: number = 0;
const GRACE_PERIOD = 3000; // 3 seconds grace period after local modification

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  attendance: [],
  loading: false,
  error: null,

  fetchAttendance: async () => {
    try {
      const now = Date.now();
      
      // Don't overwrite if we just modified locally (within grace period)
      if (now - lastLocalModification < GRACE_PERIOD) {
                return;
      }

      set({ loading: true, error: null });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false, error: 'Not authenticated' });
        return;
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching attendance:', error);
        set({ loading: false, error: error.message });
        return;
      }

      // Only update if we're not in grace period (double-check)
      const checkTime = Date.now();
      if (checkTime - lastLocalModification >= GRACE_PERIOD) {
        set({ attendance: data || [], loading: false });
      } else {
                set({ loading: false });
      }
    } catch (error: any) {
      console.error('Error in fetchAttendance:', error);
      set({ loading: false, error: error.message });
    }
  },

  getAttendanceForDate: (date: string) => {
    const { attendance } = get();
    return attendance.filter(a => a.date === date);
  },

  hasAttendanceForDate: (date: string) => {
    const { attendance } = get();
    return attendance.some(a => a.date === date);
  },

  markAttendance: async (date, presentStudentIds, notes, options) => {
    const previousAttendance = get().attendance;

    const persistToServer = async (
      userId: string,
      students: Student[]
    ): Promise<{ success: boolean; error?: string }> => {
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);

      if (deleteError) {
        console.error('❌ Error deleting old attendance:', deleteError);
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: deleteError.message };
      }

      const attendanceRecords = students.map((student) => {
        const isPresent = presentStudentIds.includes(student.id);

        return {
          user_id: userId,
          student_id: student.id,
          date,
          present: isPresent,
          notes: notes || null,
        };
      });

      const { data: insertedData, error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecords)
        .select();

      if (insertError) {
        console.error('❌ Error inserting attendance:', insertError);
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: insertError.message };
      }

      if (insertedData?.length !== students.length) {
        console.error('❌ MISMATCH! Expected', students.length, 'records, got', insertedData?.length);
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return {
          success: false,
          error: `Only saved ${insertedData?.length} of ${students.length} students`,
        };
      }

      const finalAttendance = [
        ...previousAttendance.filter((a) => a.date !== date),
        ...insertedData,
      ];

      set({ attendance: finalAttendance });

      setTimeout(() => {
        lastLocalModification = 0;
      }, GRACE_PERIOD);

      return { success: true };
    };

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Not authenticated');
        return { success: false, error: 'Not authenticated' };
      }

      const { students } = await import('./studentStore').then((m) =>
        m.useStudentStore.getState()
      );

      if (!students || students.length === 0) {
        console.error('❌ No students found!');
        return { success: false, error: 'No students found' };
      }

      lastLocalModification = Date.now();

      const optimisticRecords: AttendanceRecord[] = students.map((student) => {
        const isPresent = presentStudentIds.includes(student.id);
        return {
          id: `temp-${student.id}-${date}`,
          user_id: user.id,
          student_id: student.id,
          date,
          present: isPresent,
          notes: notes || null,
          created_at: new Date().toISOString(),
        };
      });

      const updatedAttendance = [
        ...previousAttendance.filter((a) => a.date !== date),
        ...optimisticRecords,
      ];

      set({ attendance: updatedAttendance });

      if (options?.persistInBackground) {
        void persistToServer(user.id, students).then((result) => {
          if (!result.success) {
            options.onPersistError?.(result.error ?? 'Failed to save attendance');
          }
        });
        return { success: true };
      }

      return await persistToServer(user.id, students);
    } catch (error: unknown) {
      console.error('❌ CRITICAL ERROR in markAttendance:', error);
      set({ attendance: previousAttendance });
      lastLocalModification = 0;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save attendance',
      };
    }
  },

  updateAttendance: async (studentId: string, date: string, present: boolean, notes?: string) => {
    const previousAttendance = get().attendance;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Optimistic update
      lastLocalModification = Date.now();
      const updatedAttendance = previousAttendance.map(a => 
        a.student_id === studentId && a.date === date
          ? { ...a, present, notes: notes || null }
          : a
      );
      
      // If record doesn't exist, add it
      const exists = updatedAttendance.some(a => a.student_id === studentId && a.date === date);
      if (!exists) {
        updatedAttendance.push({
          id: `temp-${studentId}-${date}`,
          user_id: user.id,
          student_id: studentId,
          date,
          present,
          notes: notes || null,
          created_at: new Date().toISOString(),
        });
      }
      
      set({ attendance: updatedAttendance });

      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          user_id: user.id,
          student_id: studentId,
          date,
          present,
          notes: notes || null,
        }, {
          onConflict: 'student_id,date',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error updating attendance:', error);
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: error.message };
      }

      // Update with real data
      const finalAttendance = previousAttendance.filter(a => 
        !(a.student_id === studentId && a.date === date)
      );
      if (data) {
        finalAttendance.push(data);
      }
      set({ attendance: finalAttendance });
      
      setTimeout(() => {
        lastLocalModification = 0;
      }, GRACE_PERIOD);

      return { success: true };
    } catch (error: any) {
      console.error('Error in updateAttendance:', error);
      set({ attendance: previousAttendance });
      lastLocalModification = 0;
      return { success: false, error: error.message };
    }
  },

  deleteAttendanceForDate: async (date: string) => {
    const previousAttendance = get().attendance;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Optimistic update
      lastLocalModification = Date.now();
      const updatedAttendance = previousAttendance.filter(a => a.date !== date);
      set({ attendance: updatedAttendance });

      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

      if (error) {
        console.error('Error deleting attendance:', error);
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: error.message };
      }

      setTimeout(() => {
        lastLocalModification = 0;
      }, GRACE_PERIOD);

      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteAttendanceForDate:', error);
      set({ attendance: previousAttendance });
      lastLocalModification = 0;
      return { success: false, error: error.message };
    }
  },

  getStudentStats: (studentId: string, startDate?: string, endDate?: string) => {
    const { attendance } = get();
    
    let filtered = attendance.filter(a => a.student_id === studentId);
    
    if (startDate) {
      filtered = filtered.filter(a => a.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(a => a.date <= endDate);
    }

    const total_days = filtered.length;
    const days_present = filtered.filter(a => a.present).length;
    const days_absent = total_days - days_present;
    const attendance_rate = total_days > 0 ? (days_present / total_days) * 100 : 0;

    return {
      student_id: studentId,
      student_name: '', // Will be filled by component
      total_days,
      days_present,
      days_absent,
      attendance_rate: Math.round(attendance_rate * 10) / 10, // Round to 1 decimal
    };
  },
}));

