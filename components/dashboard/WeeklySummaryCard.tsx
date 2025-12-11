import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { CheckCircle, Flame, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface WeeklySummaryCardProps {
  thisWeekCount: number;
  completionRate: number;  // Percentage
  streak: number;  // Days
}

export default function WeeklySummaryCard({ 
  thisWeekCount, 
  completionRate, 
  streak 
}: WeeklySummaryCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Week</Text>
      
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.background.purple }]}>
            <TrendingUp size={20} color={Colors.brand[400]} />
          </View>
          <Text style={styles.statValue}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>Lessons</Text>
        </View>
        
        <View style={styles.stat}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.background.mint }]}>
            <CheckCircle size={20} color={Colors.accent[500]} />
          </View>
          <Text style={styles.statValue}>{completionRate}%</Text>
          <Text style={styles.statLabel}>Complete</Text>
        </View>
        
        <View style={styles.stat}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.background.peach }]}>
            <Flame size={20} color={Colors.secondary[500]} />
          </View>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    ...Typography.h3,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    ...Typography.h2,
    fontSize: 20,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
  },
});

