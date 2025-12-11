import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

// Check device type
export const isSmallDevice = width < 375;
export const isMediumDevice = width >= 375 && width < 414;
export const isLargeDevice = width >= 414;
export const isTablet = width >= 768;

// Responsive spacing
export const spacing = {
  xs: isSmallDevice ? 4 : 8,
  sm: isSmallDevice ? 8 : 12,
  md: isSmallDevice ? 12 : 16,
  lg: isSmallDevice ? 16 : 20,
  xl: isSmallDevice ? 20 : 24,
  xxl: isSmallDevice ? 24 : 32,
};

// Responsive font sizes
export const fontSize = {
  xs: isSmallDevice ? 10 : 12,
  sm: isSmallDevice ? 12 : 14,
  md: isSmallDevice ? 14 : 16,
  lg: isSmallDevice ? 16 : 18,
  xl: isSmallDevice ? 20 : 24,
  xxl: isSmallDevice ? 24 : 32,
};

export default {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  isSmallDevice,
  isMediumDevice,
  isLargeDevice,
  isTablet,
  spacing,
  fontSize,
};

