import Button from '@/components/ui/Button';
import ManualItemList from '@/components/lesson-plan/ManualItemList';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { createWorkingItem, parsePasteLines, type WorkingItem } from '@/lib/lessonPlanUtils';
import { supabase } from '@/lib/supabase/client';
import type { CurriculumLibraryItem, CurriculumWithItems } from '@/store/lessonPlanStore';
import { fetchLibraryItemsForCurriculum } from '@/store/lessonPlanStore';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Pencil, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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
const MAX_TOC_PAGES = 20;

type SheetMode =
  | 'detail'
  | 'scan_capture'
  | 'scan_extracting'
  | 'scan_extract_failed'
  | 'scan_review'
  | 'paste'
  | 'edit';

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

type CurriculumLibraryDetailSheetProps = {
  visible: boolean;
  curriculum: CurriculumWithItems;
  studentId: string;
  studentName: string;
  subject: string;
  onClose: () => void;
  onSelect: (curriculum: CurriculumWithItems) => void;
  onLibraryUpdated: (curriculum: CurriculumWithItems) => void;
};

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

async function saveTitlesToLibrary(
  curriculumId: string,
  titles: string[]
): Promise<CurriculumLibraryItem[]> {
  const { error: deleteError } = await supabase
    .from('curriculum_library_items')
    .delete()
    .eq('curriculum_id', curriculumId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (titles.length > 0) {
    const { error: insertError } = await supabase.from('curriculum_library_items').insert(
      titles.map((title, index) => ({
        curriculum_id: curriculumId,
        title: title.trim(),
        order_index: index,
      }))
    );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { error: verifyError } = await supabase
    .from('curriculum_library')
    .update({ verified: true })
    .eq('id', curriculumId);

  if (verifyError) {
    throw new Error(verifyError.message);
  }

  return fetchLibraryItemsForCurriculum(curriculumId);
}

export default function CurriculumLibraryDetailSheet({
  visible,
  curriculum,
  studentId,
  studentName,
  subject,
  onClose,
  onSelect,
  onLibraryUpdated,
}: CurriculumLibraryDetailSheetProps) {
  const [mode, setMode] = useState<SheetMode>('detail');
  const [items, setItems] = useState<CurriculumLibraryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [tocPages, setTocPages] = useState<TocPagePhoto[]>([]);
  const [uploadingPage, setUploadingPage] = useState(false);
  const [reviewItems, setReviewItems] = useState<WorkingItem[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editItems, setEditItems] = useState<WorkingItem[]>([]);
  const [saving, setSaving] = useState(false);

  const isBusy = saving || uploadingPage || mode === 'scan_extracting';

  useEffect(() => {
    if (!visible) return;

    setMode('detail');
    setEditItems([]);

    if (curriculum.items.length > 0) {
      setItems(curriculum.items);
      setLoadingItems(false);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      setLoadingItems(true);
      try {
        const fetched = await fetchLibraryItemsForCurriculum(curriculum.id);
        if (!cancelled) {
          setItems(fetched);
        }
      } catch (error) {
        console.error('Failed to load library items:', error);
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
        }
      }
    };

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, [visible, curriculum.id, curriculum.items]);

  const resetScanState = () => {
    setTocPages([]);
    setUploadingPage(false);
    setReviewItems([]);
    setNewLessonTitle('');
    setEditingId(null);
    setEditingTitle('');
  };

  const handleClose = () => {
    if (isBusy) return;
    resetScanState();
    setPasteText('');
    setEditItems([]);
    setMode('detail');
    onClose();
  };

  const getCurriculumWithItems = (): CurriculumWithItems => ({
    ...curriculum,
    items,
  });

  const handleLibrarySaved = async (titles: string[]) => {
    setSaving(true);
    try {
      const updatedItems = await saveTitlesToLibrary(curriculum.id, titles);
      setItems(updatedItems);
      const updated = { ...curriculum, items: updatedItems, verified: true };
      onLibraryUpdated(updated);
      resetScanState();
      setPasteText('');
      setEditItems([]);
      setMode('detail');
      Alert.alert(
        'Saved',
        `${titles.length} lesson${titles.length === 1 ? '' : 's'} saved to library`
      );
    } catch (error) {
      console.error('Failed to save library lessons:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Could not save lessons to the library.'
      );
    } finally {
      setSaving(false);
    }
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
    setMode('scan_extracting');

    try {
      const titles = await extractLessonTitles(storagePaths);

      if (titles.length === 0) {
        setMode('scan_extract_failed');
        return;
      }

      setReviewItems(titles.map((title) => createWorkingItem(title)));
      setMode('scan_review');
    } catch (error) {
      console.error('TOC extraction failed:', error);
      setMode('scan_extract_failed');
    }
  };

  const handleExtractPages = async () => {
    if (tocPages.length === 0) return;
    await runExtraction(tocPages.map((page) => page.storagePath));
  };

  const handleScanPage = async (type: 'camera' | 'library') => {
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
      setTocPages((current) => [...current, newPage]);
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

  const handleRemovePage = (index: number) => {
    if (uploadingPage || saving) return;
    setTocPages((current) => current.filter((_, i) => i !== index));
  };

  const confirmReplaceIfNeeded = (titles: string[]) => {
    if (items.length === 0) {
      void handleLibrarySaved(titles);
      return;
    }

    Alert.alert(
      'Replace lessons?',
      `This will replace ${items.length} existing lessons for ${curriculum.name}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', onPress: () => void handleLibrarySaved(titles) },
      ]
    );
  };

  const handleSaveReviewToLibrary = async () => {
    const titles = reviewItems.map((item) => item.title.trim()).filter(Boolean);
    if (titles.length === 0) {
      Alert.alert('No lessons', 'Add at least one lesson before saving.');
      return;
    }
    confirmReplaceIfNeeded(titles);
  };

  const handleSavePasteToLibrary = async () => {
    const titles = parsePasteLines(pasteText);
    if (titles.length === 0) {
      Alert.alert('Nothing to save', 'Paste one lesson title per line.');
      return;
    }
    confirmReplaceIfNeeded(titles);
  };

  const handleOpenEdit = () => {
    setEditItems(sortedItems.map((item) => createWorkingItem(item.title)));
    setMode('edit');
  };

  const handleDiscardEdit = () => {
    if (saving) return;
    setEditItems([]);
    setMode('detail');
  };

  const handleSaveEditToLibrary = async () => {
    const titles = editItems.map((item) => item.title.trim()).filter(Boolean);
    if (titles.length === 0) {
      Alert.alert('No lessons', 'Add at least one lesson before saving.');
      return;
    }
    await handleLibrarySaved(titles);
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

  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);

  const getSheetTitle = () => {
    switch (mode) {
      case 'scan_capture':
        return 'Scan TOC';
      case 'scan_review':
        return 'Review lessons';
      case 'scan_extract_failed':
        return 'Could not read TOC';
      case 'paste':
        return 'Paste lessons';
      case 'edit':
        return 'Edit lessons';
      default:
        return curriculum.name;
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

  const renderDetailMode = () => (
    <>
      <Text style={styles.metaLine}>
        {[curriculum.publisher, curriculum.level].filter(Boolean).join(' · ') || 'Community library'}
      </Text>
      <Text style={styles.countLabel}>
        {loadingItems
          ? 'Loading lessons…'
          : sortedItems.length === 0
            ? 'No lessons added yet'
            : `${sortedItems.length} lesson${sortedItems.length === 1 ? '' : 's'}`}
      </Text>

      {loadingItems ? (
        <View style={styles.loadingItemsRow}>
          <ActivityIndicator color={Colors.brand[500]} />
          <Text style={styles.loadingItemsText}>Loading lessons…</Text>
        </View>
      ) : sortedItems.length > 0 ? (
        <View style={[styles.listCard, styles.lessonListCard]}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
            {sortedItems.map((item, index) => (
              <View
                key={item.id}
                style={[styles.lessonRow, index < sortedItems.length - 1 && styles.lessonRowBorder]}
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
        title="📷 Scan TOC"
        onPress={() => {
          resetScanState();
          setMode('scan_capture');
        }}
        disabled={isBusy}
        style={styles.actionButton}
      />
      <Button
        title="Paste lessons"
        variant="outline"
        onPress={() => setMode('paste')}
        disabled={isBusy}
        style={styles.actionButton}
      />
      {!loadingItems && sortedItems.length > 0 ? (
        <TouchableOpacity
          style={styles.editLessonsButton}
          onPress={handleOpenEdit}
          disabled={isBusy}
          activeOpacity={0.7}
        >
          <Text style={styles.editLessonsButtonText}>Edit lessons</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.sectionHeading}>Use this curriculum</Text>
      <Button
        title={`Select for ${studentName} — ${subject}`}
        onPress={() => onSelect(getCurriculumWithItems())}
        disabled={isBusy}
        style={styles.actionButton}
      />
    </>
  );

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
          title={`Save ${editItems.length} lesson${editItems.length === 1 ? '' : 's'} to library`}
          onPress={handleSaveEditToLibrary}
          loading={saving}
          disabled={editItems.length === 0 || saving}
        />
        <Button
          title="Back to details"
          variant="outline"
          onPress={handleDiscardEdit}
          disabled={saving}
          style={styles.actionButton}
        />
      </View>
    </>
  );

  const renderScanCaptureMode = () => {
    const pageCount = tocPages.length;
    const nextPageNumber = pageCount + 1;
    const canScanMore = pageCount < MAX_TOC_PAGES;

    return (
      <>
        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>Scan each TOC page</Text>
          <Text style={styles.instructionStep}>Scan up to {MAX_TOC_PAGES} pages, then tap Extract.</Text>
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
              disabled={isBusy || !canScanMore}
            />
            <Button
              title="Choose from Library"
              onPress={() => handleScanPage('library')}
              variant="outline"
              disabled={isBusy || !canScanMore}
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
        <Button
          title="Back to details"
          variant="outline"
          onPress={() => {
            resetScanState();
            setMode('detail');
          }}
          disabled={isBusy}
          style={styles.actionButton}
        />
      </>
    );
  };

  const renderScanExtractingMode = () => (
    <View style={styles.centeredState}>
      <ActivityIndicator color={Colors.brand[500]} size="large" />
      <Text style={styles.stateTitle}>
        Extracting from {tocPages.length} page{tocPages.length === 1 ? '' : 's'}…
      </Text>
      <Text style={styles.stateHint}>This may take a few seconds.</Text>
    </View>
  );

  const renderScanFailedMode = () => (
    <View style={styles.centeredState}>
      <Text style={styles.stateTitle}>We couldn&apos;t read the table of contents.</Text>
      <Text style={styles.stateHint}>Try again or go back to details.</Text>
      <Button title="Try again" onPress={handleExtractPages} style={styles.actionButton} />
      <Button
        title="Back to details"
        variant="outline"
        onPress={() => {
          resetScanState();
          setMode('detail');
        }}
        style={styles.actionButton}
      />
    </View>
  );

  const renderScanReviewMode = () => (
    <>
      <Text style={styles.countLabel}>
        {reviewItems.length} lesson{reviewItems.length === 1 ? '' : 's'} found
      </Text>

      <View style={styles.listCard}>
        {reviewItems.map((item, index) => (
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
        ))}
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
        title={`Save ${reviewItems.length} lesson${reviewItems.length === 1 ? '' : 's'} to library`}
        onPress={handleSaveReviewToLibrary}
        loading={saving}
        disabled={reviewItems.length === 0 || saving}
        style={styles.actionButton}
      />
      <Button
        title="Back to scan"
        variant="outline"
        onPress={() => setMode('scan_capture')}
        disabled={saving}
        style={styles.actionButton}
      />
    </>
  );

  const renderPasteMode = () => (
    <>
      <Text style={styles.sectionHint}>Each line becomes one lesson. Saving replaces existing lessons.</Text>
      <TextInput
        style={styles.textArea}
        value={pasteText}
        onChangeText={setPasteText}
        placeholder={'Lesson 1\nLesson 2\nLesson 3'}
        placeholderTextColor={Colors.ui.textLight}
        multiline
        numberOfLines={8}
        textAlignVertical="top"
        editable={!saving}
      />
      <Button
        title="Save to library"
        onPress={handleSavePasteToLibrary}
        loading={saving}
        disabled={saving}
        style={styles.actionButton}
      />
      <Button
        title="Back to details"
        variant="outline"
        onPress={() => setMode('detail')}
        disabled={saving}
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
            <Text style={styles.sheetTitle} numberOfLines={2}>
              {getSheetTitle()}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={isBusy}>
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
              {mode === 'detail' ? renderDetailMode() : null}
              {mode === 'scan_capture' ? renderScanCaptureMode() : null}
              {mode === 'scan_extracting' ? renderScanExtractingMode() : null}
              {mode === 'scan_extract_failed' ? renderScanFailedMode() : null}
              {mode === 'scan_review' ? renderScanReviewMode() : null}
              {mode === 'paste' ? renderPasteMode() : null}
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
  loadingItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
    marginBottom: 16,
  },
  loadingItemsText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
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
  instructionCard: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  instructionTitle: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 8,
  },
  instructionStep: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 20,
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
  textArea: {
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 160,
    ...Typography.body,
    color: Colors.ui.text,
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 12,
  },
  editLessonsButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  editLessonsButtonText: {
    ...Typography.bodySmall,
    color: Colors.brand[600],
    fontWeight: '600',
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
