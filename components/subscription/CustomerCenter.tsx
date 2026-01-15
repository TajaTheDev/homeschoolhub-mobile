import React from 'react';
import { Alert } from 'react-native';
import { RevenueCatUI, CUSTOMER_CENTER_RESULT } from 'react-native-purchases-ui';
import Constants from 'expo-constants';

/**
 * Check if we're in Expo Go or development mode
 */
const isDevelopmentMode = (): boolean => {
  const isExpoGo = Constants.appOwnership === 'expo';
  const isDev = __DEV__;
  return isExpoGo || isDev;
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
