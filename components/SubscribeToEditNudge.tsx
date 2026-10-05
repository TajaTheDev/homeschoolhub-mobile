/**
 * Shared point-of-action prompt when a read-only user attempts an edit.
 */

import Button from '@/components/ui/Button';
import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type SubscribeToEditNudgeProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  onSubscribe: () => void;
};

export default function SubscribeToEditNudge({
  visible,
  message,
  onDismiss,
  onSubscribe,
}: SubscribeToEditNudgeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Keep your homeschool hub going</Text>
          <Text style={styles.message}>Subscribe to {message}</Text>
          <View style={styles.actions}>
            <Button title="Subscribe" onPress={onSubscribe} variant="primary" size="medium" />
            <Button title="Not now" onPress={onDismiss} variant="outline" size="medium" style={styles.secondaryButton} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 27, 77, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  title: {
    ...Typography.h3,
    color: Colors.brand[900],
    marginBottom: 8,
  },
  message: {
    ...Typography.body,
    color: Colors.ui.text,
    marginBottom: 20,
    lineHeight: 22,
  },
  actions: {
    gap: 10,
  },
  secondaryButton: {
    marginTop: 0,
  },
});
