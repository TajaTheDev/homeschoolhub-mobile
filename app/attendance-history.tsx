import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Users, TrendingUp } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import Colors from '@/constants/Colors';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useStudentStore } from '@/store/studentStore';
import AttendanceModal from '@/components/attendance/AttendanceModal';
import AttendanceStats from '@/components/attendance/AttendanceStats';

export default function AttendanceHistoryScreen() {
  const router = useRouter();
  const { attendance, fetchAttendance } = useAttendanceStore();
  const { students } = useStudentStore();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [filterStudent, setFilterStudent] = useState<'all' | string>('all');
  const [activeTab, setActiveTab] = useState<'stats' | 'history'>('stats');
  
  useEffect(() => {
    fetchAttendance();
  }, []);
  
  // Group attendance by date
  const attendanceByDate = attendance.reduce((acc, record) => {
    if (!acc[record.date]) {
      acc[record.date] = [];
    }
    acc[record.date].push(record);
    return acc;
  }, {} as Record<string, typeof attendance>);
  
  // Get unique dates sorted newest first
  const uniqueDates = Object.keys(attendanceByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  // Filter by student if selected
  const filteredDates = filterStudent === 'all' 
    ? uniqueDates
    : uniqueDates.filter(date => 
        attendanceByDate[date].some(a => a.student_id === filterStudent)
      );
  
  // Calculate stats for a date
  const getDateStats = (date: string) => {
    const records = attendanceByDate[date];
    const total = students.length;
    
    // Count how many students have records
    const recordedStudents = records.length;
    
    // Count present students
    const present = records.filter(r => r.present).length;
    
    // Absent = total - present (should equal records with present=false)
    const absent = total - present;
    
        
    // Warning if not all students have records
    if (recordedStudents !== total) {
      console.warn(`⚠️ Missing records! Expected ${total}, got ${recordedStudents}`);
    }
    
    return { present, total, absent };
  };
  
  const handleEditAttendance = (date: string) => {
    setSelectedDate(new Date(date));
    setShowAttendanceModal(true);
  };
  
  const handleDeleteAttendance = (date: string) => {
    Alert.alert(
      'Delete Attendance?',
      `Delete attendance record for ${format(new Date(date), 'MMMM d, yyyy')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await useAttendanceStore.getState().deleteAttendanceForDate(date);
            if (result.success) {
              Alert.alert('Deleted', 'Attendance record removed');
            } else {
              Alert.alert('Error', 'Failed to delete');
            }
          }
        }
      ]
    );
  };
  
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
        <Text style={styles.title}>Attendance History</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {/* Stats Summary */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Calendar size={24} color={Colors.brand[600]} />
          <Text style={styles.statValue}>{uniqueDates.length}</Text>
          <Text style={styles.statLabel}>Days Recorded</Text>
        </View>
        
        <View style={styles.statCard}>
          <Users size={24} color={Colors.brand[600]} />
          <Text style={styles.statValue}>{students.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
        
        <View style={styles.statCard}>
          <TrendingUp size={24} color={Colors.brand[600]} />
          <Text style={styles.statValue}>
            {uniqueDates.length > 0 
              ? Math.round((uniqueDates.reduce((sum, date) => {
                  const stats = getDateStats(date);
                  return sum + (stats.present / stats.total * 100);
                }, 0) / uniqueDates.length))
              : 0}%
          </Text>
          <Text style={styles.statLabel}>Avg Attendance</Text>
        </View>
      </View>
      
      {/* Tab Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Statistics
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content based on active tab */}
      {activeTab === 'stats' ? (
        <ScrollView>
          <AttendanceStats
            studentId={filterStudent === 'all' ? undefined : filterStudent}
          />
        </ScrollView>
      ) : (
        <>
          {/* Student Filter */}
          <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter by Student:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterStudent === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setFilterStudent('all')}
          >
            <Text style={[
              styles.filterButtonText,
              filterStudent === 'all' && styles.filterButtonTextActive
            ]}>
              All Students
            </Text>
          </TouchableOpacity>
          
          {students.map(student => (
            <TouchableOpacity
              key={student.id}
              style={[
                styles.filterButton,
                filterStudent === student.id && styles.filterButtonActive
              ]}
              onPress={() => setFilterStudent(student.id)}
            >
              <Text style={[
                styles.filterButtonText,
                filterStudent === student.id && styles.filterButtonTextActive
              ]}>
                {student.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Attendance Records List */}
      <FlatList
        data={filteredDates}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: date }) => {
          const records = attendanceByDate[date];
          const stats = getDateStats(date);
          const notes = records.find(r => r.notes)?.notes;
          
          return (
            <View style={styles.dateCard}>
              {/* Date Header */}
              <View style={styles.dateHeader}>
                <View>
                  <Text style={styles.dateText}>
                    {format(new Date(date), 'EEEE')}
                  </Text>
                  <Text style={styles.dateSubtext}>
                    {format(new Date(date), 'MMMM d, yyyy')}
                  </Text>
                </View>
                
                <View style={styles.dateStats}>
                  <Text style={styles.dateStatsText}>
                    {stats.present}/{stats.total} present
                  </Text>
                  <View style={[
                    styles.attendanceRate,
                    stats.present === stats.total 
                      ? styles.attendanceRateFull 
                      : styles.attendanceRatePartial
                  ]}>
                    <Text style={styles.attendanceRateText}>
                      {Math.round((stats.present / stats.total) * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Student List */}
              <View style={styles.studentsList}>
                {students
                  .filter(student => {
                    // Apply student filter
                    if (filterStudent !== 'all' && student.id !== filterStudent) {
                      return false;
                    }
                    // Only show students who have attendance for this date
                    return records.some(r => r.student_id === student.id);
                  })
                  .map(student => {
                    // Find this student's attendance record for this date
                    const record = records.find(r => r.student_id === student.id);
                    
                    // If no record found, skip (shouldn't happen with new logic)
                    if (!record) {
                      console.warn(`No attendance record for ${student.name} on ${date}`);
                      return null;
                    }
                    
                    return (
                      <View key={student.id} style={styles.studentRow}>
                        <View style={[
                          styles.studentStatus,
                          record.present 
                            ? styles.studentStatusPresent 
                            : styles.studentStatusAbsent
                        ]}>
                          <Text style={styles.studentStatusText}>
                            {record.present ? '✓' : '✗'}
                          </Text>
                        </View>
                        <Text style={[
                          styles.studentRowName,
                          !record.present && styles.studentRowNameAbsent
                        ]}>
                          {student.name}
                        </Text>
                        <Text style={[
                          styles.studentRowStatus,
                          record.present 
                            ? styles.studentRowStatusPresent 
                            : styles.studentRowStatusAbsent
                        ]}>
                          {record.present ? 'Present' : 'Absent'}
                        </Text>
                      </View>
                    );
                  })}
              </View>
              
              {/* Notes */}
              {notes && (
                <View style={styles.notesCard}>
                  <Text style={styles.notesLabel}>Notes:</Text>
                  <Text style={styles.notesText}>{notes}</Text>
                </View>
              )}
              
              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditAttendance(date)}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteAttendance(date)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No Attendance Records</Text>
            <Text style={styles.emptySubtext}>
              {filterStudent === 'all' 
                ? 'Start taking attendance to see records here'
                : 'No records for this student'}
            </Text>
          </View>
        }
      />
        </>
      )}
      
      {/* Edit Attendance Modal */}
      {showAttendanceModal && selectedDate && (
        <AttendanceModal
          visible={showAttendanceModal}
          date={selectedDate}
          onClose={() => {
            setShowAttendanceModal(false);
            setSelectedDate(null);
          }}
          onSave={() => {
            fetchAttendance();
            setShowAttendanceModal(false);
            setSelectedDate(null);
          }}
        />
      )}
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.ui.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.ui.backgroundLight,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  filterButtonTextActive: {
    color: 'white',
  },
  listContent: {
    padding: 16,
  },
  dateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ui.border,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  dateSubtext: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginTop: 2,
  },
  dateStats: {
    alignItems: 'flex-end',
  },
  dateStatsText: {
    fontSize: 13,
    color: Colors.ui.textLight,
    marginBottom: 4,
  },
  attendanceRate: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  attendanceRateFull: {
    backgroundColor: '#D1FAE5',
  },
  attendanceRatePartial: {
    backgroundColor: '#FEF3C7',
  },
  attendanceRateText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.ui.text,
  },
  studentsList: {
    gap: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  studentStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentStatusPresent: {
    backgroundColor: '#10B981',
  },
  studentStatusAbsent: {
    backgroundColor: '#EF4444',
  },
  studentStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  studentRowName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.ui.text,
  },
  studentRowNameAbsent: {
    color: Colors.ui.textLight,
    textDecorationLine: 'line-through',
  },
  studentRowStatus: {
    fontSize: 13,
    color: Colors.ui.textLight,
  },
  studentRowStatusPresent: {
    color: '#10B981',
    fontWeight: '600',
  },
  studentRowStatusAbsent: {
    color: '#EF4444',
    fontWeight: '600',
  },
  notesCard: {
    backgroundColor: Colors.brand[50],
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand[700],
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: Colors.ui.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.brand[500],
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: Colors.ui.backgroundLight,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.brand[500],
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  tabTextActive: {
    color: 'white',
  },
});

