import Colors from '@/constants/Colors';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ReminderTimePickerProps {
  visible: boolean;
  value: Date;
  title?: string;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

/**
 * Shared reminder time picker.
 * Android: DateTimePickerAndroid.open, commits only on event.type === 'set'.
 * iOS: Modal with Done/Cancel; draft is re-seeded on every open; commit on Done only.
 */
export default function ReminderTimePicker({
  visible,
  value,
  title = 'Reminder Time',
  onConfirm,
  onCancel,
}: ReminderTimePickerProps) {
  const [draft, setDraft] = useState(() => new Date(value.getTime()));
  const valueRef = useRef(value);
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);
  valueRef.current = value;
  onConfirmRef.current = onConfirm;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const seeded = new Date(valueRef.current.getTime());
    setDraft(seeded);

    if (Platform.OS !== 'android') {
      return;
    }

    DateTimePickerAndroid.open({
      value: seeded,
      mode: 'time',
      is24Hour: false,
      onChange: (event, selectedTime) => {
        if (event.type !== 'set' || !selectedTime) {
          onCancelRef.current();
          return;
        }
        onConfirmRef.current(selectedTime);
      },
    });
  }, [visible]);

  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={() => onConfirm(draft)}
              accessibilityRole="button"
            >
              <Text style={styles.done}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={draft}
            mode="time"
            is24Hour={false}
            display="spinner"
            onChange={(_event, selectedTime) => {
              if (selectedTime) {
                setDraft(selectedTime);
              }
            }}
          />
        </View>
      </View>
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
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  cancel: {
    fontSize: 16,
    color: Colors.ui.error,
  },
  done: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[600],
  },
});
