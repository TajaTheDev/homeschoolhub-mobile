import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { LessonPhoto } from '@/types/database';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface PhotoUploadProps {
  lessonId: string;
  photos: LessonPhoto[];
  onPhotosChange: (photos: LessonPhoto[]) => void;
}

export default function PhotoUpload({ lessonId, photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status === 'denied') {
      Alert.alert(
        'Photo Access Required',
        'HomeschoolHub needs access to your photos to attach images to lessons.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status === 'denied') {
      Alert.alert(
        'Camera Access Required',
        'HomeschoolHub needs camera access to take photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      setUploading(true);
      
      console.log('=== UPLOAD START ===');
      console.log('1. Original URI:', uri);

      // Check authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('2. User ID:', user?.id);
      console.log('2. User error:', userError);
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Convert to JPEG
      console.log('3. Converting image...');
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { 
          compress: 0.8, 
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      console.log('3. Converted URI:', manipulatedImage.uri);
      console.log('3. Converted width:', manipulatedImage.width);
      console.log('3. Converted height:', manipulatedImage.height);

      // Read as blob
      console.log('4. Fetching blob...');
      const response = await fetch(manipulatedImage.uri);
      const blob = await response.blob();
      console.log('4. Blob type:', blob.type);
      console.log('4. Blob size:', blob.size, 'bytes');
      
      // Create file path
      const timestamp = Date.now();
      const fileName = `${user.id}/${lessonId}/${timestamp}.jpg`;
      console.log('5. Upload path:', fileName);
      console.log('5. Bucket:', 'student-avatars');
      
      // UPLOAD TO STORAGE
      console.log('6. Starting upload...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('student-avatars')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      console.log('6. Upload data:', uploadData);
      console.log('6. Upload error:', uploadError);
      
      if (uploadError) {
        console.error('❌ UPLOAD FAILED:', uploadError.message);
        console.error('Error code:', (uploadError as any).statusCode);
        console.error('Error details:', JSON.stringify(uploadError, null, 2));
        throw uploadError;
      }
      
      console.log('✅ Upload successful!');
      
      // Verify file exists
      console.log('7. Verifying file exists...');
      const { data: fileCheck, error: checkError } = await supabase.storage
        .from('student-avatars')
        .list(fileName.split('/').slice(0, -1).join('/'));
      
      console.log('7. Files in folder:', fileCheck);
      console.log('7. Check error:', checkError);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('student-avatars')
        .getPublicUrl(fileName);
      console.log('8. Public URL:', urlData.publicUrl);

      // Save to database
      console.log('9. Saving to database...');
      const { data: photoData, error: dbError } = await supabase
        .from('lesson_photos')
        .insert({
          lesson_id: lessonId,
          photo_path: fileName,
        })
        .select()
        .single();

      console.log('9. DB save result:', photoData);
      console.log('9. DB error:', dbError);

      if (dbError) throw dbError;

      onPhotosChange([...photos, photoData]);
      
      console.log('=== UPLOAD COMPLETE ===');
      Alert.alert('Success', 'Photo uploaded!');
    } catch (error: any) {
      console.error('=== UPLOAD FAILED ===');
      console.error('Error:', error);
      console.error('Message:', error.message);
      console.error('Status:', error.statusCode || error.status);
      console.error('Full error:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Upload failed', 
        error.message || 'Please try again'
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
                .from('student-avatars')
                .remove([photo.photo_path]);

              if (storageError) throw storageError;

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
              Alert.alert('Delete failed', error.message);
            }
          },
        },
      ]
    );
  };

  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    return `https://cmfqthzlzqijadltnljb.supabase.co/storage/v1/object/public/student-avatars/${path}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Photos</Text>
      
      {/* DEBUG INFO - Remove after fixing */}
      {photos.length > 0 && (
        <View style={{ backgroundColor: '#f0f0f0', padding: 10, marginBottom: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Courier' }}>
            Photo Count: {photos.length}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Courier', marginTop: 4 }}>
            ID: {photos[0].id}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Courier', marginTop: 4 }}>
            Lesson ID: {photos[0].lesson_id}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Courier', marginTop: 4 }}>
            Path: {photos[0].photo_path}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: 'Courier', marginTop: 4 }}>
            Full URL: {getPhotoUrl(photos[0].photo_path)}
          </Text>
        </View>
      )}
      
      {/* Photo Grid */}
      {photos.length > 0 && (
        <View style={styles.photoGrid}>
          {photos.map((photo) => {
            const photoUrl = `https://cmfqthzlzqijadltnljb.supabase.co/storage/v1/object/public/student-avatars/${photo.photo_path}`;
            
            console.log('Rendering photo:', photo.id);
            console.log('Photo URL:', photoUrl);
            
            return (
              <View key={photo.id} style={styles.photoContainer}>
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                  onLoadStart={() => console.log('⏳ Loading:', photoUrl)}
                  onLoad={() => console.log('✅ Loaded:', photoUrl)}
                  onError={(e) => {
                    console.error('❌ Error loading:', photoUrl);
                    console.error('Error details:', e.nativeEvent.error);
                  }}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePhoto(photo)}
                >
                  <X size={16} color="white" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
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

      {/* Test Button - Temporary for debugging */}
      <TouchableOpacity
        style={[styles.uploadButton, { backgroundColor: Colors.secondary[100], marginTop: 8 }]}
        onPress={() => {
          if (photos.length > 0) {
            const testUrl = getPhotoUrl(photos[0].photo_path);
            Alert.alert('Test URL', testUrl);
            console.log('Test photo URL:', testUrl);
          } else {
            Alert.alert('No photos', 'Upload a photo first');
          }
        }}
      >
        <Text style={styles.uploadButtonText}>Test Photo URL</Text>
      </TouchableOpacity>
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    backgroundColor: Colors.ui.border,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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

