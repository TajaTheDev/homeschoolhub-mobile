import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatBadgeProps {
  value: string | number;
  label: string;
  color?: string;
  icon?: React.ReactNode;
}

export default function StatBadge({ value, label, color, icon }: StatBadgeProps) {
  return (
    <View style={[styles.container, color && { backgroundColor: color }]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    marginBottom: 8,
  },
  value: {
    ...Typography.h2,
    marginBottom: 4,
  },
  label: {
    ...Typography.caption,
    textAlign: 'center',
  },
});

