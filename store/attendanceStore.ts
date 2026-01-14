import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { AttendanceRecord, DailyAttendance, AttendanceStats } from '@/types';
import { useStudentStore } from './studentStore';

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
  markAttendance: (date: string, presentStudentIds: string[], notes?: string) => Promise<{ success: boolean; error?: string }>;
  
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
        console.log('⏭️ Skipping fetch - recent local modification detected');
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
        console.log('⏭️ Skipping state update - recent local modification');
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

  markAttendance: async (date: string, presentStudentIds: string[], notes?: string) => {
    // Save current state for rollback
    const previousAttendance = get().attendance;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Not authenticated');
        return { success: false, error: 'Not authenticated' };
      }

      console.log('🔍 START ATTENDANCE SAVE');
      console.log('  Date:', date);
      console.log('  Present IDs:', presentStudentIds);
      console.log('  Notes:', notes);

      // Import student store
      const { students } = await import('./studentStore').then(m => m.useStudentStore.getState());
      
      if (!students || students.length === 0) {
        console.error('❌ No students found!');
        return { success: false, error: 'No students found' };
      }

      console.log('  Total students:', students.length);

      // STEP 1: Optimistic update - update UI immediately
      const now = Date.now();
      lastLocalModification = now;
      
      const optimisticRecords: AttendanceRecord[] = students.map(student => {
        const isPresent = presentStudentIds.includes(student.id);
        return {
          id: `temp-${student.id}-${date}`, // Temporary ID
          user_id: user.id,
          student_id: student.id,
          date: date,
          present: isPresent,
          notes: notes || null,
          created_at: new Date().toISOString(),
        };
      });

      // Update state optimistically (remove old records for this date, add new ones)
      const updatedAttendance = [
        ...previousAttendance.filter(a => a.date !== date),
        ...optimisticRecords,
      ];
      
      set({ attendance: updatedAttendance });
      console.log('⚡ Optimistic update applied - UI updated immediately');

      // STEP 2: Delete existing attendance for this date (clean slate)
      console.log('🗑️ Deleting existing attendance for', date);
      
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

      if (deleteError) {
        console.error('❌ Error deleting old attendance:', deleteError);
        // Rollback on error
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: deleteError.message };
      }

      console.log('✅ Old attendance deleted');

      // STEP 3: Create new attendance records for ALL students
      const attendanceRecords = students.map(student => {
        const isPresent = presentStudentIds.includes(student.id);
        console.log(`  ${isPresent ? '✓' : '✗'} ${student.name} (${student.id}): ${isPresent ? 'PRESENT' : 'ABSENT'}`);
        
        return {
          user_id: user.id,
          student_id: student.id,
          date: date,
          present: isPresent,
          notes: notes || null,
        };
      });

      console.log('📝 Inserting', attendanceRecords.length, 'new records');

      // STEP 4: Insert all records
      const { data: insertedData, error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecords)
        .select();

      if (insertError) {
        console.error('❌ Error inserting attendance:', insertError);
        // Rollback on error
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { success: false, error: insertError.message };
      }

      console.log('✅ Inserted records:', insertedData?.length);

      // VALIDATE: Check that we inserted correct number of records
      if (insertedData?.length !== students.length) {
        console.error('❌ MISMATCH! Expected', students.length, 'records, got', insertedData?.length);
        // Rollback on error
        set({ attendance: previousAttendance });
        lastLocalModification = 0;
        return { 
          success: false, 
          error: `Only saved ${insertedData?.length} of ${students.length} students` 
        };
      }

      // STEP 5: Update with real data from server (replace optimistic records)
      const finalAttendance = [
        ...previousAttendance.filter(a => a.date !== date),
        ...insertedData,
      ];
      
      set({ attendance: finalAttendance });
      
      // Reset grace period after successful save (allow future fetches)
      setTimeout(() => {
        lastLocalModification = 0;
      }, GRACE_PERIOD);

      console.log('✅ ATTENDANCE SAVE COMPLETE - All students saved');

      return { success: true };
    } catch (error: any) {
      console.error('❌ CRITICAL ERROR in markAttendance:', error);
      // Rollback on error
      set({ attendance: previousAttendance });
      lastLocalModification = 0;
      return { success: false, error: error.message };
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

