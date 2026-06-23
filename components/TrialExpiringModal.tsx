/**
 * Modal shown when the user's free trial is ending or has expired.
 * Encourages subscription with feature list and pricing.
 */

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useAuthStore } from '@/store/authStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { AlertTriangle, Check, Crown, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const TRIAL_MODAL_DISMISS_KEY = 'trial_expiring_modal_dismissed_milestone';
const SHOW_MODAL_AT_OR_BELOW_DAYS = 7;

const PREMIUM_FEATURES = [
  'Unlimited students',
  'PDF Report Cards',
  'Grade Trends & Analytics',
  'Photo Library',
  'Export & Sharing',
];

type ModalMilestone = '7' | '3' | '1' | 'expired';

interface ModalContent {
  title: string;
  subtitle: string;
  isExpired: boolean;
  isWarning: boolean;
}

/**
 * Maps days remaining to a dismiss milestone bucket.
 */
function getModalMilestone(daysRemaining: number, isExpired: boolean): ModalMilestone | null {
  if (isExpired || daysRemaining <= 0) {
    return 'expired';
  }
  if (daysRemaining <= 1) {
    return '1';
  }
  if (daysRemaining <= 3) {
    return '3';
  }
  if (daysRemaining <= SHOW_MODAL_AT_OR_BELOW_DAYS) {
    return '7';
  }
  return null;
}

/**
 * Returns modal title and subtitle copy for the current milestone.
 */
function getModalContent(daysRemaining: number, isExpired: boolean): ModalContent {
  if (isExpired || daysRemaining <= 0) {
    return {
      title: 'Your Trial Has Expired',
      subtitle: 'Subscribe now to keep your homeschool data and premium features.',
      isExpired: true,
      isWarning: true,
    };
  }

  if (daysRemaining === 1) {
    return {
      title: 'Last Day of Your Trial!',
      subtitle: 'Subscribe today so you do not lose access tomorrow.',
      isExpired: false,
      isWarning: true,
    };
  }

  if (daysRemaining <= 3) {
    return {
      title: `Only ${daysRemaining} Days Left`,
      subtitle: 'Your free trial is almost over. Lock in full access now.',
      isExpired: false,
      isWarning: true,
    };
  }

  return {
    title: `${daysRemaining} Days Left in Your Trial`,
    subtitle: 'Enjoying HomeschoolHub? Subscribe to keep everything when your trial ends.',
    isExpired: false,
    isWarning: false,
  };
}

export default function TrialExpiringModal() {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuthStore();
  const { subscriptionInfo, updateSubscriptionStatus } = useSubscriptionStore();
  const [visible, setVisible] = useState(false);
  const [dismissChecked, setDismissChecked] = useState(false);

  const isOnMainApp = segments[0] === '(tabs)';
  const hideOnRoutes = ['subscribe', 'welcome', '(auth)', 'setup'].includes(segments[0] ?? '');

  const modalState = useMemo(() => {
    if (!subscriptionInfo || subscriptionInfo.subscriptionStatus === 'active') {
      return null;
    }

    const isExpired = subscriptionInfo.subscriptionStatus === 'expired';
    const daysRemaining = subscriptionInfo.daysRemaining;
    const milestone = getModalMilestone(daysRemaining, isExpired);

    if (!milestone) {
      return null;
    }

    return {
      milestone,
      content: getModalContent(daysRemaining, isExpired),
      daysRemaining,
      isExpired,
    };
  }, [subscriptionInfo]);

  const evaluateVisibility = useCallback(async () => {
    if (!user || !isOnMainApp || hideOnRoutes || !modalState) {
      setVisible(false);
      setDismissChecked(true);
      return;
    }

    if (modalState.isExpired) {
      setVisible(true);
      setDismissChecked(true);
      return;
    }

    const dismissedMilestone = await AsyncStorage.getItem(TRIAL_MODAL_DISMISS_KEY);
    const shouldShow = dismissedMilestone !== modalState.milestone;
    setVisible(shouldShow);
    setDismissChecked(true);
  }, [user, isOnMainApp, hideOnRoutes, modalState]);

  useEffect(() => {
    if (!subscriptionInfo) {
      return;
    }

    evaluateVisibility();
  }, [subscriptionInfo, evaluateVisibility]);

  useEffect(() => {
    if (!user) {
      setVisible(false);
      setDismissChecked(true);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      setDismissChecked(false);
      await updateSubscriptionStatus();
      if (!cancelled) {
        await evaluateVisibility();
      }
    };

    refresh();

    return () => {
      cancelled = true;
    };
  }, [segments, user, updateSubscriptionStatus]);

  const handleDismiss = async () => {
    if (!modalState || modalState.isExpired) {
      return;
    }

    await AsyncStorage.setItem(TRIAL_MODAL_DISMISS_KEY, modalState.milestone);
    setVisible(false);
  };

  const handleSubscribe = () => {
    if (!modalState?.isExpired) {
      setVisible(false);
    }
    router.push('/subscribe' as const);
  };

  if (!dismissChecked || !visible || !modalState) {
    return null;
  }

  const { content, isExpired } = modalState;
  const headerIconColor = content.isWarning ? Colors.ui.error : Colors.brand[500];
  const headerBackground = content.isWarning ? '#FEE2E2' : Colors.brand[50];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isExpired ? undefined : handleDismiss}
    >
      <Pressable
        style={styles.overlay}
        onPress={isExpired ? undefined : handleDismiss}
        disabled={isExpired}
      >
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.header, { backgroundColor: headerBackground }]}>
            {!isExpired && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismiss}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={22} color={Colors.ui.textLight} />
              </TouchableOpacity>
            )}

            {content.isWarning ? (
              <AlertTriangle size={40} color={headerIconColor} />
            ) : (
              <Crown size={40} color={headerIconColor} />
            )}

            <Text style={[styles.title, content.isWarning && styles.titleWarning]}>
              {content.title}
            </Text>
            <Text style={styles.subtitle}>{content.subtitle}</Text>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Premium includes:</Text>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Check size={18} color={Colors.ui.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}

            <View style={styles.pricingSection}>
              <Text style={styles.sectionTitle}>Simple pricing</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Monthly</Text>
                <Text style={styles.priceValue}>$4.99/month</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Annual</Text>
                <Text style={styles.priceValue}>$49.99/year</Text>
              </View>
              <Text style={styles.priceNote}>Save with annual billing</Text>
            </View>

            <Button title="Subscribe Now" onPress={handleSubscribe} variant="primary" />

            {!isExpired && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={handleDismiss}
                accessibilityRole="button"
                accessibilityLabel="Maybe later"
              >
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.ui.background,
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  title: {
    ...Typography.h2,
    color: Colors.brand[800],
    textAlign: 'center',
    marginTop: 12,
  },
  titleWarning: {
    color: '#991B1B',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: 24,
    paddingTop: 16,
    gap: 8,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.ui.text,
    marginBottom: 4,
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  featureText: {
    ...Typography.body,
    color: Colors.ui.text,
    flex: 1,
  },
  pricingSection: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: {
    ...Typography.body,
    color: Colors.ui.text,
  },
  priceValue: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.brand[700],
  },
  priceNote: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginTop: 4,
  },
  laterButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  laterButtonText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
});
