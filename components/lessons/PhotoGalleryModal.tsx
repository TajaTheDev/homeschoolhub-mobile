import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import { LessonPhoto } from '@/types/database';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PhotoGalleryModalProps {
  visible: boolean;
  onClose: () => void;
  photos: LessonPhoto[];
  initialIndex?: number;
}

export default function PhotoGalleryModal({
  visible,
  onClose,
  photos,
  initialIndex = 0,
}: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Update current index when initialIndex changes (e.g., when opening with a different photo)
  useEffect(() => {
    if (visible && initialIndex >= 0 && photos.length > 0 && initialIndex < photos.length) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex, photos.length]);

  // Safety check: ensure currentIndex is valid when photos array changes
  useEffect(() => {
    if (photos.length > 0 && (currentIndex < 0 || currentIndex >= photos.length)) {
      setCurrentIndex(0);
    }
  }, [photos.length, currentIndex]);

  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    
    // Clean the path - remove leading/trailing slashes
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }
    if (cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }
    
    const { data } = supabase.storage
      .from('lesson-photos')
      .getPublicUrl(cleanPath);
    return data.publicUrl;
  };

  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Helper functions that will be called from gesture handler
  const handleSwipeNext = useCallback(() => {
    try {
      setCurrentIndex((prev) => {
        const maxIndex = photos.length > 0 ? photos.length - 1 : 0;
        if (prev < maxIndex) {
          return prev + 1;
        }
        return prev;
      });
    } catch (error) {
      console.error('Error in handleSwipeNext:', error);
    }
  }, [photos.length]);

  const handleSwipePrevious = useCallback(() => {
    try {
      setCurrentIndex((prev) => {
        if (prev > 0) {
          return prev - 1;
        }
        return prev;
      });
    } catch (error) {
      console.error('Error in handleSwipePrevious:', error);
    }
  }, []);

  // Swipe gesture for navigation
  const swipeGesture = useMemo(
    () => {
      if (photos.length <= 1) {
        // Return a no-op gesture if there's only one or no photos
        return Gesture.Pan().enabled(false);
      }
      
      return Gesture.Pan()
        .minDistance(10) // Minimum distance before gesture activates
        .onEnd((event) => {
          try {
            const swipeThreshold = 50;
            if (event.translationX < -swipeThreshold) {
              // Swipe left = next photo
              runOnJS(handleSwipeNext)();
            } else if (event.translationX > swipeThreshold) {
              // Swipe right = previous photo
              runOnJS(handleSwipePrevious)();
            }
          } catch (error) {
            console.error('Error in swipe gesture:', error);
          }
        });
    },
    [photos.length, handleSwipeNext, handleSwipePrevious]
  );

  // Early return AFTER all hooks - this is the key fix
  if (photos.length === 0 || !visible) return null;

  const safeIndex = photos.length > 0 ? Math.max(0, Math.min(currentIndex, photos.length - 1)) : 0;
  const currentPhoto = photos[safeIndex];
  
  if (!currentPhoto) return null;

  const photoUrl = getPhotoUrl(currentPhoto.storage_path || '');

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.counter}>
            {safeIndex + 1} / {photos.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Main Photo */}
        <GestureDetector gesture={swipeGesture}>
          <View style={styles.photoContainer}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                contentFit="contain"
                transition={300}
                cachePolicy="memory"
                recyclingKey={currentPhoto.id}
                onError={(error) => {
                  console.warn('Failed to load photo in gallery modal:', currentPhoto.storage_path, error);
                }}
              />
            ) : (
              <View style={[styles.photo, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' }]}>
                <Text style={{ color: 'white', fontSize: 16 }}>Photo unavailable</Text>
              </View>
            )}
          </View>
        </GestureDetector>

        {/* Navigation Arrows (only if multiple photos) */}
        {photos.length > 1 && (
          <>
            {/* Previous Button */}
            {safeIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={goToPrevious}
                activeOpacity={0.7}
              >
                <ChevronLeft size={32} color="white" />
              </TouchableOpacity>
            )}

            {/* Next Button */}
            {safeIndex < photos.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={goToNext}
                activeOpacity={0.7}
              >
                <ChevronRight size={32} color="white" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Thumbnail Strip (if multiple photos) */}
        {photos.length > 1 && (
          <View style={styles.thumbnailStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailScroll}
            >
              {photos.map((photo, index) => {
                const thumbUrl = getPhotoUrl(photo.storage_path);
                if (!thumbUrl) return null;
                
                return (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => {
                  const validIndex = Math.max(0, Math.min(index, photos.length - 1));
                  setCurrentIndex(validIndex);
                }}
                    style={[
                      styles.thumbnail,
                      index === safeIndex && styles.thumbnailActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: thumbUrl }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                      onError={() => {
                        console.warn('Failed to load thumbnail in gallery modal:', photo.storage_path);
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Caption (if exists) */}
        {currentPhoto?.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{currentPhoto.caption}</Text>
          </View>
        )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
    ...Typography.h4,
    color: 'white',
    fontSize: 16,
    fontFamily: 'Quicksand_600SemiBold',
  },
  closeButton: {
    padding: 8,
  },
  photoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  thumbnailStrip: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumbnailScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: Colors.brand[400],
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  captionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  caption: {
    ...Typography.body,
    color: 'white',
    textAlign: 'center',
  },
});
