import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DatePickerProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  lessonDates?: string[];  // Array of dates that have lessons (YYYY-MM-DD format)
}

export default function DatePicker({ selectedDate, onDateSelect, lessonDates = [] }: DatePickerProps) {
  // Generate dates: yesterday through next 5 days (7 total)
  const dates = [];
  for (let i = -1; i <= 5; i++) {
    dates.push(addDays(new Date(), i));
  }

  const hasLessons = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return lessonDates.includes(dateStr);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isTodayDate = isToday(date);
          const hasLesson = hasLessons(date);
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateCard,
                isSelected && styles.dateCardSelected,
                isTodayDate && !isSelected && styles.dateCardToday,
              ]}
              onPress={() => onDateSelect(date)}
            >
              <Text style={[
                styles.dayLabel,
                isSelected && styles.dayLabelSelected,
              ]}>
                {format(date, 'EEE')}
              </Text>
              <Text style={[
                styles.dateNumber,
                isSelected && styles.dateNumberSelected,
              ]}>
                {format(date, 'd')}
              </Text>
              {isTodayDate && !isSelected && (
                <View style={styles.todayDot} />
              )}
              {hasLesson && (
                <View style={styles.lessonIndicator} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  dateCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dateCardSelected: {
    backgroundColor: Colors.brand[400],
    borderColor: Colors.brand[400],
  },
  dateCardToday: {
    borderColor: Colors.brand[200],
  },
  dayLabel: {
    ...Typography.caption,
    color: Colors.ui.textLight,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dayLabelSelected: {
    color: 'white',
  },
  dateNumber: {
    ...Typography.h3,
    fontSize: 22,
  },
  dateNumberSelected: {
    color: 'white',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brand[400],
    marginTop: 4,
  },
  lessonIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.secondary[400],
  },
});

