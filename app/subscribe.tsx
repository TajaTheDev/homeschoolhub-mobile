import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import ConfettiCannon from 'react-native-confetti-cannon';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BookOpen,
  Camera,
  Check,
  Crown,
  Gift,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { checkProStatus } from '@/lib/revenuecat';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useSubscriptionStore } from '@/store/subscriptionStore';

const PREMIUM_FEATURES = [
  { icon: Users, label: 'Unlimited students' },
  { icon: BookOpen, label: 'PDF Report Cards' },
  { icon: TrendingUp, label: 'Grade Trends & Analytics' },
  { icon: Camera, label: 'Photo Library' },
  { icon: Sparkles, label: 'Export & Sharing' },
];

export default function SubscribeScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const { refreshSubscriptionStatus } = useSubscription();
  const { subscriptionInfo, updateSubscriptionStatus } = useSubscriptionStore();

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

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

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

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      await updateSubscriptionStatus();
      const info = useSubscriptionStore.getState().subscriptionInfo;
      setHasSubscription(info?.subscriptionStatus === 'active');
    } catch (error) {
      console.error('Subscription check error:', error);
      setHasSubscription(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribeSuccess = async () => {
    await refreshSubscriptionStatus();
    await updateSubscriptionStatus();

    const info = useSubscriptionStore.getState().subscriptionInfo;
    const isNowSubscribed =
      info?.subscriptionStatus === 'active' || (await checkProStatus());

    if (isNowSubscribed || info?.hasAccess) {
      setHasSubscription(true);
      setShowCelebration(true);
    }
  };

  const presentPaywall = async () => {
    try {
      if (!RevenueCatUI || typeof RevenueCatUI.presentPaywall !== 'function') {
        console.error('RevenueCatUI not available');
        Alert.alert(
          'Unavailable',
          'Subscriptions are temporarily unavailable. Please try again later.'
        );
        return;
      }

      const result = await RevenueCatUI.presentPaywall();

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

  const renderPlanCards = (subscribeLabel: string) => (
    <View style={styles.plansContainer}>
      <TouchableOpacity
        style={styles.planCard}
        onPress={presentPaywall}
        activeOpacity={0.9}
      >
        <Text style={styles.planTitle}>Premium Monthly</Text>
        <Text style={styles.planPrice}>
          $4.99<Text style={styles.planPeriod}>/month</Text>
        </Text>
        <View style={styles.planButton}>
          <Text style={styles.planButtonText}>{subscribeLabel}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.planCard, styles.planCardRecommended]}
        onPress={presentPaywall}
        activeOpacity={0.9}
      >
        <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
        <Text style={styles.planTitle}>Premium Yearly</Text>
        <Text style={styles.planPrice}>
          $49.99<Text style={styles.planPeriod}>/year</Text>
        </Text>
        <Text style={styles.planSavings}>Save 17%</Text>
        <View style={[styles.planButton, styles.planButtonRecommended]}>
          <Text style={styles.planButtonText}>{subscribeLabel}</Text>
        </View>
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
              style={styles.primarySubscribeButton}
              onPress={presentPaywall}
              activeOpacity={0.88}
            >
              <Gift size={22} color="#FFFFFF" />
              <Text style={styles.primarySubscribeButtonText}>Subscribe & Keep Access</Text>
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
