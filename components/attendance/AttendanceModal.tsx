import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  InputAccessoryView,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { format } from 'date-fns';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { useAttendanceStore } from '@/store/attendanceStore';

interface AttendanceModalProps {
  visible: boolean;
  date?: Date;
  onClose: () => void;
  onSave: () => void;
}

export default function AttendanceModal({
  visible,
  date = new Date(),
  onClose,
  onSave,
}: AttendanceModalProps) {
  const { students } = useStudentStore();
  const { getAttendanceForDate, markAttendance } = useAttendanceStore();
  
  const dateString = format(date, 'yyyy-MM-dd');
  
  // State: which students are present (array of student IDs)
  const [presentStudentIds, setPresentStudentIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Load existing attendance when modal opens
  useEffect(() => {
    if (visible) {
      const existingAttendance = getAttendanceForDate(dateString);
      
      if (existingAttendance.length > 0) {
        // Load who was present
        const presentIds = existingAttendance
          .filter(a => a.present)
          .map(a => a.student_id);
        
        setPresentStudentIds(presentIds);
        
        // Load notes if any
        const firstNote = existingAttendance.find(a => a.notes);
        if (firstNote?.notes) {
          setNotes(firstNote.notes);
        }
      } else {
        // Default: all students present
        setPresentStudentIds(students.map(s => s.id));
        setNotes('');
      }
    }
  }, [visible, dateString]);
  
  // Toggle student present/absent
  const toggleStudent = (studentId: string) => {
    if (presentStudentIds.includes(studentId)) {
      // Remove from present list (mark absent)
      setPresentStudentIds(presentStudentIds.filter(id => id !== studentId));
    } else {
      // Add to present list (mark present)
      setPresentStudentIds([...presentStudentIds, studentId]);
    }
  };
  
  // Save attendance
  const handleSave = async () => {
    try {
      setLoading(true);
      
      console.log('💾 ATTENDANCE SAVE DEBUG:');
      console.log('  Date:', dateString);
      console.log('  Present student IDs:', presentStudentIds);
      console.log('  Total students:', students.length);
      console.log('  Present count:', presentStudentIds.length);
      console.log('  Absent count:', students.length - presentStudentIds.length);
      
      // Show who is present vs absent
      students.forEach(student => {
        const isPresent = presentStudentIds.includes(student.id);
        console.log(`  ${isPresent ? '✓' : '✗'} ${student.name}: ${isPresent ? 'PRESENT' : 'ABSENT'}`);
      });
      
      const result = await markAttendance(dateString, presentStudentIds, notes);
      
      console.log('💾 Save result:', result);
      
      if (result.success) {
        Alert.alert('Success! ✅', 'Attendance saved');
        onSave();
        onClose();
      } else {
        Alert.alert('Error', result.error || 'Failed to save attendance');
      }
    } catch (error) {
      console.error('❌ Error saving attendance:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Take Attendance</Text>
              <Text style={styles.subtitle}>
                {format(date, 'EEEE, MMMM d, yyyy')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>
          
          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>Tap to mark attendance</Text>
          </View>
          
          {/* Student List */}
          <ScrollView 
            style={styles.studentList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {students.map((student) => {
              const isPresent = presentStudentIds.includes(student.id);
              
              return (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.studentCard,
                    isPresent ? styles.studentCardPresent : styles.studentCardAbsent
                  ]}
                  onPress={() => toggleStudent(student.id)}
                  activeOpacity={0.7}
                >
                  {/* Checkbox */}
                  <View style={[
                    styles.checkbox,
                    isPresent && styles.checkboxChecked
                  ]}>
                    {isPresent && (
                      <Check size={18} color="white" strokeWidth={3} />
                    )}
                  </View>
                  
                  {/* Student Info */}
                  <View style={styles.studentInfo}>
                    <Text style={[
                      styles.studentName,
                      !isPresent && styles.studentNameAbsent
                    ]}>
                      {student.name}
                    </Text>
                    {student.grade && (
                      <Text style={styles.studentGrade}>
                        {student.grade}
                      </Text>
                    )}
                  </View>
                  
                  {/* Status Badge */}
                  <View style={[
                    styles.statusBadge,
                    isPresent ? styles.statusBadgePresent : styles.statusBadgeAbsent
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      isPresent ? styles.statusBadgeTextPresent : styles.statusBadgeTextAbsent
                    ]}>
                      {isPresent ? 'Present' : 'Absent'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          
          {/* Keyboard toolbar for iOS */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID="notesToolbar">
              <View style={styles.keyboardToolbar}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => Keyboard.dismiss()}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </InputAccessoryView>
          )}

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Field trip, sick day, etc."
              placeholderTextColor={Colors.ui.textLight}
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
              inputAccessoryViewID={Platform.OS === 'ios' ? 'notesToolbar' : undefined}
            />
          </View>
          
          {/* Summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {presentStudentIds.length} of {students.length} present
            </Text>
          </View>
          
          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : 'Save Attendance'}
            </Text>
          </TouchableOpacity>
        </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
    flexShrink: 0,  // ← Add this - prevents header from shrinking
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  instructions: {
    backgroundColor: Colors.brand[50],
    paddingVertical: 8,  // ← Reduced from 12
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginTop: 12,  // ← Reduced from 16
    marginBottom: 8,  // ← Add small bottom margin
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    flexShrink: 0,  // ← Add this
  },
  instructionsText: {
    fontSize: 13,  // ← Reduced from 14
    color: Colors.brand[700],
    textAlign: 'center',
    fontWeight: '500',
  },
  studentList: {
    paddingHorizontal: 20,
    paddingTop: 8,  // ← Reduced top padding
    maxHeight: 500,  // ← Increased from 400
    flexGrow: 1,  // ← Allow it to grow
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,  // ← Reduced from 16
    borderRadius: 12,
    marginBottom: 10,  // ← Reduced from 12
    borderWidth: 2,
  },
  studentCardPresent: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  studentCardAbsent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  studentNameAbsent: {
    color: Colors.ui.textLight,
    textDecorationLine: 'line-through',
  },
  studentGrade: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statusBadgePresent: {
    backgroundColor: '#10B981',
  },
  statusBadgeAbsent: {
    backgroundColor: '#EF4444',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadgeTextPresent: {
    color: 'white',
  },
  statusBadgeTextAbsent: {
    color: 'white',
  },
  notesSection: {
    paddingHorizontal: 20,
    marginTop: 8,  // ← Reduced from 16
    marginBottom: 160,  // ← Reduced from 200
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 10,
    padding: 10,  // ← Reduced from 12
    fontSize: 14,  // ← Reduced from 15
    color: Colors.ui.text,
    minHeight: 50,  // ← Reduced from 60
    textAlignVertical: 'top',
  },
  keyboardToolbar: {
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  summary: {
    backgroundColor: Colors.brand[50],
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  saveButton: {
    backgroundColor: Colors.brand[500],
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'white',
  },
});

