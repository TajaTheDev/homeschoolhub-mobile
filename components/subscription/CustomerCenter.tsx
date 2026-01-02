import React from 'react';
import { Alert } from 'react-native';
import { RevenueCatUI, CUSTOMER_CENTER_RESULT } from 'react-native-purchases-ui';

/**
 * Present RevenueCat Customer Center
 * Allows users to manage their subscription
 */
export const presentCustomerCenter = async () => {
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
