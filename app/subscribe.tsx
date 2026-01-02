import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { RevenueCatUI, PAYWALL_RESULT } from 'react-native-purchases-ui';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Sparkles, Gift } from 'lucide-react-native';
import { checkProStatus } from '@/lib/revenuecat';
import Colors from '@/constants/Colors';

export default function SubscribeScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    checkSubscriptionAndShowPaywall();
  }, []);

  const checkSubscriptionAndShowPaywall = async () => {
    try {
      setLoading(true);
      
      const hasSubscription = await checkProStatus();
      
      if (hasSubscription) {
        console.log('✅ User already subscribed');
        router.replace('/(tabs)');
        return;
      }
      
      setLoading(false);
      
      setTimeout(() => {
        presentPaywall();
      }, 500);
      
    } catch (error) {
      console.error('Subscription check error:', error);
      setLoading(false);
    }
  };

  const presentPaywall = async () => {
    try {
      console.log('📱 Showing subscription paywall...');
      const result = await RevenueCatUI.presentPaywall();
      
      console.log('Paywall result:', result);
      
      if (result === PAYWALL_RESULT.PURCHASED || 
          result === PAYWALL_RESULT.RESTORED) {
        
        const nowHasSubscription = await checkProStatus();
        
        if (nowHasSubscription) {
          setShowCelebration(true);
          confettiRef.current?.start();
          
          console.log('🎉 Trial started! Celebrating...');
          
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 3000);
        }
      } else if (result === PAYWALL_RESULT.CANCELLED) {
        console.log('❌ User cancelled - showing welcome again');
        setLoading(false);
      }
    } catch (error) {
      console.error('Paywall error:', error);
      setLoading(false);
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
        
        <ActivityIndicator 
          size="small" 
          color={Colors.brand[500]} 
          style={{ marginTop: 24 }}
        />
        <Text style={styles.celebrationSubtext}>
          Taking you to your homeschool hub...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <>
          <ActivityIndicator size="large" color={Colors.brand[500]} />
          <Text style={styles.loadingText}>Loading...</Text>
        </>
      ) : (
        <View style={styles.welcomeContainer}>
          <Sparkles size={64} color={Colors.brand[500]} />
          
          <Text style={styles.welcomeTitle}>
            Start Your Free Trial
          </Text>
          
          <Text style={styles.welcomeText}>
            Get 14 days of full access to all features. No charge until trial ends.
          </Text>
          
          <TouchableOpacity
            style={styles.startButton}
            onPress={presentPaywall}
          >
            <Text style={styles.startButtonText}>
              Start Free Trial
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.disclaimer}>
            Cancel anytime during trial • No commitment
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.ui.background,
    padding: 24,
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
});