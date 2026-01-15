import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { RevenueCatUI, PAYWALL_RESULT } from 'react-native-purchases-ui';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Sparkles, Gift, Check, Crown } from 'lucide-react-native';
import { checkProStatus } from '@/lib/revenuecat';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { presentCustomerCenter } from '@/components/subscription/CustomerCenter';
import Constants from 'expo-constants';
import Colors from '@/constants/Colors';

// TEMPORARY: Bypass feature gating for App Store review (but still show subscription screen)
// TODO: Re-enable after approval (Jan 15, 2026)
const REVIEW_MODE = true;

// Check if we're in Expo Go or development mode
const isDevelopmentMode = (): boolean => {
  const isExpoGo = Constants.appOwnership === 'expo';
  const isDev = __DEV__;
  return isExpoGo || isDev;
};

export default function SubscribeScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const { refreshSubscriptionStatus } = useSubscription();

  useEffect(() => {
    // Always check subscription status but always show the screen
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      setLoading(true);
      
      // In REVIEW_MODE, bypass actual check but still show UI
      if (REVIEW_MODE) {
        console.log('⚠️ REVIEW MODE: Feature gating bypassed, but showing subscription screen for reviewers');
        setHasSubscription(false); // Always show plans in review mode
        setLoading(false);
        return;
      }
      
      const subscriptionStatus = await checkProStatus();
      setHasSubscription(subscriptionStatus);
      setLoading(false);
      
    } catch (error) {
      console.error('Subscription check error:', error);
      setHasSubscription(false);
      setLoading(false);
    }
  };

  const presentPaywall = async () => {
    try {
      // Skip in development/Expo Go
      if (isDevelopmentMode()) {
        Alert.alert(
          'Development Mode',
          'Subscription purchases are not available in Expo Go. They will work in production builds.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if RevenueCatUI is available
      if (!RevenueCatUI || typeof RevenueCatUI.presentPaywall !== 'function') {
        console.error('❌ RevenueCatUI not available');
        Alert.alert(
          'Feature Unavailable',
          'Subscription feature is not available on emulators. Please test on a physical device.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('📱 Showing subscription paywall...');
      const result = await RevenueCatUI.presentPaywall();
      
      console.log('Paywall result:', result);
      
      if (result === PAYWALL_RESULT.PURCHASED || 
          result === PAYWALL_RESULT.RESTORED) {
        
        // Refresh subscription status
        await refreshSubscriptionStatus();
        const nowHasSubscription = await checkProStatus();
        
        if (nowHasSubscription) {
          setHasSubscription(true);
          setShowCelebration(true);
          confettiRef.current?.start();
          
          console.log('🎉 Trial started! Celebrating...');
          
          setTimeout(() => {
            // Stay on subscription screen but show success state
            setShowCelebration(false);
          }, 3000);
        }
      } else if (result === PAYWALL_RESULT.CANCELLED) {
        console.log('❌ User cancelled paywall');
        // Stay on screen - user can try again
      }
    } catch (error) {
      console.error('Paywall error:', error);
      Alert.alert(
        'Cannot Show Paywall',
        'Subscriptions are not available on emulators. Test on a real device for full functionality.',
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

  if (showCelebration) {
    return (
      <View style={styles.celebrationContainer}>
        <ConfettiCannon
          count={200}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          ref={confettiRef}
          fadeOut={true}
        />
        
        <Gift size={80} color={Colors.brand[500]} />
        
        <Text style={styles.celebrationTitle}>
          Welcome to Your Free Trial! 🎉
        </Text>
        
        <Text style={styles.celebrationText}>
          You have 14 days of full access to all premium features!
        </Text>
        
        <View style={styles.featureList}>
          <Text style={styles.featureItem}>✓ Unlimited students</Text>
          <Text style={styles.featureItem}>✓ PDF Report Cards</Text>
          <Text style={styles.featureItem}>✓ Grade Trends & Analytics</Text>
          <Text style={styles.featureItem}>✓ Photo Library</Text>
          <Text style={styles.featureItem}>✓ Export & Sharing</Text>
        </View>
        
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => {
            setShowCelebration(false);
            router.back();
          }}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Premium Subscription',
          headerShown: true,
          headerBackTitle: 'Settings',
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.containerContent}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : hasSubscription ? (
        // User already has subscription - show manage UI but still show plans
        <View style={styles.subscribedContainer}>
          <View style={styles.subscribedHeader}>
            <Crown size={64} color={Colors.brand[500]} />
            <Text style={styles.subscribedTitle}>
              You're a Premium Member! ✨
            </Text>
            <Text style={styles.subscribedText}>
              You have full access to all premium features.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.manageButton}
            onPress={handleManageSubscription}
          >
            <Text style={styles.manageButtonText}>
              Manage Subscription
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>View Plans</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.plansContainer}>
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>Premium Monthly</Text>
              <Text style={styles.planPrice}>$4.99<Text style={styles.planPeriod}>/month</Text></Text>
              <TouchableOpacity
                style={styles.planButton}
                onPress={presentPaywall}
              >
                <Text style={styles.planButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.planCard, styles.planCardRecommended]}>
              <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
              <Text style={styles.planTitle}>Premium Yearly</Text>
              <Text style={styles.planPrice}>$49.99<Text style={styles.planPeriod}>/year</Text></Text>
              <Text style={styles.planSavings}>Save 17%</Text>
              <TouchableOpacity
                style={[styles.planButton, styles.planButtonRecommended]}
                onPress={presentPaywall}
              >
                <Text style={styles.planButtonText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        // No subscription - show upgrade UI
        <View style={styles.welcomeContainer}>
          <Sparkles size={64} color={Colors.brand[500]} />
          
          <Text style={styles.welcomeTitle}>
            Upgrade to Premium
          </Text>
          
          <Text style={styles.welcomeText}>
            Get 14 days of full access to all features. No charge until trial ends.
          </Text>

          <View style={styles.plansContainer}>
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>Premium Monthly</Text>
              <Text style={styles.planPrice}>$4.99<Text style={styles.planPeriod}>/month</Text></Text>
              <TouchableOpacity
                style={styles.planButton}
                onPress={presentPaywall}
              >
                <Text style={styles.planButtonText}>Start Free Trial</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.planCard, styles.planCardRecommended]}>
              <Text style={styles.recommendedBadge}>RECOMMENDED</Text>
              <Text style={styles.planTitle}>Premium Yearly</Text>
              <Text style={styles.planPrice}>$49.99<Text style={styles.planPeriod}>/year</Text></Text>
              <Text style={styles.planSavings}>Save 17%</Text>
              <TouchableOpacity
                style={[styles.planButton, styles.planButtonRecommended]}
                onPress={presentPaywall}
              >
                <Text style={styles.planButtonText}>Start Free Trial</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <Check size={20} color={Colors.brand[500]} />
              <Text style={styles.featureText}>Unlimited students</Text>
            </View>
            <View style={styles.featureRow}>
              <Check size={20} color={Colors.brand[500]} />
              <Text style={styles.featureText}>PDF Report Cards</Text>
            </View>
            <View style={styles.featureRow}>
              <Check size={20} color={Colors.brand[500]} />
              <Text style={styles.featureText}>Grade Trends & Analytics</Text>
            </View>
            <View style={styles.featureRow}>
              <Check size={20} color={Colors.brand[500]} />
              <Text style={styles.featureText}>Photo Library</Text>
            </View>
            <View style={styles.featureRow}>
              <Check size={20} color={Colors.brand[500]} />
              <Text style={styles.featureText}>Export & Sharing</Text>
            </View>
          </View>
          
          <Text style={styles.disclaimer}>
            Cancel anytime during trial • No commitment
          </Text>
        </View>
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
    paddingTop: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
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
    marginBottom: 32,
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
    borderWidth: 2,
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
    gap: 12,
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
  startButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  disclaimer: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginTop: 16,
    textAlign: 'center',
  },
  celebrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.background,
    padding: 32,
  },
  celebrationTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 32,
    marginBottom: 16,
    textAlign: 'center',
  },
  celebrationText: {
    fontSize: 18,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  featureList: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  featureItem: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  celebrationSubtext: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginTop: 8,
  },
  continueButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
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
});