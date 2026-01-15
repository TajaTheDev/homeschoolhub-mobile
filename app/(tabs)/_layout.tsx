import { Tabs } from 'expo-router';
import { BarChart3, BookOpen, Calendar, Home } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Colors from '@/constants/Colors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  
  // Calculate tab bar height with safe area insets
  // Base height: 8 (top padding) + 24 (icon) + 8 (gap) + 11 (label) + 8 (bottom padding) = ~59
  // Add bottom inset for Android system navigation bar
  const baseHeight = 70;
  const tabBarHeight = baseHeight + (Platform.OS === 'android' ? insets.bottom : 0);
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brand[400],
        tabBarInactiveTintColor: Colors.ui.textLight,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background.card,
          borderTopWidth: 1,
          borderTopColor: Colors.ui.border,
          paddingBottom: Platform.OS === 'android' 
            ? Math.max(insets.bottom, 8) // Use bottom inset or minimum 8px
            : 8,
          paddingTop: 8,
          height: tabBarHeight,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Quicksand_600SemiBold',
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: 'All Lessons',
          tabBarIcon: ({ color }) => <BookOpen size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <BarChart3 size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
