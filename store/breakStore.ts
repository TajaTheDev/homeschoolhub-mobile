import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { format } from 'date-fns';

type Break = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  /** Live DB column for break title */
  reason?: string;
  /** Legacy UI field; mapped to reason on write */
  name?: string;
  emoji?: string;
  caused_shifts: boolean;
  shift_days: number;
  created_at: string;
  updated_at: string;
};

type BreakInput = Omit<Break, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

type BreakStore = {
  breaks: Break[];
  loading: boolean;
  error: string | null;
  
  fetchBreaks: () => Promise<void>;
  addBreak: (breakData: BreakInput) => Promise<{ success: boolean; data?: Break; error?: string }>;
  deleteBreak: (breakId: string) => Promise<{ success: boolean; error?: string }>;
  isBreakDay: (date: Date) => boolean;
};

export const useBreakStore = create<BreakStore>((set, get) => ({
  breaks: [],
  loading: false,
  error: null,
  
  fetchBreaks: async () => {
    try {
      set({ loading: true, error: null });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ loading: false });
        return;
      }
      
      const { data, error } = await supabase
        .from('breaks')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });
      
      if (error) {
        console.error('Error fetching breaks:', error);
        set({ error: error.message, loading: false });
        return;
      }
      
            set({ breaks: data || [], loading: false });
      
    } catch (error: any) {
      console.error('Error in fetchBreaks:', error);
      set({ error: error.message, loading: false });
    }
  },
  
  addBreak: async (breakData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Live schema uses `reason` (not `name`) for the break title
      const { name: _legacyName, reason, ...rest } = breakData;
      const title = reason ?? _legacyName;
      
      const { data, error } = await supabase
        .from('breaks')
        .insert({
          ...rest,
          reason: title,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error adding break:', error);
        return { success: false, error: error.message };
      }
      
            
      // Add to local state
      set(state => ({
        breaks: [data, ...state.breaks],
      }));
      
      return { success: true, data };
      
    } catch (error: any) {
      console.error('Error in addBreak:', error);
      return { success: false, error: error.message };
    }
  },
  
  deleteBreak: async (breakId) => {
    try {
      const { error } = await supabase
        .from('breaks')
        .delete()
        .eq('id', breakId);
      
      if (error) {
        console.error('Error deleting break:', error);
        return { success: false, error: error.message };
      }
      
            
      // Remove from local state
      set(state => ({
        breaks: state.breaks.filter(b => b.id !== breakId),
      }));
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Error in deleteBreak:', error);
      return { success: false, error: error.message };
    }
  },
  
  isBreakDay: (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { breaks } = get();
    
    const isBreak = breaks.some(breakItem => {
      const inRange = dateStr >= breakItem.start_date && 
                      dateStr <= breakItem.end_date;
      
      if (inRange) {
              }
      
      return inRange;
    });
    
    return isBreak;
  },
}));

export default useBreakStore;

