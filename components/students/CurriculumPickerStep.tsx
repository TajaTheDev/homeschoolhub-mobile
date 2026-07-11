import AddCurriculumSheet from '@/components/students/AddCurriculumSheet';
import CurriculumLibraryDetailSheet from '@/components/students/CurriculumLibraryDetailSheet';
import PersonalCurriculumSheet from '@/components/students/PersonalCurriculumSheet';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  getCategoryLabel,
  getCurriculumCategoryForSubject,
  stageLibraryCurriculum,
  type StagedCurriculumSelection,
} from '@/lib/lessonPlanUtils';
import { supabase } from '@/lib/supabase/client';
import {
  useLessonPlanStore,
  type CurriculumWithItems,
  type LessonPlan,
} from '@/store/lessonPlanStore';
import { BookOpen, ChevronLeft, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type CurriculumPickerStepProps = {
  studentId: string;
  subject: string;
  stagedSelection?: StagedCurriculumSelection;
  onStage: (selection: StagedCurriculumSelection) => void | Promise<void>;
  onSkip: () => void;
  onBack: () => void;
  onPlanUpdated?: () => void;
};

export default function CurriculumPickerStep({
  studentId,
  subject,
  stagedSelection,
  onStage,
  onSkip,
  onBack,
  onPlanUpdated,
}: CurriculumPickerStepProps) {
  const { fetchVerifiedLibrary, fetchPlan, fetchLibraryItems } = useLessonPlanStore();
  const [curricula, setCurricula] = useState<CurriculumWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingPlan, setExistingPlan] = useState<LessonPlan | null>(null);
  const [existingPlanItemCount, setExistingPlanItemCount] = useState(0);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showPersonalSheet, setShowPersonalSheet] = useState(false);
  const [detailCurriculum, setDetailCurriculum] = useState<CurriculumWithItems | null>(null);
  const [studentName, setStudentName] = useState('Student');
  const [searchQuery, setSearchQuery] = useState('');

  const category = getCurriculumCategoryForSubject(subject);
  const isLibraryCategory = category !== 'other';

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (isLibraryCategory) {
        const [libraryEntries, planResult] = await Promise.all([
          fetchVerifiedLibrary(category),
          fetchPlan(studentId, subject),
        ]);
        setCurricula(libraryEntries);
        setExistingPlan(planResult.plan);
        setExistingPlanItemCount(planResult.items.length);
      } else {
        const planResult = await fetchPlan(studentId, subject);
        setCurricula([]);
        setExistingPlan(planResult.plan);
        setExistingPlanItemCount(planResult.items.length);
      }
    } catch (error) {
      console.error('Failed to load curriculum picker:', error);
      setCurricula([]);
      setExistingPlan(null);
      setExistingPlanItemCount(0);
      setLoadError(
        error instanceof Error ? error.message : 'Could not load curriculum options.'
      );
    } finally {
      setLoading(false);
    }
  }, [category, fetchPlan, fetchVerifiedLibrary, isLibraryCategory, studentId, subject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ensureCurriculumItems = useCallback(
    async (curriculum: CurriculumWithItems): Promise<CurriculumWithItems> => {
      if (curriculum.items.length > 0) {
        return curriculum;
      }

      const items = await fetchLibraryItems(curriculum.id);
      const withItems: CurriculumWithItems = {
        ...curriculum,
        items,
        itemCount: curriculum.itemCount ?? items.length,
      };

      setCurricula((current) =>
        current.map((entry) => (entry.id === curriculum.id ? withItems : entry))
      );

      return withItems;
    },
    [fetchLibraryItems]
  );

  useEffect(() => {
    setSearchQuery('');
  }, [studentId, subject]);

  const filteredCurricula = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return curricula;
    return curricula.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [curricula, searchQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadStudentName = async () => {
      const { data, error } = await supabase
        .from('students')
        .select('name')
        .eq('id', studentId)
        .maybeSingle();

      if (!cancelled && !error && data?.name) {
        setStudentName(data.name);
      }
    };

    loadStudentName();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const activeSelection = useMemo((): StagedCurriculumSelection | null => {
    if (stagedSelection) {
      return stagedSelection;
    }
    if (existingPlan?.source === 'library' && existingPlan.name) {
      return {
        kind: 'library',
        name: existingPlan.name,
        edition: existingPlan.edition ?? null,
        items: [],
      };
    }
    if (existingPlan?.source === 'scan' && existingPlan.name) {
      return {
        kind: 'scan',
        name: existingPlan.name,
        tocImagePath: existingPlan.toc_image_path ?? '',
      };
    }
    return null;
  }, [stagedSelection, existingPlan]);

  const isCardSelected = (curriculum: CurriculumWithItems) =>
    activeSelection?.kind === 'library' && activeSelection.name === curriculum.name;

  const hasPersonalScanPlan =
    existingPlan?.source === 'scan' && !!existingPlan.name;

  const isPersonalScanSelected = activeSelection?.kind === 'scan';

  const confirmAndStageLibrary = (curriculum: CurriculumWithItems) => {
    const hasDifferentExisting =
      (existingPlan &&
        (existingPlan.source !== 'library' ||
          existingPlan.name !== curriculum.name ||
          (stagedSelection &&
            (stagedSelection.kind !== 'library' || stagedSelection.name !== curriculum.name)))) ||
      (stagedSelection?.kind === 'library' && stagedSelection.name !== curriculum.name);

    const applySelection = () => {
      onStage(stageLibraryCurriculum(curriculum));
    };

    if (hasDifferentExisting && (existingPlan || stagedSelection)) {
      Alert.alert(
        'Replace current sequence?',
        'This will replace your current lesson sequence when you save subjects. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: applySelection },
        ]
      );
      return;
    }

    applySelection();
  };

  const handleScanComplete = async (staged: StagedCurriculumSelection) => {
    setShowAddSheet(false);
    await onStage(staged);
    await loadData();
    onPlanUpdated?.();
  };

  const handlePersonalPlanSaved = async () => {
    await loadData();
    onPlanUpdated?.();
  };

  const renderPersonalCurriculumCard = () => {
    if (!hasPersonalScanPlan || !existingPlan?.name) return null;

    return (
      <TouchableOpacity
        style={[styles.entryCard, isPersonalScanSelected && styles.entryCardSelected]}
        onPress={() => setShowPersonalSheet(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.entryName}>{existingPlan.name}</Text>
        <Text style={styles.entryMeta}>Your curriculum</Text>
        <Text style={styles.entryCount}>
          {existingPlanItemCount} lesson{existingPlanItemCount === 1 ? '' : 's'}
        </Text>
        {isPersonalScanSelected ? (
          <Text style={styles.selectedBadge}>Selected</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const handleLibraryUpdated = (updated: CurriculumWithItems) => {
    setCurricula((current) =>
      current.map((entry) => (entry.id === updated.id ? updated : entry))
    );
    setDetailCurriculum(updated);
  };

  const handleSelectFromDetail = (curriculum: CurriculumWithItems) => {
    setDetailCurriculum(null);
    confirmAndStageLibrary(curriculum);
    onBack();
  };

  const handleLongPressStage = async (curriculum: CurriculumWithItems) => {
    try {
      const withItems = await ensureCurriculumItems(curriculum);
      confirmAndStageLibrary(withItems);
    } catch (error) {
      console.error('Failed to load curriculum items for staging:', error);
      Alert.alert('Could not load lessons', 'Please try again.');
    }
  };

  const openDetailCurriculum = async (curriculum: CurriculumWithItems) => {
    try {
      const withItems = await ensureCurriculumItems(curriculum);
      setDetailCurriculum(withItems);
    } catch (error) {
      console.error('Failed to load curriculum items:', error);
      Alert.alert('Could not load lessons', 'Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={22} color={Colors.ui.text} />
          <Text style={styles.backText}>Subjects</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Choose curriculum</Text>
      {isLibraryCategory ? (
        <Text style={styles.subtitle}>
          {subject} · {getCategoryLabel(category)}
        </Text>
      ) : (
        <>
          <Text style={styles.subtitle}>{subject}</Text>
          <Text style={styles.otherSubtitle}>
            Scan or import your table of contents to get started.
          </Text>
        </>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.brand[500]} />
          <Text style={styles.loadingText}>
            {isLibraryCategory ? 'Loading curricula…' : 'Loading…'}
          </Text>
        </View>
      ) : (
        <>
          {!isLibraryCategory ? renderPersonalCurriculumCard() : null}

          {isLibraryCategory ? (
            <ScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {renderPersonalCurriculumCard()}

              {loadError ? (
                <View style={styles.emptyCard}>
                  <BookOpen size={28} color={Colors.ui.error} />
                  <Text style={styles.emptyTitle}>Could not load curricula</Text>
                  <Text style={styles.emptyText}>{loadError}</Text>
                </View>
              ) : curricula.length === 0 ? (
                <View style={styles.emptyCard}>
                  <BookOpen size={28} color={Colors.ui.textLight} />
                  <Text style={styles.emptyTitle}>No curricula found</Text>
                  <Text style={styles.emptyText}>
                    No verified {getCategoryLabel(category)} curricula in the library yet.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.searchRow}>
                    <Search size={18} color={Colors.ui.textLight} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search curricula"
                      placeholderTextColor={Colors.ui.textLight}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {searchQuery.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => setSearchQuery('')}
                        activeOpacity={0.7}
                        accessibilityLabel="Clear search"
                      >
                        <X size={18} color={Colors.ui.textLight} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {searchQuery.trim() && filteredCurricula.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyText}>
                        No results for &apos;{searchQuery.trim()}&apos;
                      </Text>
                    </View>
                  ) : (
                    filteredCurricula.map((curriculum) => {
                      const selected = isCardSelected(curriculum);
                      return (
                        <TouchableOpacity
                          key={curriculum.id}
                          style={[styles.entryCard, selected && styles.entryCardSelected]}
                          onPress={() => void openDetailCurriculum(curriculum)}
                          onLongPress={() => void handleLongPressStage(curriculum)}
                          delayLongPress={400}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.entryName}>{curriculum.name}</Text>
                          <Text style={styles.entryMeta}>
                            {[curriculum.publisher, curriculum.edition, curriculum.level]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                          <Text style={styles.entryCount}>
                            {curriculum.itemCount ?? curriculum.items.length} lesson
                            {(curriculum.itemCount ?? curriculum.items.length) === 1 ? '' : 's'}
                          </Text>
                          {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}
            </ScrollView>
          ) : null}

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addCurriculumButton}
              onPress={() => setShowAddSheet(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addCurriculumText}>Add Curriculum — not in list?</Text>
            </TouchableOpacity>

            {stagedSelection?.kind === 'library' ? (
              <View style={styles.stagedHint}>
                <Text style={styles.stagedHintText}>
                  {stagedSelection.name} selected — saves when you tap Save Subjects
                </Text>
              </View>
            ) : null}

            <Text style={styles.saveChangesHint}>Tap Save Subjects to save other changes.</Text>

            <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <AddCurriculumSheet
        visible={showAddSheet}
        studentId={studentId}
        subject={subject}
        onClose={() => setShowAddSheet(false)}
        onComplete={handleScanComplete}
        onOpenExisting={(curriculum) => {
          setShowAddSheet(false);
          void openDetailCurriculum(curriculum);
        }}
      />

      {hasPersonalScanPlan && existingPlan?.name ? (
        <PersonalCurriculumSheet
          visible={showPersonalSheet}
          studentId={studentId}
          subject={subject}
          curriculumName={existingPlan.name}
          onClose={() => setShowPersonalSheet(false)}
          onSaved={handlePersonalPlanSaved}
          onOpenAddCurriculum={() => setShowAddSheet(true)}
        />
      ) : null}

      {detailCurriculum ? (
        <CurriculumLibraryDetailSheet
          visible
          curriculum={detailCurriculum}
          studentId={studentId}
          studentName={studentName}
          subject={subject}
          onClose={() => setDetailCurriculum(null)}
          onSelect={handleSelectFromDetail}
          onLibraryUpdated={handleLibraryUpdated}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 360,
  },
  headerRow: {
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  backText: {
    ...Typography.body,
    color: Colors.brand[600],
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
  otherSubtitle: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: -12,
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  listScroll: {
    maxHeight: 260,
  },
  listContent: {
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.ui.text,
  },
  footer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  emptyCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  emptyTitle: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.ui.text,
    textAlign: 'center',
  },
  emptyText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  entryCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    padding: 14,
    marginBottom: 10,
  },
  entryCardSelected: {
    borderColor: Colors.brand[500],
    backgroundColor: Colors.brand[50],
  },
  entryName: {
    ...Typography.label,
    fontSize: 15,
    color: Colors.ui.text,
    marginBottom: 4,
  },
  entryMeta: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  entryCount: {
    ...Typography.bodySmall,
    color: Colors.brand[600],
  },
  selectedBadge: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.brand[600],
    marginTop: 8,
  },
  addCurriculumButton: {
    borderWidth: 2,
    borderColor: Colors.brand[300],
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  addCurriculumText: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  stagedHint: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stagedHintText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    textAlign: 'center',
  },
  saveChangesHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
});
