/**
 * Reading Log Screen — track books per student
 */

import Button from '@/components/ui/Button';
import BookPhotoUpload from '@/components/reading-log/BookPhotoUpload';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useSnackbar } from '@/contexts/SnackbarContext';
import {
  LESSON_PHOTOS_BUCKET,
  deleteStorageObject,
  getStoragePublicUrl,
} from '@/lib/photoStorage';
import {
  useReadingLogStore,
  type ReadingLogEntry,
  type ReadingLogStatus,
  type ReaderType,
} from '@/store/readingLogStore';
import { useStudentStore } from '@/store/studentStore';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Plus, Star, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');

const parseOptionalInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const formatDisplayDate = (dateString: string | null) => {
  if (!dateString) return '';
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

type SheetMode = 'add' | 'edit';

export default function ReadingLogScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = typeof params.studentId === 'string' ? params.studentId : '';

  const { students, fetchStudents } = useStudentStore();
  const { books, loading, fetchReadingLog, addBook, updateBook, deleteBook } =
    useReadingLogStore();
  const { showSnackbar } = useSnackbar();

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('add');
  const [editingBook, setEditingBook] = useState<ReadingLogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<ReadingLogStatus>('reading');
  const [dateFinished, setDateFinished] = useState(getTodayDate());
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [readerType, setReaderType] = useState<ReaderType | null>(null);
  const [pagesRead, setPagesRead] = useState('');
  const [minutesRead, setMinutesRead] = useState('');
  const [bookPhotoPath, setBookPhotoPath] = useState<string | null>(null);
  const [committedPhotoPath, setCommittedPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const student = useMemo(
    () => students.find((entry) => entry.id === studentId) ?? null,
    [students, studentId]
  );

  const loadData = useCallback(async () => {
    if (!studentId) return;
    await Promise.all([fetchStudents(), fetchReadingLog(studentId)]);
  }, [fetchReadingLog, fetchStudents, studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentlyReading = useMemo(
    () =>
      books
        .filter((book) => book.status === 'reading')
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        }),
    [books]
  );

  const finishedBooks = useMemo(
    () =>
      books
        .filter((book) => book.status === 'finished')
        .sort((a, b) => {
          const aTime = a.date_finished ? new Date(a.date_finished).getTime() : 0;
          const bTime = b.date_finished ? new Date(b.date_finished).getTime() : 0;
          return bTime - aTime;
        }),
    [books]
  );

  const resetSheet = () => {
    setTitle('');
    setAuthor('');
    setStatus('reading');
    setDateFinished(getTodayDate());
    setRating(null);
    setNotes('');
    setReaderType(null);
    setPagesRead('');
    setMinutesRead('');
    setBookPhotoPath(null);
    setCommittedPhotoPath(null);
    setEditingBook(null);
    setSheetMode('add');
  };

  const openAddSheet = () => {
    resetSheet();
    setSheetMode('add');
    setCommittedPhotoPath(null);
    setSheetVisible(true);
  };

  const openEditSheet = (book: ReadingLogEntry) => {
    setEditingBook(book);
    setSheetMode('edit');
    setTitle(book.title);
    setAuthor(book.author ?? '');
    setStatus(book.status === 'finished' ? 'finished' : 'reading');
    setDateFinished(book.date_finished ?? getTodayDate());
    setRating(book.rating ?? null);
    setNotes(book.notes ?? '');
    setReaderType(book.reader_type ?? null);
    setPagesRead(book.pages_read != null ? String(book.pages_read) : '');
    setMinutesRead(book.minutes_read != null ? String(book.minutes_read) : '');
    setBookPhotoPath(book.book_photo_path ?? null);
    setCommittedPhotoPath(book.book_photo_path ?? null);
    setSheetVisible(true);
  };

  const cleanupUnsavedPhotoUpload = async (
    mode: SheetMode,
    workingPath: string | null,
    committed: string | null
  ) => {
    if (!workingPath) return;

    if (mode === 'add') {
      await deleteStorageObject(LESSON_PHOTOS_BUCKET, workingPath);
      return;
    }

    if (workingPath !== committed) {
      await deleteStorageObject(LESSON_PHOTOS_BUCKET, workingPath);
    }
  };

  const closeSheet = () => {
    if (saving) return;

    const mode = sheetMode;
    const workingPath = bookPhotoPath;
    const committed = committedPhotoPath;

    setSheetVisible(false);
    resetSheet();
    void cleanupUnsavedPhotoUpload(mode, workingPath, committed);
  };

  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave || !studentId) return;

    setSaving(true);

    try {
      const pages = parseOptionalInt(pagesRead);
      const minutes = parseOptionalInt(minutesRead);

      if (sheetMode === 'add') {
        const result = await addBook(studentId, {
          title: title.trim(),
          author: author.trim() || null,
          status,
          date_started: getTodayDate(),
          date_finished: status === 'finished' ? dateFinished : null,
          pages_read: pages,
          minutes_read: minutes,
          reader_type: readerType,
          book_photo_path: bookPhotoPath,
        });

        if (!result.success) {
          showSnackbar(result.error ?? 'Could not add book', 'error');
          return;
        }

        showSnackbar('Book added', 'success');
      } else if (editingBook) {
        const previousPhotoPath = editingBook.book_photo_path ?? null;
        const result = await updateBook(editingBook.id, {
          title: title.trim(),
          author: author.trim() || null,
          status,
          date_finished: status === 'finished' ? dateFinished : null,
          rating,
          notes: notes.trim() || null,
          pages_read: pages,
          minutes_read: minutes,
          reader_type: readerType,
          book_photo_path: bookPhotoPath,
        });

        if (!result.success) {
          showSnackbar(result.error ?? 'Could not save book', 'error');
          return;
        }

        if (previousPhotoPath && previousPhotoPath !== bookPhotoPath) {
          await deleteStorageObject(LESSON_PHOTOS_BUCKET, previousPhotoPath);
        }

        showSnackbar('Book updated', 'success');
      }

      setSheetVisible(false);
      resetSheet();
    } finally {
      setSaving(false);
    }
  };

  const handleMarkFinished = async () => {
    if (!editingBook || saving) return;

    setSaving(true);

    try {
      const today = getTodayDate();
      const result = await updateBook(editingBook.id, {
        status: 'finished',
        date_finished: today,
      });

      if (!result.success) {
        showSnackbar(result.error ?? 'Could not update book', 'error');
        return;
      }

      setStatus('finished');
      setDateFinished(today);
      setEditingBook(result.data ?? { ...editingBook, status: 'finished', date_finished: today });
      showSnackbar('Marked as finished', 'success');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingBook) return;

    Alert.alert(
      'Delete book?',
      `Remove "${editingBook.title}" from the reading log?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const result = await deleteBook(editingBook.id);
            setSaving(false);

            if (!result.success) {
              showSnackbar(result.error ?? 'Could not delete book', 'error');
              return;
            }

            showSnackbar('Book deleted', 'success');
            closeSheet();
          },
        },
      ]
    );
  };

  const renderStars = (value: number | null, interactive = false) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value !== null && star <= value;
        return (
          <TouchableOpacity
            key={star}
            onPress={interactive ? () => setRating(rating === star ? null : star) : undefined}
            disabled={!interactive || saving}
            activeOpacity={interactive ? 0.7 : 1}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Star
              size={interactive ? 28 : 14}
              color={filled ? Colors.ui.warning : Colors.ui.border}
              fill={filled ? Colors.ui.warning : 'transparent'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderBookCard = (book: ReadingLogEntry) => {
    const readerBadgeLabel =
      book.reader_type === 'read_aloud'
        ? 'Read aloud'
        : book.reader_type === 'independent'
          ? 'Independent'
          : null;

    const trackingParts: string[] = [];
    if (book.pages_read != null) {
      trackingParts.push(`${book.pages_read} page${book.pages_read === 1 ? '' : 's'}`);
    }
    if (book.minutes_read != null) {
      trackingParts.push(`${book.minutes_read} min`);
    }

    return (
      <TouchableOpacity
        key={book.id}
        style={styles.bookCard}
        onPress={() => openEditSheet(book)}
        activeOpacity={0.7}
      >
        <View style={styles.bookCardRow}>
          {book.book_photo_path ? (
            <Image
              source={{
                uri: getStoragePublicUrl(LESSON_PHOTOS_BUCKET, book.book_photo_path),
              }}
              style={styles.bookCardThumb}
              contentFit="cover"
              transition={200}
            />
          ) : null}
          <View style={styles.bookCardBody}>
            <View style={styles.bookCardHeader}>
              <Text style={styles.bookTitle}>{book.title}</Text>
              {readerBadgeLabel ? (
                <View style={styles.readerBadge}>
                  <Text style={styles.readerBadgeText}>{readerBadgeLabel}</Text>
                </View>
              ) : null}
            </View>
            {book.author ? <Text style={styles.bookAuthor}>{book.author}</Text> : null}
            {trackingParts.length > 0 ? (
              <Text style={styles.bookTracking}>{trackingParts.join(' · ')}</Text>
            ) : null}
            {book.status === 'finished' ? (
              <View style={styles.bookMeta}>
                {book.rating ? renderStars(book.rating) : null}
                {book.date_finished ? (
                  <Text style={styles.bookDate}>
                    Finished {formatDisplayDate(book.date_finished)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSection = (
    sectionTitle: string,
    sectionBooks: ReadingLogEntry[],
    emptyMessage: string
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {sectionBooks.length === 0 ? (
        <Text style={styles.emptySectionText}>{emptyMessage}</Text>
      ) : (
        sectionBooks.map(renderBookCard)
      )}
    </View>
  );

  if (!studentId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>Missing student.</Text>
          <Button title="Go back" onPress={() => router.back()} size="medium" />
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
          <Text style={styles.headerTitle}>Reading log</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {student?.name ?? 'Student'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={openAddSheet}
          activeOpacity={0.7}
          accessibilityLabel="Add book"
        >
          <Plus size={20} color={Colors.brand[600]} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading reading log…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSection(
            'Currently reading',
            currentlyReading,
            'No books currently reading'
          )}
          {renderSection('Finished', finishedBooks, 'No finished books yet')}
        </ScrollView>
      )}

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={closeSheet}>
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {sheetMode === 'add' ? 'Add book' : 'Edit book'}
              </Text>
              <TouchableOpacity onPress={closeSheet} disabled={saving}>
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Book title"
                placeholderTextColor={Colors.ui.textLight}
                editable={!saving}
                autoFocus={sheetMode === 'add'}
              />

              <Text style={styles.fieldLabel}>Author</Text>
              <TextInput
                style={styles.input}
                value={author}
                onChangeText={setAuthor}
                placeholder="Optional"
                placeholderTextColor={Colors.ui.textLight}
                editable={!saving}
              />

              <BookPhotoUpload
                studentId={studentId}
                committedPhotoPath={committedPhotoPath}
                photoPath={bookPhotoPath}
                onPhotoPathChange={setBookPhotoPath}
                disabled={saving}
              />

              <Text style={styles.fieldLabel}>Reader type</Text>
              <View style={styles.statusToggle}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    readerType === 'independent' && styles.statusButtonActive,
                  ]}
                  onPress={() =>
                    setReaderType((current) =>
                      current === 'independent' ? null : 'independent'
                    )
                  }
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      readerType === 'independent' && styles.statusButtonTextActive,
                    ]}
                  >
                    Read independently
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    readerType === 'read_aloud' && styles.statusButtonActive,
                  ]}
                  onPress={() =>
                    setReaderType((current) => (current === 'read_aloud' ? null : 'read_aloud'))
                  }
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      readerType === 'read_aloud' && styles.statusButtonTextActive,
                    ]}
                  >
                    Read aloud
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Pages</Text>
              <TextInput
                style={styles.input}
                value={pagesRead}
                onChangeText={setPagesRead}
                placeholder="Optional"
                placeholderTextColor={Colors.ui.textLight}
                keyboardType="number-pad"
                editable={!saving}
              />

              <Text style={styles.fieldLabel}>Minutes read</Text>
              <TextInput
                style={styles.input}
                value={minutesRead}
                onChangeText={setMinutesRead}
                placeholder="Optional"
                placeholderTextColor={Colors.ui.textLight}
                keyboardType="number-pad"
                editable={!saving}
              />

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusToggle}>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'reading' && styles.statusButtonActive,
                  ]}
                  onPress={() => setStatus('reading')}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'reading' && styles.statusButtonTextActive,
                    ]}
                  >
                    Currently reading
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    status === 'finished' && styles.statusButtonActive,
                  ]}
                  onPress={() => {
                    setStatus('finished');
                    if (!dateFinished) {
                      setDateFinished(getTodayDate());
                    }
                  }}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === 'finished' && styles.statusButtonTextActive,
                    ]}
                  >
                    Finished
                  </Text>
                </TouchableOpacity>
              </View>

              {sheetMode === 'edit' && status === 'finished' ? (
                <>
                  <Text style={styles.fieldLabel}>Date finished</Text>
                  <TextInput
                    style={styles.input}
                    value={dateFinished}
                    onChangeText={setDateFinished}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.ui.textLight}
                    editable={!saving}
                  />
                </>
              ) : null}

              {sheetMode === 'edit' ? (
                <>
                  {status === 'reading' ? (
                    <Button
                      title="Mark as finished"
                      onPress={handleMarkFinished}
                      variant="outline"
                      size="medium"
                      disabled={saving}
                      style={styles.markFinishedButton}
                    />
                  ) : null}

                  <Text style={styles.fieldLabel}>Rating</Text>
                  {renderStars(rating, true)}

                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.notesInput]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Narration or thoughts..."
                    placeholderTextColor={Colors.ui.textLight}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    editable={!saving}
                  />

                  <TouchableOpacity
                    onPress={handleDelete}
                    disabled={saving}
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.deleteButtonText}>Delete book</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <Button
                title={sheetMode === 'add' ? 'Save book' : 'Save changes'}
                onPress={handleSave}
                disabled={!canSave}
                loading={saving}
                style={styles.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.brand[200],
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
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    ...Typography.h3,
    fontSize: 18,
    color: Colors.brand[900],
    marginBottom: 12,
  },
  emptySectionText: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  bookCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  bookCardRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  bookCardThumb: {
    width: 52,
    height: 72,
    borderRadius: 8,
    backgroundColor: Colors.ui.border,
  },
  bookCardBody: {
    flex: 1,
  },
  bookCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  bookTitle: {
    ...Typography.label,
    fontSize: 16,
    color: Colors.ui.text,
    flex: 1,
  },
  readerBadge: {
    backgroundColor: Colors.brand[50],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  readerBadgeText: {
    ...Typography.caption,
    color: Colors.brand[700],
    fontWeight: '600',
  },
  bookAuthor: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  bookTracking: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginTop: 6,
  },
  bookMeta: {
    marginTop: 10,
    gap: 6,
  },
  bookDate: {
    ...Typography.caption,
    color: Colors.brand[600],
  },
  starsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
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
  notesInput: {
    minHeight: 100,
  },
  statusToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
    textAlign: 'center',
  },
  statusButtonTextActive: {
    color: 'white',
  },
  markFinishedButton: {
    marginBottom: 16,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  deleteButtonText: {
    ...Typography.label,
    color: Colors.ui.error,
  },
  saveButton: {
    marginTop: 8,
  },
});
