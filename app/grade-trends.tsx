import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { useLessonStore } from '@/store/lessonStore';
import GradeTrends from '@/components/grades/GradeTrends';

export default function GradeTrendsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { students } = useStudentStore();
  const { lessons } = useLessonStore();
  
  const [selectedStudent, setSelectedStudent] = useState<string>(
    (params.studentId as string) || students[0]?.id || ''
  );
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  
  // Get unique subjects for the selected student
  const subjects = Array.from(new Set(
    lessons
      .filter(l => l.student_id === selectedStudent && l.grade_value)
      .map(l => l.subject)
  )).sort();
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.ui.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Grade Trends</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {/* Student Selector */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Student:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {students.map(student => (
            <TouchableOpacity
              key={student.id}
              style={[
                styles.filterChip,
                selectedStudent === student.id && styles.filterChipActive
              ]}
              onPress={() => {
                setSelectedStudent(student.id);
                setSelectedSubject(undefined); // Reset subject filter
              }}
            >
              <Text style={[
                styles.filterChipText,
                selectedStudent === student.id && styles.filterChipTextActive
              ]}>
                {student.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Subject Filter */}
      {subjects.length > 0 && (
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Filter by Subject:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedSubject === undefined && styles.filterChipActive
              ]}
              onPress={() => setSelectedSubject(undefined)}
            >
              <Text style={[
                styles.filterChipText,
                selectedSubject === undefined && styles.filterChipTextActive
              ]}>
                All Subjects
              </Text>
            </TouchableOpacity>
            
            {subjects.map(subject => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.filterChip,
                  selectedSubject === subject && styles.filterChipActive
                ]}
                onPress={() => setSelectedSubject(subject)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedSubject === subject && styles.filterChipTextActive
                ]}>
                  {subject}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Grade Trends Component */}
      <GradeTrends 
        studentId={selectedStudent}
        subject={selectedSubject}
      />
    </View>
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
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  filterSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.ui.backgroundLight,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  filterChipTextActive: {
    color: 'white',
  },
});

