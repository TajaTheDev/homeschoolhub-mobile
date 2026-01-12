import EditBreakModal from '@/components/schedule/EditBreakModal';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase/client';
import { useLessonStore } from '@/store/lessonStore';
import { useBreakStore } from '@/store/breakStore';
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
  const { breaks, fetchBreaks, addBreak, deleteBreak } = useBreakStore();
  const lessonStore = useLessonStore();
  const { getSchoolDays: getSchoolDayNumbers } = useScheduleStore();
  const [showEditBreakModal, setShowEditBreakModal] = useState(false);
  const [editBreakData, setEditBreakData] = useState<{ name: string; start_date: string; end_date: string; emoji?: string; id?: string } | null>(null);

  useEffect(() => {
    fetchBreaks();
  }, []);
  
  // Helper function to get school day names
  const getSchoolDays = (): string[] => {
    const dayNumbers = getSchoolDayNumbers();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNumbers.map(num => dayNames[num]);
  };
  
  // Helper function to add break without shifts
  const addBreakOnly = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    if (!breakData.name || breakData.name.trim() === '') {
      throw new Error('Please enter a name for this break');
    }
    
    console.log('📝 Creating break:', {
      name: breakData.name,
      emoji: breakData.emoji || '🎄',
      start_date: breakData.start_date,
      end_date: breakData.end_date,
    });
    
    const { data, error } = await supabase
      .from('breaks')
      .insert({
        user_id: user.id,
        start_date: breakData.start_date,
        end_date: breakData.end_date,
        name: breakData.name.trim(),
        emoji: breakData.emoji || '🎄',
        caused_shifts: false,
        shift_days: 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating break:', error);
      throw error;
    }
    
    console.log('✅ Break created:', data);
    await fetchBreaks();
    return data;
  };
  
  // Helper function to add break record (used in shift logic)
  const addBreakRecord = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    if (!breakData.name || breakData.name.trim() === '') {
      throw new Error('Please enter a name for this break');
    }
    
    console.log('📝 Creating break record:', {
      name: breakData.name,
      emoji: breakData.emoji || '🎄',
      start_date: format(new Date(breakData.start_date), 'yyyy-MM-dd'),
      end_date: format(new Date(breakData.end_date), 'yyyy-MM-dd'),
    });
    
    const { error } = await supabase
      .from('breaks')
      .insert({
        user_id: user.id,
        start_date: format(new Date(breakData.start_date), 'yyyy-MM-dd'),
        end_date: format(new Date(breakData.end_date), 'yyyy-MM-dd'),
        name: breakData.name.trim(),
        emoji: breakData.emoji || '🎄',
        caused_shifts: true,
        shift_days: 0, // We don't use uniform shift anymore
      });
    
    if (error) {
      console.error('Error adding break:', error);
      throw error;
    }
    
    console.log('✅ Break record created');
    await fetchBreaks();
  };

  const checkConflicts = async (startDate: string, endDate: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated');
        throw new Error('User not authenticated');
      }

      const breakStart = new Date(startDate);
      const breakEnd = new Date(endDate);
      
      console.log('🔍 Checking for conflicts...');
      console.log(`  Break: ${format(breakStart, 'yyyy-MM-dd')} to ${format(breakEnd, 'yyyy-MM-dd')}`);
      
      // Fetch lessons that fall within break period
      const { data: conflicts, error } = await supabase
        .from('lessons')
        .select('*')
        .gte('date', format(breakStart, 'yyyy-MM-dd'))
        .lte('date', format(breakEnd, 'yyyy-MM-dd'))
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      
      if (error) {
        console.error('Error checking conflicts:', error);
        throw error;
      }
      
      console.log(`  Found ${conflicts?.length || 0} conflicting lessons`);
      
      if (conflicts && conflicts.length > 0) {
        conflicts.forEach(lesson => {
          console.log(`    - ${lesson.title || lesson.subject} on ${lesson.date}`);
        });
      }
      
      return conflicts || [];
      
    } catch (error: any) {
      console.error('Error in checkConflicts:', error);
      
      // If it's a column error, show helpful message
      if (error?.code === '42703') {
        Alert.alert(
          'Database Error',
          `Column doesn't exist. Error: ${error.message}\n\nPlease check that the lessons table has the required columns.`
        );
      }
      
      throw error; // Re-throw to allow caller to handle
    }
  };

  const saveBreakToDatabase = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string; id?: string }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('💾 Saving break:', {
        id: breakData.id,
        name: breakData.name,
        mode: breakData.id ? 'EDIT' : 'CREATE'
      });
      
      if (!breakData.name || breakData.name.trim() === '') {
        Alert.alert('Error', 'Please enter a name for this break');
        return;
      }
      
      if (breakData.id) {
        // EDIT MODE - Use direct Supabase call since store doesn't have update
        console.log('📝 Updating existing break with ID:', breakData.id);
        console.log('💾 Saving break:', {
          id: breakData.id,
          name: breakData.name,
          emoji: breakData.emoji || '🎄',
          start_date: breakData.start_date,
          end_date: breakData.end_date,
        });
        
        const { error: updateError } = await supabase
          .from('breaks')
          .update({
            start_date: breakData.start_date,
            end_date: breakData.end_date,
            name: breakData.name.trim(),
            emoji: breakData.emoji || '🎄',
          })
          .eq('id', breakData.id);
        
        if (updateError) {
          console.error('Error updating break:', updateError);
          throw updateError;
        }
        
        console.log('✅ Break updated successfully');
        // Refresh breaks after update
        await fetchBreaks();
      } else {
        // CREATE MODE - Use store method
        console.log('➕ Creating new break');
        console.log('💾 Saving break:', {
          name: breakData.name,
          emoji: breakData.emoji || '🎄',
          start_date: breakData.start_date,
          end_date: breakData.end_date,
        });
        
        const result = await addBreak({
          start_date: breakData.start_date,
          end_date: breakData.end_date,
          name: breakData.name.trim(),
          emoji: breakData.emoji || '🎄',
          caused_shifts: false,
          shift_days: 0,
        } as any);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to create break');
        }
        
        console.log('✅ Break created successfully');
      }
    } catch (error: any) {
      console.error('❌ Break save error:', {
        error,
        message: error?.message,
        code: error?.code,
        details: error?.details
      });
      
      if (error?.code === '42703') {
        Alert.alert(
          'Database Error',
          `Column doesn't exist: ${error.message}\n\nPlease check the school_breaks table schema.`
        );
      } else {
        Alert.alert('Error', `Could not ${breakData.id ? 'update' : 'add'} break: ${error?.message || 'Unknown error'}`);
      }
      throw error; // Re-throw to prevent continuing
    }
  };

  const handleSaveBreak = async (breakData: { name: string; start_date: string; end_date: string; emoji?: string; id?: string }) => {
    try {
      // STEP 1: Check if any lessons exist during this break period
      let conflictingLessons: any[] = [];
      try {
        conflictingLessons = await checkConflicts(breakData.start_date, breakData.end_date);
      } catch (error: any) {
        // Error already logged and alerted in checkConflicts
        if (error?.code === '42703') {
          return; // Already shown alert
        }
        Alert.alert('Error', `Failed to check for conflicting lessons: ${error?.message || 'Unknown error'}`);
        return;
      }

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
          `There are ${lessonCount} lesson(s) scheduled during "${breakData.name}" (${dateRange}):\n\n${lessonList}${moreText}\n\nWhat would you like to do?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                console.log('User cancelled break addition');
              }
            },
            {
              text: 'Delete Lessons',
              style: 'destructive',
              onPress: async () => {
                // Delete conflicting lessons
                const lessonIds = conflictingLessons.map(l => l.id);
                console.log('🗑️ Deleting conflicting lessons:', lessonIds);
                
                const { error: deleteError } = await supabase
                  .from('lessons')
                  .delete()
                  .in('id', lessonIds);

                if (deleteError) {
                  console.error('❌ Error deleting lessons:', {
                    code: deleteError.code,
                    message: deleteError.message,
                    details: deleteError.details
                  });
                  
                  if (deleteError.code === '42703') {
                    Alert.alert(
                      'Database Error',
                      `Column doesn't exist: ${deleteError.message}\n\nPlease check the lessons table schema.`
                    );
                  } else {
                    Alert.alert('Error', `Failed to delete conflicting lessons: ${deleteError.message}`);
                  }
                  return;
                }
                
                console.log('✅ Conflicting lessons deleted successfully');

                // Now save the break
                await saveBreakToDatabase(breakData);
                
                // Refresh lessons and breaks
                await lessonStore.fetchLessons(undefined, undefined, true);
                await fetchBreaks();
                
                Alert.alert(
                  'Success! ✅',
                  `Deleted ${lessonCount} lesson(s) and added "${breakData.name}"`
                );
              }
            },
            {
              text: 'Shift Lessons',
              onPress: async () => {
                console.log('➡️ Shifting conflicting lessons');
                
                const breakStart = new Date(breakData.start_date);
                const breakEnd = new Date(breakData.end_date);
                
                // Calculate how many CALENDAR days the break spans
                const breakDuration = Math.ceil(
                  (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60 * 60 * 24)
                ) + 1;
                
                console.log(`📅 Break: ${format(breakStart, 'MMM dd')} - ${format(breakEnd, 'MMM dd')}`);
                console.log(`📊 Break duration: ${breakDuration} calendar days`);
                console.log(`📚 Lessons to shift: ${conflictingLessons.length}`);
                
                // Get school days configuration
                const schoolDayNumbers = getSchoolDayNumbers(); // [1,2,3,4,5] for Mon-Fri
                const schoolDayNames = schoolDayNumbers.map(n => {
                  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                  return days[n];
                });
                
                console.log('🏫 School days:', schoolDayNames);
                
                // For each conflicting lesson, shift it forward
                const shiftResults = [];
                
                // Start placing lessons the day after break ends
                let currentPlacementDate = new Date(breakEnd);
                currentPlacementDate.setDate(currentPlacementDate.getDate() + 1);
                
                for (const lesson of conflictingLessons) {
                  const lessonDate = new Date(lesson.date);
                  
                  // Find next school day starting from day after break
                  while (true) {
                    const dayOfWeek = currentPlacementDate.getDay();
                    
                    if (schoolDayNumbers.includes(dayOfWeek)) {
                      // This is a school day, use it!
                      break;
                    }
                    
                    // Not a school day, try next day
                    currentPlacementDate.setDate(currentPlacementDate.getDate() + 1);
                  }
                  
                  const originalDateStr = format(lessonDate, 'yyyy-MM-dd');
                  const newDateStr = format(currentPlacementDate, 'yyyy-MM-dd');
                  
                  console.log(`  📅 ${lesson.title || lesson.subject}: ${originalDateStr} → ${newDateStr}`);
                  
                  // Update lesson
                  const { error } = await supabase
                    .from('lessons')
                    .update({ date: newDateStr })
                    .eq('id', lesson.id);
                  
                  if (error) {
                    console.error('Error updating lesson:', error);
                    continue;
                  }
                  
                  shiftResults.push({
                    lessonId: lesson.id,
                    original: originalDateStr,
                    shifted: newDateStr,
                  });
                  
                  // Important: Move to next day for next lesson
                  currentPlacementDate.setDate(currentPlacementDate.getDate() + 1);
                  
                  // Skip to next school day for next lesson
                  while (!schoolDayNumbers.includes(currentPlacementDate.getDay())) {
                    currentPlacementDate.setDate(currentPlacementDate.getDate() + 1);
                  }
                }
                
                console.log(`✅ Shifted ${shiftResults.length} lessons`);
                
                // Add the break
                await addBreakRecord(breakData);
                
                // Refresh lessons
                await lessonStore.fetchLessons(undefined, undefined, true);
                await fetchBreaks();
                
                Alert.alert(
                  'Success! 🎉',
                  `Break added and ${shiftResults.length} lessons shifted to the next available school days`
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

  const deleteBreakOnly = async (breakId: string) => {
    console.log('🗑️ Deleting break without restoring');
    
    // Delete shift records
    await supabase
      .from('lesson_shifts')
      .delete()
      .eq('break_id', breakId);
    
    // Delete break
    const { error } = await supabase
      .from('breaks')
      .delete()
      .eq('id', breakId);
    
    if (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete break');
      return;
    }
    
    console.log('✅ Break deleted');
    Alert.alert('Success', 'Break deleted');
    
    // Refresh
    await fetchBreaks();
    await lessonStore.fetchLessons(undefined, undefined, true);
  };

  const deleteBreakAndRestore = async (breakId: string) => {
    console.log('↩️ Deleting break and restoring lessons');
    
    // Get all shift records for this break
    const { data: shifts, error: shiftsError } = await supabase
      .from('lesson_shifts')
      .select('*')
      .eq('break_id', breakId);
    
    if (shiftsError) {
      console.error('Error fetching shifts:', shiftsError);
      Alert.alert('Error', 'Failed to fetch shift records');
      return;
    }
    
    console.log(`📚 Found ${shifts?.length || 0} lessons to restore`);
    
    // Restore each lesson to original date
    if (shifts && shifts.length > 0) {
      for (const shift of shifts) {
        console.log(`  ↩️ Restoring lesson ${shift.lesson_id}: ${shift.shifted_date} → ${shift.original_date}`);
        
        const { error: updateError } = await supabase
          .from('lessons')
          .update({ date: shift.original_date })
          .eq('id', shift.lesson_id);
        
        if (updateError) {
          console.error('Error restoring lesson:', updateError);
        }
      }
      
      console.log(`✅ Restored ${shifts.length} lessons to original dates`);
    }
    
    // Delete shift records
    await supabase
      .from('lesson_shifts')
      .delete()
      .eq('break_id', breakId);
    
    // Delete break
    const { error: deleteError } = await supabase
      .from('breaks')
      .delete()
      .eq('id', breakId);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
      Alert.alert('Error', 'Failed to delete break');
      return;
    }
    
    console.log('✅ Break deleted and lessons restored');
    
    // Refresh
    await fetchBreaks();
    await lessonStore.fetchLessons(undefined, undefined, true);
    
    Alert.alert(
      'Success! ↩️',
      `Break deleted and ${shifts?.length || 0} lessons restored to original dates`
    );
  };

  const handleDeleteBreak = async (id: string, name: string) => {
    try {
      console.log('🗑️ Deleting break:', id);
      
      // First, check if this break caused shifts
      const { data: breakData, error: breakFetchError } = await supabase
        .from('breaks')
        .select('caused_shifts, shift_days')
        .eq('id', id)
        .single();
      
      if (breakFetchError) {
        console.error('Error fetching break:', breakFetchError);
        throw breakFetchError;
      }
      
      console.log('📋 Break info:', breakData);
      
      // If it caused shifts, ask user if they want to restore
      if (breakData?.caused_shifts) {
        Alert.alert(
          'Restore Shifted Lessons?',
          `This break shifted lessons by ${breakData.shift_days} days. Do you want to restore them to their original dates?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Keep Shifted',
              style: 'default',
              onPress: async () => {
                // Just delete break without restoring
                await deleteBreakOnly(id);
              },
            },
            {
              text: 'Restore Original Dates',
              style: 'destructive',
              onPress: async () => {
                await deleteBreakAndRestore(id);
              },
            },
          ]
        );
      } else {
        // No shifts, just delete with confirmation
        Alert.alert('Delete Break', `Are you sure you want to delete "${name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteBreakOnly(id);
            },
          },
        ]);
      }
      
    } catch (error) {
      console.error('Error deleting break:', error);
      Alert.alert('Error', 'Failed to delete break');
    }
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
                  <View style={styles.breakHeader}>
                    <Text style={styles.breakEmoji}>{breakItem.emoji || '📅'}</Text>
                    <View style={styles.breakInfo}>
                      <Text style={styles.breakReason}>
                        {breakItem.name || breakItem.reason || 'Untitled Break'}
                      </Text>
                      <Text style={styles.breakDates}>
                        {format(new Date(breakItem.start_date), 'MMM dd')} -{' '}
                        {format(new Date(breakItem.end_date), 'MMM dd, yyyy')}
                      </Text>
                      {breakItem.caused_shifts && (
                        <Text style={styles.shiftInfo}>
                          Shifted lessons
                        </Text>
                      )}
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
                      onPress={() => handleDeleteBreak(breakItem.id, breakItem.name || breakItem.reason || 'Break')}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent[400],
  },
  breakHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  breakEmoji: {
    fontSize: 32,
    lineHeight: 36,
  },
  breakInfo: {
    flex: 1,
  },
  breakReason: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.brand[900],
    marginBottom: 4,
  },
  breakDates: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  shiftInfo: {
    fontSize: 12,
    color: Colors.brand[600],
    fontStyle: 'italic',
    marginTop: 4,
  },
  breakActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingTop: 4,
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

