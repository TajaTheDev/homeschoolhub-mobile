import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

export default function About() {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>📚</Text>
        </View>
        
        <Text style={styles.title}>HomeschoolHub</Text>
        <Text style={styles.version}>Version {appVersion} (Build {buildNumber})</Text>
        
        <Text style={styles.description}>
          Your complete homeschool management solution.
        </Text>
        
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>
            {Constants.platform?.ios ? 'iOS' : 'Android'}
          </Text>
        </View>
        
        <View style={styles.infoSection}>
          <Text style={styles.infoLabel}>Expo SDK</Text>
          <Text style={styles.infoValue}>
            {Constants.expoConfig?.sdkVersion || 'N/A'}
          </Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with ❤️ for homeschool families
          </Text>
          <Text style={styles.footerText}>
            © 2026 HomeschoolHub. All rights reserved.
          </Text>
        </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  version: {
    fontSize: 16,
    color: Colors.ui.textLight,
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
  },
  infoSection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
});

