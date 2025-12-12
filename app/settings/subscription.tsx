import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SubscriptionScreen() {
  const router = useRouter();

  const Feature = ({ text }: { text: string }) => (
    <View style={styles.feature}>
      <Check size={20} color={Colors.accent[500]} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan */}
        <View style={styles.currentPlanCard}>
          <Text style={styles.currentPlanBadge}>Current Plan</Text>
          <Text style={styles.currentPlanTitle}>Free</Text>
          <Text style={styles.currentPlanSubtitle}>Basic features included</Text>
        </View>

        {/* Pro Plan */}
        <View style={styles.proCard}>
          <View style={styles.proHeader}>
            <Text style={styles.proTitle}>HomeschoolHub Pro</Text>
            <View style={styles.priceContainer}>
              <Text style={styles.priceAmount}>$4.99</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
          </View>

          <View style={styles.featuresContainer}>
            <Feature text="Track up to 5 students" />
            <Feature text="Unlimited lessons" />
            <Feature text="Photo attachments" />
            <Feature text="Export reports (CSV)" />
            <Feature text="Priority support" />
            <Feature text="Early access to new features" />
          </View>

          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Coming Soon!</Text>
          </TouchableOpacity>

          <Text style={styles.comingSoonNote}>
            In-app purchases will be available when the app launches on the App Store.
          </Text>
        </View>

        {/* Free vs Pro Comparison */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Free vs Pro</Text>
          
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Students</Text>
            <Text style={styles.comparisonFree}>1</Text>
            <Text style={styles.comparisonPro}>5</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Lessons/Month</Text>
            <Text style={styles.comparisonFree}>50</Text>
            <Text style={styles.comparisonPro}>Unlimited</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Photo Attachments</Text>
            <Text style={styles.comparisonFree}>✗</Text>
            <Text style={styles.comparisonPro}>✓</Text>
          </View>

          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Export Reports</Text>
            <Text style={styles.comparisonFree}>✗</Text>
            <Text style={styles.comparisonPro}>✓</Text>
          </View>
        </View>
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
  currentPlanCard: {
    backgroundColor: Colors.background.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  currentPlanBadge: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  currentPlanTitle: {
    ...Typography.h2,
    marginBottom: 4,
  },
  currentPlanSubtitle: {
    ...Typography.bodySmall,
    color: Colors.ui.textLight,
  },
  proCard: {
    backgroundColor: Colors.brand[500],
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
  },
  proHeader: {
    marginBottom: 24,
  },
  proTitle: {
    ...Typography.h2,
    color: 'white',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 36,
    fontFamily: 'Quicksand_700Bold',
    color: 'white',
  },
  pricePeriod: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  featuresContainer: {
    gap: 12,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    ...Typography.body,
    color: 'white',
  },
  upgradeButton: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    ...Typography.button,
    color: Colors.brand[600],
  },
  comingSoonNote: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  comparisonCard: {
    backgroundColor: Colors.background.card,
    padding: 20,
    borderRadius: 16,
  },
  comparisonTitle: {
    ...Typography.h4,
    marginBottom: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  comparisonLabel: {
    ...Typography.body,
    flex: 1,
  },
  comparisonFree: {
    ...Typography.label,
    width: 80,
    textAlign: 'center',
    color: Colors.ui.textLight,
  },
  comparisonPro: {
    ...Typography.label,
    width: 80,
    textAlign: 'center',
    color: Colors.brand[600],
  },
});

