/**
 * Login screen for existing users
 */

import Colors from '@/constants/Colors';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleDevResetOnboarding = async () => {
    await AsyncStorage.multiRemove(['hasSeenOnboarding', 'hasCompletedOnboarding']);
    Alert.alert('Flags cleared - restart app');
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      console.log('[LOGIN]', { hasSession: false, hasCompletedOnboarding: null, destination: 'alert:missing-fields' });
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const result = await signIn(email.trim(), password);

    if (!result.success) {
      console.log('[LOGIN]', { hasSession: false, hasCompletedOnboarding: null, destination: 'alert:login-failed' });
      Alert.alert('Login Failed', result.error || 'An error occurred');
      return;
    }

    let session = result.session ?? null;

    if (!session) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const { data: { session: retriedSession } } = await supabase.auth.getSession();
      session = retriedSession ?? null;
    }

    if (!session) {
      console.log('[LOGIN]', { hasSession: false, hasCompletedOnboarding: null, destination: 'alert:no-session' });
      Alert.alert("Couldn't establish your session", 'Please try again.');
      return;
    }

    await AsyncStorage.setItem('hasSeenOnboarding', 'true');

    const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');

    if (hasCompletedOnboarding !== 'true') {
      console.log('[LOGIN]', { hasSession: !!session, hasCompletedOnboarding, destination: '/setup' });
      router.replace('/setup');
    } else {
      console.log('[LOGIN]', { hasSession: !!session, hasCompletedOnboarding, destination: '/(tabs)' });
      router.replace('/(tabs)');
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
              onPress={() => router.replace('/(auth)/onboarding')}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={Colors.brand[600]} />
            </TouchableOpacity>
            <Text style={styles.title}>Welcome Back</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.form}>
            <Text style={styles.subtitle}>Log in to continue</Text>

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
              placeholder="Password"
              placeholderTextColor={Colors.ui.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Logging in...' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/signup')}>
              <Text style={styles.linkText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {__DEV__ && (
            <TouchableOpacity
              style={styles.devResetButton}
              onPress={handleDevResetOnboarding}
              activeOpacity={0.8}
            >
              <Text style={styles.devResetButtonText}>DEV: Reset Onboarding</Text>
            </TouchableOpacity>
          )}
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
  loginButton: {
    backgroundColor: Colors.brand[500],
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
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
  devResetButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.ui.border,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  devResetButtonText: {
    fontSize: 13,
    color: Colors.ui.textLight,
    fontWeight: '600',
  },
});

