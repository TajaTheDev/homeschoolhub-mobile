/**
 * Reading log store — per-student book tracking.
 */

import { supabase } from '@/lib/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.generated';
import { create } from 'zustand';

export type ReadingLogStatus = 'reading' | 'finished';
export type ReaderType = 'independent' | 'read_aloud';

export type ReadingLogEntry = Tables<'reading_log'> & {
  pages_read?: number | null;
  minutes_read?: number | null;
  reader_type?: ReaderType | null;
};

export type ReadingLogFields = {
  title: string;
  author?: string | null;
  status: ReadingLogStatus;
  date_started?: string | null;
  date_finished?: string | null;
  rating?: number | null;
  notes?: string | null;
  pages_read?: number | null;
  minutes_read?: number | null;
  reader_type?: ReaderType | null;
};

type ReadingLogStore = {
  books: ReadingLogEntry[];
  loading: boolean;
  error: string | null;
  fetchReadingLog: (studentId: string) => Promise<void>;
  addBook: (
    studentId: string,
    fields: ReadingLogFields
  ) => Promise<{ success: boolean; data?: ReadingLogEntry; error?: string }>;
  updateBook: (
    id: string,
    fields: Partial<ReadingLogFields>
  ) => Promise<{ success: boolean; data?: ReadingLogEntry; error?: string }>;
  deleteBook: (id: string) => Promise<{ success: boolean; error?: string }>;
};

export const useReadingLogStore = create<ReadingLogStore>((set, get) => ({
  books: [],
  loading: false,
  error: null,

  fetchReadingLog: async (studentId) => {
    try {
      set({ loading: true, error: null });

      const { data, error } = await supabase
        .from('reading_log')
        .select('*')
        .eq('student_id', studentId);

      if (error) {
        console.error('Error fetching reading log:', error);
        set({ loading: false, error: error.message });
        return;
      }

      set({ books: data ?? [], loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch reading log';
      console.error('Error in fetchReadingLog:', error);
      set({ loading: false, error: message });
    }
  },

  addBook: async (studentId, fields) => {
    try {
      const payload: TablesInsert<'reading_log'> = {
        student_id: studentId,
        title: fields.title.trim(),
        author: fields.author?.trim() || null,
        status: fields.status,
        date_started: fields.date_started ?? null,
        date_finished: fields.date_finished ?? null,
        rating: fields.rating ?? null,
        notes: fields.notes?.trim() || null,
        pages_read: fields.pages_read ?? null,
        minutes_read: fields.minutes_read ?? null,
        reader_type: fields.reader_type ?? null,
      };

      const { data, error } = await supabase
        .from('reading_log')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('Error adding book:', error);
        return { success: false, error: error.message };
      }

      set((state) => ({
        books: [data, ...state.books],
      }));

      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add book';
      console.error('Error in addBook:', error);
      return { success: false, error: message };
    }
  },

  updateBook: async (id, fields) => {
    const previousBooks = get().books;

    try {
      const payload: TablesUpdate<'reading_log'> = {};

      if (fields.title !== undefined) {
        payload.title = fields.title.trim();
      }
      if (fields.author !== undefined) {
        payload.author = fields.author?.trim() || null;
      }
      if (fields.status !== undefined) {
        payload.status = fields.status;
      }
      if (fields.date_started !== undefined) {
        payload.date_started = fields.date_started;
      }
      if (fields.date_finished !== undefined) {
        payload.date_finished = fields.date_finished;
      }
      if (fields.rating !== undefined) {
        payload.rating = fields.rating;
      }
      if (fields.notes !== undefined) {
        payload.notes = fields.notes?.trim() || null;
      }
      if (fields.pages_read !== undefined) {
        payload.pages_read = fields.pages_read;
      }
      if (fields.minutes_read !== undefined) {
        payload.minutes_read = fields.minutes_read;
      }
      if (fields.reader_type !== undefined) {
        payload.reader_type = fields.reader_type;
      }

      const { data, error } = await supabase
        .from('reading_log')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating book:', error);
        return { success: false, error: error.message };
      }

      set((state) => ({
        books: state.books.map((book) => (book.id === id ? data : book)),
      }));

      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update book';
      console.error('Error in updateBook:', error);
      set({ books: previousBooks });
      return { success: false, error: message };
    }
  },

  deleteBook: async (id) => {
    const previousBooks = get().books;

    try {
      set((state) => ({
        books: state.books.filter((book) => book.id !== id),
      }));

      const { error } = await supabase.from('reading_log').delete().eq('id', id);

      if (error) {
        console.error('Error deleting book:', error);
        set({ books: previousBooks });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete book';
      console.error('Error in deleteBook:', error);
      set({ books: previousBooks });
      return { success: false, error: message };
    }
  },
}));
