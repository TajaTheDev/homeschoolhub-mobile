import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  END_SCHOOL_YEAR_NEXT_GRADE_CHIPS,
  getSuggestedNextGrade,
  ORDERED_GRADE_LEVELS,
} from '@/lib/gradeLevels';
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

export type EndSchoolYearConfirmValues = {
  schoolYearLabel: string;
  startDate: string;
  endDate: string;
  gradeLevel: string;
  nextGrade: string;
};

type EndSchoolYearModalProps = {
  visible: boolean;
  studentName: string;
  /** Current students.grade — prefills "this year" grade. */
  studentGrade: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (values: EndSchoolYearConfirmValues) => void;
};

export default function EndSchoolYearModal({
  visible,
  studentName,
  studentGrade,
  loading = false,
  onClose,
  onConfirm,
}: EndSchoolYearModalProps) {
  const [schoolYearLabel, setSchoolYearLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [gradeThisYear, setGradeThisYear] = useState('');
  const [gradeNextYear, setGradeNextYear] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const label = defaultSchoolYearLabel();
    const currentGrade = studentGrade.trim();
    setSchoolYearLabel(label);
    setStartDate(defaultSchoolYearStartDate(label));
    setEndDate(defaultSchoolYearEndDate());
    setGradeThisYear(currentGrade);
    setGradeNextYear(getSuggestedNextGrade(currentGrade));
    setShowValidation(false);
  }, [visible, studentGrade]);

  const handleLabelChange = (value: string) => {
    setSchoolYearLabel(value);
    const firstYear = value.match(/(\d{4})/);
    if (firstYear) {
      setStartDate(`${firstYear[1]}-07-01`);
    }
  };

  const handleConfirm = () => {
    const trimmedLabel = schoolYearLabel.trim();
    const trimmedThisYear = gradeThisYear.trim();
    const trimmedNextYear = gradeNextYear.trim();

    if (
      !trimmedLabel ||
      !startDate.trim() ||
      !endDate.trim() ||
      !trimmedThisYear ||
      !trimmedNextYear
    ) {
      setShowValidation(true);
      return;
    }

    onConfirm({
      schoolYearLabel: trimmedLabel,
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      gradeLevel: trimmedThisYear,
      nextGrade: trimmedNextYear,
    });
  };

  const gradesValid = gradeThisYear.trim().length > 0 && gradeNextYear.trim().length > 0;
  const canConfirm =
    schoolYearLabel.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    gradesValid;

  const renderGradeChip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.gradeChip, selected && styles.gradeChipSelected]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      <Text style={[styles.gradeChipText, selected && styles.gradeChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

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

            <Text style={styles.label}>What grade was {studentName} in this year?</Text>
            <View style={styles.gradeChipGrid}>
              {ORDERED_GRADE_LEVELS.map((g) =>
                renderGradeChip(g, gradeThisYear.trim() === g, () => setGradeThisYear(g))
              )}
            </View>
            <TextInput
              style={styles.input}
              value={gradeThisYear}
              onChangeText={setGradeThisYear}
              placeholder="Or enter a custom grade"
              placeholderTextColor={Colors.ui.textLight}
              editable={!loading}
            />
            {showValidation && !gradeThisYear.trim() ? (
              <Text style={styles.validationText}>Enter the grade for this school year.</Text>
            ) : null}

            <Text style={styles.label}>What grade next year?</Text>
            <View style={styles.gradeChipGrid}>
              {END_SCHOOL_YEAR_NEXT_GRADE_CHIPS.map((g) =>
                renderGradeChip(g, gradeNextYear.trim() === g, () => setGradeNextYear(g))
              )}
            </View>
            <TextInput
              style={styles.input}
              value={gradeNextYear}
              onChangeText={setGradeNextYear}
              placeholder="Or enter a custom grade (e.g. Graduated)"
              placeholderTextColor={Colors.ui.textLight}
              editable={!loading}
            />
            {showValidation && !gradeNextYear.trim() ? (
              <Text style={styles.validationText}>Enter the grade for next year.</Text>
            ) : null}
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
              disabled={loading || !canConfirm}
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
    maxHeight: 520,
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
  gradeChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    backgroundColor: Colors.ui.background,
  },
  gradeChipSelected: {
    borderColor: Colors.brand[600],
    backgroundColor: Colors.brand[50],
  },
  gradeChipText: {
    ...Typography.caption,
    color: Colors.ui.text,
  },
  gradeChipTextSelected: {
    color: Colors.brand[700],
    fontWeight: '600',
  },
  validationText: {
    ...Typography.caption,
    color: Colors.ui.error,
    marginTop: 2,
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
