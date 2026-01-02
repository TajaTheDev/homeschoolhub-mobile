import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkProStatus } from '@/lib/revenuecat';

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

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      const hasAccess = await checkProStatus();
      setHasSubscription(hasAccess);
      console.log('🔄 Subscription status:', hasAccess ? 'Active' : 'Inactive');
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