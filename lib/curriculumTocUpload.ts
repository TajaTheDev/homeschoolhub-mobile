/**
 * Uploads a curriculum table-of-contents photo to Supabase Storage.
 */

import { supabase } from '@/lib/supabase/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const TOC_BUCKET = 'curriculum-toc';

/**
 * Compresses and uploads a TOC image. Returns the storage path on success.
 */
export async function uploadCurriculumTocImage(
  localUri: string,
  studentId: string
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Not authenticated');
  }

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  const timestamp = Date.now();
  const storagePath = `${studentId}/${timestamp}.jpg`;

  const base64Data = await FileSystem.readAsStringAsync(manipulated.uri, {
    encoding: 'base64' as any,
  });

  if (!base64Data) {
    throw new Error('Failed to read image file');
  }

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(TOC_BUCKET)
    .upload(storagePath, bytes.buffer, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw uploadError;
  }

  return uploadData?.path ?? storagePath;
}
