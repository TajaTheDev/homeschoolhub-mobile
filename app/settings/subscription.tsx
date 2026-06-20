import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { presentPaywall as presentRevenueCatPaywall, PAYWALL_RESULT, restorePurchases } from '@/lib/revenuecat';
import { format } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Crown } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscriptionStore } from '@/store/subscriptionStore';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { refreshSubscriptionStatus } = useSubscription();
  const { subscriptionInfo, checkSubscription } = useSubscriptionStore();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const isSubscribed = subscriptionInfo?.subscriptionStatus === 'active';
  const daysRemaining = subscriptionInfo?.daysRemaining ?? 0;
  const trialStartDate = subscriptionInfo?.trialStartDate
    ? new Date(subscriptionInfo.trialStartDate)
    : null;
  const trialEndDate = subscriptionInfo?.trialEndDate
    ? new Date(subscriptionInfo.trialEndDate)
    : null;

  const scheduleTrialReminders = async (endDate: Date) => {
    try {
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      const trialReminders = existing.filter((n) =>
        n.identifier.startsWith('trial-reminder')
      );
      for (const reminder of trialReminders) {
        await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
      }

      const now = new Date();

      const sevenDaysBefore = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (sevenDaysBefore > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: 'trial-reminder-7',
          content: {
            title: '7 Days Left in Your Trial',
            body: 'Keep tracking your homeschool journey - subscribe to continue!',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: sevenDaysBefore,
          },
        });
      }

      const threeDaysBefore = new Date(endDate.getTime() - 3 * 24 * 60 * 60 * 1000);
      if (threeDaysBefore > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: 'trial-reminder-3',
          content: {
            title: '3 Days Left in Your Trial',
            body: "Don't lose access! Subscribe today for just $4.99/month",
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: threeDaysBefore,
          },
        });
      }

      const oneDayBefore = new Date(endDate.getTime() - 1 * 24 * 60 * 60 * 1000);
      if (oneDayBefore > now) {
        await Notifications.scheduleNotificationAsync({
          identifier: 'trial-reminder-1',
          content: {
            title: 'Last Day of Your Trial!',
            body: 'Subscribe now to keep all your homeschool data and memories',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: oneDayBefore,
          },
        });
      }
    } catch (error) {
      console.error('Error scheduling trial reminders:', error);
    }
  };

  const loadSubscriptionStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      await checkSubscription();
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setStatusLoading(false);
    }
  }, [checkSubscription]);

  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  useEffect(() => {
    if (trialEndDate && !isSubscribed && daysRemaining > 0) {
      scheduleTrialReminders(trialEndDate);
    }
  }, [trialEndDate, isSubscribed, daysRemaining]);

  const handleSubscribeSuccess = async () => {
    await refreshSubscriptionStatus();
    await checkSubscription();
  };

  const presentPaywall = async () => {
    try {
      setLoading(true);

      const result = await presentRevenueCatPaywall();

      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        await handleSubscribeSuccess();
      }
    } catch (error: unknown) {
      console.error('Paywall error:', error);
      const err = error as { message?: string; readableErrorMessage?: string };
      Alert.alert(
        'Cannot Show Paywall',
        err?.message ||
          err?.readableErrorMessage ||
          'Unable to show subscription options. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await presentCustomerCenter();
    } catch (error) {
      console.error('Error opening customer center:', error);
      Alert.alert('Error', 'Could not open subscription management');
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const result = await restorePurchases();

      if (result.success && result.hasProAccess) {
        await handleSubscribeSuccess();
        Alert.alert('Success', 'Your purchases have been restored.');
      } else if (result.success) {
        Alert.alert(
          'No Purchases Found',
          'No active subscription was found for this account.'
        );
      } else {
        Alert.alert(
          'Error',
          result.error || 'Could not restore purchases. Please try again.'
        );
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Could not restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const trialEnded =
    subscriptionInfo?.subscriptionStatus === 'expired' ||
    (subscriptionInfo?.subscriptionStatus === 'trial' && daysRemaining === 0);
  const trialEndingSoon = daysRemaining > 0 && daysRemaining <= 7;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSubscribed && !statusLoading && (
          <View
            style={[
              styles.trialCard,
              trialEnded && styles.trialCardExpired,
              trialEndingSoon && styles.trialCardWarning,
            ]}
          >
            <View style={styles.trialHeader}>
              <Crown
                size={32}
                color={trialEnded ? Colors.ui.textLight : Colors.accent[500]}
              />
              <View style={styles.trialInfo}>
                <Text style={styles.trialTitle}>
                  {trialEnded ? 'Trial Expired' : 'Free Trial Active'}
                </Text>
                <Text style={styles.trialDays}>
                  {trialEnded
                    ? 'Subscribe to continue using HomeschoolHub'
                    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}
                </Text>
              </View>
            </View>

            {trialStartDate && trialEndDate && !trialEnded && (
              <View style={styles.trialTimeline}>
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Started</Text>
                  <Text style={styles.timelineDate}>
                    {format(trialStartDate, 'MMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.timelineDivider} />
                <View style={styles.timelineItem}>
                  <Text style={styles.timelineLabel}>Ends</Text>
                  <Text style={styles.timelineDate}>
                    {format(trialEndDate, 'MMM d, yyyy')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {isSubscribed && (
          <View style={styles.subscribedCard}>
            <Crown size={48} color={Colors.accent[500]} />
            <Text style={styles.subscribedTitle}>Premium Active</Text>
            <Text style={styles.subscribedDescription}>
              Thank you for supporting HomeschoolHub!
            </Text>
            <TouchableOpacity
              style={styles.manageButton}
              onPress={handleManageSubscription}
              activeOpacity={0.85}
            >
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>

          <TouchableOpacity
            style={styles.planCard}
            onPress={isSubscribed ? handleManageSubscription : presentPaywall}
            disabled={loading || statusLoading}
            activeOpacity={0.9}
          >
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>Monthly</Text>
                <Text style={styles.planPrice}>$4.99/month</Text>
              </View>
              {!isSubscribed && (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>Flexible</Text>
                </View>
              )}
            </View>
            <Text style={styles.planDescription}>
              {isSubscribed
                ? 'View or change your subscription'
                : 'Perfect for trying out premium features'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, styles.planCardBest]}
            onPress={isSubscribed ? handleManageSubscription : presentPaywall}
            disabled={loading || statusLoading}
            activeOpacity={0.9}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>Annual</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planPrice}>$49.99/year</Text>
                  <Text style={styles.planSavings}>Save $10!</Text>
                </View>
              </View>
            </View>
            <Text style={styles.planDescription}>
              {isSubscribed
                ? 'View or change your subscription'
                : 'Just $4.16/month - lock in this price!'}
            </Text>
          </TouchableOpacity>

          {!isSubscribed && (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={presentPaywall}
              disabled={loading || statusLoading}
              activeOpacity={0.88}
            >
              <Text style={styles.subscribeButtonText}>
                {trialEnded ? 'Subscribe Now' : 'View Plans & Subscribe'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What You Get</Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Track up to 5 students</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Unlimited lessons</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Photo attachments</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Progress tracking & analytics</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Custom schedules & breaks</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>Smart notifications</Text>
            </View>
            <View style={styles.featureItem}>
              <Check size={20} color={Colors.accent[500]} />
              <Text style={styles.featureText}>All future updates included</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={loading || statusLoading}
        >
          <Text style={styles.restoreButtonText}>Restore Purchases</Text>
        </TouchableOpacity>

        <View style={styles.finePrint}>
          <Text style={styles.finePrintText}>
            • 30-day free trial, no credit card required
          </Text>
          <Text style={styles.finePrintText}>
            • Cancel anytime from App Store settings
          </Text>
          <Text style={styles.finePrintText}>
            • Subscription automatically renews unless cancelled
          </Text>
        </View>
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
  trialCard: {
    backgroundColor: Colors.accent[50],
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.accent[200],
  },
  trialCardWarning: {
    backgroundColor: Colors.secondary[50],
    borderColor: Colors.secondary[300],
  },
  trialCardExpired: {
    backgroundColor: Colors.ui.background,
    borderColor: Colors.ui.border,
  },
  trialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    ...Typography.h3,
    fontSize: 18,
    marginBottom: 4,
  },
  trialDays: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  trialTimeline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
  },
  timelineItem: {
    flex: 1,
  },
  timelineLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  timelineDate: {
    ...Typography.label,
    fontSize: 14,
  },
  timelineDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.ui.border,
    marginHorizontal: 16,
  },
  subscribedCard: {
    backgroundColor: Colors.accent[50],
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.accent[200],
  },
  subscribedTitle: {
    ...Typography.h2,
    marginTop: 12,
    marginBottom: 8,
  },
  subscribedDescription: {
    ...Typography.body,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 16,
  },
  manageButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  manageButtonText: {
    ...Typography.button,
    color: 'white',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  planCardBest: {
    borderColor: Colors.brand[400],
    backgroundColor: Colors.brand[50],
    position: 'relative',
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: 20,
    backgroundColor: Colors.accent[500],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    ...Typography.label,
    fontSize: 11,
    color: 'white',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planName: {
    ...Typography.h4,
    fontSize: 18,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planPrice: {
    ...Typography.h3,
    fontSize: 20,
    color: Colors.brand[600],
  },
  planSavings: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.accent[600],
    backgroundColor: Colors.accent[100],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planBadge: {
    backgroundColor: Colors.ui.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planBadgeText: {
    ...Typography.label,
    fontSize: 11,
    color: Colors.ui.textLight,
  },
  planDescription: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  subscribeButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  subscribeButtonText: {
    ...Typography.button,
    color: 'white',
    fontSize: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    ...Typography.body,
    flex: 1,
  },
  restoreButton: {
    backgroundColor: Colors.ui.background,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  restoreButtonText: {
    ...Typography.label,
    color: Colors.brand[600],
  },
  finePrint: {
    gap: 8,
  },
  finePrintText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.ui.textLight,
    lineHeight: 16,
  },
});
