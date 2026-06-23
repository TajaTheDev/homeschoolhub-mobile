/**
 * Signup screen for new users
 */

import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUCCESS_FALLBACK_MS = 6000;
const FADE_OUT_MS = 450;

export default function SignupScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  const hasNavigatedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const navigateToLogin = useCallback(() => {
    if (hasNavigatedRef.current) {
      return;
    }
    hasNavigatedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        router.replace('/(auth)/login');
      }
    });
  }, [fadeAnim, router]);

  useEffect(() => {
    if (!showSuccess) {
      return;
    }

    fadeAnim.setValue(1);
    hasNavigatedRef.current = false;

    const confettiTimer = setTimeout(() => confettiRef.current?.start(), 150);
    const fallbackTimer = setTimeout(() => navigateToLogin(), SUCCESS_FALLBACK_MS);

    return () => {
      clearTimeout(confettiTimer);
      clearTimeout(fallbackTimer);
    };
  }, [showSuccess, fadeAnim, navigateToLogin]);

  const handleSignup = async () => {
    if (isSubmitting || showSuccess) {
      return;
    }

    try {
      if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert('Error', 'Please fill in all fields');
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

      setIsSubmitting(true);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Signup Error', error.message);
        setIsSubmitting(false);
        return;
      }

      if (!data.user) {
        Alert.alert('Error', 'Failed to create account. Please try again.');
        setIsSubmitting(false);
        return;
      }

      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      await supabase.auth.signOut();
      setShowSuccess(true);
    } catch (err) {
      console.error('Signup exception:', err);
      Alert.alert('Error', 'Something went wrong');
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Animated.View style={[styles.successContainer, { opacity: fadeAnim }]}>
          <ConfettiCannon
            count={250}
            origin={{ x: -10, y: 0 }}
            autoStart={false}
            ref={confettiRef}
            fadeOut
            fallSpeed={2200}
            colors={[
              Colors.brand[400],
              Colors.brand[500],
              Colors.secondary[400],
              Colors.accent[400],
              '#FFFFFF',
            ]}
          />
          <View style={styles.checkCircle}>
            <Check size={48} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Welcome to The Homeschool Hub!</Text>
          <Text style={styles.successSubtitle}>
            Your account is ready — let&apos;s get you signed in
          </Text>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={navigateToLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Continue to Login</Text>
          </TouchableOpacity>
        </Animated.View>
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
              onPress={() => router.replace('/(auth)/onboarding')}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={Colors.brand[600]} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.subtitle}>Start your homeschool journey today</Text>

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
            />

            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
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
              placeholder="Confirm Password"
              placeholderTextColor={Colors.ui.textLight}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              textContentType="newPassword"
            />

            <TouchableOpacity
              style={[styles.signupButton, isSubmitting && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.linkText}>Log In</Text>
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
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 18,
    color: Colors.brand[700],
    marginBottom: 24,
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
  signupButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  linkText: {
    fontSize: 16,
    color: Colors.brand[600],
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.brand[900],
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 17,
    color: Colors.brand[700],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  continueButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
