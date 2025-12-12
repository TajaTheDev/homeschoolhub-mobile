import { AVATAR_ILLUSTRATIONS } from '@/constants/Avatars';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface AvatarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: 'initial' | 'photo' | 'illustration', value?: string) => void;
  currentType: 'initial' | 'photo' | 'illustration';
  currentValue?: string | null;
  studentName: string;
}

export default function AvatarPicker({
  visible,
  onClose,
  onSelect,
  currentType,
  currentValue,
  studentName,
}: AvatarPickerProps) {
  const [uploading, setUploading] = useState(false);
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

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      setUploading(true);

      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create file name with timestamp
      const timestamp = Date.now();
      const fileName = `${user.id}/${timestamp}.jpg`;

      // For React Native, we need to use FormData
      const formData = new FormData();
      
      // @ts-ignore - React Native FormData accepts this
      formData.append('file', {
        uri: uri,
        type: 'image/jpeg',
        name: `${timestamp}.jpg`,
      });

      // Upload using the REST API approach
      const { data, error: uploadError } = await supabase.storage
        .from('student-avatars')
        .upload(fileName, formData, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      // Return the file path
      onSelect('photo', fileName);
      onClose();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Upload failed', 
        error.message || 'Could not upload photo. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          style={[
            styles.modalContent,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Avatar</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.ui.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Photo Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload Photo</Text>
              <View style={styles.photoButtons}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={takePhoto}
                  disabled={uploading}
                >
                  <Camera size={24} color={Colors.brand[500]} />
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={pickImage}
                  disabled={uploading}
                >
                  <ImageIcon size={24} color={Colors.brand[500]} />
                  <Text style={styles.photoButtonText}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Illustration Options */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Character</Text>
              <View style={styles.illustrationsGrid}>
                {AVATAR_ILLUSTRATIONS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.illustrationOption,
                      currentType === 'illustration' &&
                        currentValue === avatar.id &&
                        styles.illustrationOptionSelected,
                    ]}
                    onPress={() => {
                      onSelect('illustration', avatar.id);
                      onClose();
                    }}
                  >
                    <Text style={styles.illustrationEmoji}>{avatar.emoji}</Text>
                    <Text style={styles.illustrationName}>{avatar.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Use Initials */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[
                  styles.initialsButton,
                  currentType === 'initial' && styles.initialsButtonSelected,
                ]}
                onPress={() => {
                  onSelect('initial');
                  onClose();
                }}
              >
                <Text style={styles.initialsButtonText}>Use Initials ({studentName.substring(0, 2).toUpperCase()})</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  title: {
    ...Typography.h3,
  },
  closeButton: {
    padding: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  photoButtonText: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  illustrationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  illustrationOption: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: Colors.ui.background,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  illustrationOptionSelected: {
    borderColor: Colors.brand[500],
    backgroundColor: Colors.brand[50],
  },
  illustrationEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  illustrationName: {
    ...Typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  initialsButton: {
    paddingVertical: 16,
    backgroundColor: Colors.ui.background,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  initialsButtonSelected: {
    borderColor: Colors.brand[500],
    backgroundColor: Colors.brand[50],
  },
  initialsButtonText: {
    ...Typography.button,
    color: Colors.brand[600],
  },
});

