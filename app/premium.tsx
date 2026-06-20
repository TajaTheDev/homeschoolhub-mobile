/**
 * Premium Subscription Screen
 * Professional paywall with RevenueCat integration
 * Supports both iPhone and iPad
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Check, Crown } from 'lucide-react-native';
import Purchases, { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { getOfferings, purchasePackage, restorePurchases, checkProStatus } from '@/lib/revenuecat';
import { useSubscription } from '@/contexts/SubscriptionContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isIPad = SCREEN_WIDTH >= 768;

// Check if we're in Expo Go
// Only blocks Expo Go - allows TestFlight and production builds (including simulators)
// Apple reviewers test on simulators, so we must allow purchases there
const isDevelopmentMode = (): boolean => {
  // Only check for Expo Go - don't block based on __DEV__
  // This allows TestFlight builds (even on simulators) to work
  const isExpoGo = Constants.appOwnership === 'expo';
  return isExpoGo;
};

// Premium features list
const PREMIUM_FEATURES = [
  'Unlimited Students',
  'Advanced Lesson Planning',
  'Custom Schedules',
  'Progress Tracking',
  'Priority Support',
];

export default function PremiumScreen() {
  const router = useRouter();
  const { refreshSubscriptionStatus } = useSubscription();
  
  // State management
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  // Device detection and logging on mount
  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    const isTablet = width >= 768;
    
    console.log('🎯 Premium screen mounted');
    console.log('📱 Device Model:', Device.modelName || 'Unknown');
    console.log('📐 Screen Dimensions:', `${width}x${height}`);
    console.log('🖥️ Is Tablet:', isTablet);
    console.log('🍎 Platform:', Platform.OS, Platform.Version);
    console.log('📦 Device Type:', Device.deviceType || 'Unknown');
    console.log('🔧 Expo Go:', Constants.appOwnership === 'expo');
    console.log('🔨 Development Mode:', __DEV__);
  }, []);

  // Load offerings on mount
  useEffect(() => {
    loadOfferings();
    checkCurrentSubscription();
  }, []);

  // Check if user already has subscription
  const checkCurrentSubscription = async () => {
    try {
      const hasAccess = await checkProStatus();
      setHasSubscription(hasAccess);
    } catch (err) {
      console.error('Error checking subscription status:', err);
    }
  };

  // Error logging utility - Enhanced for iPad/ARS debugging
  const logPurchaseError = (error: any, context: string) => {
    console.group('❌ Purchase Error Details');
    console.log('Context:', context);
    console.log('Error Type:', typeof error);
    console.log('Error Code:', error.code || 'N/A');
    console.log('Error Message:', error.message || 'N/A');
    console.log('User Cancelled:', error.userCancelled || false);
    console.log('Underlying Error:', error.underlyingErrorMessage || 'N/A');
    console.log('Readable Error:', error.readableErrorMessage || 'N/A');
    console.log('Store Error Code:', error.storeErrorCode || 'N/A');
    console.log('Store Error String:', error.storeErrorString || 'N/A');
    console.log('Device Model:', Device.modelName || 'Unknown');
    console.log('Device Type:', Device.deviceType || 'Unknown');
    console.log('Platform:', Platform.OS, Platform.Version);
    console.log('Screen Size:', Dimensions.get('window'));
    console.log('Is iPad:', isIPad);
    console.log('Expo Go:', Constants.appOwnership === 'expo');
    console.log('Development Mode:', __DEV__);
    console.log('Timestamp:', new Date().toISOString());
    
    // Check for specific error types
    if (error.message?.includes('ARS') || error.message?.includes('Annual')) {
      console.error('⚠️ ANNUAL SUBSCRIPTION ERROR DETECTED');
      console.error('   This may indicate an issue with annual subscription configuration');
      console.error('   Check RevenueCat dashboard for product setup');
      console.error('   Verify App Store Connect product IDs match');
    }
    
    // Log full error object for debugging
    try {
      const errorKeys = Object.getOwnPropertyNames(error);
      console.log('Error Properties:', errorKeys);
      console.log('Full Error Object:', JSON.stringify(error, errorKeys, 2));
    } catch (stringifyError) {
      console.log('Full Error Object (fallback):', error);
      console.log('Error toString:', error.toString());
    }
    
    console.groupEnd();
  };

  // Load available subscription packages from RevenueCat
  const loadOfferings = async () => {
    console.log('📦 Starting to fetch offerings...');
    console.log('📱 Device:', Device.modelName || 'Unknown');
    console.log('🖥️ Is iPad:', isIPad);
    setLoading(true);
    setError(null);
    
    try {
      console.log('📡 Calling getOfferings()...');
      const offering = await getOfferings();
      
      console.log('✅ Offerings API call succeeded');
      
      if (offering) {
        console.log('📦 Current offering identifier:', offering.identifier || 'N/A');
        console.log('📦 Available packages count:', offering.availablePackages.length);
        
        // Log each package
        offering.availablePackages.forEach((pkg, index) => {
          console.log(`  Package ${index + 1}:`);
          console.log(`    - Identifier: ${pkg.identifier}`);
          console.log(`    - Type: ${pkg.packageType}`);
          console.log(`    - Price: ${pkg.product.priceString}`);
          console.log(`    - Product ID: ${pkg.product.identifier}`);
          console.log(`    - Period: ${pkg.product.subscriptionPeriod || 'N/A'}`);
        });
      } else {
        console.warn('⚠️ getOfferings() returned null or undefined');
      }
      
      if (offering && offering.availablePackages.length > 0) {
        const availablePackages = offering.availablePackages;
        setPackages(availablePackages);
        
        // Auto-select annual package if available (best value)
        const annualPkg = availablePackages.find(pkg => 
          pkg.identifier === '$rc_annual' || 
          pkg.packageType === 'ANNUAL' ||
          pkg.identifier.includes('annual')
        );
        if (annualPkg) {
          setSelectedPackage(annualPkg);
          console.log('✅ Auto-selected annual package:', annualPkg.identifier);
        } else {
          setSelectedPackage(availablePackages[0]); // Select first package
          console.log('✅ Auto-selected first package:', availablePackages[0].identifier);
        }
        
        console.log('📦 Successfully loaded', availablePackages.length, 'packages');
      } else {
        console.warn('⚠️ No offerings available');
        console.warn('   - Offering exists:', !!offering);
        console.warn('   - Packages count:', offering?.availablePackages.length || 0);
        setError('Subscriptions are not available right now. Please try again later.');
      }
    } catch (err: any) {
      console.error('❌ Error loading offerings:', err);
      logPurchaseError(err, 'loadOfferings');
      setError('Failed to load subscription options. Please check your connection and try again.');
    } finally {
      setLoading(false);
      console.log('📦 Offerings fetch completed');
    }
  };

  // Handle package purchase - Enhanced with comprehensive logging for iPad debugging
  const handlePurchase = async (pkg: PurchasesPackage) => {
    console.log('═══════════════════════════════════');
    console.log('🛒 PURCHASE INITIATED');
    console.log('═══════════════════════════════════');
    console.log('📦 Package Identifier:', pkg.identifier);
    console.log('📦 Package Type:', pkg.packageType);
    console.log('💰 Price:', pkg.product.priceString);
    console.log('🆔 Product ID:', pkg.product.identifier);
    console.log('📅 Subscription Period:', pkg.product.subscriptionPeriod || 'N/A');
    console.log('📱 Device Model:', Device.modelName || 'Unknown');
    console.log('📱 Device Type:', Device.deviceType || 'Unknown');
    console.log('🖥️ Is iPad:', isIPad);
    console.log('📐 Screen Dimensions:', Dimensions.get('window'));
    console.log('🍎 Platform:', Platform.OS, Platform.Version);
    console.log('🔧 Expo Go:', Constants.appOwnership === 'expo');
    console.log('🔨 Development Mode:', __DEV__);
    
    setPurchasing(true);
    setError(null);
    
    try {
      console.log('➡️ Calling purchasePackage() wrapper...');
      const purchaseStartTime = Date.now();
      
      const result = await purchasePackage(pkg);
      
      const purchaseDuration = Date.now() - purchaseStartTime;
      console.log(`⏱️ Purchase API call took ${purchaseDuration}ms`);
      
      console.log('✅ Purchase wrapper returned');
      console.log('📊 Purchase Result:', {
        success: result.success,
        cancelled: result.cancelled,
        hasCustomerInfo: !!result.customerInfo,
        error: result.error || 'None',
      });
      
      if (result.success && result.customerInfo) {
        console.log('✅ Purchase successful');
        console.log('👤 Customer Info:');
        console.log('   - Customer ID:', result.customerInfo.originalAppUserId);
        console.log('   - First Seen:', result.customerInfo.firstSeen);
        console.log('   - Active Entitlements:', Object.keys(result.customerInfo.entitlements.active));
        console.log('   - All Entitlements:', Object.keys(result.customerInfo.entitlements.all));
        console.log('   - Latest Expiration:', result.customerInfo.latestExpirationDate || 'N/A');
        
        // Check if premium entitlement is now active
        const entitlementId = 'pro';
        const premiumEntitlement = result.customerInfo.entitlements.active[entitlementId];
        const hasPremium = premiumEntitlement !== undefined;
        
        if (hasPremium) {
          console.log('🎉 Premium entitlement confirmed active');
          console.log('   - Entitlement ID:', entitlementId);
          console.log('   - Expiration Date:', premiumEntitlement.expirationDate || 'N/A');
          console.log('   - Product Identifier:', premiumEntitlement.productIdentifier || 'N/A');
          console.log('   - Period Type:', premiumEntitlement.periodType || 'N/A');
          console.log('   - Will Renew:', premiumEntitlement.willRenew || 'N/A');
          console.log('   - Store:', premiumEntitlement.store || 'N/A');
          
          // Refresh subscription status
          console.log('🔄 Refreshing subscription status...');
          await refreshSubscriptionStatus();
          await checkCurrentSubscription();
          
          Alert.alert(
            'Welcome to Premium! 🎉',
            'You now have access to all premium features.',
            [
              {
                text: 'Get Started',
                onPress: () => router.back(),
              },
            ],
            { cancelable: false }
          );
        } else {
          console.warn('⚠️ Purchase succeeded but premium entitlement not found');
          console.warn('   - Expected entitlement:', entitlementId);
          console.warn('   - Available entitlements:', Object.keys(result.customerInfo.entitlements.active));
          console.warn('   - All entitlements:', Object.keys(result.customerInfo.entitlements.all));
          console.warn('   - This may be normal if entitlement is still processing');
          
          Alert.alert(
            'Purchase Complete',
            'Your subscription is being processed. Please wait a moment.',
            [{ text: 'OK' }]
          );
        }
      } else if (result.cancelled) {
        console.log('ℹ️ User cancelled purchase');
        console.log('   - No error shown to user (expected behavior)');
        // Don't show error for cancellation
      } else {
        const errorMsg = result.error || 'Purchase failed';
        console.error('❌ Purchase failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.log('═══════════════════════════════════');
      console.log('❌ PURCHASE EXCEPTION CAUGHT');
      console.log('═══════════════════════════════════');
      logPurchaseError(err, 'handlePurchase');
      
      // Don't show error if user cancelled
      if (!err.userCancelled && !err.cancelled && !err.userCancelled) {
        // Build user-friendly error message
        let errorMessage = 'Something went wrong with your purchase. Please try again.';
        
        if (err.message) {
          errorMessage = err.message;
        } else if (err.readableErrorMessage) {
          errorMessage = err.readableErrorMessage;
        } else if (err.underlyingErrorMessage) {
          errorMessage = err.underlyingErrorMessage;
        }
        
        // Add helpful context for common errors
        if (err.code === 'PURCHASE_INVALID' || err.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE') {
          errorMessage = 'This subscription may not be available. Please check App Store Connect configuration.';
        } else if (err.message?.includes('ARS') || err.message?.includes('Annual')) {
          errorMessage = 'There was an issue processing the annual subscription. Please try again or contact support.';
        } else if (err.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (err.code === 'PURCHASE_NOT_ALLOWED') {
          errorMessage = 'Purchases are not allowed on this device. Please check your device settings.';
        }
        
        setError(errorMessage);
        
        // Log error details for debugging
        console.error('📝 Error details for user:');
        console.error('   - Message:', errorMessage);
        console.error('   - Error code:', err.code || 'N/A');
        console.error('   - Device:', Device.modelName || 'Unknown');
        console.error('   - Is iPad:', isIPad);
        console.log('═══════════════════════════════════');
        
        Alert.alert(
          'Purchase Failed',
          errorMessage,
          [
            {
              text: 'OK',
              style: 'default',
            },
            {
              text: 'Retry',
              style: 'default',
              onPress: () => {
                // Allow user to retry
                setError(null);
              },
            },
          ]
        );
      } else {
        console.log('ℹ️ Purchase cancelled by user (no error shown)');
        console.log('═══════════════════════════════════');
      }
    } finally {
      setPurchasing(false);
      console.log('🏁 Purchase flow completed');
      console.log('═══════════════════════════════════');
    }
  };

  // Restore previous purchases
  const handleRestore = async () => {
    console.log('🔄 Restore purchases initiated');
    console.log('📱 Device:', Device.modelName || 'Unknown');
    console.log('🖥️ Is iPad:', isIPad);
    
    setRestoring(true);
    setError(null);
    
    try {
      console.log('📡 Calling restorePurchases()...');
      const restoreStartTime = Date.now();
      
      const result = await restorePurchases();
      
      const restoreDuration = Date.now() - restoreStartTime;
      console.log(`⏱️ Restore API call took ${restoreDuration}ms`);
      
      console.log('✅ Restore API call completed');
      console.log('📊 Restore Result:', {
        success: result.success,
        hasProAccess: result.hasProAccess,
        error: result.error || 'None',
      });
      
      if (result.success) {
        console.log('🔄 Refreshing subscription status after restore...');
        await refreshSubscriptionStatus();
        await checkCurrentSubscription();
        
        if (result.hasProAccess) {
          console.log('🎉 Premium access confirmed after restore');
          
          Alert.alert(
            'Purchases Restored! ✅',
            'Your premium subscription has been restored.',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ],
            { cancelable: false }
          );
        } else {
          console.log('ℹ️ No active subscriptions found to restore');
          
          Alert.alert(
            'No Purchases Found',
            'We couldn\'t find any active subscriptions to restore.',
            [{ text: 'OK' }]
          );
        }
      } else {
        const errorMsg = result.error || 'Restore failed';
        console.error('❌ Restore failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error('❌ Restore exception caught');
      logPurchaseError(err, 'handleRestore');
      
      const errorMessage = err.message || 'Unable to restore purchases. Please try again.';
      setError(errorMessage);
      
      console.error('📝 Restore error details:');
      console.error('   - Message:', errorMessage);
      console.error('   - Error code:', err.code || 'N/A');
      
      Alert.alert('Restore Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setRestoring(false);
      console.log('🏁 Restore flow completed');
    }
  };

  // Determine if package is annual (best value)
  const isAnnualPackage = (pkg: PurchasesPackage): boolean => {
    return (
      pkg.identifier === '$rc_annual' ||
      pkg.packageType === 'ANNUAL' ||
      pkg.identifier.toLowerCase().includes('annual') ||
      pkg.identifier.toLowerCase().includes('yearly')
    );
  };

  // Determine if package is monthly
  const isMonthlyPackage = (pkg: PurchasesPackage): boolean => {
    return (
      pkg.identifier === '$rc_monthly' ||
      pkg.packageType === 'MONTHLY' ||
      pkg.identifier.toLowerCase().includes('monthly')
    );
  };

  // Get package display name
  const getPackageDisplayName = (pkg: PurchasesPackage): string => {
    if (isAnnualPackage(pkg)) return 'Annual';
    if (isMonthlyPackage(pkg)) return 'Monthly';
    return 'Premium';
  };

  // Expo Go/Development Mode - Show preview UI
  if (isDevelopmentMode()) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Unlock Premium',
            headerShown: true,
            headerBackTitle: 'Back',
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.devModeContainer}>
              <Crown size={64} color={Colors.brand[500]} />
              <Text style={styles.devModeTitle}>Premium Features</Text>
              <Text style={styles.devModeText}>
                💡 Subscriptions work in production builds.{'\n'}
                This is a preview in development mode.
              </Text>
              
              <View style={styles.mockPlansContainer}>
                <View style={styles.mockPlanCard}>
                  <Text style={styles.mockPlanTitle}>Annual</Text>
                  <Text style={styles.mockPlanPrice}>$49.99<Text style={styles.mockPlanPeriod}>/year</Text></Text>
                  <Text style={styles.mockPlanBadge}>BEST VALUE</Text>
                </View>
                <View style={styles.mockPlanCard}>
                  <Text style={styles.mockPlanTitle}>Monthly</Text>
                  <Text style={styles.mockPlanPrice}>$4.99<Text style={styles.mockPlanPeriod}>/month</Text></Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => router.back()}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Main premium screen UI
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Unlock Premium',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Crown size={isIPad ? 80 : 64} color={Colors.brand[500]} />
            <Text style={styles.title}>🎓 TheHomeschoolHub Premium</Text>
            {hasSubscription && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>✓ Active Subscription</Text>
              </View>
            )}
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {PREMIUM_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Check size={20} color={Colors.ui.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.brand[500]} />
              <Text style={styles.loadingText}>Loading subscription options...</Text>
            </View>
          ) : error ? (
            /* Error State */
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadOfferings}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : packages.length > 0 ? (
            /* Packages Selection */
            <View style={styles.packagesContainer}>
              {packages.map((pkg) => {
                const isAnnual = isAnnualPackage(pkg);
                const isSelected = selectedPackage?.identifier === pkg.identifier;
                
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[
                      styles.packageCard,
                      isAnnual && styles.packageCardRecommended,
                      isSelected && styles.packageCardSelected,
                      (purchasing || restoring) && styles.packageCardDisabled,
                    ]}
                    onPress={() => !purchasing && !restoring && setSelectedPackage(pkg)}
                    disabled={purchasing || restoring}
                    activeOpacity={0.7}
                  >
                    {isAnnual && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>BEST VALUE</Text>
                      </View>
                    )}
                    
                    <Text style={styles.packageName}>{getPackageDisplayName(pkg)}</Text>
                    
                    <Text style={styles.packagePrice}>
                      {pkg.product.priceString}
                      {isAnnual && (
                        <Text style={styles.packageSavings}> /year</Text>
                      )}
                      {isMonthlyPackage(pkg) && (
                        <Text style={styles.packageSavings}> /month</Text>
                      )}
                    </Text>
                    
                    {isAnnual && (
                      <Text style={styles.savingsText}>Save 33%</Text>
                    )}
                    
                    {isSelected && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color={Colors.brand[500]} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Purchase Button */}
              {selectedPackage && (
                <TouchableOpacity
                  style={[
                    styles.purchaseButton,
                    purchasing && styles.purchaseButtonDisabled,
                  ]}
                  onPress={() => handlePurchase(selectedPackage)}
                  disabled={purchasing || restoring}
                  activeOpacity={0.8}
                >
                  {purchasing ? (
                    <>
                      <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.purchaseButtonText}>Processing...</Text>
                    </>
                  ) : (
                    <Text style={styles.purchaseButtonText}>
                      Continue with {getPackageDisplayName(selectedPackage)} - {selectedPackage.product.priceString}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Restore Purchases Button */}
              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={purchasing || restoring}
              >
                {restoring ? (
                  <ActivityIndicator size="small" color={Colors.brand[600]} />
                ) : (
                  <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                )}
              </TouchableOpacity>

              {/* Footer Links */}
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.footerLinkText}>Terms</Text>
                </TouchableOpacity>
                <Text style={styles.footerSeparator}>•</Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.footerLinkText}>Privacy</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* No Packages Available */
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No subscription packages available</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={loadOfferings}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Loading Overlay */}
        {(purchasing || restoring) && (
          <View style={styles.overlay}>
            <View style={styles.overlayContent}>
              <ActivityIndicator size="large" color={Colors.brand[500]} />
              <Text style={styles.overlayText}>
                {purchasing ? 'Processing purchase...' : 'Restoring purchases...'}
              </Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: isIPad ? 32 : 20,
    paddingBottom: 40,
    maxWidth: isIPad ? 600 : undefined,
    alignSelf: isIPad ? 'center' : 'stretch',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: isIPad ? 36 : 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 16,
    textAlign: 'center',
  },
  activeBadge: {
    backgroundColor: Colors.ui.success + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  activeBadgeText: {
    color: Colors.ui.success,
    fontSize: 14,
    fontWeight: '600',
  },
  featuresContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    ...Typography.body,
    fontSize: 16,
    color: Colors.ui.text,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    marginTop: 16,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    ...Typography.body,
    color: Colors.ui.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.ui.error,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    ...Typography.button,
    color: 'white',
  },
  packagesContainer: {
    gap: 16,
  },
  packageCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: isIPad ? 24 : 20, // More padding on iPad
    borderWidth: 2,
    borderColor: Colors.ui.border,
    position: 'relative',
    minHeight: isIPad ? 120 : 100, // Larger min height for iPad
    minWidth: isIPad ? 200 : undefined, // Ensure minimum width on iPad
  },
  packageCardRecommended: {
    borderColor: Colors.brand[500],
    borderWidth: 3,
  },
  packageCardSelected: {
    borderColor: Colors.brand[600],
    backgroundColor: Colors.brand[50],
  },
  packageCardDisabled: {
    opacity: 0.6,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    backgroundColor: Colors.brand[500],
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  packageName: {
    ...Typography.h4,
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  packagePrice: {
    fontSize: isIPad ? 36 : 32,
    fontWeight: 'bold',
    color: Colors.brand[500],
    textAlign: 'center',
    marginBottom: 4,
  },
  packageSavings: {
    fontSize: 16,
    fontWeight: 'normal',
    color: Colors.ui.textLight,
  },
  savingsText: {
    fontSize: 14,
    color: Colors.brand[600],
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: isIPad ? 18 : 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
    minHeight: 44, // iPad touch target requirement (44pt minimum)
    minWidth: isIPad ? 200 : 150, // Minimum width for iPad compatibility
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  purchaseButtonDisabled: {
    opacity: 0.7,
  },
  purchaseButtonText: {
    ...Typography.button,
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  restoreButton: {
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44, // iPad touch target
  },
  restoreButtonText: {
    ...Typography.body,
    color: Colors.brand[600],
    fontSize: 15,
    fontWeight: '600',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.ui.border,
  },
  footerLinkText: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    fontSize: 14,
  },
  footerSeparator: {
    color: Colors.ui.textLight,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  overlayText: {
    ...Typography.body,
    marginTop: 16,
    color: Colors.ui.text,
  },
  // Dev Mode Styles
  devModeContainer: {
    alignItems: 'center',
    padding: 32,
  },
  devModeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 24,
    marginBottom: 16,
  },
  devModeText: {
    ...Typography.body,
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  mockPlansContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  mockPlanCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.ui.border,
    alignItems: 'center',
  },
  mockPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  mockPlanPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[500],
  },
  mockPlanPeriod: {
    fontSize: 16,
    fontWeight: 'normal',
    color: Colors.ui.textLight,
  },
  mockPlanBadge: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand[600],
  },
  closeButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  closeButtonText: {
    ...Typography.button,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
