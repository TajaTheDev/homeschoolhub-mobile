import Avatar from '@/components/ui/Avatar';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { supabase } from '@/lib/supabase';
import type { AvatarType } from '@/types';
import { useRouter } from 'expo-router';
import {
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  Download,
  Info,
  LogOut,
  Moon,
  Shield,
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
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
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
            <Text style={styles.profileEmail}>{userEmail || 'Loading...'}</Text>
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
            <SettingsItem
              icon={CreditCard}
              title="Upgrade to Pro"
              subtitle="Unlock all features"
              onPress={() => router.push('/settings/subscription' as any)}
              showBadge={true}
              badgeText="Free"
            />
          </View>
        </View>

        {/* Data & Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Download}
              title="Export Data"
              subtitle="Download your data as CSV"
              onPress={() => Alert.alert('Coming Soon', 'Export feature coming soon!')}
            />
            <SettingsItem
              icon={Shield}
              title="Privacy Policy"
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy will be displayed here')}
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
              onPress={() => {}}
            />
            <SettingsItem
              icon={Info}
              title="Terms of Service"
              onPress={() => Alert.alert('Terms of Service', 'Terms will be displayed here')}
            />
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={Colors.ui.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

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
});

