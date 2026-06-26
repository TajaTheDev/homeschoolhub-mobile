import React, { useState, useEffect } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar, X } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { format } from 'date-fns';
import type { SchoolBreak } from '@/types/database';

interface EditBreakModalProps {
  visible: boolean;
  breakData: { name: string; start_date: string; end_date: string; emoji?: string; id?: string } | null;
  onClose: () => void;
  onSave: (breakData: Omit<SchoolBreak, 'user_id' | 'created_at'> & { id?: string }) => Promise<void>;
}

export default function EditBreakModal({
  visible,
  breakData,
  onClose,
  onSave,
}: EditBreakModalProps) {
  const [name, setName] = useState(breakData?.name || '');
  const [startDate, setStartDate] = useState(
    breakData?.start_date ? new Date(breakData.start_date) : new Date()
  );
  const [endDate, setEndDate] = useState(
    breakData?.end_date ? new Date(breakData.end_date) : new Date()
  );
  const [selectedEmoji, setSelectedEmoji] = useState(breakData?.emoji || '🎄');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [originalStartDate, setOriginalStartDate] = useState<Date | null>(null);
  const [originalEndDate, setOriginalEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Add logging when picker visibility changes
  useEffect(() => {
      }, [showStartPicker]);

  useEffect(() => {
      }, [showEndPicker]);

  // Add logging when dates change
  useEffect(() => {
      }, [startDate]);

  useEffect(() => {
      }, [endDate]);

  // Update state when breakData changes
  useEffect(() => {
    if (breakData) {
            setName(breakData.name);
      setStartDate(new Date(breakData.start_date));
      setEndDate(new Date(breakData.end_date));
      setSelectedEmoji(breakData.emoji || '🎄');
    } else {
            setName('');
      setStartDate(new Date());
      setEndDate(new Date());
      setSelectedEmoji('🎄');
    }
  }, [breakData, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for the break');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    setLoading(true);

    const breakToSave: Omit<SchoolBreak, 'user_id' | 'created_at'> & { id?: string } = {
      name: name.trim(),
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      emoji: selectedEmoji,
      ...(breakData?.id && { id: breakData.id }),
    };

        try {
      await onSave(breakToSave);
      setLoading(false);
      onClose();
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save break');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {breakData ? 'Edit Break' : 'Add Break'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Break Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(text) => {
                                    setName(text);
                }}
                placeholder="e.g., Christmas Break"
                placeholderTextColor={Colors.ui.textLight}
              />
            </View>

            {/* Emoji Picker Section */}
            <View style={styles.section}>
              <Text style={styles.label}>Icon/Emoji</Text>
              <TouchableOpacity
                style={styles.emojiPickerButton}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Text style={styles.selectedEmoji}>{selectedEmoji}</Text>
                <Text style={styles.emojiPickerButtonText}>
                  {showEmojiPicker ? 'Hide emoji picker' : 'Tap to change'}
                </Text>
              </TouchableOpacity>
              
              {/* Emoji Grid */}
              {showEmojiPicker && (
                <View style={styles.emojiGrid}>
                  {[
                    '🎄', '🎅', '🎁', '❄️', '⛄', // Christmas
                    '🌸', '🌺', '🌼', '🌻', '🌷', // Spring
                    '☀️', '🏖️', '🏝️', '🌊', '🍉', // Summer
                    '🍂', '🍁', '🎃', '🦃', '🥧', // Fall
                    '🎆', '🎇', '🎉', '🎊', '🥳', // Celebrations
                    '🏫', '📚', '✏️', '🎓', '📖', // School related
                    '🏥', '🤒', '💊', '🩺', '⚕️', // Sick/Medical
                    '✈️', '🗺️', '🧳', '🏔️', '🏕️', // Travel/Vacation
                    '🙏', '⛪', '🕌', '🕍', '☪️', // Religious
                    '🎂', '🎈', '🎀', '🎪', '🎭', // Parties/Events
                  ].map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.emojiButton,
                        selectedEmoji === emoji && styles.emojiButtonActive
                      ]}
                      onPress={() => {
                                                setSelectedEmoji(emoji);
                        setShowEmojiPicker(false);
                      }}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Start Date */}
            <View style={styles.section}>
              <Text style={styles.label}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setOriginalStartDate(startDate);
                  setShowStartPicker(true);
                }}
              >
                <Calendar size={20} color={Colors.brand[600]} />
                <Text style={styles.dateText}>
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start Date Picker */}
            {showStartPicker && (
              <>
                {Platform.OS === 'ios' ? (
                  // iOS: Show in Modal with buttons
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showStartPicker}
                    onRequestClose={() => {
                      if (originalStartDate) {
                        setStartDate(originalStartDate);
                      }
                      setShowStartPicker(false);
                    }}
                  >
                    <View style={styles.datePickerOverlay}>
                      <View style={styles.datePickerContainer}>
                        {/* Header with Cancel/Done */}
                        <View style={styles.datePickerHeader}>
                          <TouchableOpacity
                            onPress={() => {
                              // Revert to original date
                              if (originalStartDate) {
                                setStartDate(originalStartDate);
                              }
                              setShowStartPicker(false);
                            }}
                          >
                            <Text style={styles.datePickerCancel}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <Text style={styles.datePickerTitle}>Start Date</Text>
                          
                          <TouchableOpacity
                            onPress={() => {
                              // Date is already set via onChange
                              setShowStartPicker(false);
                            }}
                          >
                            <Text style={styles.datePickerDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* The actual picker */}
                        <DateTimePicker
                          value={startDate}
                          mode="date"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              setStartDate(selectedDate);
                            }
                          }}
                          textColor="#000000"
                          themeVariant="light"
                          style={styles.dateTimePicker}
                        />
                      </View>
                    </View>
                  </Modal>
                ) : (
                  // Android: Native picker
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartPicker(false);
                      if (event.type === 'set' && selectedDate) {
                        setStartDate(selectedDate);
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* End Date */}
            <View style={styles.section}>
              <Text style={styles.label}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setOriginalEndDate(endDate);
                  setShowEndPicker(true);
                }}
              >
                <Calendar size={20} color={Colors.brand[600]} />
                <Text style={styles.dateText}>
                  {format(endDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date Picker */}
            {showEndPicker && (
              <>
                {Platform.OS === 'ios' ? (
                  // iOS: Show in Modal with buttons
                  <Modal
                    transparent={true}
                    animationType="slide"
                    visible={showEndPicker}
                    onRequestClose={() => {
                      if (originalEndDate) {
                        setEndDate(originalEndDate);
                      }
                      setShowEndPicker(false);
                    }}
                  >
                    <View style={styles.datePickerOverlay}>
                      <View style={styles.datePickerContainer}>
                        {/* Header with Cancel/Done */}
                        <View style={styles.datePickerHeader}>
                          <TouchableOpacity
                            onPress={() => {
                              // Revert to original date
                              if (originalEndDate) {
                                setEndDate(originalEndDate);
                              }
                              setShowEndPicker(false);
                            }}
                          >
                            <Text style={styles.datePickerCancel}>Cancel</Text>
                          </TouchableOpacity>
                          
                          <Text style={styles.datePickerTitle}>End Date</Text>
                          
                          <TouchableOpacity
                            onPress={() => {
                              setShowEndPicker(false);
                            }}
                          >
                            <Text style={styles.datePickerDone}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* The actual picker */}
                        <DateTimePicker
                          value={endDate}
                          mode="date"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              setEndDate(selectedDate);
                            }
                          }}
                          minimumDate={startDate} // End must be after start
                          textColor="#000000"
                          themeVariant="light"
                          style={styles.dateTimePicker}
                        />
                      </View>
                    </View>
                  </Modal>
                ) : (
                  // Android: Native picker
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowEndPicker(false);
                      if (event.type === 'set' && selectedDate) {
                        setEndDate(selectedDate);
                      }
                    }}
                    minimumDate={startDate}
                  />
                )}
              </>
            )}

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 Recurring lessons will automatically skip these dates
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Break'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.ui.text,
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
  dateText: {
    fontSize: 16,
    color: Colors.brand[700],
    flex: 1,
  },
  infoBox: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    color: Colors.brand[700],
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  emojiPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  selectedEmoji: {
    fontSize: 32,
  },
  emojiPickerButtonText: {
    fontSize: 14,
    color: Colors.brand[700],
    flex: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  emojiButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.ui.backgroundLight,
  },
  emojiButtonActive: {
    backgroundColor: Colors.brand[100],
    borderWidth: 2,
    borderColor: Colors.brand[500],
  },
  emojiText: {
    fontSize: 24,
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  datePickerCancel: {
    fontSize: 16,
    color: Colors.ui.error,
  },
  datePickerDone: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  dateTimePicker: {
    width: '100%',
    height: 200,
    backgroundColor: 'white',
  },
});

