import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import {
  LESSON_PHOTOS_BUCKET,
  buildReadingLogPhotoPath,
  deleteStorageObject,
  getStoragePublicUrl,
  requestImagePermission,
  uploadJpegToStorage,
} from '@/lib/photoStorage';
import { supabase } from '@/lib/supabase/client';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface BookPhotoUploadProps {
  studentId: string;
  /** Path persisted in DB when the sheet was opened (null for add). */
  committedPhotoPath: string | null;
  /** Working path while editing (may include unstaged uploads). */
  photoPath: string | null;
  onPhotoPathChange: (path: string | null) => void;
  disabled?: boolean;
}

/**
 * Single book-cover photo picker for reading log entries.
 * Reuses lesson-photos bucket; defers deleting committed paths until parent saves.
 */
export default function BookPhotoUpload({
  studentId,
  committedPhotoPath,
  photoPath,
  onPhotoPathChange,
  disabled = false,
}: BookPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [localPreviewUri, setLocalPreviewUri] = useState<string | null>(null);

  const displayUri =
    localPreviewUri ||
    (photoPath ? getStoragePublicUrl(LESSON_PHOTOS_BUCKET, photoPath) : '');

  const uploadPhoto = async (uri: string) => {
    try {
      setLocalPreviewUri(uri);
      setUploading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Not authenticated');
      }

      // Remove a prior unstaged upload from this session (not the committed DB path).
      if (photoPath && photoPath !== committedPhotoPath) {
        await deleteStorageObject(LESSON_PHOTOS_BUCKET, photoPath);
      }

      const storagePath = buildReadingLogPhotoPath(user.id, studentId);
      const actualPath = await uploadJpegToStorage(LESSON_PHOTOS_BUCKET, storagePath, uri);

      setLocalPreviewUri(null);
      onPhotoPathChange(actualPath);
    } catch (error: unknown) {
      console.error('Book photo upload failed:', error);
      setLocalPreviewUri(null);
      const message = error instanceof Error ? error.message : 'Could not upload photo';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestImagePermission('library');
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestImagePermission('camera');
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const handleRemove = () => {
    Alert.alert('Remove photo', 'Remove the book photo from this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setLocalPreviewUri(null);
          onPhotoPathChange(null);
        },
      },
    ]);
  };

  const buttonsDisabled = disabled || uploading;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Book photo</Text>

      {displayUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: displayUri }}
            style={styles.preview}
            contentFit="cover"
            transition={200}
          />
          {uploading ? (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="small" color="white" />
            </View>
          ) : null}
          {!buttonsDisabled ? (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleRemove}
              accessibilityLabel="Remove book photo"
            >
              <X size={16} color="white" />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={takePhoto}
          disabled={buttonsDisabled}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={Colors.brand[600]} />
          ) : (
            <>
              <Camera size={20} color={Colors.brand[600]} />
              <Text style={styles.uploadButtonText}>Camera</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickImage}
          disabled={buttonsDisabled}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={Colors.brand[600]} />
          ) : (
            <>
              <ImageIcon size={20} color={Colors.brand[600]} />
              <Text style={styles.uploadButtonText}>Gallery</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    ...Typography.label,
    marginBottom: 8,
  },
  previewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  preview: {
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.ui.border,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  uploadButtonText: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.brand[600],
  },
});
