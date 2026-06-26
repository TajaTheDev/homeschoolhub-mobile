/**
 * Shared image upload helpers for lesson-photos bucket.
 * Used by reading log book photos; lesson PhotoUpload keeps its own inline logic in v1.
 */

import { supabase } from '@/lib/supabase/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export const LESSON_PHOTOS_BUCKET = 'lesson-photos';

/**
 * Normalizes a storage object path (trim slashes).
 */
export function cleanStoragePath(path: string): string {
  let cleanPath = path.trim();
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }
  if (cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  return cleanPath;
}

/**
 * Returns the public URL for an object in Supabase storage.
 */
export function getStoragePublicUrl(bucket: string, path: string): string {
  if (!path) {
    return '';
  }

  const cleanPath = cleanStoragePath(path);
  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return data.publicUrl ?? '';
}

/**
 * Builds a reading-log photo path with userId as the first segment (storage RLS).
 */
export function buildReadingLogPhotoPath(userId: string, studentId: string): string {
  return `${userId}/reading-log/${studentId}/${Date.now()}.jpg`;
}

/**
 * Requests camera or photo-library permission; opens Settings if denied.
 */
export async function requestImagePermission(type: 'camera' | 'library'): Promise<boolean> {
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
}

/**
 * Compresses a local image for upload (max width 1200px, JPEG 0.8).
 */
export async function compressImageForUpload(localUri: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  return manipulated.uri;
}

/**
 * Uploads a local JPEG to Supabase storage; returns the stored path.
 */
export async function uploadJpegToStorage(
  bucket: string,
  storagePath: string,
  localUri: string
): Promise<string> {
  const compressedUri = await compressImageForUpload(localUri);
  const base64Data = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: 'base64' as const,
  });

  if (!base64Data || base64Data.length === 0) {
    throw new Error('Failed to read file');
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { data, error } = await supabase.storage.from(bucket).upload(storagePath, bytes.buffer, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    throw error;
  }

  return data?.path ?? storagePath;
}

/**
 * Deletes a storage object; logs errors without throwing.
 */
export async function deleteStorageObject(bucket: string, storagePath: string): Promise<void> {
  if (!storagePath) {
    return;
  }

  try {
    const cleanPath = cleanStoragePath(storagePath);
    const { error } = await supabase.storage.from(bucket).remove([cleanPath]);

    if (error) {
      console.error('Storage delete error:', error);
    }
  } catch (error) {
    console.error('Storage delete threw:', error);
  }
}
