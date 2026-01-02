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

export const useAttendanceStore = create<AttendanceStore>((set, get) => ({
  attendance: [],
  loading: false,
  error: null,

  fetchAttendance: async () => {
    try {
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

      set({ attendance: data || [], loading: false });
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

      // STEP 1: Delete existing attendance for this date (clean slate)
      console.log('🗑️ Deleting existing attendance for', date);
      
      const { error: deleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

      if (deleteError) {
        console.error('❌ Error deleting old attendance:', deleteError);
        // Continue anyway - maybe there was no old data
      } else {
        console.log('✅ Old attendance deleted');
      }

      // STEP 2: Create new attendance records for ALL students
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

      // STEP 3: Insert all records
      const { data: insertedData, error: insertError } = await supabase
        .from('attendance')
        .insert(attendanceRecords)
        .select();

      if (insertError) {
        console.error('❌ Error inserting attendance:', insertError);
        return { success: false, error: insertError.message };
      }

      console.log('✅ Inserted records:', insertedData?.length);

      // VALIDATE: Check that we inserted correct number of records
      if (insertedData?.length !== students.length) {
        console.error('❌ MISMATCH! Expected', students.length, 'records, got', insertedData?.length);
        return { 
          success: false, 
          error: `Only saved ${insertedData?.length} of ${students.length} students` 
        };
      }

      console.log('✅ ATTENDANCE SAVE COMPLETE - All students saved');

      // STEP 4: Refresh attendance data
      await get().fetchAttendance();

      // STEP 5: Verify the data is in the store
      const updatedAttendance = get().attendance;
      const recordsForDate = updatedAttendance.filter(a => a.date === date);

      console.log('✅ Verification: Found', recordsForDate.length, 'records for', date, 'in store');

      if (recordsForDate.length !== students.length) {
        console.warn('⚠️ Store has', recordsForDate.length, 'but should have', students.length);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ CRITICAL ERROR in markAttendance:', error);
      return { success: false, error: error.message };
    }
  },

  updateAttendance: async (studentId: string, date: string, present: boolean, notes?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
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
        });

      if (error) {
        console.error('Error updating attendance:', error);
        return { success: false, error: error.message };
      }

      await get().fetchAttendance();
      return { success: true };
    } catch (error: any) {
      console.error('Error in updateAttendance:', error);
      return { success: false, error: error.message };
    }
  },

  deleteAttendanceForDate: async (date: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('user_id', user.id)
        .eq('date', date);

      if (error) {
        console.error('Error deleting attendance:', error);
        return { success: false, error: error.message };
      }

      await get().fetchAttendance();
      return { success: true };
    } catch (error: any) {
      console.error('Error in deleteAttendanceForDate:', error);
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

