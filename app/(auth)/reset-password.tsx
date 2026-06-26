/**
 * Set a new password after opening the recovery deep link.
 */

import Colors from '@/constants/Colors';
import {
  establishSessionFromRecoveryUrl,
  isRecoveryDeepLink,
} from '@/lib/recoveryDeepLink';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Waits for an existing session or establishes one from a recovery deep link.
 */
async function resolveRecoverySession(): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  const hasActiveSession = async (): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  };

  if (await hasActiveSession()) {
    console.log('[reset-password] Recovery session already active');
    return true;
  }

  const initialUrl = await Linking.getInitialURL();
  if (initialUrl && isRecoveryDeepLink(initialUrl)) {
    console.log('[reset-password] Attempting session from initial URL');
    const established = await establishSessionFromRecoveryUrl(initialUrl);
    if (established && (await hasActiveSession())) {
      console.log('[reset-password] Session established from initial URL');
      return true;
    }
  }

  // _layout may still be finishing establishSessionFromRecoveryUrl
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (await hasActiveSession()) {
    console.log('[reset-password] Session available after brief wait');
    return true;
  }

  if (initialUrl && isRecoveryDeepLink(initialUrl)) {
    console.log('[reset-password] Retrying session from initial URL');
    const established = await establishSessionFromRecoveryUrl(initialUrl);
    if (established && (await hasActiveSession())) {
      console.log('[reset-password] Session established on retry');
      return true;
    }
  }

  console.log('[reset-password] No recovery session could be established');
  return false;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runSessionCheck = async () => {
      const ready = await resolveRecoverySession();
      if (!cancelled) {
        setSessionReady(ready);
      }
    };

    void runSessionCheck();

    const subscription = Linking.addEventListener('url', (event) => {
      void (async () => {
        if (!isRecoveryDeepLink(event.url)) {
          return;
        }

        console.log('[reset-password] Recovery URL received while on screen');
        const established = await establishSessionFromRecoveryUrl(event.url);
        if (!cancelled && established && supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            setSessionReady(true);
          }
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const showLinkExpiredAlert = () => {
    Alert.alert(
      'Link expired',
      'This reset link is invalid or has expired. Please request a new one.',
      [
        {
          text: 'Request new link',
          onPress: () => router.replace('/(auth)/forgot-password'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleUpdatePassword = async () => {
    console.log('[reset-password] Update pressed', { sessionReady, isSubmitting });

    if (sessionReady === null) {
      Alert.alert(
        'Please wait',
        'Still verifying your reset link. Try again in a moment.'
      );
      return;
    }

    if (sessionReady === false) {
      showLinkExpiredAlert();
      return;
    }

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log('[reset-password] Session before updateUser', {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });

      if (!session) {
        setSessionReady(false);
        showLinkExpiredAlert();
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.log('[reset-password] updateUser failed:', error.message);
        Alert.alert('Error', error.message || 'Failed to update password. Please try again.');
        return;
      }

      console.log('[reset-password] updateUser succeeded');

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
      console.error('[reset-password] Reset password exception:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCheckingSession = sessionReady === null;
  const isButtonDisabled = isCheckingSession || isSubmitting;

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

            {isCheckingSession ? (
              <Text style={styles.checkingHint}>Verifying your reset link…</Text>
            ) : null}

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
              editable={!isButtonDisabled}
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
              editable={!isButtonDisabled}
            />

            <TouchableOpacity
              style={[styles.primaryButton, isButtonDisabled && styles.primaryButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={isButtonDisabled}
              activeOpacity={0.8}
            >
              <View style={styles.buttonContent}>
                {isButtonDisabled ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : null}
                <Text style={styles.primaryButtonText}>
                  {isCheckingSession
                    ? 'Checking...'
                    : isSubmitting
                      ? 'Updating...'
                      : 'Update password'}
                </Text>
              </View>
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
  checkingHint: {
    fontSize: 14,
    color: Colors.brand[600],
    textAlign: 'center',
    marginBottom: 4,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
