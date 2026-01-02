import Colors from '@/constants/Colors';
import Typography from '@/constants/Typography';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const onboardingData = [
  {
    id: 1,
    image: require('@/assets/onboarding/screen1.png'),
    backgroundColor: '#E8DEFF', // Purple
  },
  {
    id: 2,
    image: require('@/assets/onboarding/screen2.png'),
    backgroundColor: '#FFE5D0', // Peach - corrected
  },
  {
    id: 3,
    image: require('@/assets/onboarding/screen3.png'),
    backgroundColor: '#C7F0DB', // Mint - corrected
  },
  {
    id: 4,
    image: require('@/assets/onboarding/screen4.png'),
    backgroundColor: '#FFE5B4', // Yellow
  },
];

export default function OnboardingWelcome() {
  const router = useRouter();
  const carouselRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleGetStarted = async () => {
    // Mark onboarding as completed
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    
    // Navigate to signup
    router.replace('/(auth)/signup');
  };

  const handleLogin = async () => {
    // Mark onboarding as completed
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    
    // Navigate to login
    router.replace('/(auth)/login');
  };

  const handleSkip = async () => {
    // Mark onboarding as completed
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    
    router.replace('/(auth)/signup');
  };

  const renderItem = ({ item, index }: { item: typeof onboardingData[0], index: number }) => (
    <View style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          index === onboardingData.length - 1 && styles.scrollContentLastScreen
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <TouchableOpacity
          onPress={() => {
            // Last screen goes to signup, others advance
            if (index === onboardingData.length - 1) {
              handleGetStarted();
            } else {
              carouselRef.current?.scrollTo({ index: index + 1, animated: true });
            }
          }}
          activeOpacity={0.95}
          style={{ width: '100%', height: '100%' }}
        >
          <Image 
            source={item.image} 
            style={styles.fullScreenImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
        </TouchableOpacity>

        {/* Show "Already have an account?" on last screen */}
        {index === onboardingData.length - 1 && (
          <View style={styles.loginPrompt}>
            <Text style={styles.loginPromptText}>
              Already have an account?{' '}
              <Text 
                style={styles.loginLink}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLogin();
                }}
              >
                Log In
              </Text>
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Skip Button - only show on first 3 screens */}
      {currentIndex < onboardingData.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Carousel */}
      <Carousel
        ref={carouselRef}
        loop={false}
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        data={onboardingData}
        renderItem={renderItem}
        onSnapToItem={(index) => setCurrentIndex(index)}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {onboardingData.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8DEFF', // Matches screen 1
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skipText: {
    ...Typography.label,
    color: Colors.ui.text,
  },
  slide: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    // backgroundColor will be applied inline from item.backgroundColor
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20, // Add vertical padding
  },
  scrollContentLastScreen: {
    paddingTop: 40, // Extra top padding for screen 4 to prevent pill cutoff
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: undefined,
    aspectRatio: 1080 / 1920, // Adjust based on your Canva export size
  },
  pagination: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: Colors.brand[400],
    width: 24,
  },
  loginPrompt: {
    position: 'absolute',
    bottom: 80, // Changed from 40 to 80 (moved up 40px to avoid pagination dots)
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 5,
  },
  loginPromptText: {
    ...Typography.body,
    color: Colors.ui.text,
    textAlign: 'center',
  },
  loginLink: {
    ...Typography.label,
    color: Colors.brand[600],
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
});
