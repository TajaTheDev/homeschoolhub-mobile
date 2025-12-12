import { AVATAR_ILLUSTRATIONS } from '@/constants/Avatars';
import { supabase } from '@/lib/supabase';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  type: 'initial' | 'photo' | 'illustration';
  value?: string | null;
  name: string;
  color: string;
  size?: number;
}

const getPhotoUrl = (path: string) => {
  if (!path) return '';
  
  // Use student-avatars bucket (which works)
  const { data } = supabase.storage
    .from('student-avatars')
    .getPublicUrl(path);
  
  console.log('Avatar path:', path);
  console.log('Avatar URL:', data.publicUrl);
  
  return data.publicUrl;
};

export default function Avatar({ type, value, name, color, size = 40 }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const getInitials = () => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderInitialAvatar = () => (
    <View style={[styles.container, styles.initial, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials()}</Text>
    </View>
  );

  // Photo type - with fallback to initials on error
  if (type === 'photo' && value && !imageError) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Image
          source={{ uri: getPhotoUrl(value) }}
          style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
          onError={(e) => {
            console.error('Avatar image load error:', e.nativeEvent.error);
            console.error('Attempted URL:', getPhotoUrl(value));
            console.log('🔄 Falling back to initials for:', name);
            setImageError(true);
          }}
          onLoad={() => {
            console.log('✅ Avatar loaded:', value);
            setImageError(false);
          }}
        />
      </View>
    );
  }

  // If photo failed to load, show initials
  if (type === 'photo' && imageError) {
    return renderInitialAvatar();
  }

  // Illustration type
  if (type === 'illustration' && value) {
    const illustration = AVATAR_ILLUSTRATIONS.find(a => a.id === value);
    if (illustration) {
      return (
        <View style={[styles.container, styles.illustration, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.emoji, { fontSize: size * 0.5 }]}>{illustration.emoji}</Text>
        </View>
      );
    }
    // Fallback to initial if illustration not found
    return renderInitialAvatar();
  }

  // Default: Initial
  return renderInitialAvatar();

}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: {
    // Dynamic styles applied inline
  },
  illustration: {
    backgroundColor: 'transparent',
  },
  emoji: {
    // Dynamic size applied inline
  },
  initial: {
    // Dynamic styles applied inline
  },
  initials: {
    fontFamily: 'Quicksand_700Bold',
    color: 'white',
  },
});

