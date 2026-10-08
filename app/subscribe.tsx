import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import ConfettiCannon from 'react-native-confetti-cannon';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen,
  Camera,
  Crown,
  Gift,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import Colors from '@/constants/Colors';
import { FOUNDING_PRICING_URGENCY_COPY } from '@/constants/foundingOffer';
import Typography from '@/constants/Typography';
import {
  checkProStatus,
  formatPackagePrice,
  getFoundingLifetimePackage,
  getOfferings,
  hasActiveRecurringProSubscription,
  openStoreSubscriptionManagement,
  purchasePackage,
  restorePurchases,
} from '@/lib/revenuecat';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import type { PurchasesPackage } from 'react-native-purchases';

const LIFETIME_FOOTNOTE_COPY =
  'Already subscribed? After purchasing, cancel your subscription in your store settings to stop future charges.';

const PREMIUM_FEATURES = [
  { icon: Users, label: 'Unlimited students' },
  { icon: BookOpen, label: 'PDF Report Cards' },
  { icon: TrendingUp, label: 'Grade Trends & Analytics' },
  { icon: Camera, label: 'Photo Library' },
  { icon: Sparkles, label: 'Export & Sharing' },
];

function isAnnualPackage(pkg: PurchasesPackage): boolean {
  return (
    pkg.identifier === '$rc_annual' ||
    pkg.packageType === 'ANNUAL' ||
    pkg.identifier.toLowerCase().includes('annual') ||
    pkg.identifier.toLowerCase().includes('yearly')
  );
}

function isMonthlyPackage(pkg: PurchasesPackage): boolean {
  return (
    pkg.identifier === '$rc_monthly' ||
    pkg.packageType === 'MONTHLY' ||
    pkg.identifier.toLowerCase().includes('monthly')
  );
}

function billingPeriodSuffix(pkg: PurchasesPackage): string {
  if (isAnnualPackage(pkg)) return '/year';
  if (isMonthlyPackage(pkg)) return '/month';
  return '';
}

export default function SubscribeScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const [loading, setLoading] = useState(true);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [foundingLifetimePackage, setFoundingLifetimePackage] =
    useState<PurchasesPackage | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { refreshSubscriptionStatus } = useSubscription();
  const { subscriptionInfo, updateSubscriptionStatus } = useSubscriptionStore();

  const isPaidPro = subscriptionInfo?.subscriptionStatus === 'active';
  const showFoundingLifetimeCard = Boolean(foundingLifetimePackage) && !isPaidPro;

  const isTrialExpired =
    subscriptionInfo?.subscriptionStatus === 'expired' ||
    (subscriptionInfo?.subscriptionStatus === 'trial' &&
      subscriptionInfo.daysRemaining <= 0);

  const runEntranceAnimation = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const loadSubscriptionStatus = useCallback(async () => {
    try {
      await updateSubscriptionStatus();
      const info = useSubscriptionStore.getState().subscriptionInfo;
      setHasSubscription(info?.subscriptionStatus === 'active');
    } catch (error) {
      console.error('Subscription check error:', error);
      setHasSubscription(false);
    }
  }, [updateSubscriptionStatus]);

  const loadPackages = useCallback(async () => {
    setPackagesLoading(true);
    setPackagesError(null);

    try {
      const [currentOffering, foundingPkg] = await Promise.all([
        getOfferings(),
        getFoundingLifetimePackage(),
      ]);

      setFoundingLifetimePackage(foundingPkg);

      if (!currentOffering?.availablePackages.length) {
        setMonthlyPackage(null);
        setAnnualPackage(null);
        if (!foundingPkg) {
          setPackagesError(
            'Subscription plans are unavailable right now. Pull down and try again, or check back shortly.'
          );
        }
        return;
      }

      const packages = currentOffering.availablePackages;
      setMonthlyPackage(packages.find(isMonthlyPackage) ?? null);
      setAnnualPackage(packages.find(isAnnualPackage) ?? null);
    } catch (error) {
      console.error('Offerings load error:', error);
      setPackagesError('Could not load plan prices. Tap Try again below.');
      setMonthlyPackage(null);
      setAnnualPackage(null);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      await Promise.all([loadSubscriptionStatus(), loadPackages()]);
      setLoading(false);
    };
    void bootstrap();
  }, [loadPackages, loadSubscriptionStatus]);

  useEffect(() => {
    if (!loading && !showCelebration) {
      runEntranceAnimation();
    }
  }, [loading, showCelebration, isTrialExpired, runEntranceAnimation]);

  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => confettiRef.current?.start(), 150);
      return () => clearTimeout(timer);
    }
  }, [showCelebration]);

  const handleSubscribeSuccess = async () => {
    await refreshSubscriptionStatus();
    await updateSubscriptionStatus();

    const info = useSubscriptionStore.getState().subscriptionInfo;
    const isNowSubscribed =
      info?.subscriptionStatus === 'active' || (await checkProStatus());

    if (isNowSubscribed || info?.canEdit) {
      setHasSubscription(true);
      setShowCelebration(true);
    }
  };

  const showLifetimeDoubleBillingAlert = () => {
    const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';
    Alert.alert(
      'You now have lifetime access!',
      `You still have an active subscription that will keep charging you. Cancel it in your ${storeName} settings to stop future charges — your lifetime access stays regardless.`,
      [
        {
          text: 'Manage subscriptions',
          onPress: () => {
            void openStoreSubscriptionManagement();
          },
        },
        { text: 'OK', style: 'cancel' },
      ]
    );
  };

  const handlePackagePurchase = async (pkg: PurchasesPackage | null) => {
    if (!pkg || purchasing) {
      return;
    }

    setPurchasing(true);
    try {
      const result = await purchasePackage(pkg);

      if (result.success) {
        await handleSubscribeSuccess();
        return;
      }

      if (result.cancelled) {
        return;
      }

      Alert.alert('Purchase failed', result.error ?? 'Please try again.');
    } catch (error: unknown) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Purchase failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleLifetimePurchase = async () => {
    if (!foundingLifetimePackage || purchasing) {
      return;
    }

    setPurchasing(true);
    try {
      const hadRecurringSubscription = await hasActiveRecurringProSubscription();
      const result = await purchasePackage(foundingLifetimePackage);

      if (result.success) {
        await handleSubscribeSuccess();
        if (hadRecurringSubscription) {
          showLifetimeDoubleBillingAlert();
        }
        return;
      }

      if (result.cancelled) {
        return;
      }

      Alert.alert('Purchase failed', result.error ?? 'Please try again.');
    } catch (error: unknown) {
      console.error('Lifetime purchase error:', error);
      Alert.alert(
        'Purchase failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handlePrimarySubscribe = async () => {
    const preferred = annualPackage ?? monthlyPackage;
    if (!preferred) {
      Alert.alert(
        'Plans unavailable',
        'Subscription options could not be loaded. Please try again in a moment.'
      );
      return;
    }
    await handlePackagePurchase(preferred);
  };

  const handleRestorePurchases = async () => {
    if (restoring || purchasing) {
      return;
    }

    setRestoring(true);
    try {
      const result = await restorePurchases();

      if (result.success && result.hasProAccess) {
        await handleSubscribeSuccess();
        return;
      }

      if (result.success) {
        Alert.alert(
          'Restore purchases',
          'No previous purchases found to restore.'
        );
        return;
      }

      Alert.alert(
        'Restore purchases',
        'We couldn’t restore purchases right now. Please try again in a moment.'
      );
    } catch (error: unknown) {
      console.error('Restore purchases error:', error);
      Alert.alert(
        'Restore purchases',
        'We couldn’t restore purchases right now. Please try again in a moment.'
      );
    } finally {
      setRestoring(false);
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

  const handleContinueAfterSubscribe = () => {
    setShowCelebration(false);
    router.replace('/(tabs)');
  };

  if (showCelebration) {
    return (
      <View style={styles.celebrationContainer}>
        <ConfettiCannon
          count={250}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          ref={confettiRef}
          fadeOut
          fallSpeed={2500}
          colors={[
            Colors.brand[400],
            Colors.brand[500],
            Colors.secondary[400],
            Colors.accent[400],
            '#FFFFFF',
          ]}
        />

        <View style={styles.celebrationIconWrap}>
          <Crown size={72} color={Colors.brand[500]} />
        </View>

        <Text style={styles.celebrationTitle}>Thank You for Subscribing!</Text>
        <Text style={styles.celebrationText}>
          Welcome back to The Homeschool Hub. We are so glad you are here — enjoy
          full access to every premium feature.
        </Text>

        <View style={styles.featureList}>
          {PREMIUM_FEATURES.map(({ label }) => (
            <Text key={label} style={styles.featureItem}>
              ✓ {label}
            </Text>
          ))}
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinueAfterSubscribe}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue to the App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const animatedContentStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  const renderSubscriptionPlanCard = (
    pkg: PurchasesPackage,
    options: { title: string; recommended?: boolean; subscribeLabel: string }
  ) => (
    <TouchableOpacity
      key={pkg.identifier}
      style={[
        styles.planCard,
        options.recommended && styles.planCardRecommended,
        (purchasing || restoring) && styles.planCardDisabled,
      ]}
      onPress={() => handlePackagePurchase(pkg)}
      disabled={purchasing || restoring}
      activeOpacity={0.9}
    >
      {options.recommended ? (
        <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
      ) : null}
      <Text style={styles.planTitle}>{options.title}</Text>
      <Text style={styles.planPrice}>
        {formatPackagePrice(pkg)}
        {billingPeriodSuffix(pkg) ? (
          <Text style={styles.planPeriod}>{billingPeriodSuffix(pkg)}</Text>
        ) : null}
      </Text>
      <View style={[styles.planButton, options.recommended && styles.planButtonRecommended]}>
        <Text style={styles.planButtonText}>{options.subscribeLabel}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFoundingLifetimeCard = (subscribeLabel: string) => {
    if (!showFoundingLifetimeCard || !foundingLifetimePackage) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[
          styles.planCard,
          styles.lifetimePlanCard,
          (purchasing || restoring) && styles.planCardDisabled,
        ]}
        onPress={handleLifetimePurchase}
        disabled={purchasing || restoring}
        activeOpacity={0.9}
      >
        <Text style={styles.lifetimeBadge}>FOUNDING MEMBER</Text>
        <Text style={styles.planTitle}>Lifetime Access</Text>
        <Text style={styles.planPrice}>{formatPackagePrice(foundingLifetimePackage)}</Text>
        <Text style={styles.lifetimeSubtitle}>
          One-time payment, lifetime access, no recurring charges.
        </Text>
        <Text style={styles.lifetimeUrgency}>{FOUNDING_PRICING_URGENCY_COPY}</Text>
        <View style={styles.planButton}>
          <Text style={styles.planButtonText}>
            {purchasing ? 'Processing…' : subscribeLabel}
          </Text>
        </View>
        <Text style={styles.lifetimeFootnote}>{LIFETIME_FOOTNOTE_COPY}</Text>
      </TouchableOpacity>
    );
  };

  const renderPlanCards = (subscribeLabel: string) => (
    <View style={styles.plansContainer}>
      {packagesLoading ? (
        <View style={styles.packagesLoadingRow}>
          <ActivityIndicator size="small" color={Colors.brand[500]} />
          <Text style={styles.packagesLoadingText}>Loading plan prices…</Text>
        </View>
      ) : null}

      {!packagesLoading && packagesError ? (
        <View style={styles.packagesErrorBox}>
          <Text style={styles.packagesErrorText}>{packagesError}</Text>
          <TouchableOpacity
            style={styles.paywallFallbackButton}
            onPress={() => void loadPackages()}
            disabled={packagesLoading}
          >
            <Text style={styles.paywallFallbackButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!packagesLoading && monthlyPackage
        ? renderSubscriptionPlanCard(monthlyPackage, {
            title: 'Premium Monthly',
            subscribeLabel,
          })
        : null}

      {!packagesLoading && annualPackage
        ? renderSubscriptionPlanCard(annualPackage, {
            title: 'Premium Yearly',
            recommended: true,
            subscribeLabel,
          })
        : null}

      {!packagesLoading && !monthlyPackage && !annualPackage && !packagesError ? (
        <TouchableOpacity
          style={styles.paywallFallbackButton}
          onPress={() => void loadPackages()}
          disabled={packagesLoading}
        >
          <Text style={styles.paywallFallbackButtonText}>Reload plans</Text>
        </TouchableOpacity>
      ) : null}

      {!packagesLoading ? renderFoundingLifetimeCard('Get Lifetime Access') : null}

      <TouchableOpacity
        style={styles.restorePurchasesButton}
        onPress={() => void handleRestorePurchases()}
        disabled={purchasing || restoring}
        activeOpacity={0.7}
      >
        {restoring ? (
          <ActivityIndicator size="small" color={Colors.brand[600]} />
        ) : (
          <Text style={styles.restorePurchasesButtonText}>Restore Purchases</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderFeatureList = () => (
    <View style={styles.featuresList}>
      {PREMIUM_FEATURES.map(({ icon: Icon, label }) => (
        <View key={label} style={styles.featureRow}>
          <View style={styles.featureIconWrap}>
            <Icon size={18} color={Colors.brand[600]} />
          </View>
          <Text style={styles.featureText}>{label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isTrialExpired ? 'Subscribe to Continue' : 'Premium Subscription',
          headerShown: !isTrialExpired,
          headerBackTitle: 'Settings',
          gestureEnabled: !isTrialExpired,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.containerContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand[500]} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : hasSubscription ? (
          <Animated.View style={[styles.subscribedContainer, animatedContentStyle]}>
            <View style={styles.subscribedHeader}>
              <Crown size={64} color={Colors.brand[500]} />
              <Text style={styles.subscribedTitle}>You&apos;re a Premium Member!</Text>
              <Text style={styles.subscribedText}>
                You have full access to all premium features.
              </Text>
            </View>

            <TouchableOpacity style={styles.manageButton} onPress={handleManageSubscription}>
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>View Plans</Text>
              <View style={styles.dividerLine} />
            </View>

            {renderPlanCards('View Details')}
          </Animated.View>
        ) : isTrialExpired ? (
          <Animated.View style={[styles.expiredContainer, animatedContentStyle]}>
            <LinearGradient
              colors={[Colors.brand[100], Colors.brand[50], Colors.ui.backgroundLight]}
              style={styles.expiredHero}
            >
              <View style={styles.expiredIconCircle}>
                <Heart size={40} color={Colors.brand[600]} fill={Colors.brand[200]} />
              </View>
              <Text style={styles.expiredTitle}>
                We&apos;re sorry — your free trial has expired
              </Text>
              <Text style={styles.expiredSubtitle}>
                Please subscribe to continue enjoying The Homeschool Hub app and keep
                all your lessons, photos, and progress in one place.
              </Text>
            </LinearGradient>

            <View style={styles.expiredMessageCard}>
              <Text style={styles.expiredMessageTitle}>Your homeschool hub awaits</Text>
              <Text style={styles.expiredMessageBody}>
                Your data is safe. Subscribe now to pick up right where you left off —
                planning lessons, tracking progress, and celebrating wins with your
                family.
              </Text>
            </View>

            {renderFeatureList()}

            <Text style={styles.choosePlanLabel}>Choose a plan to continue</Text>
            {renderPlanCards('Subscribe Now')}

            <TouchableOpacity
              style={[
                styles.primarySubscribeButton,
                (purchasing ||
                  restoring ||
                  (!annualPackage && !monthlyPackage)) &&
                  styles.primarySubscribeButtonDisabled,
              ]}
              onPress={handlePrimarySubscribe}
              disabled={
                purchasing || restoring || (!annualPackage && !monthlyPackage)
              }
              activeOpacity={0.88}
            >
              <Gift size={22} color="#FFFFFF" />
              <Text style={styles.primarySubscribeButtonText}>
                {purchasing ? 'Processing…' : 'Subscribe & Keep Access'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Cancel anytime • Secure billing through the App Store
            </Text>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.welcomeContainer, animatedContentStyle]}>
            {!loading && subscriptionInfo?.subscriptionStatus === 'trial' && (
              <View style={styles.trialInfo}>
                <Text style={styles.trialInfoText}>
                  {subscriptionInfo.daysRemaining > 0
                    ? `${subscriptionInfo.daysRemaining} days left in your trial`
                    : 'Your trial has ended'}
                </Text>
              </View>
            )}

            <Sparkles size={64} color={Colors.brand[500]} />
            <Text style={styles.welcomeTitle}>Upgrade to Premium</Text>
            <Text style={styles.welcomeText}>
              Get full access to all features and keep your homeschool journey organized.
            </Text>

            {renderPlanCards('Start Free Trial')}
            {renderFeatureList()}

            <Text style={styles.disclaimer}>Cancel anytime • No commitment</Text>
          </Animated.View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  containerContent: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  welcomeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  expiredContainer: {
    width: '100%',
  },
  expiredHero: {
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  expiredIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  expiredTitle: {
    ...Typography.h2,
    textAlign: 'center',
    color: Colors.brand[800],
    marginBottom: 12,
  },
  expiredSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.ui.textLight,
    lineHeight: 24,
  },
  expiredMessageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  expiredMessageTitle: {
    ...Typography.h3,
    marginBottom: 8,
    color: Colors.ui.text,
  },
  expiredMessageBody: {
    ...Typography.body,
    color: Colors.ui.textLight,
    lineHeight: 24,
  },
  choosePlanLabel: {
    ...Typography.label,
    textAlign: 'center',
    marginBottom: 16,
    color: Colors.brand[700],
  },
  primarySubscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.brand[600],
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 8,
    shadowColor: Colors.brand[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primarySubscribeButtonDisabled: {
    opacity: 0.5,
  },
  primarySubscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subscribedContainer: {
    width: '100%',
    alignItems: 'center',
  },
  subscribedHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  subscribedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  subscribedText: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  manageButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  manageButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.ui.border,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
  plansContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    position: 'relative',
  },
  planCardRecommended: {
    borderColor: Colors.brand[500],
  },
  planCardDisabled: {
    opacity: 0.6,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: Colors.brand[500],
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  planTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[500],
    textAlign: 'center',
    marginBottom: 8,
  },
  planPeriod: {
    fontSize: 18,
    fontWeight: 'normal',
    color: Colors.ui.textLight,
  },
  planSavings: {
    fontSize: 14,
    color: Colors.brand[600],
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 16,
  },
  planButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  planButtonRecommended: {
    backgroundColor: Colors.brand[600],
  },
  planButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  packagesLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  packagesLoadingText: {
    fontSize: 14,
    color: Colors.ui.textLight,
  },
  packagesErrorBox: {
    backgroundColor: Colors.brand[50],
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.brand[200],
    gap: 12,
  },
  packagesErrorText: {
    fontSize: 14,
    color: Colors.ui.text,
    lineHeight: 20,
  },
  paywallFallbackButton: {
    borderWidth: 1,
    borderColor: Colors.brand[400],
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  paywallFallbackButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  lifetimePlanCard: {
    borderColor: Colors.secondary[400],
    backgroundColor: Colors.background.light,
  },
  lifetimeBadge: {
    alignSelf: 'center',
    backgroundColor: Colors.secondary[500],
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  lifetimeSubtitle: {
    fontSize: 14,
    color: Colors.ui.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  lifetimeUrgency: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand[700],
    textAlign: 'center',
    marginBottom: 12,
  },
  lifetimeFootnote: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  featuresList: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.ui.text,
    fontWeight: '500',
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 18,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  disclaimer: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  restorePurchasesButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  restorePurchasesButtonText: {
    ...Typography.body,
    color: Colors.brand[600],
    fontSize: 15,
    fontWeight: '600',
  },
  celebrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.background,
    padding: 32,
  },
  celebrationIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.brand[200],
  },
  celebrationTitle: {
    ...Typography.h1,
    fontSize: 30,
    marginTop: 28,
    marginBottom: 12,
    textAlign: 'center',
  },
  celebrationText: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 28,
    color: Colors.ui.textLight,
    paddingHorizontal: 8,
  },
  featureList: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
  },
  featureItem: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  trialInfo: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  trialInfoText: {
    color: Colors.brand[700],
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
