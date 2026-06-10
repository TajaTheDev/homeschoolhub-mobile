/**
 * Lesson plan and curriculum library store.
 */

import type { StagedCurriculumSelection } from '@/lib/lessonPlanUtils';
import { supabase } from '@/lib/supabase/client';
import { type LibraryCategoryKey } from '@/lib/lessonPlanUtils';
import type { Tables } from '@/types/database.generated';
import { create } from 'zustand';

export type LessonPlan = Tables<'lesson_plans'> & {
  name?: string | null;
  toc_image_path?: string | null;
};
export type LessonPlanItem = Tables<'lesson_plan_items'>;
export type CurriculumLibrary = Tables<'curriculum_library'>;
export type CurriculumLibraryItem = Tables<'curriculum_library_items'>;

export type CurriculumWithItems = CurriculumLibrary & {
  items: CurriculumLibraryItem[];
};

export type NextLessonResult = {
  item_id: string;
  order_index: number;
  title: string;
};

type SavePlanParams = {
  studentId: string;
  subject: string;
  items: { title: string }[];
  source?: string | null;
  edition?: string | null;
  name?: string | null;
};

type PersistLessonPlanParams = {
  studentId: string;
  subject: string;
  name?: string | null;
  source?: string | null;
  edition?: string | null;
  tocImagePath?: string | null;
  items: { title: string }[];
};

type LessonPlanStore = {
  loading: boolean;
  saving: boolean;
  fetchPlan: (
    studentId: string,
    subject: string
  ) => Promise<{ plan: LessonPlan | null; items: LessonPlanItem[] }>;
  fetchLibrary: () => Promise<CurriculumWithItems[]>;
  fetchVerifiedLibrary: (category: LibraryCategoryKey) => Promise<CurriculumWithItems[]>;
  savePlan: (params: SavePlanParams) => Promise<{ success: boolean; error?: string }>;
  persistStagedCurriculum: (
    studentId: string,
    subject: string,
    staged: StagedCurriculumSelection
  ) => Promise<{ success: boolean; error?: string }>;
  fetchNextLesson: (
    studentId: string,
    subject: string
  ) => Promise<NextLessonResult | null>;
};

async function persistLessonPlan({
  studentId,
  subject,
  name,
  source,
  edition,
  tocImagePath,
  items,
}: PersistLessonPlanParams): Promise<{ success: boolean; error?: string }> {
  const normalizedSubject = subject.trim();

  const { data: existingPlan, error: existingPlanError } = await supabase
    .from('lesson_plans')
    .select('id')
    .eq('student_id', studentId)
    .eq('subject', normalizedSubject)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingPlanError) {
    return { success: false, error: existingPlanError.message };
  }

  let planId = existingPlan?.id ?? null;
  let existingItemIds: string[] = [];
  let createdNewPlan = false;

  const planPayload = {
    name: name ?? null,
    source: source ?? null,
    edition: edition ?? null,
    toc_image_path: tocImagePath ?? null,
  };

  if (planId) {
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('lesson_plan_items')
      .select('id')
      .eq('lesson_plan_id', planId);

    if (existingItemsError) {
      return { success: false, error: existingItemsError.message };
    }

    existingItemIds = (existingItems ?? []).map((item) => item.id);

    const { error: updatePlanError } = await supabase
      .from('lesson_plans')
      .update(planPayload)
      .eq('id', planId);

    if (updatePlanError) {
      return { success: false, error: updatePlanError.message };
    }
  } else {
    const { data: newPlan, error: createPlanError } = await supabase
      .from('lesson_plans')
      .insert({
        student_id: studentId,
        subject: normalizedSubject,
        ...planPayload,
      })
      .select('id')
      .single();

    if (createPlanError || !newPlan) {
      return {
        success: false,
        error: createPlanError?.message ?? 'Failed to create lesson plan.',
      };
    }

    planId = newPlan.id;
    createdNewPlan = true;
  }

  if (items.length === 0) {
    if (existingItemIds.length > 0) {
      if (source === 'scan' && existingItemIds.length > 0) {
        return { success: true };
      }

      const { error: deleteError } = await supabase
        .from('lesson_plan_items')
        .delete()
        .in('id', existingItemIds);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }
    }

    return { success: true };
  }

  const rowsToInsert = items.map((item, index) => ({
    lesson_plan_id: planId!,
    title: item.title,
    order_index: index,
  }));

  const { data: insertedItems, error: insertError } = await supabase
    .from('lesson_plan_items')
    .insert(rowsToInsert)
    .select('id');

  if (insertError || !insertedItems) {
    if (createdNewPlan && planId) {
      await supabase.from('lesson_plans').delete().eq('id', planId);
    }
    return {
      success: false,
      error: insertError?.message ?? 'Failed to save lesson items.',
    };
  }

  if (existingItemIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('lesson_plan_items')
      .delete()
      .in('id', existingItemIds);

    if (deleteError) {
      const newItemIds = insertedItems.map((item) => item.id);
      await supabase.from('lesson_plan_items').delete().in('id', newItemIds);
      return { success: false, error: deleteError.message };
    }
  }

  return { success: true };
}

export const useLessonPlanStore = create<LessonPlanStore>(() => ({
  loading: false,
  saving: false,

  fetchPlan: async (studentId, subject) => {
    const normalizedSubject = subject.trim();

    const { data: plan, error: planError } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('student_id', studentId)
      .eq('subject', normalizedSubject)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError) {
      throw new Error(planError.message);
    }

    if (!plan) {
      return { plan: null, items: [] };
    }

    const { data: items, error: itemsError } = await supabase
      .from('lesson_plan_items')
      .select('*')
      .eq('lesson_plan_id', plan.id)
      .order('order_index', { ascending: true });

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    return { plan: plan as LessonPlan, items: items ?? [] };
  },

  fetchLibrary: async () => {
    const { data: curricula, error: curriculaError } = await supabase
      .from('curriculum_library')
      .select('*')
      .order('name', { ascending: true });

    if (curriculaError) {
      throw new Error(curriculaError.message);
    }

    if (!curricula?.length) {
      return [];
    }

    return attachLibraryItems(curricula);
  },

  fetchVerifiedLibrary: async (category) => {
    const { data: curricula, error: curriculaError } = await supabase
      .from('curriculum_library')
      .select('*')
      .eq('category', category)
      .eq('verified', true)
      .order('name', { ascending: true });

    if (curriculaError) {
      throw new Error(curriculaError.message);
    }

    if (!curricula?.length) {
      return [];
    }

    return attachLibraryItems(curricula);
  },

  savePlan: async ({ studentId, subject, items, source, edition, name }) => {
    if (items.length === 0) {
      return { success: false, error: 'Add at least one lesson to save.' };
    }

    useLessonPlanStore.setState({ saving: true });

    try {
      return await persistLessonPlan({
        studentId,
        subject,
        name: name ?? null,
        source,
        edition,
        items,
      });
    } finally {
      useLessonPlanStore.setState({ saving: false });
    }
  },

  persistStagedCurriculum: async (studentId, subject, staged) => {
    if (staged.kind === 'library') {
      return persistLessonPlan({
        studentId,
        subject,
        name: staged.name,
        source: 'library',
        edition: staged.edition,
        items: staged.items,
      });
    }

    return persistLessonPlan({
      studentId,
      subject,
      name: staged.name,
      source: 'scan',
      tocImagePath: staged.tocImagePath,
      items: [],
    });
  },

  fetchNextLesson: async (studentId, subject) => {
    const normalizedSubject = subject.trim();

    const { data, error } = await supabase.rpc('next_lesson', {
      p_student: studentId,
      p_subject: normalizedSubject,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data?.[0] ?? null;
  },
}));

async function attachLibraryItems(
  curricula: CurriculumLibrary[]
): Promise<CurriculumWithItems[]> {
  const curriculumIds = curricula.map((entry) => entry.id);
  const { data: items, error: itemsError } = await supabase
    .from('curriculum_library_items')
    .select('*')
    .in('curriculum_id', curriculumIds)
    .order('order_index', { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const itemsByCurriculum = new Map<string, CurriculumLibraryItem[]>();
  for (const item of items ?? []) {
    const existing = itemsByCurriculum.get(item.curriculum_id) ?? [];
    existing.push(item);
    itemsByCurriculum.set(item.curriculum_id, existing);
  }

  return curricula.map((curriculum) => ({
    ...curriculum,
    items: itemsByCurriculum.get(curriculum.id) ?? [],
  }));
}
