import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Share2, FileText, Award, Calendar, BookOpen, Sparkles, GraduationCap } from 'lucide-react-native';
import PdfExportSetupModal, { type PdfExportMode } from '@/components/export/PdfExportSetupModal';
import TranscriptSetupModal, { type TranscriptGenerateParams } from '@/components/export/TranscriptSetupModal';
import { fetchReadingLogExportData, fetchYearInReviewData } from '@/lib/fetchPdfExportData';
import { fetchTranscriptData } from '@/lib/fetchTranscriptData';
import { generateReadingLogPdf } from '@/utils/readingLogPdfGenerator';
import { generateTranscriptPdf } from '@/utils/transcriptPdfGenerator';
import { generateYearInReviewPdf } from '@/utils/yearInReviewPdfGenerator';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { useLessonStore } from '@/store/lessonStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { generateReportCard } from '@/utils/pdfReportGenerator';

type ExportType = 'wrapup' | 'reading_log' | 'transcript' | 'grades' | 'attendance';
type DateRange = 'this_month' | 'last_month' | 'this_year' | 'all_time';

export default function ExportScreen() {
  const router = useRouter();
  const { students } = useStudentStore();
  const { lessons } = useLessonStore();
  const { attendance } = useAttendanceStore();
  
  const [exportingType, setExportingType] = useState<ExportType | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<'all' | string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const [pdfModalMode, setPdfModalMode] = useState<PdfExportMode | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  
  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
          label: format(now, 'MMMM yyyy')
        };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return {
          start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
          label: format(lastMonth, 'MMMM yyyy')
        };
      case 'this_year':
        return {
          start: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
          end: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd'),
          label: now.getFullYear().toString()
        };
      case 'all_time':
        return {
          start: '2020-01-01',
          end: '2030-12-31',
          label: 'All Time'
        };
    }
  };
  
  const sharePdf = async (pdfUri: string, dialogTitle: string) => {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle,
      });
    } else {
      Alert.alert('Success', `PDF saved to:\n${pdfUri}`);
    }
  };

  const handleGenerateYearInReview = async ({
    studentId,
    startDate,
    endDate,
  }: {
    studentId: string;
    startDate: string;
    endDate: string;
  }) => {
    setExportingType('wrapup');
    try {
      const student = students.find((s) => s.id === studentId);
      if (!student) {
        Alert.alert('Error', 'Student not found');
        return;
      }

      const data = await fetchYearInReviewData(studentId, startDate, endDate);
      const pdfUri = await generateYearInReviewPdf({
        studentName: student.name,
        startDate,
        endDate,
        data,
      });

      await sharePdf(pdfUri, `${student.name} - Year in Review`);
      setPdfModalMode(null);
      Alert.alert('Success!', `Year in Review generated for ${student.name}`);
    } catch (error: unknown) {
      console.error('Year in review export error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate year in review'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handleGenerateTranscript = async (params: TranscriptGenerateParams) => {
    setExportingType('transcript');
    try {
      const student = students.find((s) => s.id === params.studentId);
      if (!student) {
        Alert.alert('Error', 'Student not found');
        return;
      }

      const data = await fetchTranscriptData(
        params.studentId,
        params.startDate,
        params.endDate
      );
      const pdfUri = await generateTranscriptPdf({
        studentFullName: params.studentFullName,
        schoolName: params.schoolName,
        gradeLevel: params.gradeLevel,
        startDate: params.startDate,
        endDate: params.endDate,
        data,
      });

      await sharePdf(pdfUri, `${student.name} - Academic Transcript`);
      setShowTranscriptModal(false);
      Alert.alert('Success!', `Transcript generated for ${student.name}`);
    } catch (error: unknown) {
      console.error('Transcript export error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate transcript'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handleGenerateReadingLog = async ({ studentId }: { studentId: string }) => {
    setExportingType('reading_log');
    try {
      const student = students.find((s) => s.id === studentId);
      if (!student) {
        Alert.alert('Error', 'Student not found');
        return;
      }

      const data = await fetchReadingLogExportData(studentId);
      const pdfUri = await generateReadingLogPdf({
        studentName: student.name,
        data,
      });

      await sharePdf(pdfUri, `${student.name} - Reading Log`);
      setPdfModalMode(null);
      Alert.alert('Success!', `Reading log exported for ${student.name}`);
    } catch (error: unknown) {
      console.error('Reading log export error:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to export reading log'
      );
    } finally {
      setExportingType(null);
    }
  };
  
  const handleExportGrades = async () => {
    setExportingType('grades');
    try {
      const range = getDateRange();
      
      // Filter lessons with grades
      const gradedLessons = lessons.filter(lesson => {
        const inRange = lesson.date >= range.start && lesson.date <= range.end;
        const matchesStudent = selectedStudent === 'all' || lesson.student_id === selectedStudent;
        const hasGrade = lesson.grade_value !== null && lesson.grade_value !== undefined;
        return inRange && matchesStudent && hasGrade;
      });
      
      if (gradedLessons.length === 0) {
        Alert.alert('No Data', 'No graded lessons found for the selected criteria');
        setExportingType(null);
        return;
      }
      
      // Generate CSV (for now - we'll add PDF later)
      const csv = await generateGradesCSV(gradedLessons);
      
      // Save and share
      await saveAndShare(csv, `grades_${range.label.replace(' ', '_')}.csv`);
      
      Alert.alert('Success!', `Exported ${gradedLessons.length} graded lessons`);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export grades');
    } finally {
      setExportingType(null);
    }
  };
  
  const handleExportReportCard = async () => {
    setExportingType('grades');
    try {
      const range = getDateRange();
      
      // Check if specific student selected
      if (selectedStudent === 'all') {
        Alert.alert(
          'Select Student',
          'Please select a specific student for report card generation',
          [{ text: 'OK' }]
        );
        setExportingType(null);
        return;
      }
      
      const student = students.find(s => s.id === selectedStudent);
      if (!student) {
        Alert.alert('Error', 'Student not found');
        setExportingType(null);
        return;
      }
      
                        
      // Generate PDF
      const pdfUri = await generateReportCard({
        student,
        lessons,
        attendance,
        startDate: range.start,
        endDate: range.end,
      });
      
            
      await sharePdf(pdfUri, `${student.name} - Report Card`);
      Alert.alert('Success!', `Report card generated for ${student.name}`);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      Alert.alert('Error', error.message || 'Failed to generate report card');
    } finally {
      setExportingType(null);
    }
  };
  
  const handleExportAttendance = async () => {
    setExportingType('attendance');
    try {
      const range = getDateRange();
      
      // Filter attendance
      const filteredAttendance = attendance.filter(record => {
        const inRange = record.date >= range.start && record.date <= range.end;
        const matchesStudent = selectedStudent === 'all' || record.student_id === selectedStudent;
        return inRange && matchesStudent;
      });
      
      if (filteredAttendance.length === 0) {
        Alert.alert('No Data', 'No attendance records found for the selected criteria');
        setExportingType(null);
        return;
      }
      
      // Generate CSV
      const csv = await generateAttendanceCSV(filteredAttendance);
      
      // Save and share
      await saveAndShare(csv, `attendance_${range.label.replace(' ', '_')}.csv`);
      
      Alert.alert('Success!', `Exported ${filteredAttendance.length} attendance records`);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export attendance');
    } finally {
      setExportingType(null);
    }
  };
  
  // CSV Generation Functions
  const generateGradesCSV = async (lessons: any[]) => {
    let csv = 'Date,Student,Subject,Title,Grade Type,Grade,Max Points\n';
    
    lessons.forEach(lesson => {
      const student = students.find(s => s.id === lesson.student_id);
      const studentName = student?.name || 'Unknown';
      const title = lesson.title || '';
      const gradeType = lesson.grade_type || '';
      const gradeValue = lesson.grade_value || '';
      const maxPoints = lesson.grade_max_points || '';
      
      csv += `${lesson.date},${studentName},${lesson.subject},${title},${gradeType},${gradeValue},${maxPoints}\n`;
    });
    
    return csv;
  };
  
  const generateAttendanceCSV = async (records: any[]) => {
    let csv = 'Date,Student,Status,Notes\n';
    
    records.forEach(record => {
      const student = students.find(s => s.id === record.student_id);
      const studentName = student?.name || 'Unknown';
      const status = record.present ? 'Present' : 'Absent';
      const notes = (record.notes || '').replace(/,/g, ';').replace(/\n/g, ' ');
      
      csv += `${record.date},${studentName},${status},"${notes}"\n`;
    });
    
    return csv;
  };
  
  // Save and Share
  const saveAndShare = async (content: string, filename: string) => {
    const fileUri = FileSystem.documentDirectory + filename;
    
    // Write file with UTF8 encoding (use string literal)
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: 'utf8',
    });
    
        
    try {
      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Data',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Success', `File saved to:\n${fileUri}`);
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('File Saved', `Your export has been saved to:\n\n${fileUri}\n\nYou can find it in your Files app.`);
    }
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
        <Text style={styles.title}>Export Data</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Export your homeschool records for backup, sharing, or compliance purposes.
          </Text>
        </View>
        
        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>
          
          {/* Student Selector */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Student:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterChip, selectedStudent === 'all' && styles.filterChipActive]}
                onPress={() => setSelectedStudent('all')}
              >
                <Text style={[styles.filterChipText, selectedStudent === 'all' && styles.filterChipTextActive]}>
                  All Students
                </Text>
              </TouchableOpacity>
              
              {students.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={[styles.filterChip, selectedStudent === student.id && styles.filterChipActive]}
                  onPress={() => setSelectedStudent(student.id)}
                >
                  <Text style={[styles.filterChipText, selectedStudent === student.id && styles.filterChipTextActive]}>
                    {student.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          {/* Date Range Selector */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Date Range:</Text>
            <View style={styles.dateRangeButtons}>
              <TouchableOpacity
                style={[styles.dateRangeButton, dateRange === 'this_month' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('this_month')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'this_month' && styles.dateRangeButtonTextActive]}>
                  This Month
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateRangeButton, dateRange === 'last_month' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('last_month')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'last_month' && styles.dateRangeButtonTextActive]}>
                  Last Month
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateRangeButton, dateRange === 'this_year' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('this_year')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'this_year' && styles.dateRangeButtonTextActive]}>
                  This Year
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateRangeButton, dateRange === 'all_time' && styles.dateRangeButtonActive]}
                onPress={() => setDateRange('all_time')}
              >
                <Text style={[styles.dateRangeButtonText, dateRange === 'all_time' && styles.dateRangeButtonTextActive]}>
                  All Time
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
        {/* Export Options */}
        <View style={styles.exportsSection}>
          <Text style={styles.sectionTitle}>Export Options</Text>
          
          {/* Year in Review */}
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIcon}>
                <Sparkles size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Year in Review</Text>
                <Text style={styles.exportDescription}>
                  A celebratory PDF wrap-up with lessons, books, photos, and stats
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.exportButton, exportingType === 'wrapup' && styles.exportButtonDisabled]}
              onPress={() => setPdfModalMode('wrapup')}
              disabled={exportingType === 'wrapup'}
            >
              {exportingType === 'wrapup' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Share2 size={18} color="white" />
                  <Text style={styles.exportButtonText}>Generate PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Export Grades */}
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIcon}>
                <Award size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Export Grades</Text>
                <Text style={styles.exportDescription}>
                  Grade report with all assessments and performance data
                </Text>
              </View>
            </View>
            
            {/* Two export buttons */}
            <View style={styles.exportButtonRow}>
              <TouchableOpacity
                style={[styles.exportButtonHalf, exportingType === 'grades' && styles.exportButtonDisabled]}
                onPress={handleExportGrades}
                disabled={exportingType === 'grades'}
              >
                {exportingType === 'grades' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <FileText size={16} color="white" />
                    <Text style={styles.exportButtonTextSmall}>CSV</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.exportButtonHalf, styles.exportButtonPDF, exportingType === 'grades' && styles.exportButtonDisabled]}
                onPress={handleExportReportCard}
                disabled={exportingType === 'grades'}
              >
                {exportingType === 'grades' ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Award size={16} color="white" />
                    <Text style={styles.exportButtonTextSmall}>Report Card (PDF)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            {selectedStudent === 'all' && (
              <Text style={styles.pdfHint}>
                💡 Select a specific student for PDF report card
              </Text>
            )}
          </View>

          {/* Export Transcript */}
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIcon}>
                <GraduationCap size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Export Transcript</Text>
                <Text style={styles.exportDescription}>
                  Formal academic transcript for college admissions and records
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.exportButton,
                exportingType === 'transcript' && styles.exportButtonDisabled,
              ]}
              onPress={() => setShowTranscriptModal(true)}
              disabled={exportingType === 'transcript'}
            >
              {exportingType === 'transcript' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Share2 size={18} color="white" />
                  <Text style={styles.exportButtonText}>Generate PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Export Reading Log */}
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIcon}>
                <BookOpen size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Export Reading Log</Text>
                <Text style={styles.exportDescription}>
                  Finished and currently reading books with ratings and notes
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.exportButton,
                exportingType === 'reading_log' && styles.exportButtonDisabled,
              ]}
              onPress={() => setPdfModalMode('reading_log')}
              disabled={exportingType === 'reading_log'}
            >
              {exportingType === 'reading_log' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Share2 size={18} color="white" />
                  <Text style={styles.exportButtonText}>Generate PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Export Attendance */}
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={styles.exportIcon}>
                <Calendar size={24} color={Colors.brand[600]} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>Export Attendance</Text>
                <Text style={styles.exportDescription}>
                  Attendance records with present/absent status and notes
                </Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.exportButton, exportingType === 'attendance' && styles.exportButtonDisabled]}
              onPress={handleExportAttendance}
              disabled={exportingType === 'attendance'}
            >
              {exportingType === 'attendance' ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Share2 size={18} color="white" />
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <PdfExportSetupModal
        visible={pdfModalMode !== null}
        mode={pdfModalMode ?? 'wrapup'}
        students={students}
        loading={exportingType === 'wrapup' || exportingType === 'reading_log'}
        onClose={() => {
          if (exportingType !== 'wrapup' && exportingType !== 'reading_log') {
            setPdfModalMode(null);
          }
        }}
        onGenerate={(params) => {
          if (pdfModalMode === 'wrapup') {
            handleGenerateYearInReview(params);
          } else if (pdfModalMode === 'reading_log') {
            handleGenerateReadingLog({ studentId: params.studentId });
          }
        }}
      />

      <TranscriptSetupModal
        visible={showTranscriptModal}
        students={students}
        loading={exportingType === 'transcript'}
        onClose={() => {
          if (exportingType !== 'transcript') {
            setShowTranscriptModal(false);
          }
        }}
        onGenerate={handleGenerateTranscript}
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
  content: {
    flex: 1,
  },
  infoBanner: {
    backgroundColor: Colors.brand[50],
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  infoBannerText: {
    fontSize: 14,
    color: Colors.brand[700],
    lineHeight: 20,
    textAlign: 'center',
  },
  filtersSection: {
    padding: 16,
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 16,
  },
  filterGroup: {
    marginBottom: 16,
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
  dateRangeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateRangeButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.ui.backgroundLight,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  dateRangeButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  dateRangeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ui.text,
  },
  dateRangeButtonTextActive: {
    color: 'white',
  },
  exportsSection: {
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  exportCard: {
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
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  exportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  exportInfo: {
    flex: 1,
  },
  exportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 4,
  },
  exportDescription: {
    fontSize: 13,
    color: Colors.ui.textLight,
    lineHeight: 18,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  exportButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportButtonHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand[500],
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  exportButtonPDF: {
    backgroundColor: '#8b5cf6',
  },
  exportButtonTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  pdfHint: {
    fontSize: 12,
    color: Colors.brand[600],
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

