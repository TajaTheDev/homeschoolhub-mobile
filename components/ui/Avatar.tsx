import { AVATAR_ILLUSTRATIONS } from '@/constants/Avatars';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  type: 'initial' | 'photo' | 'illustration';
  value?: string | null;
  name: string;
  color: string;
  size?: number;
}

function Avatar({ type, value, name, color, size = 40 }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Memoize the URL so it's only calculated once
  const photoUrl = useMemo(() => {
    if (type !== 'photo' || !value) return '';
    
    const { data } = supabase.storage
      .from('student-avatars')
      .getPublicUrl(value);
    
            
    return data.publicUrl;
  }, [type, value]);

  // Memoize initials calculation
  const initials = useMemo(() => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [name]);

  const getInitials = () => initials;

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
          source={{ uri: photoUrl }}
          style={[styles.photo, { width: size, height: size, borderRadius: size / 2 }]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={(e) => {
            console.error('Avatar image load error:', e);
            console.error('Attempted URL:', photoUrl);
                        setImageError(true);
          }}
          onLoad={() => {
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

export default React.memo(Avatar);

