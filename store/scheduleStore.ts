import { supabase } from '@/lib/supabase';
import { SchoolBreak, SchoolSchedule } from '@/types/database';
import { format } from 'date-fns';
import { create } from 'zustand';

interface ScheduleStore {
  schedule: SchoolSchedule | null;
  breaks: SchoolBreak[];
  
  // Actions
  fetchSchedule: () => Promise<void>;
  updateSchedule: (schedule: Partial<SchoolSchedule>) => Promise<void>;
  getSchoolDays: () => number[]; // Returns array of school day numbers [1,2,3,4,5] for Mon-Fri
  
  fetchBreaks: () => Promise<void>;
  addBreak: (breakData: Omit<SchoolBreak, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  updateBreak: (breakId: string, breakData: Partial<Omit<SchoolBreak, 'id' | 'user_id' | 'created_at'>>) => Promise<void>;
  deleteBreak: (id: string) => Promise<void>;
  isBreakDay: (date: Date | string) => boolean;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  schedule: null,
  breaks: [],

  fetchSchedule: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('school_schedule')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching schedule:', error);
      return;
    }

    if (!data) {
      // Create default schedule (Mon-Fri)
      const { data: newSchedule, error: insertError } = await supabase
        .from('school_schedule')
        .insert({
          user_id: user.id,
          sunday: false,
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating default schedule:', insertError);
        return;
      }

      set({ schedule: newSchedule });
    } else {
      set({ schedule: data });
    }
  },

  updateSchedule: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('school_schedule')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      return;
    }

    set({ schedule: data });
  },

  getSchoolDays: () => {
    const schedule = get().schedule;
    if (!schedule) return [1, 2, 3, 4, 5]; // Default: Mon-Fri

    const days: number[] = [];
    if (schedule.sunday) days.push(0);
    if (schedule.monday) days.push(1);
    if (schedule.tuesday) days.push(2);
    if (schedule.wednesday) days.push(3);
    if (schedule.thursday) days.push(4);
    if (schedule.friday) days.push(5);
    if (schedule.saturday) days.push(6);

    return days;
  },

  fetchBreaks: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('school_breaks')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Error fetching breaks:', error);
      return;
    }

    set({ breaks: data || [] });
  },

  addBreak: async (breakData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('school_breaks')
      .insert({ ...breakData, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error('Error adding break:', error);
      return;
    }

    set((state) => ({ breaks: [...state.breaks, data] }));
  },

  updateBreak: async (breakId, breakData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('school_breaks')
      .update(breakData)
      .eq('id', breakId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating break:', error);
      return;
    }

    // Refresh breaks
    await get().fetchBreaks();
  },

  deleteBreak: async (id) => {
    const { error } = await supabase
      .from('school_breaks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting break:', error);
      return;
    }

    set((state) => ({
      breaks: state.breaks.filter((b) => b.id !== id),
    }));
  },

  isBreakDay: (date: Date | string) => {
    const breaks = get().breaks;
    // Handle both Date objects and strings
    const dateStr = typeof date === 'string' 
      ? date 
      : date instanceof Date 
        ? format(date, 'yyyy-MM-dd')
        : '';

    return breaks.some((breakItem) => {
      return dateStr >= breakItem.start_date && dateStr <= breakItem.end_date;
    });
  },
}));
