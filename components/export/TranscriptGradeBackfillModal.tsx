import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { ORDERED_GRADE_LEVELS } from '@/lib/gradeLevels';
import type { MissingGradeArchive } from '@/lib/fetchTranscriptData';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type TranscriptGradeBackfillModalProps = {
  visible: boolean;
  items: MissingGradeArchive[];
  loading?: boolean;
  onClose: () => void;
  onExportAnyway: () => void;
  onSaveGradesAndExport: (gradesByArchiveId: Record<string, string>) => void;
};

export default function TranscriptGradeBackfillModal({
  visible,
  items,
  loading = false,
  onClose,
  onExportAnyway,
  onSaveGradesAndExport,
}: TranscriptGradeBackfillModalProps) {
  const [gradesByArchiveId, setGradesByArchiveId] = useState<Record<string, string>>({});
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.archiveId] = '';
    });
    setGradesByArchiveId(initial);
    setShowValidation(false);
  }, [visible, items]);

  const handleSave = () => {
    const allFilled = items.every((item) => gradesByArchiveId[item.archiveId]?.trim());
    if (!allFilled) {
      setShowValidation(true);
      return;
    }
    const payload: Record<string, string> = {};
    items.forEach((item) => {
      payload[item.archiveId] = gradesByArchiveId[item.archiveId].trim();
    });
    onSaveGradesAndExport(payload);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Missing grade levels</Text>
            <TouchableOpacity onPress={onClose} disabled={loading} accessibilityLabel="Close">
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.body}>
              Some archived school years do not have a grade level saved. You can add them now, or
              export anyway — those sections will show &quot;Grade not recorded&quot; on the PDF.
            </Text>

            {items.map((item) => (
              <View key={item.archiveId} style={styles.itemBlock}>
                <Text style={styles.itemLabel}>{item.schoolYearLabel}</Text>
                <View style={styles.chipGrid}>
                  {ORDERED_GRADE_LEVELS.map((grade) => {
                    const selected = gradesByArchiveId[item.archiveId]?.trim() === grade;
                    return (
                      <TouchableOpacity
                        key={grade}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() =>
                          setGradesByArchiveId((prev) => ({
                            ...prev,
                            [item.archiveId]: grade,
                          }))
                        }
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {grade}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  value={gradesByArchiveId[item.archiveId] ?? ''}
                  onChangeText={(value) =>
                    setGradesByArchiveId((prev) => ({ ...prev, [item.archiveId]: value }))
                  }
                  placeholder="Or enter custom grade"
                  placeholderTextColor={Colors.ui.textLight}
                  editable={!loading}
                />
                {showValidation && !gradesByArchiveId[item.archiveId]?.trim() ? (
                  <Text style={styles.validationText}>Grade is required to save.</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onExportAnyway}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Export anyway</Text>
            </TouchableOpacity>
            <Button
              title="Save grades & export"
              onPress={handleSave}
              loading={loading}
              disabled={loading}
              style={styles.primaryButton}
            />
          </View>
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
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  title: {
    ...Typography.h3,
    color: Colors.ui.text,
  },
  scroll: {
    maxHeight: 440,
  },
  scrollContent: {
    padding: 20,
    gap: 8,
  },
  body: {
    ...Typography.body,
    color: Colors.ui.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  itemBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  itemLabel: {
    ...Typography.label,
    color: Colors.ui.text,
    marginBottom: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
  },
  chipSelected: {
    borderColor: Colors.brand[600],
    backgroundColor: Colors.brand[50],
  },
  chipText: {
    ...Typography.caption,
    color: Colors.ui.text,
  },
  chipTextSelected: {
    color: Colors.brand[700],
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Typography.body,
    color: Colors.ui.text,
    backgroundColor: Colors.ui.background,
  },
  validationText: {
    ...Typography.caption,
    color: Colors.ui.error,
    marginTop: 4,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  secondaryButtonText: {
    ...Typography.label,
    color: Colors.ui.text,
  },
  primaryButton: {
    width: '100%',
  },
});
