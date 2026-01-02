import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Calendar, Users, BookOpen, Repeat, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useStudentStore } from '@/store/studentStore';
import { useLessonStore } from '@/store/lessonStore';
import StudentModal from '@/components/students/StudentModal';
import * as ImagePicker from 'expo-image-picker';

type OnboardingStep = 'welcome' | 'schedule' | 'students' | 'lesson' | 'recurring' | 'complete';

export default function OnboardingScreen() {
  const router = useRouter();
  const confettiRef = useRef<any>(null);
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [schoolDays, setSchoolDays] = useState([1, 2, 3, 4, 5]); // Mon-Fri default
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSubject, setLessonSubject] = useState('');
  
  const { students } = useStudentStore();
  const { addLesson } = useLessonStore();
  
  const shootConfetti = () => {
    confettiRef.current?.start();
  };
  
  const handleAddLesson = () => {
    setCurrentStep('recurring');
  };
  
  const handleComplete = async () => {
    shootConfetti();
    
    try {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      console.log('✅ Onboarding marked complete');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
    
    setTimeout(() => {
      router.replace('/subscribe' as any);
    }, 2000);
  };
  
  return (
    <View style={styles.container}>
      <ConfettiCannon
        count={200}
        origin={{ x: -10, y: 0 }}
        autoStart={false}
        ref={confettiRef}
        fadeOut={true}
      />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Welcome */}
        {currentStep === 'welcome' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <Sparkles size={64} color={Colors.brand[500]} />
            </View>
            
            <Text style={styles.stepTitle}>Welcome to HomeschoolHub!</Text>
            <Text style={styles.stepDescription}>
              Let's set up your homeschool in just a few steps.
              We'll help you get organized and ready to track your students' progress!
            </Text>
            
            <View style={styles.featuresList}>
              <FeatureItem icon={Calendar} text="Track lessons & attendance" />
              <FeatureItem icon={Users} text="Manage multiple students" />
              <FeatureItem icon={BookOpen} text="Grade assignments" />
              <FeatureItem icon={Repeat} text="Create recurring lessons" />
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentStep('schedule')}
            >
              <Text style={styles.primaryButtonText}>Get Started! 🚀</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Schedule Setup */}
        {currentStep === 'schedule' && (
          <View style={styles.stepContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '25%' }]} />
            </View>
            
            <Text style={styles.stepNumber}>Step 1 of 4</Text>
            <Text style={styles.stepTitle}>School Schedule</Text>
            <Text style={styles.stepDescription}>
              Which days do you typically have school?
            </Text>
            
            <View style={styles.daysGrid}>
              {[
                { day: 'Monday', value: 1 },
                { day: 'Tuesday', value: 2 },
                { day: 'Wednesday', value: 3 },
                { day: 'Thursday', value: 4 },
                { day: 'Friday', value: 5 },
                { day: 'Saturday', value: 6 },
                { day: 'Sunday', value: 0 },
              ].map(({ day, value }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.dayButton,
                    schoolDays.includes(value) && styles.dayButtonActive
                  ]}
                  onPress={() => {
                    if (schoolDays.includes(value)) {
                      setSchoolDays(schoolDays.filter(d => d !== value));
                    } else {
                      setSchoolDays([...schoolDays, value].sort());
                    }
                  }}
                >
                  <Text style={[
                    styles.dayButtonText,
                    schoolDays.includes(value) && styles.dayButtonTextActive
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                // Save schedule (you can add this to a settings store)
                setCurrentStep('students');
              }}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep('welcome')}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Add Students */}
        {currentStep === 'students' && (
          <View style={styles.stepContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '50%' }]} />
            </View>
            
            <Text style={styles.stepNumber}>Step 2 of 4</Text>
            <Text style={styles.stepTitle}>Add Your First Student 👨‍🎓</Text>
            <Text style={styles.stepDescription}>
              {students.length === 0 
                ? "Let's add your first student!"
                : `Great! You've added ${students.length} student${students.length > 1 ? 's' : ''}. Add another or continue.`
              }
            </Text>
            
            {/* Show added students */}
            {students.length > 0 && (
              <View style={styles.addedStudents}>
                {students.map(student => (
                  <View key={student.id} style={styles.studentChip}>
                    <Text style={styles.studentChipText}>✓ {student.name}</Text>
                  </View>
                ))}
              </View>
            )}
            
            {/* Add Student Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowStudentModal(true)}
            >
              <Text style={styles.primaryButtonText}>
                {students.length === 0 ? 'Add Your First Student 🎊' : 'Add Another Student'}
              </Text>
            </TouchableOpacity>
            
            {students.length > 0 && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  shootConfetti();
                  setTimeout(() => setCurrentStep('lesson'), 1500);
                }}
              >
                <Text style={styles.secondaryButtonText}>
                  Continue with {students.length} student{students.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep('schedule')}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Add First Lesson */}
        {currentStep === 'lesson' && (
          <View style={styles.stepContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '75%' }]} />
            </View>
            
            <Text style={styles.stepNumber}>Step 3 of 4</Text>
            <Text style={styles.stepTitle}>Great Job! 🎉</Text>
            <Text style={styles.stepDescription}>
              You've added your students! Now let's talk about lessons.
              
              You can add individual lessons anytime from the calendar or home screen.
              
              Let's learn about recurring lessons next!
            </Text>
            
            <View style={styles.infoBox}>
              <BookOpen size={32} color={Colors.brand[600]} />
              <Text style={styles.infoText}>
                💡 Tip: You can add photos, grades, and notes to any lesson!
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAddLesson}
            >
              <Text style={styles.primaryButtonText}>Learn About Recurring Lessons</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep('students')}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Recurring Lessons */}
        {currentStep === 'recurring' && (
          <View style={styles.stepContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '100%' }]} />
            </View>
            
            <Text style={styles.stepNumber}>Step 4 of 4</Text>
            <Text style={styles.stepTitle}>Recurring Lessons 🔄</Text>
            <Text style={styles.stepDescription}>
              Save time by creating lessons that repeat automatically!
            </Text>
            
            <View style={styles.recurringOptions}>
              <View style={styles.recurringCard}>
                <Text style={styles.recurringEmoji}>📅</Text>
                <Text style={styles.recurringTitle}>Every School Day</Text>
                <Text style={styles.recurringDesc}>
                  Math, reading, etc. - automatically scheduled for all school days
                </Text>
              </View>
              
              <View style={styles.recurringCard}>
                <Text style={styles.recurringEmoji}>🗓️</Text>
                <Text style={styles.recurringTitle}>Once a Week</Text>
                <Text style={styles.recurringDesc}>
                  PE on Mondays, Art on Fridays - choose specific days
                </Text>
              </View>
              
              <View style={styles.recurringCard}>
                <Text style={styles.recurringEmoji}>✨</Text>
                <Text style={styles.recurringTitle}>Custom Days</Text>
                <Text style={styles.recurringDesc}>
                  Pick any combination of days that works for you
                </Text>
              </View>
            </View>
            
            <View style={styles.infoBox}>
              <Sparkles size={24} color={Colors.brand[600]} />
              <Text style={styles.infoText}>
                💡 Recurring lessons automatically skip breaks and weekends!
              </Text>
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setCurrentStep('complete')}
            >
              <Text style={styles.primaryButtonText}>Got It!</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep('lesson')}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Complete */}
        {currentStep === 'complete' && (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <Sparkles size={80} color={Colors.brand[500]} />
            </View>
            
            <Text style={styles.completeTitle}>You're All Set! 🎊</Text>
            <Text style={styles.completeDescription}>
              You've completed the setup wizard!
              
              Your homeschool hub is ready to use.
            </Text>
            
            <View style={styles.completeChecklist}>
              <CheckItem text="✓ School schedule configured" />
              <CheckItem text={`✓ ${students.length} student${students.length > 1 ? 's' : ''} added`} />
              <CheckItem text="✓ Ready to track lessons" />
              <CheckItem text="✓ Ready to take attendance" />
            </View>
            
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleComplete}
            >
              <Text style={styles.primaryButtonText}>Start Homeschooling! 🚀</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      
      {/* Student Modal */}
      <StudentModal
        visible={showStudentModal}
        onClose={() => {
          setShowStudentModal(false);
          // Shoot confetti when student is added
          if (students.length > 0) {
            shootConfetti();
          }
        }}
      />
    </View>
  );
}

// Helper component
function FeatureItem({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Icon size={20} color={Colors.brand[600]} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// Helper component
function CheckItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.ui.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 80,
  },
  stepContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.ui.border,
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.brand[500],
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.brand[600],
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconContainer: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.ui.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresList: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  daysGrid: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  dayButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
  },
  dayButtonActive: {
    backgroundColor: Colors.brand[500],
    borderColor: Colors.brand[500],
  },
  dayButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.text,
    textAlign: 'center',
  },
  dayButtonTextActive: {
    color: 'white',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: Colors.ui.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.ui.text,
  },
  addedStudents: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  studentChip: {
    backgroundColor: Colors.brand[100],
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.brand[300],
  },
  studentChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand[700],
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.brand[50],
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  infoText: {
    fontSize: 14,
    color: Colors.brand[700],
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  recurringOptions: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  recurringCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recurringEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  recurringTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.ui.text,
    marginBottom: 8,
  },
  recurringDesc: {
    fontSize: 14,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.ui.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  completeDescription: {
    fontSize: 16,
    color: Colors.ui.textLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  completeChecklist: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    gap: 16,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 16,
    color: Colors.ui.text,
    fontWeight: '500',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.brand[500],
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.brand[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.ui.textLight,
  },
});

