import ManualItemList from '@/components/lesson-plan/ManualItemList';
import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  appendWorkingItems,
  createWorkingItem,
  getCurriculumCategoryForSubject,
  parsePasteLines,
  type StagedScanCurriculum,
  type WorkingItem,
} from '@/lib/lessonPlanUtils';
import { supabase } from '@/lib/supabase/client';
import type { CurriculumWithItems } from '@/store/lessonPlanStore';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const TOC_BUCKET = 'curriculum-toc';
const MAX_TOC_PAGES = 10;

type AddCurriculumSheetProps = {
  visible: boolean;
  studentId: string;
  subject: string;
  onClose: () => void;
  onComplete: (staged: StagedScanCurriculum) => void;
  onOpenExisting?: (curriculum: CurriculumWithItems) => void;
};

type SheetStep = 'capture' | 'extracting' | 'extract_failed' | 'review' | 'manual';

type TocPagePhoto = {
  id: string;
  storagePath: string;
  previewUri: string;
};

type ExtractTocResponse = {
  titles?: string[];
  count?: number;
  error?: string;
};

function serializeStoragePaths(pages: TocPagePhoto[]): string {
  return JSON.stringify(pages.map((page) => page.storagePath));
}

async function uploadTocPageImage(
  localUri: string,
  studentId: string,
  pageIndex: number
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  const timestamp = Date.now();
  const storagePath = `${studentId}/${timestamp}_${pageIndex}.jpg`;

  const base64Data = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: 'base64' as const,
  });

  if (!base64Data) {
    throw new Error('Failed to read image file');
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(TOC_BUCKET)
    .upload(storagePath, bytes.buffer, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw uploadError;
  }

  return uploadData?.path ?? storagePath;
}

async function upsertScanLessonPlan(
  studentId: string,
  subject: string,
  name: string,
  tocImagePathJson: string
): Promise<string> {
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
    throw new Error(existingPlanError.message);
  }

  const planPayload = {
    name,
    source: 'scan',
    toc_image_path: tocImagePathJson,
  };

  if (existingPlan?.id) {
    const { error: updateError } = await supabase
      .from('lesson_plans')
      .update(planPayload)
      .eq('id', existingPlan.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return existingPlan.id;
  }

  const { data: newPlan, error: createError } = await supabase
    .from('lesson_plans')
    .insert({
      student_id: studentId,
      subject: normalizedSubject,
      ...planPayload,
    })
    .select('id')
    .single();

  if (createError || !newPlan) {
    throw new Error(createError?.message ?? 'Failed to create lesson plan.');
  }

  return newPlan.id;
}

async function extractLessonTitles(storagePaths: string[]): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke<ExtractTocResponse>(
    'extract-toc',
    { body: { storage_paths: storagePaths } }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const titles = Array.isArray(data?.titles) ? data.titles : [];
  return titles.filter((title) => typeof title === 'string' && title.trim().length > 0);
}

async function saveLessonPlanItems(lessonPlanId: string, titles: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('lesson_plan_items')
    .delete()
    .eq('lesson_plan_id', lessonPlanId);

  if (deleteError) {
    throw new Error(deleteError.message);
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

async function replaceLibraryItems(
  curriculumId: string,
  titles: string[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('curriculum_library_items')
    .delete()
    .eq('curriculum_id', curriculumId);

  if (deleteError) {
    console.error('Failed to clear community library items:', deleteError);
    return;
  }

  const { error: insertError } = await supabase.from('curriculum_library_items').insert(
    titles.map((title, index) => ({
      curriculum_id: curriculumId,
      title: title.trim(),
      order_index: index,
    }))
  );

  if (insertError) {
    console.error('Failed to share lessons to community library:', insertError);
  }
}

function mapLibraryRowToCurriculum(
  data: Record<string, unknown> & { curriculum_library_items?: CurriculumWithItems['items'] }
): CurriculumWithItems {
  const { curriculum_library_items: rawItems, ...libraryRow } = data;
  const items = [...(rawItems ?? [])].sort((a, b) => a.order_index - b.order_index);

  return {
    ...(libraryRow as CurriculumWithItems),
    items,
  };
}

async function searchLibraryByName(trimmedName: string): Promise<CurriculumWithItems[]> {
  const { data, error } = await supabase
    .from('curriculum_library')
    .select('*, curriculum_library_items(*)')
    .ilike('name', `%${trimmedName}%`);

  if (error) {
    console.error('Failed to look up curriculum library entries:', error);
    return [];
  }

  return (data ?? []).map((row) => mapLibraryRowToCurriculum(row));
}

async function shareToCommunityLibrary(
  curriculumName: string,
  subject: string,
  titles: string[]
): Promise<void> {
  try {
    const trimmedName = curriculumName.trim();

    const { data: libraryEntry, error: libraryError } = await supabase
      .from('curriculum_library')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle();

    if (libraryError) {
      console.error('Failed to look up community library entry:', libraryError);
      return;
    }

    if (libraryEntry) {
      await replaceLibraryItems(libraryEntry.id, titles);
      return;
    }

    const category = getCurriculumCategoryForSubject(subject);

    const { data: newEntry, error: createError } = await supabase
      .from('curriculum_library')
      .insert({
        name: trimmedName,
        category,
        publisher: null,
        edition: null,
        level: null,
        verified: true,
      })
      .select('id')
      .single();

    if (createError || !newEntry) {
      console.error('Failed to create community library entry:', createError);
      return;
    }

    await replaceLibraryItems(newEntry.id, titles);
  } catch (error) {
    console.error('Community library share failed:', error);
  }
}

export default function AddCurriculumSheet({
  visible,
  studentId,
  subject,
  onClose,
  onComplete,
  onOpenExisting,
}: AddCurriculumSheetProps) {
  const [step, setStep] = useState<SheetStep>('capture');
  const [curriculumName, setCurriculumName] = useState('');
  const [lessonPlanId, setLessonPlanId] = useState<string | null>(null);
  const [tocPages, setTocPages] = useState<TocPagePhoto[]>([]);
  const [uploadingPage, setUploadingPage] = useState(false);
  const [reviewItems, setReviewItems] = useState<WorkingItem[]>([]);
  const [manualItems, setManualItems] = useState<WorkingItem[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [exactMatch, setExactMatch] = useState<CurriculumWithItems | null>(null);
  const [partialMatches, setPartialMatches] = useState<CurriculumWithItems[]>([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [personalPlanOnly, setPersonalPlanOnly] = useState(false);

  const isBusy = saving || uploadingPage || step === 'extracting';

  const resetForm = () => {
    setStep('capture');
    setCurriculumName('');
    setLessonPlanId(null);
    setTocPages([]);
    setUploadingPage(false);
    setReviewItems([]);
    setManualItems([]);
    setPasteText('');
    setNewLessonTitle('');
    setEditingId(null);
    setEditingTitle('');
    setSaving(false);
    setExactMatch(null);
    setPartialMatches([]);
    setCheckingDuplicate(false);
    setPersonalPlanOnly(false);
  };

  const handleClose = () => {
    if (isBusy) return;
    resetForm();
    onClose();
  };

  const getActiveTitles = (): string[] => {
    const items = step === 'manual' ? manualItems : reviewItems;
    return items.map((item) => item.title.trim()).filter(Boolean);
  };

  const getTocImagePathJson = (): string => serializeStoragePaths(tocPages);

  const promptCommunityShare = (titles: string[]): Promise<boolean> =>
    new Promise((resolve) => {
      Alert.alert(
        'Share with the community library?',
        'Help other families by contributing this lesson sequence.',
        [
          { text: 'No thanks', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Share', onPress: () => resolve(true) },
        ]
      );
    });

  const finishWithSuccess = (name: string, imagePathJson: string, lessonCount: number) => {
    const staged: StagedScanCurriculum = {
      kind: 'scan',
      name,
      tocImagePath: imagePathJson,
    };
    resetForm();
    onComplete(staged);
    Alert.alert(
      'Curriculum saved!',
      `${lessonCount} lesson${lessonCount === 1 ? '' : 's'} saved to your sequence.`
    );
  };

  const persistPlanPaths = async (pages: TocPagePhoto[]): Promise<string> => {
    const trimmedName = curriculumName.trim();
    const planId = await upsertScanLessonPlan(
      studentId,
      subject,
      trimmedName,
      serializeStoragePaths(pages)
    );
    setLessonPlanId(planId);
    return planId;
  };

  const handleSaveLessons = async () => {
    const titles = getActiveTitles();
    if (titles.length === 0) {
      Alert.alert('No lessons', 'Add at least one lesson before saving.');
      return;
    }

    setSaving(true);

    try {
      let planId = lessonPlanId;
      if (!planId) {
        planId = await persistPlanPaths(tocPages);
      }

      await saveLessonPlanItems(planId, titles);

      if (!personalPlanOnly) {
        const shouldShare = await promptCommunityShare(titles);
        if (shouldShare) {
          await shareToCommunityLibrary(curriculumName.trim(), subject, titles);
        }
      }

      finishWithSuccess(curriculumName.trim(), getTocImagePathJson(), titles.length);
    } catch (error) {
      console.error('Failed to save lesson sequence:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save your lessons. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = (value: string) => {
    setCurriculumName(value);
    setExactMatch(null);
    setPartialMatches([]);
    setPersonalPlanOnly(false);
  };

  const handleNameBlur = async () => {
    const trimmedName = curriculumName.trim();
    if (!trimmedName) {
      setExactMatch(null);
      setPartialMatches([]);
      return;
    }

    setCheckingDuplicate(true);
    try {
      const results = await searchLibraryByName(trimmedName);
      const lower = trimmedName.toLowerCase();
      const exact = results.find((entry) => entry.name.toLowerCase() === lower) ?? null;
      const partial = results
        .filter((entry) => entry.name.toLowerCase() !== lower)
        .slice(0, 5);

      setExactMatch(exact);
      setPartialMatches(partial);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleOpenExisting = (curriculum: CurriculumWithItems) => {
    resetForm();
    onClose();
    onOpenExisting?.(curriculum);
  };

  const handleUseExisting = () => {
    if (!exactMatch) return;
    handleOpenExisting(exactMatch);
  };

  const handleDismissPartialSuggestions = () => {
    setPartialMatches([]);
  };

  const handleScanAnywayPersonal = () => {
    setPersonalPlanOnly(true);
    setExactMatch(null);
  };

  const requestPermission = async (type: 'camera' | 'library') => {
    const permission =
      type === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status === 'denied') {
      Alert.alert(
        'Permission Required',
        `Please enable ${type} access in Settings to upload photos.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return permission.status === 'granted';
  };

  const runExtraction = async (storagePaths: string[]) => {
    setStep('extracting');

    try {
      const titles = await extractLessonTitles(storagePaths);

      if (titles.length === 0) {
        setStep('extract_failed');
        return;
      }

      setReviewItems(titles.map((title) => createWorkingItem(title)));
      setStep('review');
    } catch (error) {
      console.error('TOC extraction failed:', error);
      setStep('extract_failed');
    }
  };

  const handleExtractPages = async () => {
    if (tocPages.length === 0) return;

    const trimmedName = curriculumName.trim();
    if (!trimmedName) {
      Alert.alert('Curriculum name required', 'Enter a curriculum name before extracting.');
      return;
    }

    try {
      await persistPlanPaths(tocPages);
      await runExtraction(tocPages.map((page) => page.storagePath));
    } catch (error) {
      console.error('Failed to prepare extraction:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not start extraction. Please try again.'
      );
    }
  };

  const handleScanPage = async (type: 'camera' | 'library') => {
    const trimmedName = curriculumName.trim();
    if (!trimmedName) {
      Alert.alert('Curriculum name required', 'Enter a curriculum name before taking a photo.');
      return;
    }

    if (tocPages.length >= MAX_TOC_PAGES) {
      Alert.alert('Page limit reached', `You can scan up to ${MAX_TOC_PAGES} TOC pages.`);
      return;
    }

    const hasPermission = await requestPermission(type);
    if (!hasPermission) return;

    const result =
      type === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: false,
            quality: 0.8,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const localUri = result.assets[0].uri;
    const pageIndex = tocPages.length;

    setUploadingPage(true);

    try {
      const storagePath = await uploadTocPageImage(localUri, studentId, pageIndex);
      const newPage: TocPagePhoto = {
        id: `${Date.now()}-${pageIndex}`,
        storagePath,
        previewUri: localUri,
      };
      const nextPages = [...tocPages, newPage];

      setTocPages(nextPages);
      await persistPlanPaths(nextPages);
    } catch (error) {
      console.error('TOC page upload failed:', error);
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload your photo. Please try again.'
      );
    } finally {
      setUploadingPage(false);
    }
  };

  const handleRemovePage = async (index: number) => {
    if (uploadingPage || saving) return;

    const nextPages = tocPages.filter((_, i) => i !== index);
    setTocPages(nextPages);

    if (nextPages.length === 0) {
      setLessonPlanId(null);
      return;
    }

    try {
      await persistPlanPaths(nextPages);
    } catch (error) {
      console.error('Failed to update plan after removing page:', error);
    }
  };

  const handleImportPaste = () => {
    const titles = parsePasteLines(pasteText);
    if (titles.length === 0) {
      Alert.alert('Nothing to import', 'Paste one lesson title per line.');
      return;
    }

    setManualItems((current) => appendWorkingItems(current, titles));
    setPasteText('');
  };

  const handleAddReviewLesson = () => {
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    setReviewItems((current) => [...current, createWorkingItem(trimmed)]);
    setNewLessonTitle('');
  };

  const handleDeleteReviewItem = (id: string) => {
    setReviewItems((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle('');
    }
  };

  const handleStartEditReview = (item: WorkingItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEditReview = () => {
    const trimmed = editingTitle.trim();
    if (!editingId || !trimmed) return;

    setReviewItems((current) =>
      current.map((item) =>
        item.id === editingId ? { ...item, title: trimmed } : item
      )
    );
    setEditingId(null);
    setEditingTitle('');
  };

  const getSheetTitle = () => {
    switch (step) {
      case 'review':
        return 'Review lessons';
      case 'manual':
        return 'Enter lessons manually';
      case 'extract_failed':
        return 'Could not read TOC';
      default:
        return 'Add your curriculum';
    }
  };

  const renderThumbnailRow = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.thumbnailRow}
    >
      {tocPages.map((page, index) => (
        <View key={page.id} style={styles.thumbnailSlot}>
          <Image source={{ uri: page.previewUri }} style={styles.thumbnailImage} contentFit="cover" />
          <TouchableOpacity
            style={styles.thumbnailRemove}
            onPress={() => handleRemovePage(index)}
            disabled={uploadingPage || saving}
            activeOpacity={0.7}
          >
            <X size={14} color="white" />
          </TouchableOpacity>
        </View>
      ))}
      {tocPages.length < MAX_TOC_PAGES ? (
        <View style={styles.emptyThumbnailSlot}>
          <Text style={styles.emptyThumbnailText}>+</Text>
        </View>
      ) : null}
    </ScrollView>
  );

  const renderCaptureStep = () => {
    const pageCount = tocPages.length;
    const nextPageNumber = pageCount + 1;
    const canScanMore = pageCount < MAX_TOC_PAGES;

    return (
      <>
        <Text style={styles.fieldLabel}>Curriculum name</Text>
        <TextInput
          style={styles.input}
          value={curriculumName}
          onChangeText={handleNameChange}
          onBlur={handleNameBlur}
          placeholder="e.g. Saxon Math 5/4"
          placeholderTextColor={Colors.ui.textLight}
          editable={!isBusy}
        />

        {checkingDuplicate ? (
          <View style={styles.duplicateCheckingRow}>
            <ActivityIndicator size="small" color={Colors.brand[500]} />
            <Text style={styles.duplicateCheckingText}>Checking library…</Text>
          </View>
        ) : null}

        {exactMatch && !personalPlanOnly ? (
          <View style={styles.duplicateWarning}>
            <Text style={styles.duplicateWarningText}>
              This curriculum is already in the library.
            </Text>
            <TouchableOpacity
              style={styles.duplicatePrimaryAction}
              onPress={handleUseExisting}
              activeOpacity={0.7}
            >
              <Text style={styles.duplicatePrimaryActionText}>Use existing →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.duplicateSecondaryAction}
              onPress={handleScanAnywayPersonal}
              activeOpacity={0.7}
            >
              <Text style={styles.duplicateSecondaryActionText}>
                Scan anyway — add as personal plan
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!exactMatch && partialMatches.length > 0 ? (
          <View style={styles.duplicateWarning}>
            <Text style={styles.duplicateWarningText}>
              Similar curricula already in library:
            </Text>
            {partialMatches.map((entry) => (
              <View key={entry.id} style={styles.partialMatchRow}>
                <View style={styles.partialMatchInfo}>
                  <Text style={styles.partialMatchName}>{entry.name}</Text>
                  {entry.level ? (
                    <Text style={styles.partialMatchLevel}>{entry.level}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.partialMatchAction}
                  onPress={() => handleOpenExisting(entry)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.partialMatchActionText}>Use this →</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.duplicateSecondaryAction}
              onPress={handleDismissPartialSuggestions}
              activeOpacity={0.7}
            >
              <Text style={styles.duplicateSecondaryActionText}>
                None of these — continue adding new
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>How to photograph your TOC</Text>
          <Text style={styles.instructionStep}>1. Open your book to the Table of Contents page</Text>
          <Text style={styles.instructionStep}>2. Lay it flat — good lighting, no shadows</Text>
          <Text style={styles.instructionStep}>3. Make sure all chapter or lesson titles are visible</Text>
          <Text style={styles.instructionStep}>
            4. Scan each TOC page (up to {MAX_TOC_PAGES}) — then tap Extract
          </Text>
        </View>

        {renderThumbnailRow()}

        {uploadingPage ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator color={Colors.brand[500]} />
            <Text style={styles.uploadingText}>Uploading page…</Text>
          </View>
        ) : (
          <>
            <Button
              title={`📷 Scan page ${nextPageNumber}`}
              onPress={() => handleScanPage('camera')}
              disabled={!curriculumName.trim() || isBusy || !canScanMore}
            />
            <Button
              title="Choose from Library"
              onPress={() => handleScanPage('library')}
              variant="outline"
              disabled={!curriculumName.trim() || isBusy || !canScanMore}
              style={styles.secondaryButton}
            />
          </>
        )}

        <Button
          title={`Extract ${pageCount} page${pageCount === 1 ? '' : 's'}`}
          onPress={handleExtractPages}
          disabled={pageCount === 0 || isBusy}
          style={styles.extractButton}
        />

        <Text style={styles.subjectHint}>For {subject}</Text>
      </>
    );
  };

  const renderExtractingStep = () => (
    <View style={styles.centeredState}>
      <ActivityIndicator color={Colors.brand[500]} size="large" />
      <Text style={styles.stateTitle}>
        Extracting from {tocPages.length} page{tocPages.length === 1 ? '' : 's'}…
      </Text>
      <Text style={styles.stateHint}>This may take a few seconds.</Text>
    </View>
  );

  const renderExtractFailedStep = () => (
    <View style={styles.centeredState}>
      <Text style={styles.stateTitle}>We couldn&apos;t read the table of contents.</Text>
      <Text style={styles.stateHint}>Try again or enter lessons manually.</Text>
      <Button title="Try again" onPress={handleExtractPages} style={styles.actionButton} />
      <Button
        title="Enter manually"
        variant="outline"
        onPress={() => setStep('manual')}
        style={styles.actionButton}
      />
      <Button
        title="Back to pages"
        variant="outline"
        onPress={() => setStep('capture')}
        style={styles.actionButton}
      />
    </View>
  );

  const renderReviewStep = () => (
    <>
      <Text style={styles.countLabel}>
        {reviewItems.length} lesson{reviewItems.length === 1 ? '' : 's'} found
      </Text>

      <View style={styles.listCard}>
        {reviewItems.length === 0 ? (
          <Text style={styles.emptyListText}>No lessons yet. Add one below.</Text>
        ) : (
          reviewItems.map((item, index) => (
            <View
              key={item.id}
              style={[styles.reviewRow, index < reviewItems.length - 1 && styles.reviewRowBorder]}
            >
              {editingId === item.id ? (
                <TextInput
                  style={styles.reviewEditInput}
                  value={editingTitle}
                  onChangeText={setEditingTitle}
                  autoFocus
                  onSubmitEditing={handleSaveEditReview}
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.reviewTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              )}

              <View style={styles.reviewActions}>
                {editingId === item.id ? (
                  <TouchableOpacity onPress={handleSaveEditReview} style={styles.iconButton}>
                    <Text style={styles.saveEditText}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => handleStartEditReview(item)}
                      style={styles.iconButton}
                    >
                      <Pencil size={16} color={Colors.brand[600]} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteReviewItem(item.id)}
                      style={styles.iconButton}
                    >
                      <Trash2 size={16} color={Colors.ui.error} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newLessonTitle}
          onChangeText={setNewLessonTitle}
          placeholder="Add a missing lesson"
          placeholderTextColor={Colors.ui.textLight}
          onSubmitEditing={handleAddReviewLesson}
          returnKeyType="done"
          editable={!saving}
        />
        <TouchableOpacity
          style={[styles.addButton, !newLessonTitle.trim() && styles.addButtonDisabled]}
          onPress={handleAddReviewLesson}
          disabled={!newLessonTitle.trim() || saving}
          activeOpacity={0.7}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Button
        title={`Save ${reviewItems.length} lesson${reviewItems.length === 1 ? '' : 's'}`}
        onPress={handleSaveLessons}
        loading={saving}
        disabled={reviewItems.length === 0 || saving}
        style={styles.actionButton}
      />
      <Button
        title="Enter manually instead"
        variant="outline"
        onPress={() => setStep('manual')}
        disabled={saving}
        style={styles.actionButton}
      />
    </>
  );

  const renderManualStep = () => (
    <>
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
        editable={!saving}
      />
      <Button
        title="Import lines"
        onPress={handleImportPaste}
        size="medium"
        variant="outline"
        disabled={saving}
        style={styles.actionButton}
      />

      <Text style={styles.sectionTitle}>Manual</Text>
      <Text style={styles.sectionHint}>Add, edit, and reorder lessons one at a time.</Text>
      <ManualItemList items={manualItems} onChange={setManualItems} />

      <Button
        title={`Save ${manualItems.length} lesson${manualItems.length === 1 ? '' : 's'}`}
        onPress={handleSaveLessons}
        loading={saving}
        disabled={manualItems.length === 0 || saving}
        style={styles.actionButton}
      />
      <Button
        title="Back to review"
        variant="outline"
        onPress={() => setStep('review')}
        disabled={saving || reviewItems.length === 0}
        style={styles.actionButton}
      />
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
          disabled={isBusy}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{getSheetTitle()}</Text>
            <TouchableOpacity onPress={handleClose} disabled={isBusy}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'capture' ? renderCaptureStep() : null}
            {step === 'extracting' ? renderExtractingStep() : null}
            {step === 'extract_failed' ? renderExtractFailedStep() : null}
            {step === 'review' ? renderReviewStep() : null}
            {step === 'manual' ? renderManualStep() : null}
          </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  sheetTitle: {
    ...Typography.h3,
    fontSize: 20,
  },
  sheetContent: {
    padding: 24,
    paddingBottom: 40,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: 8,
    color: Colors.ui.text,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.ui.text,
    marginBottom: 16,
  },
  duplicateCheckingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  duplicateCheckingText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  duplicateWarning: {
    backgroundColor: Colors.brand[50],
    borderWidth: 1,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    padding: 14,
    marginTop: -8,
    marginBottom: 16,
    gap: 10,
  },
  duplicateWarningText: {
    ...Typography.bodySmall,
    color: Colors.brand[800],
    lineHeight: 20,
  },
  duplicatePrimaryAction: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brand[500],
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  duplicatePrimaryActionText: {
    ...Typography.label,
    color: 'white',
  },
  duplicateSecondaryAction: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  duplicateSecondaryActionText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    textDecorationLine: 'underline',
  },
  partialMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.brand[200],
  },
  partialMatchInfo: {
    flex: 1,
    gap: 2,
  },
  partialMatchName: {
    ...Typography.bodySmall,
    color: Colors.brand[800],
    fontWeight: '600',
  },
  partialMatchLevel: {
    ...Typography.caption,
    color: Colors.brand[700],
  },
  partialMatchAction: {
    backgroundColor: Colors.brand[500],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  partialMatchActionText: {
    ...Typography.caption,
    color: 'white',
    fontWeight: '600',
  },
  instructionCard: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 10,
  },
  instructionStep: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 22,
    marginBottom: 4,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingVertical: 4,
  },
  thumbnailSlot: {
    width: 72,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.background.card,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyThumbnailSlot: {
    width: 72,
    height: 96,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ui.background,
  },
  emptyThumbnailText: {
    ...Typography.h3,
    color: Colors.ui.textLight,
  },
  secondaryButton: {
    marginTop: 12,
  },
  extractButton: {
    marginTop: 16,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  uploadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  subjectHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  centeredState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  stateTitle: {
    ...Typography.h4,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    color: Colors.ui.text,
  },
  stateHint: {
    ...Typography.bodySmall,
    textAlign: 'center',
    color: Colors.ui.textLight,
    marginBottom: 20,
    lineHeight: 20,
  },
  countLabel: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 12,
  },
  listCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  emptyListText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    padding: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  reviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  reviewTitle: {
    flex: 1,
    ...Typography.body,
    color: Colors.ui.text,
  },
  reviewEditInput: {
    flex: 1,
    backgroundColor: Colors.ui.background,
    borderWidth: 1,
    borderColor: Colors.brand[300],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...Typography.body,
    color: Colors.ui.text,
  },
  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 4,
  },
  saveEditText: {
    ...Typography.label,
    color: Colors.brand[600],
    fontSize: 13,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.ui.text,
  },
  addButton: {
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    ...Typography.label,
    color: 'white',
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.ui.text,
    marginBottom: 4,
    marginTop: 8,
  },
  sectionHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginBottom: 10,
    lineHeight: 18,
  },
  textArea: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    ...Typography.body,
    color: Colors.ui.text,
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 12,
  },
});
