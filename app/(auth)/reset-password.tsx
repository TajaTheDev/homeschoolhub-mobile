/**
 * Enter recovery code and set a new password.
 */

import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

const INVALID_CODE_MESSAGE =
  'That code is invalid or expired. Request a new one.';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const email = typeof emailParam === 'string' ? emailParam.trim() : '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/forgot-password');
    }
  }, [email, router]);

  const handleRequestNewCode = () => {
    router.replace({
      pathname: '/(auth)/forgot-password',
      params: email ? { email } : {},
    });
  };

  const handleUpdatePassword = async () => {
    setCodeError(null);
    setPasswordError(null);

    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setCodeError('Enter the code from your email.');
      return;
    }

    if (!/^\d+$/.test(trimmedCode)) {
      setCodeError('Enter a valid numeric code from your email.');
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      setPasswordError('Please fill in both password fields.');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (!supabase) {
      Alert.alert('Error', 'Unable to connect. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'recovery',
      });

      if (verifyError) {
        console.error('verifyOtp recovery error:', verifyError.message);
        setCodeError(INVALID_CODE_MESSAGE);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error('updateUser password error:', updateError.message);
        Alert.alert('Error', updateError.message || 'Failed to update password.');
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

  if (!email) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredContent}>
          <ActivityIndicatorPlaceholder />
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
            <Text style={styles.subtitle}>
              Enter the code sent to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            <Text style={styles.fieldLabel}>Recovery code</Text>
            <TextInput
              style={[styles.input, codeError ? styles.inputError : null]}
              placeholder="Code from email"
              placeholderTextColor={Colors.ui.textLight}
              value={code}
              onChangeText={(value) => {
                setCode(value.replace(/\D/g, ''));
                if (codeError) setCodeError(null);
              }}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              editable={!isSubmitting}
            />
            {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}

            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              style={styles.input}
              placeholder="New password (min 6 characters)"
              placeholderTextColor={Colors.ui.textLight}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (passwordError) setPasswordError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!isSubmitting}
            />

            <Text style={styles.fieldLabel}>Confirm password</Text>
            <TextInput
              style={[styles.input, passwordError ? styles.inputError : null]}
              placeholder="Confirm new password"
              placeholderTextColor={Colors.ui.textLight}
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (passwordError) setPasswordError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
              editable={!isSubmitting}
            />
            {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handleUpdatePassword}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Updating...' : 'Update password'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRequestNewCode}
              disabled={isSubmitting}
              style={styles.secondaryLink}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>Request a new code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActivityIndicatorPlaceholder() {
  return <Text style={styles.subtitle}>Loading…</Text>;
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
    alignItems: 'center',
    padding: 20,
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
    gap: 8,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.brand[700],
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 26,
  },
  emailHighlight: {
    fontWeight: '600',
    color: Colors.brand[900],
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginTop: 8,
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
    marginBottom: 4,
  },
  inputError: {
    borderColor: Colors.ui.error,
  },
  errorText: {
    fontSize: 14,
    color: Colors.ui.error,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
    paddingVertical: 16,
  },
  linkText: {
    fontSize: 16,
    color: Colors.brand[600],
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
