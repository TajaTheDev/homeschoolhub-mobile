import Button from '@/components/ui/Button';
import CurriculumLibraryPicker from '@/components/lesson-plan/CurriculumLibraryPicker';
import ManualItemList from '@/components/lesson-plan/ManualItemList';
import Skeleton from '@/components/ui/Skeleton';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  appendWorkingItems,
  createWorkingItem,
  generateAutoNumberItems,
  parsePasteLines,
  replaceWorkingItems,
  type WorkingItem,
} from '@/lib/lessonPlanUtils';
import {
  useLessonPlanStore,
  type CurriculumWithItems,
} from '@/store/lessonPlanStore';
import { useStudentStore } from '@/store/studentStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LessonSequenceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; subject?: string }>();
  const studentId = params.studentId ?? '';
  const subject = params.subject ? decodeURIComponent(params.subject) : '';

  const { students } = useStudentStore();
  const { fetchPlan, fetchLibrary, savePlan, saving } = useLessonPlanStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingItems, setWorkingItems] = useState<WorkingItem[]>([]);
  const [planSource, setPlanSource] = useState<string | null>(null);
  const [planEdition, setPlanEdition] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [autoPattern, setAutoPattern] = useState('Chapter {n}');
  const [autoCount, setAutoCount] = useState('10');
  const [curricula, setCurricula] = useState<CurriculumWithItems[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  const student = useMemo(
    () => students.find((entry) => entry.id === studentId) ?? null,
    [students, studentId]
  );

  const loadInitialData = useCallback(async () => {
    if (!studentId || !subject) {
      setLoadError('Missing student or subject.');
      setLoading(false);
      setLibraryLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [{ plan, items }, libraryEntries] = await Promise.all([
        fetchPlan(studentId, subject),
        fetchLibrary(),
      ]);

      setWorkingItems(items.map((item) => createWorkingItem(item.title)));
      setPlanSource(plan?.source ?? null);
      setPlanEdition(plan?.edition ?? null);
      setCurricula(libraryEntries);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Failed to load lesson sequence.'
      );
    } finally {
      setLoading(false);
      setLibraryLoading(false);
    }
  }, [fetchLibrary, fetchPlan, studentId, subject]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleImportPaste = () => {
    const titles = parsePasteLines(pasteText);
    if (titles.length === 0) {
      Alert.alert('Nothing to import', 'Paste one lesson title per line.');
      return;
    }

    setWorkingItems((current) => appendWorkingItems(current, titles));
    setPasteText('');
  };

  const handleGenerateAutoNumber = () => {
    const count = parseInt(autoCount, 10);
    if (!autoPattern.trim()) {
      Alert.alert('Pattern required', 'Enter a title pattern such as "Chapter {n}".');
      return;
    }
    if (!Number.isFinite(count) || count <= 0) {
      Alert.alert('Invalid count', 'Enter a number greater than 0.');
      return;
    }

    const titles = generateAutoNumberItems(autoPattern, count);
    setWorkingItems((current) => appendWorkingItems(current, titles));
  };

  const applyLibrarySelection = (curriculum: CurriculumWithItems) => {
    const titles = curriculum.items
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => item.title);

    if (titles.length === 0) {
      Alert.alert('Empty curriculum', 'This curriculum has no lessons to copy.');
      return;
    }

    setWorkingItems(replaceWorkingItems(titles));
    setPlanSource(curriculum.name);
    setPlanEdition(curriculum.edition ?? null);
  };

  const handleLibrarySelect = (curriculum: CurriculumWithItems) => {
    if (workingItems.length > 0) {
      Alert.alert(
        'Replace current sequence?',
        `This will replace your ${workingItems.length} current lesson${workingItems.length === 1 ? '' : 's'} with "${curriculum.name}".`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => applyLibrarySelection(curriculum),
          },
        ]
      );
      return;
    }

    applyLibrarySelection(curriculum);
  };

  const handleSave = async () => {
    if (workingItems.length === 0) {
      Alert.alert('Add lessons', 'Add at least one lesson before saving.');
      return;
    }

    const result = await savePlan({
      studentId,
      subject,
      items: workingItems.map((item) => ({ title: item.title })),
      source: planSource,
      edition: planEdition,
    });

    if (!result.success) {
      Alert.alert('Save failed', result.error ?? 'Could not save lesson sequence.');
      return;
    }

    Alert.alert('Saved', 'Your lesson sequence has been saved.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!studentId || !subject) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.ui.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lesson Sequence</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>Missing student or subject.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Lesson Sequence</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {student?.name ?? 'Student'} · {subject}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading lesson sequence…</Text>
          <Skeleton width="90%" height={16} style={{ marginTop: 16 }} />
          <Skeleton width="75%" height={16} style={{ marginTop: 8 }} />
        </View>
      ) : loadError ? (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button title="Try again" onPress={loadInitialData} size="medium" />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>
                Build an ordered list of lessons for this subject. Use any combination of
                paste import, auto-number, manual entry, or a library pick — then save
                when you are ready.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Paste import</Text>
              <Text style={styles.sectionHint}>Each line becomes one lesson, appended in order.</Text>
              <TextInput
                style={styles.textArea}
                value={pasteText}
                onChangeText={setPasteText}
                placeholder={'Lesson 1\nLesson 2\nLesson 3'}
                placeholderTextColor={Colors.ui.textLight}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              <Button
                title="Import lines"
                onPress={handleImportPaste}
                size="medium"
                variant="outline"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Auto-number</Text>
              <Text style={styles.sectionHint}>
                Use {'{n}'} in the pattern for the lesson number.
              </Text>
              <TextInput
                style={styles.input}
                value={autoPattern}
                onChangeText={setAutoPattern}
                placeholder="Chapter {n}"
                placeholderTextColor={Colors.ui.textLight}
              />
              <TextInput
                style={styles.input}
                value={autoCount}
                onChangeText={setAutoCount}
                placeholder="Count"
                placeholderTextColor={Colors.ui.textLight}
                keyboardType="number-pad"
              />
              <Button
                title="Generate lessons"
                onPress={handleGenerateAutoNumber}
                size="medium"
                variant="outline"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Manual</Text>
              <Text style={styles.sectionHint}>Add, edit, and reorder lessons one at a time.</Text>
              <ManualItemList items={workingItems} onChange={setWorkingItems} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pick from library</Text>
              <Text style={styles.sectionHint}>
                Copy a shared curriculum into this student&apos;s plan.
              </Text>
              <CurriculumLibraryPicker
                curricula={curricula}
                loading={libraryLoading}
                onSelect={handleLibrarySelect}
              />
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                Your sequence ({workingItems.length} lesson{workingItems.length === 1 ? '' : 's'})
              </Text>
              {planSource ? (
                <Text style={styles.summaryMeta}>
                  Source: {planSource}
                  {planEdition ? ` · ${planEdition}` : ''}
                </Text>
              ) : null}
            </View>

            <Button
              title="Save sequence"
              onPress={handleSave}
              loading={saving}
              disabled={saving || workingItems.length === 0}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 4,
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    marginTop: 12,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorText: {
    ...Typography.body,
    color: Colors.ui.error,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  descriptionCard: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  descriptionText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 6,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    ...Typography.body,
    color: Colors.ui.text,
  },
  textArea: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    minHeight: 120,
    ...Typography.body,
    color: Colors.ui.text,
  },
  summaryCard: {
    backgroundColor: Colors.accent[100],
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: Colors.accent[600],
  },
  summaryMeta: {
    ...Typography.bodySmall,
    color: Colors.accent[600],
    marginTop: 4,
  },
});
