import Colors from '@/constants/Colors';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

/**
 * Branded full-screen loading state: house icon + spinner on brand purple.
 */
export default function BrandLoadingScreen() {
  return (
    <View style={styles.container} accessibilityLabel="Loading">
      <Image
        source={require('@/assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <ActivityIndicator
        size="large"
        color={Colors.brand[500]}
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  spinner: {
    marginTop: 24,
  },
});
