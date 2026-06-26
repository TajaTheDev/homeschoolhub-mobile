import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { checkProStatus, PAYWALL_RESULT, presentPaywall as presentRevenueCatPaywall } from '@/lib/revenuecat';

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  feature?: string;
}

export default function PremiumPaywall({
  visible,
  onClose,
  onSuccess,
  feature,
}: PremiumPaywallProps) {
  const [showingPaywall, setShowingPaywall] = useState(false);

  const handleShowPaywall = async () => {
    try {
      setShowingPaywall(true);

      const result = await presentRevenueCatPaywall();
      
            
      if (result === PAYWALL_RESULT.PURCHASED || 
          result === PAYWALL_RESULT.RESTORED) {
        
        // Verify Pro status
        const hasProAccess = await checkProStatus();
        
        if (hasProAccess) {
          Alert.alert(
            'Welcome to Premium! 🎉',
            'You now have full access to all features!',
            [
              {
                text: 'Get Started',
                onPress: () => {
                  onSuccess?.();
                  onClose();
                },
              },
            ]
          );
        }
      } else if (result === PAYWALL_RESULT.CANCELLED) {
              }
    } catch (error) {
      console.error('Paywall error:', error);
      Alert.alert('Error', 'Could not load subscription options');
    } finally {
      setShowingPaywall(false);
    }
  };

  useEffect(() => {
    if (visible && !showingPaywall) {
      handleShowPaywall();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible && !showingPaywall}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={Colors.ui.text} />
          </TouchableOpacity>
          
          <View style={styles.content}>
            <Sparkles size={64} color={Colors.brand[500]} />
            
            <Text style={styles.title}>Upgrade to Premium</Text>
            
            {feature && (
              <Text style={styles.subtitle}>
                To access {feature}, upgrade to Premium
              </Text>
            )}
            
            <ActivityIndicator 
              size="large" 
              color={Colors.brand[500]} 
              style={styles.loader}
            />
            
            <Text style={styles.loadingText}>Loading subscription options...</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 8,
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  loader: {
    marginVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.ui.textLight,
  },
});
