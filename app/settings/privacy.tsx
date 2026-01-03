import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: January 3, 2026</Text>
        
        <Text style={styles.section}>1. Information We Collect</Text>
        <Text style={styles.text}>
          We collect information you provide directly to us, including your name, 
          email address, and student information you choose to add to the app.
        </Text>
        
        <Text style={styles.section}>2. How We Use Your Information</Text>
        <Text style={styles.text}>
          We use your information to provide, maintain, and improve our services, 
          including tracking your homeschool progress and generating reports.
        </Text>
        
        <Text style={styles.section}>3. Data Security</Text>
        <Text style={styles.text}>
          We use industry-standard encryption and security measures to protect 
          your data. Your information is stored securely on Supabase servers.
        </Text>
        
        <Text style={styles.section}>4. Your Rights</Text>
        <Text style={styles.text}>
          You have the right to access, update, or delete your personal information 
          at any time through the app settings.
        </Text>
        
        <Text style={styles.section}>5. Children's Privacy (COPPA Compliance)</Text>
        <Text style={styles.text}>
          HomeschoolHub is designed for parents to manage their children's education. 
          We do not knowingly collect personal information directly from children under 13. 
          All data is collected and managed by parents or guardians.
        </Text>
        
        <Text style={styles.section}>6. Contact Us</Text>
        <Text style={styles.text}>
          If you have questions about this Privacy Policy, contact us at:{'\n'}
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

