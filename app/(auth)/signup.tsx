/**
 * Signup screen for new users
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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignup = async () => {
    try {
      console.log('🔐 Starting signup...');
      console.log('📧 Email:', email);
      console.log('🔑 Password length:', password?.length);
      
      // Validation
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

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });
      
      console.log('📊 Signup response:', JSON.stringify(data, null, 2));
      console.log('❌ Signup error:', error);
      
      if (error) {
        console.error('❌ Signup failed:', error.message);
        Alert.alert('Signup Error', error.message);
        return;
      }
      
      // CRITICAL: Check what we got back
      console.log('✅ Signup successful!');
      console.log('📱 Session exists?', !!data.session);
      console.log('👤 User exists?', !!data.user);
      console.log('👤 User ID:', data.user?.id);
      console.log('📧 User email:', data.user?.email);
      
      if (data.session) {
        console.log('✅ Session created, going to interactive onboarding');
        // Mark onboarding welcome as seen
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        Alert.alert('Success', 'Account created!');
        // Navigate to interactive onboarding
        router.replace('/onboarding');
      } else {
        console.log('⚠️ No session after signup!');
        Alert.alert('Account Created', 'Account created! Please login.');
        router.replace('/(auth)/login');
      }
      
    } catch (err) {
      console.error('🚨 Signup exception:', err);
      Alert.alert('Error', 'Something went wrong');
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
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.signupButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
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
});

