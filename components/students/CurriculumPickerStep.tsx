import AddCurriculumSheet from '@/components/students/AddCurriculumSheet';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  getCategoryLabel,
  getCurriculumCategoryForSubject,
  stageLibraryCurriculum,
  type StagedCurriculumSelection,
} from '@/lib/lessonPlanUtils';
import {
  useLessonPlanStore,
  type CurriculumWithItems,
  type LessonPlan,
} from '@/store/lessonPlanStore';
import { BookOpen, ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CurriculumPickerStepProps = {
  studentId: string;
  subject: string;
  stagedSelection?: StagedCurriculumSelection;
  onStage: (selection: StagedCurriculumSelection) => void;
  onSkip: () => void;
  onBack: () => void;
};

export default function CurriculumPickerStep({
  studentId,
  subject,
  stagedSelection,
  onStage,
  onSkip,
  onBack,
}: CurriculumPickerStepProps) {
  const { fetchVerifiedLibrary, fetchPlan } = useLessonPlanStore();
  const [curricula, setCurricula] = useState<CurriculumWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingPlan, setExistingPlan] = useState<LessonPlan | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const category = getCurriculumCategoryForSubject(subject);

  const loadData = useCallback(async () => {
    if (!category) return;

    setLoading(true);
    try {
      const [libraryEntries, planResult] = await Promise.all([
        fetchVerifiedLibrary(category),
        fetchPlan(studentId, subject),
      ]);
      setCurricula(libraryEntries);
      setExistingPlan(planResult.plan);
    } catch (error) {
      console.error('Failed to load curriculum picker:', error);
      Alert.alert('Error', 'Could not load curriculum options.');
    } finally {
      setLoading(false);
    }
  }, [category, fetchPlan, fetchVerifiedLibrary, studentId, subject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isCardSelected = (curriculum: CurriculumWithItems) => {
    if (stagedSelection?.kind === 'library') {
      return stagedSelection.name === curriculum.name;
    }
    if (!stagedSelection && existingPlan?.source === 'library' && existingPlan.name) {
      return existingPlan.name === curriculum.name;
    }
    return false;
  };

  const isScanSelected =
    stagedSelection?.kind === 'scan' ||
    (!stagedSelection && existingPlan?.source === 'scan' && !!existingPlan.name);

  const selectedScanName =
    stagedSelection?.kind === 'scan'
      ? stagedSelection.name
      : existingPlan?.source === 'scan'
        ? existingPlan.name ?? undefined
        : undefined;

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

  const handleScanComplete = (staged: StagedCurriculumSelection) => {
    setShowAddSheet(false);
    onStage(staged);
    Alert.alert(
      'Curriculum saved!',
      'Your lesson sequence will be ready shortly. Tap Save Subjects to finish.'
    );
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
      <Text style={styles.subtitle}>
        {subject}
        {category ? ` · ${getCategoryLabel(category)}` : ''}
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading curricula…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {curricula.length === 0 ? (
            <View style={styles.emptyCard}>
              <BookOpen size={28} color={Colors.ui.textLight} />
              <Text style={styles.emptyText}>
                No verified curricula in the library yet — check back soon.
              </Text>
            </View>
          ) : (
            curricula.map((curriculum) => {
              const selected = isCardSelected(curriculum);
              return (
                <TouchableOpacity
                  key={curriculum.id}
                  style={[styles.entryCard, selected && styles.entryCardSelected]}
                  onPress={() => confirmAndStageLibrary(curriculum)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.entryName}>{curriculum.name}</Text>
                  <Text style={styles.entryMeta}>
                    {[curriculum.publisher, curriculum.edition, curriculum.level]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.entryCount}>
                    {curriculum.items.length} lesson{curriculum.items.length === 1 ? '' : 's'}
                  </Text>
                  {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity
            style={styles.addCurriculumButton}
            onPress={() => setShowAddSheet(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addCurriculumText}>Add Curriculum — not in list?</Text>
          </TouchableOpacity>

          {isScanSelected && selectedScanName ? (
            <View style={styles.scanSelectedCard}>
              <Text style={styles.scanSelectedTitle}>{selectedScanName}</Text>
              <Text style={styles.scanSelectedHint}>Sequence coming soon</Text>
            </View>
          ) : null}

          {stagedSelection?.kind === 'library' ? (
            <View style={styles.stagedHint}>
              <Text style={styles.stagedHintText}>
                {stagedSelection.name} selected — saves when you tap Save Subjects
              </Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <AddCurriculumSheet
        visible={showAddSheet}
        studentId={studentId}
        subject={subject}
        onClose={() => setShowAddSheet(false)}
        onComplete={handleScanComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  scrollContent: {
    paddingBottom: 24,
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
    marginTop: 8,
    marginBottom: 16,
  },
  addCurriculumText: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  scanSelectedCard: {
    backgroundColor: Colors.accent[100],
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  scanSelectedTitle: {
    ...Typography.label,
    color: Colors.accent[600],
    marginBottom: 4,
  },
  scanSelectedHint: {
    ...Typography.bodySmall,
    color: Colors.accent[600],
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
