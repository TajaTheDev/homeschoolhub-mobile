import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: January 3, 2026</Text>
        
        <Text style={styles.section}>1. Acceptance of Terms</Text>
        <Text style={styles.text}>
          By accessing and using HomeschoolHub, you accept and agree to be bound by 
          the terms and provision of this agreement.
        </Text>
        
        <Text style={styles.section}>2. Use License</Text>
        <Text style={styles.text}>
          Permission is granted to temporarily use HomeschoolHub for personal, 
          non-commercial homeschool management purposes. This license does not include 
          any resale or commercial use of the app.
        </Text>
        
        <Text style={styles.section}>3. User Account</Text>
        <Text style={styles.text}>
          You are responsible for maintaining the confidentiality of your account 
          and password. You agree to accept responsibility for all activities that 
          occur under your account.
        </Text>
        
        <Text style={styles.section}>4. User Content</Text>
        <Text style={styles.text}>
          You retain ownership of all content you upload to HomeschoolHub. By using 
          the service, you grant us a license to store and process your data to 
          provide the service.
        </Text>
        
        <Text style={styles.section}>5. Prohibited Uses</Text>
        <Text style={styles.text}>
          You may not use HomeschoolHub in any way that could damage, disable, 
          overburden, or impair the service or interfere with any other party's use 
          of the service.
        </Text>
        
        <Text style={styles.section}>6. Limitation of Liability</Text>
        <Text style={styles.text}>
          HomeschoolHub shall not be liable for any indirect, incidental, special, 
          consequential, or punitive damages resulting from your use of the service.
        </Text>
        
        <Text style={styles.section}>7. Changes to Terms</Text>
        <Text style={styles.text}>
          We reserve the right to modify these terms at any time. Your continued use 
          of the service after changes constitutes acceptance of the new terms.
        </Text>
        
        <Text style={styles.section}>8. Contact Information</Text>
        <Text style={styles.text}>
          If you have questions about these Terms of Service, contact us at:{'\n'}
          support@homeschoolhub.com
        </Text>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: Colors.ui.text,
  },
  updated: {
    fontSize: 14,
    color: Colors.ui.textLight,
    marginBottom: 32,
  },
  section: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
    color: Colors.ui.text,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.ui.textLight,
    marginBottom: 16,
  },
});

