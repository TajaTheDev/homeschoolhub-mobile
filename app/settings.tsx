import Avatar from '@/components/ui/Avatar';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import type { AvatarType } from '@/types';
import { requestNotificationPermissions, scheduleAttendanceReminder } from '@/utils/notificationManager';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import { restorePurchases } from '@/lib/revenuecat';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  Image as ImageIcon,
  Info,
  LogOut,
  Moon,
  RefreshCw,
  Shield,
  Share2,
  TrendingUp,
  User
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { hasSubscription, refreshSubscriptionStatus } = useSubscription();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarType, setAvatarType] = useState<AvatarType>('initial');
  const [avatarValue, setAvatarValue] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

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
        <Text style={styles.headerTitle}>Settings</Text>
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
            <SettingsItem
              icon={Bell}
              title="Attendance Reminder"
              subtitle="Daily reminder at 9:00 AM"
              onPress={async () => {
                const hasPermission = await requestNotificationPermissions();
                if (hasPermission) {
                  await scheduleAttendanceReminder(9, 0); // 9 AM daily
                  Alert.alert('Success!', 'Daily attendance reminder set for 9:00 AM');
                } else {
                  Alert.alert('Permission Required', 'Please enable notifications in your device settings');
                }
              }}
            />
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
                  // Open Customer Center
                  presentCustomerCenter();
                } else {
                  // Go to subscribe screen
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
                  Manage Subscription
                </Text>
                <Text style={styles.settingsOptionDescription}>
                  {hasSubscription 
                    ? 'View your plan and billing' 
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
                    Alert.alert('Success!', 'Your subscription has been restored!');
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
              subtitle="Export lessons, grades, and attendance"
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
  headerTitle: {
    ...Typography.h2,
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
});

