import ManualItemList from '@/components/lesson-plan/ManualItemList';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { createWorkingItem, type WorkingItem } from '@/lib/lessonPlanUtils';
import { supabase } from '@/lib/supabase/client';
import { useLessonPlanStore, type LessonPlanItem } from '@/store/lessonPlanStore';
import { X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type SheetMode = 'summary' | 'edit';

type PersonalCurriculumSheetProps = {
  visible: boolean;
  studentId: string;
  subject: string;
  curriculumName: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onOpenAddCurriculum?: () => void;
};

/**
 * Replaces lesson_plan_items for a plan without touching lesson_plans metadata.
 * Same delete+insert pattern as AddCurriculumSheet.saveLessonPlanItems.
 */
async function saveLessonPlanItems(lessonPlanId: string, titles: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('lesson_plan_items')
    .delete()
    .eq('lesson_plan_id', lessonPlanId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (titles.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from('lesson_plan_items').insert(
    titles.map((title, index) => ({
      lesson_plan_id: lessonPlanId,
      title: title.trim(),
      order_index: index,
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export default function PersonalCurriculumSheet({
  visible,
  studentId,
  subject,
  curriculumName,
  onClose,
  onSaved,
  onOpenAddCurriculum,
}: PersonalCurriculumSheetProps) {
  const { fetchPlan } = useLessonPlanStore();
  const [mode, setMode] = useState<SheetMode>('summary');
  const [planId, setPlanId] = useState<string | null>(null);
  const [summaryItems, setSummaryItems] = useState<LessonPlanItem[]>([]);
  const [editItems, setEditItems] = useState<WorkingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPlanItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { plan, items } = await fetchPlan(studentId, subject);

      if (!plan?.id) {
        throw new Error('No lesson plan found for this subject.');
      }

      setPlanId(plan.id);
      setSummaryItems(items);
      setEditItems(items.map((item) => createWorkingItem(item.title)));
    } catch (error) {
      console.error('Failed to load personal curriculum:', error);
      setPlanId(null);
      setSummaryItems([]);
      setEditItems([]);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load your curriculum.'
      );
    } finally {
      setLoading(false);
    }
  }, [fetchPlan, studentId, subject]);

  useEffect(() => {
    if (!visible) return;

    setMode('summary');
    void loadPlanItems();
  }, [visible, loadPlanItems]);

  const handleClose = () => {
    if (saving) return;
    setMode('summary');
    onClose();
  };

  const handleOpenEdit = () => {
    setEditItems(summaryItems.map((item) => createWorkingItem(item.title)));
    setMode('edit');
  };

  const handleCancelEdit = () => {
    if (saving) return;
    setEditItems(summaryItems.map((item) => createWorkingItem(item.title)));
    setMode('summary');
  };

  const handleSaveEdit = async () => {
    if (!planId) {
      Alert.alert('Save failed', 'No lesson plan found for this subject.');
      return;
    }

    const titles = editItems.map((item) => item.title.trim()).filter(Boolean);
    if (titles.length === 0) {
      Alert.alert('No lessons', 'Add at least one lesson before saving.');
      return;
    }

    setSaving(true);

    try {
      await saveLessonPlanItems(planId, titles);
      await loadPlanItems();
      setMode('summary');
      await onSaved();
      Alert.alert(
        'Saved',
        `${titles.length} lesson${titles.length === 1 ? '' : 's'} saved to your plan.`
      );
    } catch (error) {
      console.error('Failed to save personal curriculum lessons:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save your lessons. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddCurriculum = () => {
    if (saving) return;
    onClose();
    onOpenAddCurriculum?.();
  };

  const getSheetTitle = () => {
    if (mode === 'edit') return 'Edit lessons';
    return curriculumName;
  };

  const renderSummaryMode = () => {
    if (loading) {
      return (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading lessons…</Text>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button title="Try again" onPress={() => void loadPlanItems()} variant="outline" />
        </View>
      );
    }

    return (
      <>
        <Text style={styles.metaLine}>Your curriculum</Text>
        <Text style={styles.countLabel}>
          {summaryItems.length === 0
            ? 'No lessons yet'
            : `${summaryItems.length} lesson${summaryItems.length === 1 ? '' : 's'}`}
        </Text>

        {summaryItems.length > 0 ? (
          <View style={[styles.listCard, styles.lessonListCard]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {summaryItems.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.lessonRow,
                    index < summaryItems.length - 1 && styles.lessonRowBorder,
                  ]}
                >
                  <Text style={styles.orderBadge}>{index + 1}</Text>
                  <Text style={styles.lessonTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Text style={styles.sectionHeading}>Manage lessons</Text>
        <Button
          title="Edit lessons"
          onPress={handleOpenEdit}
          disabled={saving}
          style={styles.actionButton}
        />
        {onOpenAddCurriculum ? (
          <>
            <Button
              title="Re-scan TOC"
              variant="outline"
              onPress={handleOpenAddCurriculum}
              disabled={saving}
              style={styles.actionButton}
            />
            <Button
              title="Paste lessons"
              variant="outline"
              onPress={handleOpenAddCurriculum}
              disabled={saving}
              style={styles.actionButton}
            />
          </>
        ) : null}
      </>
    );
  };

  const renderEditMode = () => (
    <>
      <Text style={styles.sectionHint}>
        Reorder, rename, or remove lessons, then save.
      </Text>
      <ScrollView
        style={styles.editListScroll}
        contentContainerStyle={styles.editListContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        <ManualItemList items={editItems} onChange={setEditItems} />
      </ScrollView>
      <View style={styles.editFooter}>
        <Button
          title={`Save ${editItems.length} lesson${editItems.length === 1 ? '' : 's'}`}
          onPress={() => void handleSaveEdit()}
          loading={saving}
          disabled={editItems.length === 0 || saving}
        />
        <Button
          title="Back to summary"
          variant="outline"
          onPress={handleCancelEdit}
          disabled={saving}
          style={styles.actionButton}
        />
      </View>
    </>
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
          disabled={saving}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {getSheetTitle()}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={saving}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          {mode === 'edit' ? (
            <View style={styles.editModeContainer}>{renderEditMode()}</View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderSummaryMode()}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    gap: 12,
  },
  sheetTitle: {
    ...Typography.h3,
    fontSize: 20,
    flex: 1,
  },
  sheetContent: {
    padding: 24,
    paddingBottom: 40,
  },
  metaLine: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 8,
  },
  countLabel: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  errorCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 16,
    gap: 12,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.ui.error,
    textAlign: 'center',
    lineHeight: 20,
  },
  listCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  lessonListCard: {
    maxHeight: 200,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  lessonRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  orderBadge: {
    width: 24,
    textAlign: 'center',
    ...Typography.label,
    color: Colors.brand[600],
  },
  lessonTitle: {
    flex: 1,
    ...Typography.body,
    color: Colors.ui.text,
  },
  sectionHeading: {
    ...Typography.label,
    color: Colors.ui.text,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 10,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 12,
  },
  editModeContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    minHeight: 280,
  },
  editListScroll: {
    maxHeight: 360,
    marginTop: 8,
    marginBottom: 8,
  },
  editListContent: {
    paddingBottom: 8,
  },
  editFooter: {
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
});
