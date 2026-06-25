/**
 * Set a new password after opening the recovery deep link.
 */

import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyRecoverySession = async () => {
      if (!supabase) {
        setSessionReady(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setSessionReady(!!session);
    };

    void verifyRecoverySession();
  }, []);

  const handleUpdatePassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!supabase) {
      Alert.alert('Error', 'Unable to connect. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(
          'Link expired',
          'This reset link is invalid or has expired. Please request a new one.',
          [
            {
              text: 'Request new link',
              onPress: () => router.replace('/(auth)/forgot-password'),
            },
          ]
        );
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error('updateUser password error:', error);
        Alert.alert('Error', error.message || 'Failed to update password. Please try again.');
        return;
      }

      await supabase.auth.signOut();

      Alert.alert(
        'Password updated',
        'Your password has been changed. Please sign in with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (err) {
      console.error('Reset password exception:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionReady === false) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredContent}>
          <Text style={styles.subtitle}>
            This reset link is invalid or has expired. Request a new link to continue.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(auth)/forgot-password')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Request new link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}
            style={styles.secondaryLink}
          >
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.title}>New Password</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>

            <TextInput
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={Colors.ui.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.ui.textLight}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
            />

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={isSubmitting || sessionReady === null}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Updating...' : 'Update password'}
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
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
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
    textAlign: 'center',
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
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 16,
    color: Colors.brand[600],
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
