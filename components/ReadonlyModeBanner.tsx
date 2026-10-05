/**
 * Persistent banner for expired-trial read-only access on main tabs.
 */

import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useRouter } from 'expo-router';
import { ChevronRight, LockOpen } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BANNER_MESSAGE =
  "You're in read-only mode — subscribe to add and edit.";

export default function ReadonlyModeBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accessLevel = useSubscriptionStore((state) => state.subscriptionInfo?.accessLevel);

  if (accessLevel !== 'readonly') {
    return null;
  }

  return (
    <View style={[styles.wrapper, { paddingTop: Math.max(insets.top, 8) }]}>
      <TouchableOpacity
        style={styles.banner}
        onPress={() => router.push('/subscribe' as const)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={BANNER_MESSAGE}
        accessibilityHint="Opens subscription screen"
      >
        <View style={styles.content}>
          <LockOpen size={18} color={Colors.brand[700]} />
          <Text style={styles.message}>{BANNER_MESSAGE}</Text>
        </View>
        <ChevronRight size={18} color={Colors.brand[600]} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.brand[50],
    borderBottomWidth: 1,
    borderBottomColor: Colors.brand[200],
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 6,
  },
  message: {
    flex: 1,
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand[900],
    lineHeight: 18,
  },
});
