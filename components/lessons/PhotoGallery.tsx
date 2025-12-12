import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { LessonPhoto } from '@/types/database';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoGalleryProps {
  visible: boolean;
  onClose: () => void;
  photos: LessonPhoto[];
  initialIndex?: number;
}

export default function PhotoGallery({
  visible,
  onClose,
  photos,
  initialIndex = 0,
}: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage
      .from('student-avatars')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  if (photos.length === 0) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.counter}>
            {currentIndex + 1} / {photos.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Main Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: getPhotoUrl(photos[currentIndex].photo_path) }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Navigation Buttons */}
        {photos.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonLeft]}
              onPress={goToPrevious}
            >
              <ChevronLeft size={32} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, styles.navButtonRight]}
              onPress={goToNext}
            >
              <ChevronRight size={32} color="white" />
            </TouchableOpacity>
          </>
        )}

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
                  key={photo.id}
                  onPress={() => setCurrentIndex(index)}
                  style={[
                    styles.thumbnail,
                    currentIndex === index && styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{ uri: getPhotoUrl(photo.photo_path) }}
                    style={styles.thumbnailImage}
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
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  counter: {
    ...Typography.label,
    color: 'white',
    fontSize: 16,
  },
  closeButton: {
    padding: 4,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  thumbnailContainer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumbnailScroll: {
    paddingHorizontal: 20,
    gap: 12,
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
    borderColor: Colors.brand[400],
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
});

