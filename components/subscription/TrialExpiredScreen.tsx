import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { checkSubscriptionStatus } from '@/lib/revenuecat';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Crown, Lock } from 'lucide-react-native';
import React, { useCallback } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrialExpiredScreen() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      // Check if they subscribed when they return to this screen
      const checkStatus = async () => {
        const isSubscribed = await checkSubscriptionStatus();
        if (isSubscribed) {
          // They subscribed! Reload the app
          router.replace('/(tabs)');
        }
      };
      
      checkStatus();
    }, [router])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Lock size={64} color={Colors.accent[500]} strokeWidth={1.5} />
        </View>

        <Text style={styles.title}>Trial Expired</Text>
        <Text style={styles.description}>
          Your free trial has ended. Subscribe to continue using HomeschoolHub and access all premium features.
        </Text>

        <TouchableOpacity
          style={styles.subscribeButton}
          onPress={() => router.push('/settings/subscription')}
          activeOpacity={0.8}
        >
          <Crown size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
        </TouchableOpacity>

        <Text style={styles.finePrint}>
          Subscribe to unlock unlimited lessons, photo attachments, progress tracking, and more!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    ...Typography.h2,
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 16,
    color: Colors.ui.text,
  },
  description: {
    ...Typography.body,
    textAlign: 'center',
    color: Colors.ui.textLight,
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  subscribeButton: {
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  subscribeButtonText: {
    ...Typography.button,
    fontSize: 18,
    color: 'white',
    fontFamily: 'Quicksand_600SemiBold',
  },
  finePrint: {
    ...Typography.caption,
    fontSize: 12,
    textAlign: 'center',
    color: Colors.ui.textLight,
    marginTop: 24,
    paddingHorizontal: 32,
    lineHeight: 18,
  },
});


