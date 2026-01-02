import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import type { LessonPhoto } from '@/types';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PhotoGalleryModal from './PhotoGalleryModal';

interface PhotoUploadProps {
  lessonId: string;
  photos: LessonPhoto[];
  onPhotosChange: (photos: LessonPhoto[]) => void;
}

export default function PhotoUpload({ lessonId, photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);

  const requestPermission = async (type: 'camera' | 'library') => {
    const permission = type === 'camera' 
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

  const pickImage = async () => {
    const hasPermission = await requestPermission('library');
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
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      setUploading(true);
      
      console.log('=== PHOTO UPLOAD START ===');
      console.log('1. Original URI:', uri);

      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Not authenticated');
      }
      console.log('2. User ID:', user.id);

      // Convert to JPEG and resize (handles HEIC, PNG, etc.)
      console.log('3. Converting image (will convert HEIC to JPEG)...');
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false
        }
      );
      console.log('3. Converted size:', manipulated.width, 'x', manipulated.height);
      console.log('3. Converted URI:', manipulated.uri);

      // Read file as base64 using expo-file-system (better for React Native)
      console.log('4. Reading file as base64 using expo-file-system...');
      console.log('4. Manipulated URI:', manipulated.uri);
      
      const base64Data = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: 'base64' as any,
      });
      
      console.log('4. Base64 length:', base64Data.length);
      
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to read file as base64');
      }

      // Create storage path
      const timestamp = Date.now();
      const fileName = `${user.id}/${lessonId}/${timestamp}.jpg`;
      console.log('5. Storage path:', fileName);

      // Upload to Supabase Storage - convert base64 to ArrayBuffer for React Native
      console.log('6. Uploading to storage...');
      console.log('6. File name:', fileName);
      console.log('6. Base64 data length:', base64Data.length);
      
      // Convert base64 to ArrayBuffer (React Native compatible way)
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      console.log('6. ArrayBuffer length:', bytes.length, 'bytes');
      
      // Upload the ArrayBuffer directly
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lesson-photos')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('6. Upload error:', uploadError);
        throw uploadError;
      }
      console.log('6. Upload success:', uploadData.path);

      // Get public URL to verify
      const { data: urlData } = supabase.storage
        .from('lesson-photos')
        .getPublicUrl(fileName);
      console.log('7. Public URL:', urlData.publicUrl);

      // Save to database - use uploadData.path (this is what was actually created)
      console.log('8. Saving to database...');
      console.log('8. uploadData:', JSON.stringify(uploadData, null, 2));
      const actualStoragePath = uploadData?.path || fileName;
      console.log('8. fileName we tried:', fileName);
      console.log('8. uploadData.path (actual):', uploadData?.path);
      console.log('8. Using storage path:', actualStoragePath);
      
      const { data: photoData, error: dbError } = await supabase
        .from('lesson_photos')
        .insert({
          lesson_id: lessonId,
          storage_path: actualStoragePath,
        })
        .select()
        .single();

      if (dbError) {
        console.error('8. Database error:', dbError);
        throw dbError;
      }
      console.log('8. Database save success:', photoData.id);
      console.log('8. Saved storage_path in DB:', photoData.storage_path);
      
      // Verify the URL works
      const { data: verifyUrl } = supabase.storage
        .from('lesson-photos')
        .getPublicUrl(actualStoragePath);
      console.log('8. Final verified URL:', verifyUrl.publicUrl);
      
      // Also try listing files to see what's actually in storage
      const { data: listData } = await supabase.storage
        .from('lesson-photos')
        .list(`${user.id}/${lessonId}`, { limit: 10 });
      console.log('8. Files actually in storage:', listData?.map(f => f.name));

      // Update local state
      onPhotosChange([...photos, photoData]);
      
      console.log('=== PHOTO UPLOAD SUCCESS ===');
      Alert.alert('Success', 'Photo uploaded!');
      
    } catch (error: any) {
      console.error('=== PHOTO UPLOAD FAILED ===');
      console.error('Error:', error);
      console.error('Message:', error.message);
      
      Alert.alert(
        'Upload Failed',
        error.message || 'Could not upload photo. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo: LessonPhoto) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from storage
              const { error: storageError } = await supabase.storage
                .from('lesson-photos')
                .remove([photo.storage_path]);

              if (storageError) {
                console.error('Storage delete error:', storageError);
              }

              // Delete from database
              const { error: dbError } = await supabase
                .from('lesson_photos')
                .delete()
                .eq('id', photo.id);

              if (dbError) throw dbError;

              // Update local state
              onPhotosChange(photos.filter(p => p.id !== photo.id));
              
            } catch (error: any) {
              console.error('Delete error:', error);
              Alert.alert('Delete Failed', error.message);
            }
          },
        },
      ]
    );
  };

  const getPhotoUrl = (path: string) => {
    if (!path) {
      console.warn('getPhotoUrl: path is empty');
      return '';
    }
    
    // Clean the path - remove leading/trailing slashes and any extra whitespace
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }
    if (cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    // URL encode the path to handle special characters
    const encodedPath = encodeURIComponent(cleanPath).replace(/%2F/g, '/');
    
    console.log('getPhotoUrl input:', { 
      originalPath: path, 
      cleanPath,
      encodedPath 
    });
    
    const { data } = supabase.storage
      .from('lesson-photos')
      .getPublicUrl(cleanPath);
    const url = data.publicUrl;
    
    console.log('getPhotoUrl result:', { 
      originalPath: path, 
      cleanPath, 
      encodedPath,
      generatedUrl: url,
      urlLength: url?.length
    });
    
    // Validate URL format
    if (!url || !url.startsWith('http')) {
      console.error('⚠️ Invalid URL generated:', url);
    }
    
    return url;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos</Text>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.photoScroll}
        >
          {photos.map((photo, index) => {
            const photoUrl = getPhotoUrl(photo.storage_path);
            console.log('Displaying photo:', {
              id: photo.id,
              storage_path: photo.storage_path,
              photoUrl: photoUrl,
            });
            
            // Verify URL is valid before rendering
            if (!photoUrl || photoUrl.trim() === '') {
              console.warn('⚠️ Empty URL for photo:', photo.id, photo.storage_path);
              return null;
            }
            
            return (
              <View key={photo.id} style={styles.photoContainer}>
                <TouchableOpacity
                  onPress={() => {
                    setGalleryStartIndex(index);
                    setShowGallery(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: photoUrl }}
                    style={styles.photo}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory"
                    recyclingKey={photo.id}
                    onError={(error) => {
                      console.error('❌ Image load error for photo:', photo.id);
                      console.error('Error details:', JSON.stringify(error, null, 2));
                      console.error('Failed URL (full):', photoUrl);
                      console.error('Storage path:', photo.storage_path);
                      console.error('Full URL length:', photoUrl.length);
                      console.error('URL starts with http?:', photoUrl.startsWith('http'));
                      // Try to verify the URL is accessible
                      fetch(photoUrl, { method: 'HEAD' })
                        .then(response => {
                          console.log('URL fetch test - Status:', response.status);
                          console.log('URL fetch test - Headers:', Object.fromEntries(response.headers.entries()));
                          if (!response.ok) {
                            console.error('URL is not accessible - HTTP status:', response.status);
                          }
                        })
                        .catch(fetchError => {
                          console.error('URL fetch test failed:', fetchError);
                        });
                    }}
                    onLoad={() => {
                      console.log('✅ Image loaded successfully:', photoUrl);
                    }}
                    onLoadStart={() => {
                      console.log('🔄 Image load started:', photoUrl.substring(0, 60) + '...');
                    }}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePhoto(photo)}
                >
                  <X size={16} color="white" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Upload Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={takePhoto}
          disabled={uploading}
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
          disabled={uploading}
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

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        visible={showGallery}
        onClose={() => setShowGallery(false)}
        photos={photos}
        initialIndex={galleryStartIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    ...Typography.label,
    marginBottom: 12,
  },
  photoScroll: {
    marginBottom: 12,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  deleteButton: {
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
