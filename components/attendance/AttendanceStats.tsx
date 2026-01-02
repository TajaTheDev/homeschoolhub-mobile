import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { useAttendanceStore } from '@/store/attendanceStore';

interface AttendanceStatsProps {
  studentId?: string; // If undefined, show all students
  startDate?: Date;
  endDate?: Date;
}

export default function AttendanceStats({
  studentId,
  startDate = startOfMonth(new Date()),
  endDate = endOfMonth(new Date()),
}: AttendanceStatsProps) {
  const { students } = useStudentStore();
  const { attendance } = useAttendanceStore();
  
  const stats = useMemo(() => {
    // Filter attendance records
    const filtered = attendance.filter(record => {
      const dateMatch = record.date >= format(startDate, 'yyyy-MM-dd') && 
                       record.date <= format(endDate, 'yyyy-MM-dd');
      const studentMatch = !studentId || record.student_id === studentId;
      return dateMatch && studentMatch;
    });
    
    const presentCount = filtered.filter(r => r.present).length;
    const absentCount = filtered.length - presentCount;
    const totalDays = filtered.length;
    const percentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
    
    // Calculate by student
    const byStudent: Record<string, { present: number; total: number }> = {};
    
    filtered.forEach(record => {
      if (!byStudent[record.student_id]) {
        byStudent[record.student_id] = { present: 0, total: 0 };
      }
      byStudent[record.student_id].total++;
      if (record.present) byStudent[record.student_id].present++;
    });
    
    // Calculate weekly trend
    const weeklyData: { week: string; present: number; absent: number }[] = [];
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // Group by week
    const weeks: Record<string, { present: number; absent: number }> = {};
    filtered.forEach(record => {
      const date = new Date(record.date);
      const weekLabel = format(date, 'MMM d');
      if (!weeks[weekLabel]) {
        weeks[weekLabel] = { present: 0, absent: 0 };
      }
      if (record.present) {
        weeks[weekLabel].present++;
      } else {
        weeks[weekLabel].absent++;
      }
    });
    
    Object.entries(weeks).forEach(([week, data]) => {
      weeklyData.push({ week, ...data });
    });
    
    return {
      presentCount,
      absentCount,
      totalDays,
      percentage,
      byStudent,
      weeklyData: weeklyData.slice(0, 10), // Last 10 data points
    };
  }, [attendance, studentId, startDate, endDate]);
  
  const screenWidth = Dimensions.get('window').width;
  
  // Pie chart data
  const pieData = [
    { x: 'Present', y: stats.presentCount, color: '#10B981' },
    { x: 'Absent', y: stats.absentCount, color: '#EF4444' },
  ].filter(d => d.y > 0); // Only show if there's data
  
  if (stats.totalDays === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No attendance data for this period</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Summary Cards */}
      <View style={styles.summaryCards}>
        <View style={[styles.summaryCard, styles.cardPresent]}>
          <Text style={styles.summaryValue}>{stats.presentCount}</Text>
          <Text style={styles.summaryLabel}>Days Present</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.cardAbsent]}>
          <Text style={styles.summaryValue}>{stats.absentCount}</Text>
          <Text style={styles.summaryLabel}>Days Absent</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.cardPercentage]}>
          <Text style={styles.summaryValue}>{stats.percentage}%</Text>
          <Text style={styles.summaryLabel}>Attendance Rate</Text>
        </View>
      </View>
      
      {/* Pie Chart */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Attendance Overview</Text>
        <View style={styles.pieContainer}>
          <PieChart
            data={pieData.map(d => ({
              name: d.x,
              population: d.y,
              color: d.color,
              legendFontColor: '#1f2937',
              legendFontSize: 14,
            }))}
            width={screenWidth - 60}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
      </View>
      
      {/* By Student Breakdown (if showing all students) */}
      {!studentId && Object.keys(stats.byStudent).length > 1 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>By Student</Text>
          <View style={styles.studentBreakdown}>
            {Object.entries(stats.byStudent).map(([sid, data]) => {
              const student = students.find(s => s.id === sid);
              const percent = data.total > 0 
                ? Math.round((data.present / data.total) * 100)
                : 0;
              
              return (
                <View key={sid} style={styles.studentRow}>
                  <Text style={styles.studentName}>{student?.name}</Text>
                  <View style={styles.studentStats}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${percent}%`,
                            backgroundColor: percent >= 90 ? '#10B981' : percent >= 75 ? '#F59E0B' : '#EF4444'
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.studentPercent}>{percent}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
      
      {/* Weekly Trend (if enough data) */}
      {stats.weeklyData.length > 2 && (
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Weekly Trend</Text>
          <BarChart
            data={{
              labels: stats.weeklyData.map(d => d.week),
              datasets: [{
                data: stats.weeklyData.map(d => d.present)
              }]
            }}
            width={screenWidth - 80}
            height={200}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16
              },
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cardPresent: {
    backgroundColor: '#D1FAE5',
  },
  cardAbsent: {
    backgroundColor: '#FEE2E2',
  },
  cardPercentage: {
    backgroundColor: '#DBEAFE',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  chartSection: {
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
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 16,
  },
  pieContainer: {
    alignItems: 'center',
  },
  studentBreakdown: {
    gap: 12,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.ui.text,
    flex: 1,
  },
  studentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 2,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  studentPercent: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.ui.text,
    width: 45,
    textAlign: 'right',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.ui.textLight,
  },
});

