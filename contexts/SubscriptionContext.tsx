import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkProStatus } from '@/lib/revenuecat';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import Constants from 'expo-constants';

interface SubscriptionContextType {
  hasSubscription: boolean;
  isLoading: boolean;
  refreshSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  hasSubscription: false,
  isLoading: true,
  refreshSubscriptionStatus: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

interface SubscriptionProviderProps {
  children: ReactNode;
}

/**
 * Returns true when running in Expo Go.
 */
function isDevelopmentMode(): boolean {
  return Constants.appOwnership === 'expo';
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscriptionStatus = async () => {
    try {
      setIsLoading(true);

      // Use the subscription store for trial + paid status
      try {
        const info = await useSubscriptionStore.getState().checkSubscription();
        setHasSubscription(info.subscriptionStatus === 'active');
        console.log('🔄 Subscription status:', info.subscriptionStatus);
        return;
      } catch (storeError) {
        console.log('ℹ️ Subscription store check skipped:', storeError);
      }

      // Fallback for logged-out sessions in production builds
      if (!isDevelopmentMode()) {
        const hasAccess = await checkProStatus();
        setHasSubscription(hasAccess);
      } else {
        setHasSubscription(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasSubscription(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscriptionStatus();
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{ hasSubscription, isLoading, refreshSubscriptionStatus }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
