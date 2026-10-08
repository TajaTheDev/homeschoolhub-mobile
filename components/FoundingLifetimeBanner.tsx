/**
 * Dismissible dashboard promo when the founding lifetime offering is live.
 */

import Colors from '@/constants/Colors';
import { foundingLifetimeBannerMessage } from '@/constants/foundingOffer';
import Typography from '@/constants/Typography';
import {
  formatPackagePrice,
  getFoundingLifetimePackage,
} from '@/lib/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Sparkles, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

export const FOUNDING_LIFETIME_BANNER_DISMISS_KEY =
  'founding_lifetime_banner_dismissed_v1';

export default function FoundingLifetimeBanner() {
  const router = useRouter();
  const subscriptionStatus = useSubscriptionStore(
    (state) => state.subscriptionInfo?.subscriptionStatus
  );

  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [foundingPackage, setFoundingPackage] = useState<PurchasesPackage | null>(
    null
  );
  const [loadingPackage, setLoadingPackage] = useState(true);

  const readDismissFlag = useCallback(async () => {
    try {
      const value = await AsyncStorage.getItem(FOUNDING_LIFETIME_BANNER_DISMISS_KEY);
      setDismissed(value === '1');
    } catch (error) {
      console.warn('Founding banner: could not read dismiss flag', error);
      setDismissed(false);
    }
  }, []);

  const loadFoundingPackage = useCallback(async () => {
    setLoadingPackage(true);
    try {
      const pkg = await getFoundingLifetimePackage();
      setFoundingPackage(pkg);
    } catch (error) {
      console.warn('Founding banner: could not load package', error);
      setFoundingPackage(null);
    } finally {
      setLoadingPackage(false);
    }
  }, []);

  useEffect(() => {
    void readDismissFlag();
  }, [readDismissFlag]);

  useFocusEffect(
    useCallback(() => {
      void loadFoundingPackage();
    }, [loadFoundingPackage])
  );

  const handleDismiss = async () => {
    setDismissed(true);
    try {
      await AsyncStorage.setItem(FOUNDING_LIFETIME_BANNER_DISMISS_KEY, '1');
    } catch (error) {
      console.warn('Founding banner: could not save dismiss flag', error);
    }
  };

  const handleOpenSubscribe = () => {
    router.push('/subscribe' as const);
  };

  if (subscriptionStatus === 'active') {
    return null;
  }

  if (dismissed === true) {
    return null;
  }

  if (dismissed === null || loadingPackage) {
    return null;
  }

  if (!foundingPackage) {
    return null;
  }

  const message = foundingLifetimeBannerMessage(
    formatPackagePrice(foundingPackage)
  );

  return (
    <View style={styles.outer}>
      <TouchableOpacity
        style={styles.banner}
        onPress={handleOpenSubscribe}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={message}
        accessibilityHint="Opens subscription screen"
      >
        <Sparkles size={20} color={Colors.brand[600]} />
        <Text style={styles.message}>{message}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={() => void handleDismiss()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss founding lifetime offer"
      >
        <X size={18} color={Colors.ui.textLight} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    gap: 4,
  },
  banner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand[300],
    backgroundColor: Colors.brand[50],
  },
  message: {
    flex: 1,
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    color: Colors.brand[900],
  },
  dismissButton: {
    paddingTop: 10,
    paddingHorizontal: 4,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
