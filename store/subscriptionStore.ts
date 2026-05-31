/**
 * Subscription store using Zustand
 * Manages trial and paid subscription status via Supabase and RevenueCat
 */

import { create } from 'zustand';
import Constants from 'expo-constants';
import {
  convertUserTrial,
  ensureUserTrial,
  getDaysRemaining,
} from '@/lib/trial';
import { supabase } from '@/lib/supabase/client';
import type { SubscriptionPlan } from '@/types/database';

const PRO_ENTITLEMENT_ID = 'The Homeschool Hub Pro';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export type SubscriptionInfo = {
  userId: string;
  trialStartDate: string | null;
  trialEndDate: string | null;
  subscriptionStatus: SubscriptionStatus;
  daysRemaining: number;
  hasAccess: boolean;
};

type SubscriptionStore = {
  subscriptionInfo: SubscriptionInfo | null;
  loading: boolean;
  checkSubscription: () => Promise<SubscriptionInfo>;
  startTrial: () => Promise<void>;
  updateSubscriptionStatus: () => Promise<void>;
};

/**
 * Returns true when running in Expo Go (RevenueCat unavailable).
 */
function isDevelopmentMode(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Lazily loads RevenueCat to avoid native module issues in Expo Go.
 */
async function getRevenueCatCustomerInfo() {
  if (isDevelopmentMode()) {
    return null;
  }

  try {
    const Purchases = (await import('react-native-purchases')).default;
    return Purchases.getCustomerInfo();
  } catch (error) {
    console.log('ℹ️ RevenueCat unavailable:', error);
    return null;
  }
}

/**
 * Updates store state only when subscription info meaningfully changed.
 */
function setSubscriptionInfo(
  set: (partial: Partial<{ subscriptionInfo: SubscriptionInfo | null; loading: boolean }>) => void,
  info: SubscriptionInfo
) {
  set((state) => {
    const current = state.subscriptionInfo;
    if (
      current?.subscriptionStatus === info.subscriptionStatus &&
      current?.daysRemaining === info.daysRemaining &&
      current?.hasAccess === info.hasAccess &&
      current?.trialEndDate === info.trialEndDate
    ) {
      return { loading: false };
    }

    return { subscriptionInfo: info, loading: false };
  });
}

/**
 * Builds a dev fallback when Supabase trial tables/RPCs are not available yet.
 */
function buildDevFallbackTrialInfo(userId: string): SubscriptionInfo {
  const startedAt = new Date().toISOString();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return buildTrialSubscriptionInfo(
    userId,
    startedAt,
    expiresAt.toISOString(),
    'active'
  );
}

/**
 * Maps RevenueCat product identifier to a subscription plan.
 */
function getPlanFromProductId(productId: string | undefined): SubscriptionPlan | undefined {
  if (!productId) return undefined;
  if (productId.includes('annual') || productId.includes('yearly')) return 'annual';
  if (productId.includes('monthly')) return 'monthly';
  return undefined;
}

/**
 * Builds subscription info from an active RevenueCat entitlement.
 */
function buildActiveSubscriptionInfo(userId: string): SubscriptionInfo {
  return {
    userId,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStatus: 'active',
    daysRemaining: 999,
    hasAccess: true,
  };
}

/**
 * Maps a Supabase user_trials record to SubscriptionInfo.
 */
function buildTrialSubscriptionInfo(
  userId: string,
  startedAt: string,
  expiresAt: string,
  status: string
): SubscriptionInfo {
  const daysRemaining = getDaysRemaining(expiresAt);
  const isExpired = status === 'expired' || (status === 'active' && daysRemaining === 0);
  const isConverted = status === 'converted';

  let subscriptionStatus: SubscriptionStatus = 'trial';
  if (isExpired) {
    subscriptionStatus = 'expired';
  } else if (isConverted) {
    subscriptionStatus = 'active';
  }

  const hasAccess = !isExpired && (daysRemaining > 0 || isConverted);

  return {
    userId,
    trialStartDate: startedAt,
    trialEndDate: expiresAt,
    subscriptionStatus,
    daysRemaining: Math.max(0, daysRemaining),
    hasAccess,
  };
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  subscriptionInfo: null,
  loading: false,

  checkSubscription: async () => {
    try {
      set({ loading: true });

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        set({ loading: false });
        throw new Error('Not authenticated');
      }

      console.log('🔍 Checking subscription for user:', user.id);

      // First check RevenueCat for paid subscription
      const customerInfo = await getRevenueCatCustomerInfo();
      if (customerInfo) {
        try {
          const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
          const hasActiveEntitlement = proEntitlement !== undefined;

          if (hasActiveEntitlement) {
            console.log('💎 User has active RevenueCat subscription');

            const plan = getPlanFromProductId(proEntitlement.productIdentifier);
            await convertUserTrial(plan);

            const info = buildActiveSubscriptionInfo(user.id);
            setSubscriptionInfo(set, info);
            return info;
          }
        } catch (rcError) {
          console.log('ℹ️ No RevenueCat subscription found, checking trial', rcError);
        }
      }

      // Check Supabase (or local fallback) for trial status
      const trialInfo = await ensureUserTrial();

      if (!trialInfo) {
        console.warn('⚠️ Trial status unavailable — using fallback access');
        const info = buildDevFallbackTrialInfo(user.id);
        setSubscriptionInfo(set, info);
        return info;
      }

      const { trial } = trialInfo;

      console.log('📊 Subscription status:', {
        status: trial.status,
        daysRemaining: trialInfo.daysRemaining,
        hasAccess: trialInfo.isActive || trialInfo.isConverted,
      });

      const info = buildTrialSubscriptionInfo(
        user.id,
        trial.started_at,
        trial.expires_at,
        trial.status
      );

      setSubscriptionInfo(set, info);
      return info;
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      set({ loading: false });
      throw error;
    }
  },

  startTrial: async () => {
    if (!supabase) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    console.log('🆕 Starting trial for user:', user.id);

    await ensureUserTrial();
    await get().checkSubscription();
  },

  updateSubscriptionStatus: async () => {
    try {
      await get().checkSubscription();
    } catch (error) {
      // Expected when user is logged out or Supabase trial migration is pending
      console.log('ℹ️ Subscription status update skipped:', error);
    }
  },
}));

export default useSubscriptionStore;
