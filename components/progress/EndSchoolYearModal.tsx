import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  defaultSchoolYearEndDate,
  defaultSchoolYearLabel,
  defaultSchoolYearStartDate,
} from '@/lib/schoolYearArchive';
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

type EndSchoolYearModalProps = {
  visible: boolean;
  studentName: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (values: {
    schoolYearLabel: string;
    startDate: string;
    endDate: string;
  }) => void;
};

export default function EndSchoolYearModal({
  visible,
  studentName,
  loading = false,
  onClose,
  onConfirm,
}: EndSchoolYearModalProps) {
  const [schoolYearLabel, setSchoolYearLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!visible) return;

    const label = defaultSchoolYearLabel();
    setSchoolYearLabel(label);
    setStartDate(defaultSchoolYearStartDate(label));
    setEndDate(defaultSchoolYearEndDate());
  }, [visible]);

  const handleLabelChange = (value: string) => {
    setSchoolYearLabel(value);
    const firstYear = value.match(/(\d{4})/);
    if (firstYear) {
      setStartDate(`${firstYear[1]}-07-01`);
    }
  };

  const handleConfirm = () => {
    const trimmedLabel = schoolYearLabel.trim();
    if (!trimmedLabel || !startDate.trim() || !endDate.trim()) {
      return;
    }

    onConfirm({
      schoolYearLabel: trimmedLabel,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
    });
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
            <Text style={styles.title}>End school year</Text>
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
              This will archive {studentName}&apos;s progress for this school year and start fresh.
              Completed lessons will be saved to your records and can still be exported. Your
              subjects and curricula stay in place. Continue?
            </Text>

            <Text style={styles.label}>School year label</Text>
            <TextInput
              style={styles.input}
              value={schoolYearLabel}
              onChangeText={handleLabelChange}
              placeholder="2025–2026"
              placeholderTextColor={Colors.ui.textLight}
              editable={!loading}
            />

            <Text style={styles.label}>Start date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.ui.textLight}
              autoCapitalize="none"
              editable={!loading}
            />

            <Text style={styles.label}>End date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.ui.textLight}
              autoCapitalize="none"
              editable={!loading}
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Button
              title="End School Year"
              onPress={handleConfirm}
              loading={loading}
              disabled={loading || !schoolYearLabel.trim()}
              style={styles.confirmButton}
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
    maxHeight: '85%',
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
    maxHeight: 360,
  },
  scrollContent: {
    padding: 20,
    gap: 8,
  },
  body: {
    ...Typography.body,
    color: Colors.ui.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  label: {
    ...Typography.label,
    color: Colors.ui.text,
    marginTop: 8,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  cancelText: {
    ...Typography.label,
    color: Colors.ui.textLight,
  },
  confirmButton: {
    flex: 1,
  },
});
