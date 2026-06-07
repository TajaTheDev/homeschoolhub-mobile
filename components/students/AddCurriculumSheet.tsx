import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { uploadCurriculumTocImage } from '@/lib/curriculumTocUpload';
import type { StagedScanCurriculum } from '@/lib/lessonPlanUtils';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type AddCurriculumSheetProps = {
  visible: boolean;
  studentId: string;
  subject: string;
  onClose: () => void;
  onComplete: (staged: StagedScanCurriculum) => void;
};

export default function AddCurriculumSheet({
  visible,
  studentId,
  subject,
  onClose,
  onComplete,
}: AddCurriculumSheetProps) {
  const [curriculumName, setCurriculumName] = useState('');
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setCurriculumName('');
    setUploading(false);
  };

  const handleClose = () => {
    if (uploading) return;
    resetForm();
    onClose();
  };

  const requestPermission = async (type: 'camera' | 'library') => {
    const permission =
      type === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status === 'denied') {
      Alert.alert(
        'Permission Required',
        `Please enable ${type} access in Settings to upload photos.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    return permission.status === 'granted';
  };

  const handleImageCapture = async (type: 'camera' | 'library') => {
    const trimmedName = curriculumName.trim();
    if (!trimmedName) {
      Alert.alert('Curriculum name required', 'Enter a curriculum name before taking a photo.');
      return;
    }

    const hasPermission = await requestPermission(type);
    if (!hasPermission) return;

    const result =
      type === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: false,
            quality: 0.8,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setUploading(true);

    try {
      const tocImagePath = await uploadCurriculumTocImage(result.assets[0].uri, studentId);
      const staged: StagedScanCurriculum = {
        kind: 'scan',
        name: trimmedName,
        tocImagePath,
      };
      resetForm();
      onComplete(staged);
    } catch (error) {
      console.error('TOC upload failed:', error);
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Could not upload your photo. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add your curriculum</Text>
            <TouchableOpacity onPress={handleClose} disabled={uploading}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.fieldLabel}>Curriculum name</Text>
            <TextInput
              style={styles.input}
              value={curriculumName}
              onChangeText={setCurriculumName}
              placeholder="e.g. Saxon Math 5/4"
              placeholderTextColor={Colors.ui.textLight}
              editable={!uploading}
            />

            <View style={styles.instructionCard}>
              <Text style={styles.instructionTitle}>How to photograph your TOC</Text>
              <Text style={styles.instructionStep}>1. Open your book to the Table of Contents page</Text>
              <Text style={styles.instructionStep}>
                2. Lay it flat — good lighting, no shadows
              </Text>
              <Text style={styles.instructionStep}>
                3. Make sure all chapter or lesson titles are visible
              </Text>
              <Text style={styles.instructionStep}>
                4. If your TOC spans two pages, you will take two photos
              </Text>
            </View>

            {uploading ? (
              <View style={styles.uploadingRow}>
                <ActivityIndicator color={Colors.brand[500]} />
                <Text style={styles.uploadingText}>Uploading photo…</Text>
              </View>
            ) : (
              <>
                <Button
                  title="Take Photo"
                  onPress={() => handleImageCapture('camera')}
                  disabled={!curriculumName.trim()}
                />
                <Button
                  title="Choose from Library"
                  onPress={() => handleImageCapture('library')}
                  variant="outline"
                  disabled={!curriculumName.trim()}
                  style={styles.secondaryButton}
                />
              </>
            )}

            <Text style={styles.subjectHint}>
              For {subject} · photo uploads now; curriculum saves when you tap Save Subjects
            </Text>
          </ScrollView>
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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  sheetTitle: {
    ...Typography.h3,
    fontSize: 20,
  },
  sheetContent: {
    padding: 24,
    paddingBottom: 40,
  },
  fieldLabel: {
    ...Typography.label,
    marginBottom: 8,
    color: Colors.ui.text,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: Colors.ui.text,
    marginBottom: 16,
  },
  instructionCard: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  instructionTitle: {
    ...Typography.label,
    color: Colors.brand[700],
    marginBottom: 10,
  },
  instructionStep: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 22,
    marginBottom: 4,
  },
  secondaryButton: {
    marginTop: 12,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  uploadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  subjectHint: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
