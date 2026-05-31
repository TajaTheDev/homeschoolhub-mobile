/**
 * Trial countdown banner shown on the dashboard during an active trial.
 * Hides when the user has an active paid subscription.
 */

import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type BannerVariant = 'purple' | 'orange' | 'red';

interface BannerConfig {
  variant: BannerVariant;
  message: string;
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

/**
 * Returns banner styling and copy based on days remaining in the trial.
 */
function getBannerConfig(daysRemaining: number, isExpired: boolean): BannerConfig {
  if (isExpired || daysRemaining <= 0) {
    return {
      variant: 'red',
      message: 'Your free trial has ended — subscribe to keep access',
      backgroundColor: '#FEE2E2',
      borderColor: Colors.ui.error,
      iconColor: Colors.ui.error,
      textColor: '#991B1B',
    };
  }

  if (daysRemaining <= 3) {
    return {
      variant: 'red',
      message:
        daysRemaining === 1
          ? 'Last day of your free trial!'
          : `${daysRemaining} days left — subscribe before your trial ends`,
      backgroundColor: '#FEE2E2',
      borderColor: Colors.ui.error,
      iconColor: Colors.ui.error,
      textColor: '#991B1B',
    };
  }

  if (daysRemaining <= 7) {
    return {
      variant: 'orange',
      message: `${daysRemaining} days left in your free trial`,
      backgroundColor: Colors.secondary[100],
      borderColor: Colors.ui.warning,
      iconColor: Colors.ui.warning,
      textColor: Colors.secondary[700],
    };
  }

  return {
    variant: 'purple',
    message: `${daysRemaining} days left in your free trial`,
    backgroundColor: Colors.brand[50],
    borderColor: Colors.brand[400],
    iconColor: Colors.brand[600],
    textColor: Colors.brand[800],
  };
}

export default function TrialBanner() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { subscriptionInfo, updateSubscriptionStatus } = useSubscriptionStore();

  useEffect(() => {
    if (user) {
      updateSubscriptionStatus();
    }
  }, [user, updateSubscriptionStatus]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        updateSubscriptionStatus();
      }
    }, [user, updateSubscriptionStatus])
  );

  const bannerConfig = useMemo(() => {
    if (!subscriptionInfo) {
      return null;
    }

    if (subscriptionInfo.subscriptionStatus === 'active') {
      return null;
    }

    const isExpired = subscriptionInfo.subscriptionStatus === 'expired';
    return getBannerConfig(subscriptionInfo.daysRemaining, isExpired);
  }, [subscriptionInfo]);

  if (!bannerConfig) {
    return null;
  }

  const handlePress = () => {
    router.push('/subscribe' as const);
  };

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: bannerConfig.backgroundColor,
          borderColor: bannerConfig.borderColor,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={bannerConfig.message}
      accessibilityHint="Opens subscription screen"
    >
      <View style={styles.content}>
        <Clock size={20} color={bannerConfig.iconColor} />
        <Text style={[styles.message, { color: bannerConfig.textColor }]}>
          {bannerConfig.message}
        </Text>
      </View>
      <ChevronRight size={20} color={bannerConfig.iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  message: {
    flex: 1,
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
});
