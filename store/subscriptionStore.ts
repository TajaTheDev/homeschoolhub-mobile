/**
 * Subscription store using Zustand
 * Manages trial and paid subscription status via Supabase and RevenueCat
 *
 * Access model: see docs/subscription-access.md
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

const PRO_ENTITLEMENT_ID = 'pro';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export type AccessLevel = 'full' | 'readonly' | 'locked';

export type SubscriptionInfo = {
  userId: string;
  trialStartDate: string | null;
  trialEndDate: string | null;
  subscriptionStatus: SubscriptionStatus;
  daysRemaining: number;
  accessLevel: AccessLevel;
  /** May open main app (tabs), including read-only expired trial */
  canEnterApp: boolean;
  /** May create or mutate homeschool data */
  canEdit: boolean;
};

type SubscriptionStore = {
  subscriptionInfo: SubscriptionInfo | null;
  loading: boolean;
  checkSubscription: () => Promise<SubscriptionInfo>;
  startTrial: () => Promise<void>;
  updateSubscriptionStatus: () => Promise<void>;
};

function accessFromLevel(level: AccessLevel): Pick<SubscriptionInfo, 'accessLevel' | 'canEnterApp' | 'canEdit'> {
  switch (level) {
    case 'full':
      return { accessLevel: 'full', canEnterApp: true, canEdit: true };
    case 'readonly':
      return { accessLevel: 'readonly', canEnterApp: true, canEdit: false };
    case 'locked':
      return { accessLevel: 'locked', canEnterApp: false, canEdit: false };
  }
}

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
      current?.accessLevel === info.accessLevel &&
      current?.canEnterApp === info.canEnterApp &&
      current?.canEdit === info.canEdit &&
      current?.trialEndDate === info.trialEndDate
    ) {
      return { loading: false };
    }

    return { subscriptionInfo: info, loading: false };
  });
}

/**
 * Trial could not be resolved or user is not authenticated — no app entry.
 */
function buildLockedSubscriptionInfo(userId: string): SubscriptionInfo {
  return {
    userId,
    trialStartDate: null,
    trialEndDate: null,
    subscriptionStatus: 'expired',
    daysRemaining: 0,
    ...accessFromLevel('locked'),
  };
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
    ...accessFromLevel('full'),
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

  const accessLevel: AccessLevel = isConverted ? 'full' : isExpired ? 'readonly' : 'full';

  return {
    userId,
    trialStartDate: startedAt,
    trialEndDate: expiresAt,
    subscriptionStatus,
    daysRemaining: Math.max(0, daysRemaining),
    ...accessFromLevel(accessLevel),
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
        const info = buildLockedSubscriptionInfo('');
        set({ loading: false });
        return info;
      }

      // First check RevenueCat for paid subscription
      const customerInfo = await getRevenueCatCustomerInfo();
      if (customerInfo) {
        try {
          const proEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT_ID];
          const hasActiveEntitlement = proEntitlement !== undefined;

          if (hasActiveEntitlement) {
            const plan = getPlanFromProductId(proEntitlement.productIdentifier);
            await convertUserTrial(plan);

            const info = buildActiveSubscriptionInfo(user.id);
            setSubscriptionInfo(set, info);
            return info;
          }
        } catch {
          // No RevenueCat subscription — fall through to trial check
        }
      }

      // Check Supabase (or local fallback) for trial status
      const trialInfo = await ensureUserTrial();

      if (!trialInfo) {
        console.warn('⚠️ Trial status unavailable — denying app entry');
        const info = buildLockedSubscriptionInfo(user.id);
        setSubscriptionInfo(set, info);
        return info;
      }

      const { trial } = trialInfo;

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

    await ensureUserTrial();
    await get().checkSubscription();
  },

  updateSubscriptionStatus: async () => {
    try {
      await get().checkSubscription();
    } catch {
      // Expected when user is logged out or Supabase trial migration is pending
    }
  },
}));

export default useSubscriptionStore;
