import Purchases, { 
  LOG_LEVEL, 
  PurchasesOffering,
  CustomerInfo,
  PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase/client';

// API Keys - Production keys
const REVENUECAT_API_KEYS = {
  apple: 'appl_BmeebQGFfqrrGAdKaQwiyJkhsKC',    // Starts with appl_
  google: 'goog_PEXoSHKqKxPTXBZBxowodeuFrdD', // Starts with goog_
};

// Entitlement identifier
const PRO_ENTITLEMENT_ID = 'pro';

let revenueCatConfigured = false;
let pendingSupabaseUserId: string | null = null;
let authSyncRegistered = false;

/**
 * Returns true once Purchases.configure() has completed successfully.
 */
export function isRevenueCatConfigured(): boolean {
  return revenueCatConfigured;
}

/**
 * Persists the RevenueCat app user ID on the Supabase user_subscriptions row.
 */
async function persistRevenueCatCustomerId(
  supabaseUserId: string,
  appUserId: string
): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .upsert(
      {
        user_id: supabaseUserId,
        revenuecat_customer_id: appUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('❌ Failed to save revenuecat_customer_id:', error.message);
    return;
  }

  console.log('✅ Saved revenuecat_customer_id to user_subscriptions:', appUserId);
}

/**
 * Links the RevenueCat customer to the Supabase auth user via Purchases.logIn().
 * No-ops until Purchases.configure() has finished; queues the user id if needed.
 */
export async function identifyRevenueCatUser(supabaseUserId: string): Promise<void> {
  if (isDevelopmentMode()) {
    return;
  }

  if (!revenueCatConfigured) {
    pendingSupabaseUserId = supabaseUserId;
    return;
  }

  try {
    await Purchases.logIn(supabaseUserId);
    const appUserId = await Purchases.getAppUserID();
    console.log('✅ RevenueCat logIn:', supabaseUserId, '→ appUserId:', appUserId);
    await persistRevenueCatCustomerId(supabaseUserId, appUserId);
    pendingSupabaseUserId = null;
  } catch (error) {
    console.error('❌ RevenueCat logIn failed:', error);
  }
}

/**
 * Resets RevenueCat to an anonymous customer on sign-out.
 */
export async function logoutRevenueCatUser(): Promise<void> {
  pendingSupabaseUserId = null;

  if (isDevelopmentMode() || !revenueCatConfigured) {
    return;
  }

  try {
    await Purchases.logOut();
    console.log('✅ RevenueCat logOut complete');
  } catch (error) {
    console.error('❌ RevenueCat logOut failed:', error);
  }
}

/**
 * Ensures the current Supabase user is identified in RevenueCat before purchases.
 * @returns true when a user is signed in and identification succeeded or was queued.
 */
export async function ensureRevenueCatUserIdentified(): Promise<boolean> {
  if (isDevelopmentMode()) {
    return false;
  }

  if (!supabase) {
    return false;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    console.warn('⚠️ Cannot identify RevenueCat user — no Supabase session');
    return false;
  }

  await identifyRevenueCatUser(session.user.id);

  if (!revenueCatConfigured) {
    return false;
  }

  return true;
}

/**
 * Registers a single Supabase auth listener for RevenueCat logIn/logOut sync.
 */
function setupSupabaseRevenueCatAuthSync(): void {
  if (authSyncRegistered || !supabase || isDevelopmentMode()) {
    return;
  }

  authSyncRegistered = true;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!revenueCatConfigured) {
      if (session?.user) {
        pendingSupabaseUserId = session.user.id;
      }
      return;
    }

    if (
      (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
      session?.user
    ) {
      await identifyRevenueCatUser(session.user.id);
      return;
    }

    if (event === 'SIGNED_OUT') {
      await logoutRevenueCatUser();
    }
  });

  console.log('✅ RevenueCat auth sync listener registered');
}

/**
 * Presents the RevenueCat paywall after ensuring the user is identified.
 */
export async function presentPaywall(): Promise<PAYWALL_RESULT> {
  const identified = await ensureRevenueCatUserIdentified();
  if (!identified) {
    throw new Error('Must be signed in before subscribing');
  }

  if (!RevenueCatUI || typeof RevenueCatUI.presentPaywall !== 'function') {
    throw new Error('RevenueCat paywall is unavailable');
  }

  return RevenueCatUI.presentPaywall();
}

export { PAYWALL_RESULT };

/**
 * Check if we're in Expo Go
 * Only blocks Expo Go - allows TestFlight and production builds (including simulators)
 * Apple reviewers test on simulators, so we must allow purchases there
 */
const isDevelopmentMode = (): boolean => {
  // Only check for Expo Go - don't block based on __DEV__
  // This allows TestFlight builds (even on simulators) to work
  const isExpoGo = Constants.appOwnership === 'expo';
  
  return isExpoGo;
};

/**
 * Initialize RevenueCat SDK
 * Call this once when app starts (in _layout.tsx)
 * Skips initialization in Expo Go/development mode
 */
export const initializeRevenueCat = async (): Promise<boolean> => {
  if (revenueCatConfigured) {
    return true;
  }

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

    revenueCatConfigured = true;
    setupSupabaseRevenueCatAuthSync();

    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await identifyRevenueCatUser(session.user.id);
      } else if (pendingSupabaseUserId) {
        await identifyRevenueCatUser(pendingSupabaseUserId);
      }
    }

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
 * Check if user has the "pro" entitlement
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

  const identified = await ensureRevenueCatUserIdentified();
  if (!identified) {
    return {
      success: false,
      error: 'Must be signed in before purchasing',
    };
  }

  try {
    console.log('═══════════════════════════════════');
    console.log('💳 REVENUECAT: Starting purchase');
    console.log('═══════════════════════════════════');
    console.log('📦 Package ID:', packageToPurchase.identifier);
    console.log('🆔 Product ID:', packageToPurchase.product.identifier);
    console.log('💵 Price:', packageToPurchase.product.priceString);
    console.log('📅 Period:', packageToPurchase.product.subscriptionPeriod || 'N/A');
    
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(packageToPurchase);
    
    console.log('✅ RevenueCat API returned successfully');
    console.log('🆔 Product purchased:', productIdentifier);
    console.log('👤 Customer ID:', customerInfo.originalAppUserId);
    console.log('🎫 Active Entitlements:', Object.keys(customerInfo.entitlements.active));
    console.log('📅 Latest Expiration:', customerInfo.latestExpirationDate || 'N/A');
    
    // Check if purchase granted Pro access
    const hasProAccess = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
    
    if (hasProAccess) {
      console.log('🎉 Purchase successful! User now has Pro access');
      console.log('   Entitlement:', PRO_ENTITLEMENT_ID);
      const entitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
      console.log('   - Expiration:', entitlement.expirationDate || 'N/A');
      console.log('   - Product:', entitlement.productIdentifier || 'N/A');
      console.log('   - Will Renew:', entitlement.willRenew || 'N/A');
      console.log('═══════════════════════════════════');
      
      return {
        success: true,
        customerInfo,
      };
    }
    
    console.warn('⚠️ Purchase completed but no Pro entitlement found');
    console.warn('   Expected entitlement:', PRO_ENTITLEMENT_ID);
    console.warn('   Available entitlements:', Object.keys(customerInfo.entitlements.active));
    console.warn('   All entitlements:', Object.keys(customerInfo.entitlements.all));
    console.log('═══════════════════════════════════');
    
    return {
      success: false,
      customerInfo,
      error: 'Purchase completed but premium entitlement not found',
    };
  } catch (error: any) {
    console.log('═══════════════════════════════════');
    console.log('❌ REVENUECAT: Purchase Error');
    console.log('═══════════════════════════════════');
    console.error('Error type:', typeof error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('User cancelled:', error.userCancelled);
    console.error('Underlying error:', error.underlyingErrorMessage || 'N/A');
    console.error('Readable message:', error.readableErrorMessage || 'N/A');
    console.error('Store error code:', error.storeErrorCode || 'N/A');
    console.error('Store error string:', error.storeErrorString || 'N/A');
    
    // Log full error for debugging
    try {
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (stringifyError) {
      console.error('Full error object:', error);
    }
    console.log('═══════════════════════════════════');
    
    // Check if user cancelled the purchase
    if (error.userCancelled) {
      console.log('🚫 User cancelled purchase (no error shown)');
      return {
        success: false,
        cancelled: true,
      };
    }
    
    // Build comprehensive error message
    let errorMessage = 'Purchase failed';
    if (error.readableErrorMessage) {
      errorMessage = error.readableErrorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.underlyingErrorMessage) {
      errorMessage = error.underlyingErrorMessage;
    }
    
    // Add specific guidance for common errors
    if (error.code === 'PURCHASE_INVALID' || error.code === 'PRODUCT_NOT_AVAILABLE_FOR_PURCHASE') {
      errorMessage += ' - Product may not be configured correctly in App Store Connect.';
    } else if (error.code === 'PURCHASE_NOT_ALLOWED') {
      errorMessage += ' - In-app purchases may be disabled on this device.';
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage += ' - Please check your internet connection.';
    }
    
    return {
      success: false,
      error: errorMessage,
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

  const identified = await ensureRevenueCatUserIdentified();
  if (!identified) {
    return {
      success: false,
      hasProAccess: false,
      error: 'Must be signed in before restoring purchases',
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