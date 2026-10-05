import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const PRIVACY_POLICY_URL =
  'https://tajathedev.github.io/homeschoolhub-support/privacy.html';

export default function PrivacyPolicy() {
  const router = useRouter();

  useEffect(() => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.body}>
        <Text style={styles.hint}>Opening the Privacy Policy in your browser…</Text>
        <TouchableOpacity onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} activeOpacity={0.7}>
          <Text style={styles.link}>Open Privacy Policy</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.h3,
    fontSize: 18,
  },
  body: {
    padding: 24,
    gap: 12,
  },
  hint: {
    ...Typography.body,
    color: Colors.ui.textLight,
  },
  link: {
    ...Typography.label,
    color: Colors.brand[600],
  },
});
