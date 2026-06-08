import Colors from '@/constants/Colors';
import type { Student } from '@/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export type PdfExportMode = 'wrapup' | 'reading_log';

type PdfExportSetupModalProps = {
  visible: boolean;
  mode: PdfExportMode;
  students: Student[];
  loading?: boolean;
  onClose: () => void;
  onGenerate: (params: {
    studentId: string;
    startDate: string;
    endDate: string;
  }) => void;
};

const getDefaultStartDate = () => new Date(new Date().getFullYear(), 0, 1);
const getDefaultEndDate = () => new Date();

export default function PdfExportSetupModal({
  visible,
  mode,
  students,
  loading = false,
  onClose,
  onGenerate,
}: PdfExportSetupModalProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (!visible) return;

    setStartDate(getDefaultStartDate());
    setEndDate(getDefaultEndDate());
    setActivePicker(null);

    if (students.length === 1) {
      setSelectedStudentId(students[0].id);
    } else {
      setSelectedStudentId(null);
    }
  }, [visible, students]);

  const canGenerate = Boolean(selectedStudentId) && !loading;

  const handleGenerate = () => {
    if (!selectedStudentId) return;
    onGenerate({
      studentId: selectedStudentId,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
  };

  const renderDatePicker = (
    picker: 'start' | 'end',
    value: Date,
    onChange: (date: Date) => void,
    minimumDate?: Date
  ) => {
    if (activePicker !== picker) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal transparent animationType="slide" visible onRequestClose={() => setActivePicker(null)}>
          <Pressable style={styles.pickerOverlay} onPress={() => setActivePicker(null)}>
            <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setActivePicker(null)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={value}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                onChange={(_, date) => {
                  if (date) onChange(date);
                }}
                textColor="#000000"
                accentColor={Colors.brand[500]}
                themeVariant="light"
              />
            </Pressable>
          </Pressable>
        </Modal>
      );
    }

    return (
      <DateTimePicker
        value={value}
        mode="date"
        display="default"
        minimumDate={minimumDate}
        onChange={(event, date) => {
          setActivePicker(null);
          if (event.type === 'set' && date) onChange(date);
        }}
      />
    );
  };

  const title = mode === 'wrapup' ? 'Year in Review' : 'Export Reading Log';
  const subtitle =
    mode === 'wrapup'
      ? 'Choose a student and date range for the wrap-up PDF.'
      : 'Choose a student to export their reading log.';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>Student</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {students.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.filterChip,
                    selectedStudentId === student.id && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedStudentId(student.id)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedStudentId === student.id && styles.filterChipTextActive,
                    ]}
                  >
                    {student.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {mode === 'wrapup' ? (
              <>
                <Text style={[styles.filterLabel, styles.dateLabel]}>Date range</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setActivePicker('start')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <CalendarIcon size={20} color={Colors.brand[600]} />
                  <View style={styles.dateButtonContent}>
                    <Text style={styles.dateButtonLabel}>Start date</Text>
                    <Text style={styles.dateButtonText}>{format(startDate, 'MMMM d, yyyy')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, styles.dateButtonSpaced]}
                  onPress={() => setActivePicker('end')}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <CalendarIcon size={20} color={Colors.brand[600]} />
                  <View style={styles.dateButtonContent}>
                    <Text style={styles.dateButtonLabel}>End date</Text>
                    <Text style={styles.dateButtonText}>{format(endDate, 'MMMM d, yyyy')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={[styles.generateButton, !canGenerate && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              disabled={!canGenerate}
              activeOpacity={0.8}
            >
              <Text style={styles.generateButtonText}>
                {loading ? 'Generating…' : 'Generate PDF'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>

      {mode === 'wrapup' ? (
        <>
          {renderDatePicker('start', startDate, setStartDate)}
          {renderDatePicker(
            'end',
            endDate,
            (date) => {
              if (date < startDate) {
                setEndDate(startDate);
              } else {
                setEndDate(date);
              }
            },
            startDate
          )}
        </>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  sheetHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.ui.textLight,
    lineHeight: 18,
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 32,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  dateLabel: {
    marginTop: 16,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.ui.backgroundLight,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  filterChipTextActive: {
    color: 'white',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  dateButtonSpaced: {
    marginTop: 12,
  },
  dateButtonContent: {
    flex: 1,
  },
  dateButtonLabel: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginBottom: 2,
  },
  dateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  generateButton: {
    marginTop: 24,
    backgroundColor: Colors.brand[500],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pickerSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  pickerHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
});
