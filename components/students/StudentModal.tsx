import AvatarPicker from '@/components/students/AvatarPicker';
import Avatar from '@/components/ui/Avatar';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { GradeLevel, Student, StudentColor } from '@/types';
import { Trash2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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

interface StudentModalProps {
  visible: boolean;
  student: Student | null;
  onClose: () => void;
  onSave: () => void;
}

const GRADES: GradeLevel[] = ['Pre-K', 'Kindergarten', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

const COLORS: { name: StudentColor; color: string }[] = [
  { name: 'purple', color: Colors.student.purple },
  { name: 'blue', color: Colors.student.blue },
  { name: 'green', color: Colors.student.green },
  { name: 'pink', color: Colors.student.pink },
  { name: 'orange', color: Colors.student.orange },
];

export default function StudentModal({ visible, student, onClose, onSave }: StudentModalProps) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel>('1st');
  const [colorTheme, setColorTheme] = useState<StudentColor>('purple');
  const [avatarType, setAvatarType] = useState<'initial' | 'photo' | 'illustration'>('initial');
  const [avatarValue, setAvatarValue] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const studentStore = useStudentStore();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(300);
    }
  }, [visible]);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setGrade(student.grade as GradeLevel);
      setColorTheme(student.color_theme as StudentColor);
      setAvatarType(student.avatar_type || 'initial');
      setAvatarValue(student.avatar_value || null);
    }
  }, [student]);

  if (!visible || !student) return null;

  const handleAvatarSelect = (type: 'initial' | 'photo' | 'illustration', value?: string) => {
    setAvatarType(type);
    setAvatarValue(value || null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    setLoading(true);
    const result = await studentStore.updateStudent(student.id, {
      name,
      grade,
      color_theme: colorTheme,
      avatar_type: avatarType,
      avatar_value: avatarValue || undefined,
    });
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Student updated!');
      onSave();
    } else {
      Alert.alert('Error', result.error || 'Failed to update student');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Student?',
      `Are you sure you want to delete ${student.name}? This will delete all their lessons.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await studentStore.deleteStudent(student.id);
            setLoading(false);
            if (result.success) {
              onSave();
            } else {
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

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
        <Animated.View 
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Edit Student</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={24} color={Colors.ui.text} />
              </TouchableOpacity>
            </View>

            {/* Avatar Selection */}
            <View style={styles.avatarSection}>
              <Text style={styles.sectionLabel}>Student Avatar</Text>
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowAvatarPicker(true)}
                activeOpacity={0.7}
              >
                <Avatar
                  type={avatarType}
                  value={avatarValue}
                  name={name || 'Student'}
                  color={Colors.student[colorTheme]}
                  size={80}
                />
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditText}>Change</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Name Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Student name"
                placeholderTextColor={Colors.ui.textLight}
              />
            </View>

            {/* Grade Picker */}
            <View style={styles.section}>
              <Text style={styles.label}>Grade</Text>
              <View style={styles.gradeGrid}>
                {GRADES.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.gradeButton,
                      grade === g && styles.gradeButtonSelected,
                    ]}
                    onPress={() => setGrade(g)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.gradeButtonText,
                        grade === g && styles.gradeButtonTextSelected,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Color Picker */}
            <View style={styles.section}>
              <Text style={styles.label}>Color Theme</Text>
              <View style={styles.colorRow}>
                {COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.name}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c.color },
                      colorTheme === c.name && styles.colorCircleSelected,
                    ]}
                    onPress={() => setColorTheme(c.name)}
                  />
                ))}
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={loading}
              >
                <Trash2 size={20} color={Colors.ui.error} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        visible={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onSelect={handleAvatarSelect}
        currentType={avatarType}
        currentValue={avatarValue}
        studentName={name || 'Student'}
      />
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
    maxWidth: 500,
    maxHeight: '90%',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.brand[500],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarEditText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: 'white',
  },
  section: {
    marginBottom: 24,
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
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gradeButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  gradeButtonSelected: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  gradeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.ui.text,
  },
  gradeButtonTextSelected: {
    color: 'white',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: Colors.ui.text,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.error,
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 52,
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
});
