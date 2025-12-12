import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useScheduleStore } from '@/store/scheduleStore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const COMMON_BREAKS = [
  { name: 'Christmas Break', start: '2025-12-20', end: '2026-01-03' },
  { name: 'Spring Break', start: '2026-03-15', end: '2026-03-22' },
  { name: 'Summer Break', start: '2026-06-01', end: '2026-08-15' },
  { name: 'Thanksgiving', start: '2025-11-24', end: '2025-11-28' },
];

export default function BreaksScreen() {
  const router = useRouter();
  const { breaks, fetchBreaks, addBreak, deleteBreak } = useScheduleStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [breakName, setBreakName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    fetchBreaks();
  }, []);

  const handleAddBreak = async () => {
    if (!breakName.trim()) {
      Alert.alert('Error', 'Please enter a name for the break');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    await addBreak({
      name: breakName.trim(),
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
    });

    setModalVisible(false);
    setBreakName('');
    setStartDate(new Date());
    setEndDate(new Date());
  };

  const handleDeleteBreak = (id: string, name: string) => {
    Alert.alert('Delete Break', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteBreak(id),
      },
    ]);
  };

  const addCommonBreak = async (breakData: typeof COMMON_BREAKS[0]) => {
    await addBreak({
      name: breakData.name,
      start_date: breakData.start,
      end_date: breakData.end,
    });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || startDate;
    setShowStartPicker(Platform.OS === 'ios');
    
    if (event.type === 'set' && selectedDate) {
      setStartDate(selectedDate);
    }
    
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || endDate;
    setShowEndPicker(Platform.OS === 'ios');
    
    if (event.type === 'set' && selectedDate) {
      setEndDate(selectedDate);
    }
    
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>School Breaks</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
          <Plus size={24} color={Colors.brand[500]} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            Add school breaks, holidays, and vacations. Your streaks won't be affected during
            these periods.
          </Text>
        </View>

        {/* Common Breaks Suggestions */}
        {breaks.length === 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Add Common Breaks</Text>
            <View style={styles.commonBreaksContainer}>
              {COMMON_BREAKS.map((breakData) => (
                <TouchableOpacity
                  key={breakData.name}
                  style={styles.commonBreakButton}
                  onPress={() => addCommonBreak(breakData)}
                >
                  <Text style={styles.commonBreakName}>{breakData.name}</Text>
                  <Text style={styles.commonBreakDates}>
                    {format(new Date(breakData.start), 'MMM d')} -{' '}
                    {format(new Date(breakData.end), 'MMM d, yyyy')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Current Breaks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Your Breaks {breaks.length > 0 && `(${breaks.length})`}
          </Text>

          {breaks.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={48} color={Colors.ui.textLight} />
              <Text style={styles.emptyStateText}>No breaks scheduled</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the + button to add a break
              </Text>
            </View>
          ) : (
            <View style={styles.breaksContainer}>
              {breaks.map((breakItem) => (
                <View key={breakItem.id} style={styles.breakCard}>
                  <View style={styles.breakInfo}>
                    <Text style={styles.breakName}>{breakItem.name}</Text>
                    <Text style={styles.breakDates}>
                      {format(new Date(breakItem.start_date), 'MMM d, yyyy')} -{' '}
                      {format(new Date(breakItem.end_date), 'MMM d, yyyy')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteBreak(breakItem.id, breakItem.name)}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color={Colors.ui.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Break Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add School Break</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Break Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Spring Break"
                value={breakName}
                onChangeText={setBreakName}
                placeholderTextColor={Colors.ui.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {format(startDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleStartDateChange}
                  minimumDate={new Date(2020, 0, 1)}
                  maximumDate={new Date(2030, 11, 31)}
                />
              )}
              {Platform.OS === 'ios' && showStartPicker && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => setShowStartPicker(false)}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {format(endDate, 'MMM d, yyyy')}
                </Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleEndDateChange}
                  minimumDate={startDate}
                  maximumDate={new Date(2030, 11, 31)}
                />
              )}
              {Platform.OS === 'ios' && showEndPicker && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setBreakName('');
                  setStartDate(new Date());
                  setEndDate(new Date());
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddBreak}
              >
                <Text style={styles.saveButtonText}>Add Break</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  addButton: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 18,
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
    marginBottom: 32,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 12,
  },
  commonBreaksContainer: {
    gap: 8,
  },
  commonBreakButton: {
    backgroundColor: Colors.background.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  commonBreakName: {
    ...Typography.label,
    color: Colors.ui.text,
    marginBottom: 4,
  },
  commonBreakDates: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
  },
  emptyStateText: {
    ...Typography.h4,
    marginTop: 12,
    color: Colors.ui.textLight,
  },
  emptyStateSubtext: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  breaksContainer: {
    gap: 12,
  },
  breakCard: {
    backgroundColor: Colors.background.card,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent[400],
  },
  breakInfo: {
    flex: 1,
  },
  breakName: {
    ...Typography.label,
    fontSize: 16,
    marginBottom: 4,
  },
  breakDates: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  deleteButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...Typography.h3,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    ...Typography.label,
    marginBottom: 8,
    color: Colors.ui.text,
  },
  input: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    padding: 14,
    ...Typography.body,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  dateButton: {
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  dateButtonText: {
    ...Typography.body,
    color: Colors.ui.text,
  },
  confirmButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand[500],
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  confirmButtonText: {
    ...Typography.buttonSmall,
    color: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.ui.border,
  },
  cancelButtonText: {
    ...Typography.button,
    color: Colors.ui.text,
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
  },
  saveButtonText: {
    ...Typography.button,
    color: 'white',
  },
});

