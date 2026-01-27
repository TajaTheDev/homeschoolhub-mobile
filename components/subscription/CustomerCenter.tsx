import React from 'react';
import { Alert } from 'react-native';
import { RevenueCatUI, CUSTOMER_CENTER_RESULT } from 'react-native-purchases-ui';
import Constants from 'expo-constants';

/**
 * Check if we're in Expo Go
 * Only blocks Expo Go - allows TestFlight and production builds (including simulators)
 */
const isDevelopmentMode = (): boolean => {
  // Only check for Expo Go - don't block based on __DEV__
  // This allows TestFlight builds (even on simulators) to work
  const isExpoGo = Constants.appOwnership === 'expo';
  return isExpoGo;
};

/**
 * Present RevenueCat Customer Center
 * Allows users to manage their subscription
 * In development/Expo Go, shows a message that it's not available
 */
export const presentCustomerCenter = async () => {
  if (isDevelopmentMode()) {
    Alert.alert(
      'Development Mode',
      'Subscription management is not available in Expo Go. It will work in production builds.',
    );
    return;
  }

  try {
    console.log('📋 Presenting Customer Center...');
    
    const result = await RevenueCatUI.presentCustomerCenter();
    
    console.log('Customer Center result:', result);
    
    if (result === CUSTOMER_CENTER_RESULT.RESTORED) {
      Alert.alert(
        'Purchases Restored',
        'Your subscription has been restored successfully!'
      );
    }
  } catch (error) {
    console.error('Customer Center error:', error);
    Alert.alert('Error', 'Could not open subscription management');
  }
};
