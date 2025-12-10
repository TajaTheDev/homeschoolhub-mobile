import Colors from '@/constants/Colors';
import { Target, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
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

interface EditGoalModalProps {
  visible: boolean;
  subject: string;
  currentGoal: number;
  studentName: string;
  onClose: () => void;
  onSave: (newGoal: number | null) => void;
}

export default function EditGoalModal({
  visible,
  subject,
  currentGoal,
  studentName,
  onClose,
  onSave,
}: EditGoalModalProps) {
  const [goalValue, setGoalValue] = useState('');

  useEffect(() => {
    if (visible) {
      setGoalValue(currentGoal.toString());
    }
  }, [visible, currentGoal]);

  const handleSave = () => {
    const trimmed = goalValue.trim();
    
    if (!trimmed) {
      // Empty = remove goal
      onSave(null);
      return;
    }

    const newGoal = parseInt(trimmed);
    if (isNaN(newGoal) || newGoal <= 0) {
      Alert.alert('Invalid Goal', 'Please enter a number greater than 0');
      return;
    }

    onSave(newGoal);
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Goal?',
      `Are you sure you want to remove the goal for ${subject}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onSave(null);
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Target size={24} color={Colors.brand[600]} />
                <View style={styles.headerText}>
                  <Text style={styles.title}>Edit Goal</Text>
                  <Text style={styles.subtitle}>{subject}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            {/* Current Goal Display */}
            <View style={styles.currentGoalSection}>
              <Text style={styles.currentGoalLabel}>Current goal:</Text>
              <Text style={styles.currentGoalValue}>{currentGoal} lessons</Text>
            </View>

            {/* Input Field */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>New Goal (lessons)</Text>
              <TextInput
                style={styles.input}
                value={goalValue}
                onChangeText={setGoalValue}
                placeholder="Enter goal number"
                placeholderTextColor={Colors.ui.textLight}
                keyboardType="number-pad"
                autoFocus
              />
              <Text style={styles.inputHint}>
                Leave empty to remove the goal
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemove}
                activeOpacity={0.7}
              >
                <Text style={styles.removeButtonText}>Remove Goal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Save Goal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.ui.textLight,
    marginTop: 4,
    fontWeight: '500',
  },
  currentGoalSection: {
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  currentGoalLabel: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  currentGoalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.brand[700],
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: Colors.ui.text,
    minHeight: 44,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.ui.textLight,
    marginTop: 8,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  removeButton: {
    flex: 1,
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.ui.error,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.error,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});

