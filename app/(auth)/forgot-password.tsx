/**
 * Request a password reset code by email.
 */

import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GENERIC_SUCCESS_MESSAGE =
  'If an account exists for that email, a recovery code has been sent.';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendCode = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!supabase) {
        Alert.alert('Error', 'Unable to connect. Please try again later.');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);

      if (error) {
        console.error('resetPasswordForEmail error:', error);
      }

      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: trimmedEmail },
      });
    } catch (err) {
      console.error('Forgot password exception:', err);
      Alert.alert('Check your email', GENERIC_SUCCESS_MESSAGE, [
        {
          text: 'Continue',
          onPress: () =>
            router.push({
              pathname: '/(auth)/reset-password',
              params: { email: trimmedEmail },
            }),
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={Colors.brand[600]} />
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.subtitle}>
              Enter your email and we&apos;ll send you a recovery code to reset your password.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.ui.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!isSubmitting}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleSendCode}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Sending...' : 'Send code'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand[50],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.brand[900],
    flex: 1,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.brand[700],
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: Colors.brand[200],
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 44,
    color: Colors.ui.text,
  },
  primaryButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
