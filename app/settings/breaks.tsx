import EditBreakModal from '@/components/schedule/EditBreakModal';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Calendar, ChevronLeft, Pencil, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BreaksScreen() {
  const router = useRouter();
  const { breaks, fetchBreaks, addBreak, updateBreak, deleteBreak } = useScheduleStore();
  const lessonStore = useLessonStore();
  const [showEditBreakModal, setShowEditBreakModal] = useState(false);
  const [editBreakData, setEditBreakData] = useState<{ name: string; start_date: string; end_date: string; emoji?: string; id?: string } | null>(null);

  useEffect(() => {
    fetchBreaks();
  }, []);

  const saveBreakToDatabase = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string; id?: string }) => {
    console.log('💾 Saving break:', {
      id: breakData.id,
      name: breakData.name,
      mode: breakData.id ? 'EDIT' : 'CREATE'
    });
    
    if (breakData.id) {
      // EDIT MODE
      console.log('📝 Updating existing break with ID:', breakData.id);
      await updateBreak(breakData.id, {
        name: breakData.name,
        start_date: breakData.start_date,
        end_date: breakData.end_date,
        emoji: breakData.emoji,
      });
    } else {
      // CREATE MODE
      console.log('➕ Creating new break');
      await addBreak({
        name: breakData.name,
        start_date: breakData.start_date,
        end_date: breakData.end_date,
        emoji: breakData.emoji,
      });
    }
  };

  const handleSaveBreak = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string; id?: string }) => {
    try {
      // STEP 1: Check if any lessons exist during this break period
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conflictingLessons, error: fetchError } = await supabase
        .from('lessons')
        .select('id, date, title, subject')
        .eq('user_id', user.id)
        .gte('date', breakData.start_date)
        .lte('date', breakData.end_date)
        .order('date', { ascending: true });

      if (fetchError) {
        console.error('Error checking for conflicts:', fetchError);
        Alert.alert('Error', 'Failed to check for conflicting lessons');
        return;
      }

      console.log('🔍 Conflict check:', {
        breakName: breakData.name,
        startDate: breakData.start_date,
        endDate: breakData.end_date,
        conflictsFound: conflictingLessons?.length || 0
      });

      // STEP 2: If conflicts found, ask user what to do
      if (conflictingLessons && conflictingLessons.length > 0) {
        const lessonCount = conflictingLessons.length;
        const dateRange = `${format(new Date(breakData.start_date), 'MMM d')} - ${format(new Date(breakData.end_date), 'MMM d, yyyy')}`;
        
        // Show detailed list of first 5 conflicts
        const lessonList = conflictingLessons
          .slice(0, 5)
          .map(l => `• ${format(new Date(l.date), 'MMM d')}: ${l.subject}${l.title ? ` - ${l.title}` : ''}`)
          .join('\n');
        
        const moreText = lessonCount > 5 ? `\n...and ${lessonCount - 5} more` : '';

        Alert.alert(
          '⚠️ Conflicting Lessons Found',
          `There are ${lessonCount} lesson(s) scheduled during "${breakData.name}" (${dateRange}):\n\n${lessonList}${moreText}\n\nDo you want to delete these lessons and add the break?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('User cancelled break addition');
              }
            },
            {
              text: 'Delete Lessons & Add Break',
              style: 'destructive',
              onPress: async () => {
                // Delete conflicting lessons
                const lessonIds = conflictingLessons.map(l => l.id);
                const { error: deleteError } = await supabase
                  .from('lessons')
                  .delete()
                  .in('id', lessonIds);

                if (deleteError) {
                  console.error('Error deleting lessons:', deleteError);
                  Alert.alert('Error', 'Failed to delete conflicting lessons');
                  return;
                }

                // Now save the break
                await saveBreakToDatabase(breakData);
                
                Alert.alert(
                  'Success! ✅',
                  `Deleted ${lessonCount} lesson(s) and added "${breakData.name}"`,
                  [{ text: 'OK', onPress: () => {
                    // Refresh lessons and breaks
                    lessonStore.fetchLessons();
                    fetchBreaks();
                  }}]
                );
              }
            }
          ]
        );
      } else {
        // No conflicts - just save the break
        await saveBreakToDatabase(breakData);
        Alert.alert('Success! ✅', `Added "${breakData.name}"`);
        
        // Refresh breaks
        fetchBreaks();
      }
    } catch (error) {
      console.error('Error in handleSaveBreak:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const handleEditBreak = (breakItem: typeof breaks[0]) => {
    setEditBreakData({
      name: breakItem.name,
      start_date: breakItem.start_date,
      end_date: breakItem.end_date,
      emoji: breakItem.emoji,
      id: breakItem.id,
    });
    setShowEditBreakModal(true);
  };

  const handleDeleteBreak = (id: string, name: string) => {
    Alert.alert('Delete Break', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBreak(id);
          await fetchBreaks();
        },
      },
    ]);
  };

  const handleQuickAddBreak = (breakType: string) => {
    // Preset dates for common breaks (current year)
    const currentYear = new Date().getFullYear();
    const presets: Record<string, { name: string; start: string; end: string }> = {
      thanksgiving: {
        name: 'Thanksgiving Break',
        start: `${currentYear}-11-27`,
        end: `${currentYear}-11-29`
      },
      christmas: {
        name: 'Christmas Break',
        start: `${currentYear}-12-20`,
        end: `${currentYear + 1}-01-05`
      },
      spring: {
        name: 'Spring Break',
        start: `${currentYear}-03-15`,
        end: `${currentYear}-03-22`
      },
      summer: {
        name: 'Summer Vacation',
        start: `${currentYear}-06-01`,
        end: `${currentYear}-08-15`
      },
      winter: {
        name: 'Winter Break',
        start: `${currentYear}-12-23`,
        end: `${currentYear + 1}-01-03`
      }
    };
    
    const preset = presets[breakType];
    if (preset) {
      // Open edit modal with preset values
      setEditBreakData({
        name: preset.name,
        start_date: preset.start,
        end_date: preset.end,
      });
      setShowEditBreakModal(true);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>School Breaks</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>
            Add school breaks, holidays, and vacations. Your streaks won&apos;t be affected during
            these periods.
          </Text>
        </View>

        {/* Quick Add Common Breaks - ALWAYS VISIBLE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Add Common Breaks</Text>
          <View style={styles.quickAddGrid}>
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => handleQuickAddBreak('christmas')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickAddButtonText}>🎄 Christmas</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => handleQuickAddBreak('spring')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickAddButtonText}>🌸 Spring</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => handleQuickAddBreak('summer')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickAddButtonText}>☀️ Summer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={() => handleQuickAddBreak('thanksgiving')}
              activeOpacity={0.7}
            >
              <Text style={styles.quickAddButtonText}>🦃 Thanksgiving</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Your Breaks - ALWAYS VISIBLE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Breaks</Text>
            <TouchableOpacity
              style={styles.addCustomButton}
              onPress={() => {
                setEditBreakData(null);
                setShowEditBreakModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.addCustomButtonText}>+ Custom Break</Text>
            </TouchableOpacity>
          </View>

          {breaks.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={48} color={Colors.ui.border} />
              <Text style={styles.emptyStateText}>No breaks scheduled yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Use quick adds above or create a custom break
              </Text>
            </View>
          ) : (
            <View style={styles.breaksContainer}>
              {breaks.map((breakItem) => (
                <View key={breakItem.id} style={styles.breakCard}>
                  <View style={styles.breakInfo}>
                    <Text style={styles.breakEmoji}>{breakItem.emoji || '🎄'}</Text>
                    <View style={styles.breakDetails}>
                      <Text style={styles.breakName}>{breakItem.name}</Text>
                      <Text style={styles.breakDates}>
                        {format(new Date(breakItem.start_date), 'MMM d')} -{' '}
                        {format(new Date(breakItem.end_date), 'MMM d, yyyy')}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.breakActions}>
                    {/* Edit Button */}
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditBreak(breakItem)}
                    >
                      <Pencil size={18} color={Colors.brand[600]} />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    
                    {/* Delete Button */}
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteBreak(breakItem.id, breakItem.name)}
                    >
                      <Trash2 size={18} color={Colors.ui.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Break Modal */}
      <EditBreakModal
        visible={showEditBreakModal}
        breakData={editBreakData}
        onClose={() => {
          setShowEditBreakModal(false);
          setEditBreakData(null);
        }}
        onSave={handleSaveBreak}
      />
    </SafeAreaView>
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
    paddingVertical: 12,
    backgroundColor: Colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 4,
  },
  addButton: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  descriptionCard: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  descriptionText: {
    ...Typography.bodySmall,
    color: Colors.brand[700],
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickAddGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAddButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.brand[100],
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  quickAddButtonText: {
    ...Typography.label,
    color: Colors.brand[700],
  },
  addCustomButton: {
    backgroundColor: Colors.brand[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addCustomButtonText: {
    ...Typography.label,
    fontSize: 13,
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
  },
  emptyStateText: {
    ...Typography.h4,
    marginTop: 12,
    color: Colors.ui.textLight,
  },
  emptyStateSubtext: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  breaksContainer: {
    gap: 12,
  },
  breakCard: {
    backgroundColor: Colors.background.card,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent[400],
  },
  breakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  breakEmoji: {
    fontSize: 32,
  },
  breakDetails: {
    flex: 1,
  },
  breakName: {
    ...Typography.label,
    fontSize: 16,
    marginBottom: 4,
  },
  breakDates: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  breakActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.brand[50],
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
});

