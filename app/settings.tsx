import Avatar from '@/components/ui/Avatar';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useSnackbar } from '@/contexts/SnackbarContext';
import { supabase } from '@/lib/supabase';
import type { AvatarType } from '@/types';
import { requestNotificationPermissions, scheduleAttendanceReminder, cancelAttendanceReminder } from '@/utils/notificationManager';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import { restorePurchases } from '@/lib/revenuecat';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Info,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  Share2,
  TrendingUp,
  Trash2,
  User
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { hasSubscription, refreshSubscriptionStatus } = useSubscription();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarType, setAvatarType] = useState<AvatarType>('initial');
  const [avatarValue, setAvatarValue] = useState<string | null>(null);
  const [attendanceReminders, setAttendanceReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0); // Default 9:00 AM
    return defaultTime;
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUserData();
    loadReminderSettings();
  }, []);

  const loadReminderSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('attendanceRemindersEnabled');
      const savedTime = await AsyncStorage.getItem('reminderTime');
      
      if (enabled === 'true') {
        setAttendanceReminders(true);
      }
      
      if (savedTime) {
        const time = new Date(savedTime);
        setReminderTime(time);
      }
    } catch (error) {
      console.error('Error loading reminder settings:', error);
    }
  };

  const handleTimeChange = async (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      setReminderTime(selectedTime);
      await AsyncStorage.setItem('reminderTime', selectedTime.toISOString());
      
      // If reminders are enabled, reschedule with new time
      if (attendanceReminders) {
        const result = await scheduleAttendanceReminder(selectedTime);
        if (result.success) {
          // Silent update - no alert for inline picker
                  } else {
          Alert.alert('Error', result.error || 'Failed to schedule reminder');
        }
      }
    }
  };

  const handleToggleReminders = async (value: boolean) => {
    try {
      setAttendanceReminders(value);
      await AsyncStorage.setItem('attendanceRemindersEnabled', value.toString());
      
      if (value) {
        // Schedule notification
        const permissionResult = await requestNotificationPermissions();
        if (permissionResult.success) {
          const result = await scheduleAttendanceReminder(reminderTime);
          if (result.success) {
            Alert.alert('Success', 'Daily reminder enabled!');
          } else {
            Alert.alert('Error', result.error || 'Failed to schedule reminder');
            setAttendanceReminders(false);
            await AsyncStorage.setItem('attendanceRemindersEnabled', 'false');
          }
        } else {
          Alert.alert('Permission Required', permissionResult.error || 'Please enable notifications in your device settings');
          setAttendanceReminders(false);
          await AsyncStorage.setItem('attendanceRemindersEnabled', 'false');
        }
      } else {
        // Cancel notifications
        await cancelAttendanceReminder();
        showSnackbar('Daily reminder disabled', 'success');
      }
    } catch (error) {
      console.error('Error toggling reminders:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || '');
      const metadata = user.user_metadata || {};
      setDisplayName(metadata.display_name || user.email?.split('@')[0] || 'Parent');
      setAvatarType(metadata.avatar_type || 'initial');
      setAvatarValue(metadata.avatar_value || null);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/welcome');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your account and all associated data including:\n\n• All students\n• All lessons and schedules\n• All assignments and grades\n• All attendance records\n• All progress tracking\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => showFinalConfirmation(),
        },
      ]
    );
  };

  const showFinalConfirmation = () => {
    Alert.alert(
      'Are You Absolutely Sure?',
      'This action is permanent and cannot be reversed. All your data will be permanently deleted.\n\nIf you\'re having issues with the app, please contact support first.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'I Understand, Delete My Account',
          style: 'destructive',
          onPress: () => performAccountDeletion(),
        },
      ]
    );
  };

  const performAccountDeletion = async () => {
    setIsDeleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('No user found');
      }

      // Call Supabase RPC function to delete user account
      const { error: deleteError } = await supabase.rpc('delete_user_account', {
        user_id: user.id,
      });

      if (deleteError) {
        throw deleteError;
      }

      await AsyncStorage.multiRemove(['hasSeenOnboarding', 'hasCompletedOnboarding']);

      // Sign out the user
      await supabase.auth.signOut();

      Alert.alert(
        'Account Deleted',
        'Your account and all data have been permanently deleted.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/welcome');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Account deletion error:', error);
      Alert.alert(
        'Deletion Failed',
        error?.message?.includes('permission') || error?.message?.includes('policy')
          ? 'Unable to delete account. Please contact support at support@thehomeschoolhub.com for assistance.'
          : 'We couldn\'t delete your account. Please try again or contact support at support@thehomeschoolhub.com',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const SettingsItem = ({
    icon: Icon,
    title,
    subtitle,
    onPress,
    showBadge = false,
    badgeText = '',
  }: {
    icon: any;
    title: string;
    subtitle?: string;
    onPress: () => void;
    showBadge?: boolean;
    badgeText?: string;
  }) => (
    <TouchableOpacity 
      style={styles.settingsItem} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingsItemLeft}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={Colors.brand[500]} />
        </View>
        <View style={styles.settingsItemText}>
          <Text style={styles.settingsItemTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {showBadge && badgeText && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
        <ChevronRight size={20} color={Colors.ui.textLight} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Settings size={28} color={Colors.brand[700]} />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={() => router.push('/settings/profile' as any)}
            activeOpacity={0.7}
          >
            <Avatar
              type={avatarType}
              value={avatarValue}
              name={displayName}
              color={Colors.brand[400]}
              size={64}
            />
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{userEmail || ''}</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={User}
              title="Profile"
              subtitle="Update your name and photo"
              onPress={() => router.push('/settings/profile' as any)}
            />
          </View>
        </View>

        {/* School Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>School Settings</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Calendar}
              title="School Schedule"
              subtitle="Set your school days"
              onPress={() => router.push('/settings/schedule' as any)}
            />
            <SettingsItem
              icon={Calendar}
              title="Breaks & Holidays"
              subtitle="Manage school breaks"
              onPress={() => router.push('/settings/breaks' as any)}
            />
          </View>
        </View>

        {/* Reminders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          <View style={styles.sectionContent}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingHeader}>
                  <Bell size={20} color={Colors.brand[500]} style={styles.settingIcon} />
                  <Text style={styles.settingTitle}>Daily Attendance Reminder</Text>
                </View>
                <Text style={styles.settingDescription}>
                  Get notified to mark attendance
                </Text>
              </View>
              <Switch
                value={attendanceReminders}
                onValueChange={handleToggleReminders}
                trackColor={{ false: Colors.ui.border, true: Colors.brand[300] }}
                thumbColor={attendanceReminders ? Colors.brand[500] : Colors.ui.textLight}
              />
            </View>
            
            {attendanceReminders && (
              <View style={styles.timePickerContainer}>
                <Text style={styles.timePickerLabel}>Reminder Time</Text>
                
                <DateTimePicker
                  value={reminderTime}
                  mode="time"
                  is24Hour={false}
                  display="spinner"  // Always visible spinner style
                  themeVariant="light"
                  textColor="#000000"
                  onChange={(event, selectedTime) => {
                    if (selectedTime) {
                      handleTimeChange(event, selectedTime);
                    }
                  }}
                  style={styles.timePicker}
                />
                
                <Text style={styles.selectedTimeText}>
                  Daily reminder at {format(reminderTime, 'h:mm a')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Bell}
              title="Notifications"
              subtitle="Manage reminders"
              onPress={() => router.push('/settings/notifications' as any)}
            />
            <SettingsItem
              icon={Moon}
              title="Dark Mode"
              subtitle="Coming soon"
              onPress={() => Alert.alert('Coming Soon', 'Dark mode will be available in a future update!')}
            />
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.sectionContent}>
            {/* Manage Subscription - Available to all users */}
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={() => {
                if (hasSubscription) {
                  void presentCustomerCenter();
                } else {
                  router.push('/subscribe' as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsOptionIcon}>
                <CreditCard size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>
                  {hasSubscription ? 'Manage Subscription' : 'Upgrade to Premium'}
                </Text>
                <Text style={styles.settingsOptionDescription}>
                  {hasSubscription 
                    ? 'View plans and manage billing' 
                    : 'Start your 14-day free trial'}
                </Text>
              </View>
              <ChevronRight size={20} color={Colors.ui.textLight} />
            </TouchableOpacity>
            
            {/* Restore Purchases - Available to all users */}
            <TouchableOpacity
              style={styles.settingsOption}
              onPress={async () => {
                const result = await restorePurchases();
                
                if (result.success) {
                  await refreshSubscriptionStatus();
                  
                  if (result.hasProAccess) {
                    showSnackbar('Your subscription has been restored!', 'success');
                  } else {
                    Alert.alert('No Subscription', 'No active subscription found to restore');
                  }
                } else {
                  Alert.alert('Error', result.error || 'Could not restore subscription');
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingsOptionIcon}>
                <RefreshCw size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.settingsOptionContent}>
                <Text style={styles.settingsOptionTitle}>Restore Purchases</Text>
                <Text style={styles.settingsOptionDescription}>
                  Restore your subscription on this device
                </Text>
              </View>
              <ChevronRight size={20} color={Colors.ui.textLight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data & Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Share2}
              title="Export Data"
              subtitle="Year-in-review PDF, reading log, grades, and attendance"
              onPress={() => router.push('/export' as any)}
            />
            <SettingsItem
              icon={TrendingUp}
              title="Grade Trends"
              subtitle="View student progress and performance"
              onPress={() => router.push('/grade-trends' as any)}
            />
            <SettingsItem
              icon={ImageIcon}
              title="Photo Library"
              subtitle="View all lesson photos"
              onPress={() => router.push('/photo-library' as any)}
            />
            <SettingsItem
              icon={Shield}
              title="Privacy Policy"
              onPress={() => router.push('/settings/privacy' as any)}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Info}
              title="App Version"
              subtitle="1.0.0"
              onPress={() => router.push('/settings/about' as any)}
            />
            <SettingsItem
              icon={Info}
              title="Terms of Service"
              onPress={() => router.push('/settings/terms' as any)}
            />
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <View style={styles.dangerZoneContent}>
            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color={Colors.background.card} />
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting Account...' : 'Delete Account'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.deleteWarning}>
              This action is permanent and cannot be undone
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton} 
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <LogOut size={20} color={Colors.ui.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Version Section */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.versionSubtext}>Made with ❤️ for homeschool families</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.brand[900],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background.card,
    marginBottom: 8,
  },
  profileImageContainer: {
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.h4,
    marginBottom: 4,
  },
  profileEmail: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: Colors.background.card,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.brand[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsItemText: {
    flex: 1,
  },
  settingsItemTitle: {
    ...Typography.body,
    marginBottom: 2,
  },
  settingsItemSubtitle: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.secondary[200],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: Colors.secondary[700],
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  settingsOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.brand[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsOptionContent: {
    flex: 1,
  },
  settingsOptionTitle: {
    ...Typography.body,
    marginBottom: 2,
  },
  settingsOptionDescription: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 14,
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.ui.error,
  },
  signOutText: {
    ...Typography.button,
    color: Colors.ui.error,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 16,
  },
  versionText: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  versionSubtext: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingIcon: {
    marginRight: 8,
  },
  settingTitle: {
    ...Typography.body,
    marginBottom: 2,
  },
  settingDescription: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginLeft: 28,
  },
  timePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.brand[900],
    marginBottom: 12,
  },
  timePicker: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: 120,
  },
  selectedTimeText: {
    fontSize: 14,
    color: Colors.brand[600],
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  dangerZoneTitle: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.ui.error,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  dangerZoneContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFEBEE',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.ui.error,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    ...Typography.button,
    color: Colors.background.card,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteWarning: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginTop: 12,
  },
});

