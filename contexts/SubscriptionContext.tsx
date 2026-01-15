import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkProStatus } from '@/lib/revenuecat';
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

// Check if we're in Expo Go or development mode
const isDevelopmentMode = (): boolean => {
  const isExpoGo = Constants.appOwnership === 'expo';
  const isDev = __DEV__;
  return isExpoGo || isDev;
};

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      
      // In development mode, grant premium access immediately
      if (isDevelopmentMode()) {
        console.log('🔄 Subscription status (Dev Mode): Granting premium access');
        setHasSubscription(true);
        setIsLoading(false);
        return;
      }
      
      // In production, check actual subscription status
      const hasAccess = await checkProStatus();
      setHasSubscription(hasAccess);
      console.log('🔄 Subscription status:', hasAccess ? 'Active' : 'Inactive');
    } catch (error) {
      console.error('Error checking subscription:', error);
      // In dev mode, still grant access on error
      if (isDevelopmentMode()) {
        setHasSubscription(true);
      } else {
        setHasSubscription(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // In development mode, set premium immediately without async check
    if (isDevelopmentMode()) {
      console.log('⚡ Development mode detected - granting premium access');
      setHasSubscription(true);
      setIsLoading(false);
    } else {
      refreshSubscriptionStatus();
    }
  }, []);

  return (
    <SubscriptionContext.Provider 
      value={{ hasSubscription, isLoading, refreshSubscriptionStatus }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}