import Purchases, { 
  LOG_LEVEL, 
  PurchasesOffering,
  CustomerInfo,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API Keys - Production keys
const REVENUECAT_API_KEYS = {
  apple: 'appl_BmeebQGFfqrrGAdKaQwiyJkhsKC',    // Starts with appl_
  google: 'goog_PEXoSHKqKxPTXBZBxowodeuFrdD', // Starts with goog_
};

// Entitlement identifier
const PRO_ENTITLEMENT_ID = 'The Homeschool Hub Pro';

/**
 * Check if we're in Expo Go or development mode
 */
const isDevelopmentMode = (): boolean => {
  // Check if we're in Expo Go
  const isExpoGo = Constants.appOwnership === 'expo';
  
  // Check if we're in development mode
  const isDev = __DEV__;
  
  return isExpoGo || isDev;
};

/**
 * Initialize RevenueCat SDK
 * Call this once when app starts (in _layout.tsx)
 * Skips initialization in Expo Go/development mode
 */
export const initializeRevenueCat = async (): Promise<boolean> => {
  // Skip RevenueCat in Expo Go or development mode
  if (isDevelopmentMode()) {
    console.log('⏭️ Skipping RevenueCat initialization in Expo Go/development mode');
    console.log('💡 Subscriptions will work in production builds');
    return false;
  }

  try {
    // Enable debug logging in development
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    // Configure SDK with platform-specific API key
    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEYS.apple 
      : REVENUECAT_API_KEYS.google;

    await Purchases.configure({ apiKey });

    console.log('✅ RevenueCat initialized successfully');
    console.log('   Platform:', Platform.OS);
    console.log('   API Key:', apiKey.substring(0, 20) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ RevenueCat initialization failed:', error);
    return false;
  }
};

/**
 * Check if user has "The Homeschool Hub Pro" entitlement
 * @returns Promise<boolean> - true if user has Pro access
 * In development/Expo Go, returns true to allow full access
 */
export const checkProStatus = async (): Promise<boolean> => {
  // In development mode, grant premium access
  if (isDevelopmentMode()) {
    console.log('📊 Pro Status Check (Dev Mode): Granting premium access');
    return true;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    
    const hasProAccess = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    
    console.log('📊 Pro Status Check:');
    console.log('   Has Pro:', hasProAccess);
    console.log('   Active entitlements:', Object.keys(customerInfo.entitlements.active));
    
    return hasProAccess;
  } catch (error) {
    console.error('❌ Error checking Pro status:', error);
    return false; // Default to no access on error
  }
};

/**
 * Get available subscription offerings
 * @returns Promise<PurchasesOffering | null>
 * Returns null in development/Expo Go
 */
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  if (isDevelopmentMode()) {
    console.log('⏭️ Skipping offerings fetch in development mode');
    return null;
  }

  try {
    console.log('📦 Fetching offerings...');
    
    const offerings = await Purchases.getOfferings();
    
    if (offerings.current !== null) {
      const packages = offerings.current.availablePackages;
      
      console.log('✅ Offerings loaded:');
      console.log('   Available packages:', packages.length);
      packages.forEach(pkg => {
        console.log('   -', pkg.identifier, ':', pkg.product.priceString);
      });
      
      return offerings.current;
    }
    
    console.warn('⚠️ No current offering found');
    return null;
  } catch (error) {
    console.error('❌ Error fetching offerings:', error);
    return null;
  }
};

/**
 * Purchase a subscription package
 * @param packageToPurchase - The package to purchase
 * @returns Promise with success status and customer info
 * In development/Expo Go, simulates successful purchase
 */
export const purchasePackage = async (
  packageToPurchase: PurchasesPackage
): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  cancelled?: boolean;
  error?: string;
}> => {
  if (isDevelopmentMode()) {
    console.log('⏭️ Skipping purchase in development mode');
    console.log('💡 Purchase would be:', packageToPurchase.identifier, packageToPurchase.product.priceString);
    return {
      success: false,
      error: 'Purchases not available in development mode',
    };
  }

  try {
    console.log('💳 Starting purchase:', packageToPurchase.identifier);
    console.log('   Price:', packageToPurchase.product.priceString);
    
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    
    // Check if purchase granted Pro access
    const hasProAccess = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    
    if (hasProAccess) {
      console.log('✅ Purchase successful! User now has Pro access');
      console.log('   Product:', packageToPurchase.product.identifier);
      
      return {
        success: true,
        customerInfo,
      };
    }
    
    console.warn('⚠️ Purchase completed but no Pro entitlement found');
    return {
      success: false,
      customerInfo,
    };
  } catch (error: any) {
    // Check if user cancelled the purchase
    if (error.userCancelled) {
      console.log('🚫 User cancelled purchase');
      return {
        success: false,
        cancelled: true,
      };
    }
    
    // Other purchase errors
    console.error('❌ Purchase error:', error.message);
    return {
      success: false,
      error: error.message || 'Purchase failed',
    };
  }
};

/**
 * Restore previous purchases
 * Useful when user reinstalls app or switches devices
 * In development/Expo Go, simulates no purchases to restore
 */
export const restorePurchases = async (): Promise<{
  success: boolean;
  hasProAccess: boolean;
  error?: string;
}> => {
  if (isDevelopmentMode()) {
    console.log('⏭️ Skipping restore in development mode');
    return {
      success: true,
      hasProAccess: false, // No purchases in dev mode
    };
  }

  try {
    console.log('🔄 Restoring purchases...');
    
    const customerInfo = await Purchases.restorePurchases();
    
    const hasProAccess = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    
    if (hasProAccess) {
      console.log('✅ Purchases restored! User has Pro access');
      console.log('   Active entitlements:', Object.keys(customerInfo.entitlements.active));
    } else {
      console.log('ℹ️ No active purchases to restore');
    }
    
    return {
      success: true,
      hasProAccess,
    };
  } catch (error: any) {
    console.error('❌ Restore error:', error.message);
    return {
      success: false,
      hasProAccess: false,
      error: error.message || 'Failed to restore purchases',
    };
  }
};

/**
 * Get detailed customer information
 * @returns Promise with customer info and Pro status
 * In development/Expo Go, returns simulated premium access
 */
export const getCustomerInfo = async (): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  hasProAccess: boolean;
  activeSubscriptions: string[];
  error?: string;
}> => {
  if (isDevelopmentMode()) {
    console.log('⏭️ Skipping customer info fetch in development mode');
    return {
      success: true,
      hasProAccess: true, // Grant premium in dev mode
      activeSubscriptions: [],
    };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    
    const hasProAccess = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    const activeSubscriptions = Object.keys(customerInfo.entitlements.active);
    
    console.log('👤 Customer Info:');
    console.log('   Has Pro:', hasProAccess);
    console.log('   Active subs:', activeSubscriptions.join(', ') || 'none');
    
    return {
      success: true,
      customerInfo,
      hasProAccess,
      activeSubscriptions,
    };
  } catch (error: any) {
    console.error('❌ Error getting customer info:', error.message);
    return {
      success: false,
      hasProAccess: false,
      activeSubscriptions: [],
      error: error.message || 'Failed to get customer info',
    };
  }
};

/**
 * Check if user is in free trial
 * In development/Expo Go, returns false (user has full access)
 */
export const isInFreeTrial = async (): Promise<boolean> => {
  if (isDevelopmentMode()) {
    return false; // Not in trial, has full access in dev mode
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    
    if (proEntitlement) {
      // Check if this is an intro/trial period
      const isTrial = proEntitlement.periodType === 'TRIAL' || 
                      proEntitlement.periodType === 'INTRO';
      
      console.log('🎁 Trial Status:', isTrial);
      return isTrial;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking trial status:', error);
    return false;
  }
};

/**
 * Get subscription expiration date
 * In development/Expo Go, returns null (no expiration)
 */
export const getSubscriptionExpirationDate = async (): Promise<Date | null> => {
  if (isDevelopmentMode()) {
    return null; // No expiration in dev mode
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
    
    if (proEntitlement && proEntitlement.expirationDate) {
      return new Date(proEntitlement.expirationDate);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting expiration date:', error);
    return null;
  }
};