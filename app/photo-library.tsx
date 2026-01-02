import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, User } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useStudentStore } from '@/store/studentStore';
import PhotoGallery from '@/components/lessons/PhotoGallery';

export default function PhotoLibraryScreen() {
  const router = useRouter();
  const { lessons } = useLessonStore();
  const { students } = useStudentStore();
  
  const [showGallery, setShowGallery] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterStudent, setFilterStudent] = useState<'all' | string>('all');
  
  // Get all photos from lessons
  const photoItems = useMemo(() => {
    console.log('📸 Building Photo Library from storage_path...');
    
    const items: Array<{
      photoUrl: string;
      lessonId: string;
      date: string;
      studentId: string;
      studentName: string;
      subject: string;
      title: string;
    }> = [];
    
    lessons.forEach(lesson => {
      const student = students.find(s => s.id === lesson.student_id);
      
      // Handle single photo (photo_url field - legacy format)
      if (lesson.photo_url && typeof lesson.photo_url === 'string') {
        items.push({
          photoUrl: lesson.photo_url,
          lessonId: lesson.id,
          date: lesson.date,
          studentId: lesson.student_id,
          studentName: student?.name || 'Unknown',
          subject: lesson.subject,
          title: lesson.title || 'Lesson',
        });
      }
      
      // Handle photos array with storage_path
      if (lesson.photos && Array.isArray(lesson.photos) && lesson.photos.length > 0) {
        lesson.photos.forEach((photo: any) => {
          let photoUrl = '';
          
          if (typeof photo === 'string') {
            // Direct URL string
            photoUrl = photo;
          } else if (photo && typeof photo === 'object') {
            // Check for storage_path (NEW FORMAT)
            if (photo.storage_path) {
              // Build full Supabase URL from storage path
              const { data } = supabase.storage
                .from('lesson-photos')
                .getPublicUrl(photo.storage_path);
              
              photoUrl = data.publicUrl;
              console.log('✅ Built URL from storage_path:', photoUrl.substring(0, 70));
            }
            // Check for photo_url (OLD FORMAT)
            else if (photo.photo_url) {
              photoUrl = photo.photo_url;
            }
            // Check for url (ALTERNATE FORMAT)
            else if (photo.url) {
              photoUrl = photo.url;
            }
          }
          
          if (photoUrl) {
            items.push({
              photoUrl: photoUrl,
              lessonId: lesson.id,
              date: lesson.date,
              studentId: lesson.student_id,
              studentName: student?.name || 'Unknown',
              subject: lesson.subject,
              title: lesson.title || 'Lesson',
            });
          }
        });
      }
    });
    
    console.log('✅ Total photos found:', items.length);
    
    return items.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [lessons, students]);
  
  // Filter by student
  const filteredPhotos = useMemo(() => {
    if (filterStudent === 'all') return photoItems;
    return photoItems.filter(item => item.studentId === filterStudent);
  }, [photoItems, filterStudent]);
  
  const handlePhotoPress = (index: number) => {
    const allPhotoUrls = filteredPhotos.map(item => item.photoUrl);
    setSelectedPhotos(allPhotoUrls);
    setSelectedIndex(index);
    setShowGallery(true);
  };
  
  const screenWidth = Dimensions.get('window').width;
  const numColumns = 3;
  const spacing = 4;
  const itemWidth = (screenWidth - spacing * (numColumns + 1)) / numColumns;
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Photo Library</Text>
          <Text style={styles.subtitle}>
            {filteredPhotos.length} photo{filteredPhotos.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>
      
      {/* Student Filter */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: 'all', name: 'All Students' }, ...students]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                filterStudent === item.id && styles.filterChipActive
              ]}
              onPress={() => setFilterStudent(item.id)}
            >
              <Text style={[
                styles.filterChipText,
                filterStudent === item.id && styles.filterChipTextActive
              ]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>
      
      {/* Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyText}>No Photos Yet</Text>
          <Text style={styles.emptySubtext}>
            Photos from lessons will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          numColumns={numColumns}
          keyExtractor={(item, index) => `${item.lessonId}-${index}`}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.photoItem, { width: itemWidth, height: itemWidth }]}
              onPress={() => handlePhotoPress(index)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.photoUrl }}
                style={styles.photoImage}
                resizeMode="cover"
              />
              
              {/* Photo Info Overlay */}
              <View style={styles.photoOverlay}>
                <View style={styles.photoInfo}>
                  <View style={styles.photoInfoRow}>
                    <Calendar size={10} color="white" />
                    <Text style={styles.photoInfoText}>
                      {format(parseISO(item.date), 'MMM d')}
                    </Text>
                  </View>
                  <View style={styles.photoInfoRow}>
                    <User size={10} color="white" />
                    <Text style={styles.photoInfoText} numberOfLines={1}>
                      {item.studentName}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
        />
      )}
      
      {/* Photo Gallery */}
      <PhotoGallery
        visible={showGallery}
        photos={selectedPhotos}
        initialIndex={selectedIndex}
        onClose={() => setShowGallery(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  filterChipTextActive: {
    color: 'white',
  },
  gridContent: {
    padding: 2,
  },
  gridRow: {
    gap: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  photoItem: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 6,
  },
  photoInfo: {
    gap: 2,
  },
  photoInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoInfoText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
});

