import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Text,
  Alert,
} from 'react-native';
import { X, ChevronLeft, ChevronRight, Trash2, Share2 } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Colors from '@/constants/Colors';

interface PhotoGalleryProps {
  visible: boolean;
  photos: string[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (photoUrl: string) => void;
}

export default function PhotoGallery({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  onDelete,
}: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  const handlePrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };
  
  const handleShare = async () => {
    try {
      const currentPhoto = photos[currentIndex];
      
      console.log('📤 Sharing photo:', currentPhoto.substring(0, 60));
      
      // Download the photo to local storage first
      const filename = currentPhoto.split('/').pop() || `photo_${Date.now()}.jpg`;
      const localUri = FileSystem.documentDirectory + filename;
      
      console.log('⬇️ Downloading to:', localUri);
      
      const downloadResult = await FileSystem.downloadAsync(currentPhoto, localUri);
      
      console.log('✅ Downloaded:', downloadResult.uri);
      
      // Now share the local file
      const canShare = await Sharing.isAvailableAsync();
      
      if (canShare) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Share Photo',
        });
        
        console.log('✅ Share completed');
      } else {
        Alert.alert('Sharing not available', 'Unable to share on this device');
      }
    } catch (error: any) {
      console.error('❌ Share error:', error);
      Alert.alert('Error', 'Failed to share photo: ' + error.message);
    }
  };
  
  const handleDelete = () => {
    if (!onDelete) return;
    
    Alert.alert(
      'Delete Photo?',
      'This photo will be permanently removed from this lesson.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const photoToDelete = photos[currentIndex];
            onDelete(photoToDelete);
            
            if (photos.length === 1) {
              onClose();
            } else {
              setCurrentIndex(prev => prev > 0 ? prev - 1 : 0);
            }
          }
        }
      ]
    );
  };
  
  if (!visible || photos.length === 0) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          
          <View style={styles.headerActions}>
            {onDelete && (
              <TouchableOpacity 
                style={styles.iconButton}
                onPress={handleDelete}
              >
                <View style={styles.iconCircle}>
                  <Trash2 size={20} color="white" />
                </View>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleShare}
            >
              <View style={styles.iconCircle}>
                <Share2 size={20} color="white" />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={onClose}
            >
              <View style={styles.iconCircle}>
                <X size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Main Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: photos[currentIndex] }}
            style={styles.image}
            resizeMode="contain"
          />
          
          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={handlePrevious}
              >
                <ChevronLeft size={32} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.navButton, styles.navButtonRight]}
                onPress={handleNext}
              >
                <ChevronRight size={32} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
        
        {/* Thumbnail Strip */}
        {photos.length > 1 && (
          <View style={styles.thumbnailContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailScroll}
            >
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentIndex(index)}
                  style={[
                    styles.thumbnail,
                    currentIndex === index && styles.thumbnailActive
                  ]}
                >
                  <Image
                    source={{ uri: photo }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',  // Solid black
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  counter: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: 'black',  // Ensure black background
  },
  image: {
    width: '100%',
    height: '100%',
    maxWidth: Dimensions.get('window').width,
    maxHeight: Dimensions.get('window').height - 180,
  },
  navButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 24,
    padding: 8,
    top: '50%',
    marginTop: -24,
  },
  navButtonLeft: {
    left: 16,
  },
  navButtonRight: {
    right: 16,
  },
  thumbnailContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  thumbnailScroll: {
    gap: 8,
    paddingHorizontal: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: Colors.brand[500],
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});
