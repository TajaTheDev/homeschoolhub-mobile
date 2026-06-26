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

interface OptimisticPhoto extends LessonPhoto {
  localUri?: string;
  uploading?: boolean;
  uploadError?: boolean;
}

export default function PhotoUpload({ lessonId, photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [optimisticPhotos, setOptimisticPhotos] = useState<OptimisticPhoto[]>([]);

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
    const tempId = `temp-${Date.now()}`;
    
    try {
      // STEP 1: Show optimistic preview immediately with local URI
      const optimisticPhoto: OptimisticPhoto = {
        id: tempId,
        lesson_id: lessonId,
        storage_path: '', // Will be filled after upload
        photo_path: '',
        localUri: uri,
        uploading: true,
        uploadError: false,
        created_at: new Date().toISOString(),
      };
      
      // Update photos immediately with local URI preview
      const currentPhotos = [...photos, optimisticPhoto];
      onPhotosChange(currentPhotos);
      setOptimisticPhotos(prev => [...prev, optimisticPhoto]);
      
            // STEP 2: Get user (non-blocking, quick check)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Not authenticated');
      }

      // STEP 3: Compress full image for upload (background operation)
            const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Full size but reasonable
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG,
          base64: false
        }
      );

      // STEP 5: Upload in background (don't block UI)
      setUploading(true);
      
      // Create storage path
      const timestamp = Date.now();
      const fileName = `${user.id}/${lessonId}/${timestamp}.jpg`;
      
      // Read compressed image as base64
      const base64Data = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: 'base64' as any,
      });
      
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to read file');
      }

      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Upload to storage (background operation)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lesson-photos')
        .upload(fileName, bytes.buffer, {
          contentType: 'image/jpeg',
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw uploadError;
      }

      const actualStoragePath = uploadData?.path || fileName;
      
      // Save to database
      const { data: photoData, error: dbError } = await supabase
        .from('lesson_photos')
        .insert({
          lesson_id: lessonId,
          storage_path: actualStoragePath,
        })
        .select()
        .single();

      if (dbError) {
        throw dbError;
      }

      // STEP 6: Replace optimistic photo with real data
      const updatedPhotos = photos.filter(p => p.id !== tempId);
      onPhotosChange([...updatedPhotos, photoData]);
      setOptimisticPhotos(prev => prev.filter(p => p.id !== tempId));
      
            
    } catch (error: any) {
      console.error('❌ Photo upload failed:', error);
      
      // STEP 7: Mark optimistic photo as error (but keep showing it)
      const updatedOptimistic = optimisticPhotos.map(p => 
        p.id === tempId ? { ...p, uploading: false, uploadError: true } : p
      );
      setOptimisticPhotos(updatedOptimistic);
      
      // Update main photos array to show error state
      const updatedPhotos = photos.map(p => 
        p.id === tempId ? { ...p, uploading: false, uploadError: true } : p
      );
      onPhotosChange(updatedPhotos);
      
      Alert.alert(
        'Upload Failed',
        error.message || 'Could not upload photo. The preview will remain visible. You can retry or delete it.',
        [
          { text: 'OK' },
          {
            text: 'Retry',
            onPress: () => {
              // Remove failed photo and retry
              onPhotosChange(photos.filter(p => p.id !== tempId));
              setOptimisticPhotos(prev => prev.filter(p => p.id !== tempId));
              uploadPhoto(uri);
            }
          },
        ]
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
              // If it's an optimistic photo (uploading or temp), just remove it
              const optimisticPhoto = optimisticPhotos.find(p => p.id === photo.id);
              if (optimisticPhoto && (!photo.storage_path || photo.id.startsWith('temp-'))) {
                onPhotosChange(photos.filter(p => p.id !== photo.id));
                setOptimisticPhotos(prev => prev.filter(p => p.id !== photo.id));
                return;
              }

              // Delete from storage (only if it has a storage path)
              if (photo.storage_path) {
                const { error: storageError } = await supabase.storage
                  .from('lesson-photos')
                  .remove([photo.storage_path]);

                if (storageError) {
                  console.error('Storage delete error:', storageError);
                }
              }

              // Delete from database (only if it has a real ID)
              if (!photo.id.startsWith('temp-')) {
                const { error: dbError } = await supabase
                  .from('lesson_photos')
                  .delete()
                  .eq('id', photo.id);

                if (dbError) throw dbError;
              }

              // Update local state
              onPhotosChange(photos.filter(p => p.id !== photo.id));
              setOptimisticPhotos(prev => prev.filter(p => p.id !== photo.id));
              
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
    
        
    const { data } = supabase.storage
      .from('lesson-photos')
      .getPublicUrl(cleanPath);
    const url = data.publicUrl;
    
        
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
            // Use local URI for optimistic preview if available, otherwise use uploaded URL
            const optimisticPhoto = optimisticPhotos.find(p => p.id === photo.id);
            const photoUri = optimisticPhoto?.localUri || (photo.storage_path ? getPhotoUrl(photo.storage_path) : '');
            const isUploading = optimisticPhoto?.uploading || false;
            const hasError = optimisticPhoto?.uploadError || false;
            
            // Verify URI is valid before rendering
            if (!photoUri || photoUri.trim() === '') {
              return null;
            }
            
            return (
              <View key={photo.id} style={styles.photoContainer}>
                <TouchableOpacity
                  onPress={() => {
                    // Don't open gallery if still uploading or if no storage path yet
                    if (!isUploading && photo.storage_path) {
                      setGalleryStartIndex(index);
                      setShowGallery(true);
                    }
                  }}
                  activeOpacity={isUploading ? 0.5 : 0.8}
                  disabled={isUploading}
                >
                  <Image
                    source={{ uri: photoUri }}
                    style={[styles.photo, (isUploading || hasError) && styles.photoUploading]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk" // Better caching
                    recyclingKey={photo.id}
                    priority="high" // High priority for visible images
                  />
                  
                  {/* Uploading overlay */}
                  {isUploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.uploadingText}>Uploading...</Text>
                    </View>
                  )}
                  
                  {/* Error overlay */}
                  {hasError && (
                    <View style={styles.errorOverlay}>
                      <Text style={styles.errorText}>Failed</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePhoto(photo)}
                  disabled={isUploading}
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
  photoUploading: {
    opacity: 0.7,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
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
