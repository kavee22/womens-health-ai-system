import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Fonts, Pink } from '@/constants/theme';

export function ProfileIconButton({
  name,
  avatarUri,
  dark = false,
}: {
  name?: string | null;
  avatarUri?: string | null;
  dark?: boolean;
}) {
  const router = useRouter();
  const initial = useMemo(() => (name?.trim()?.[0] || 'P').toUpperCase(), [name]);

  return (
    <Pressable onPress={() => router.push('/modal')} style={({ pressed }) => [styles.wrap, dark && styles.wrapDark, pressed && styles.pressed]}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.image} />
      ) : (
        <View style={styles.fallback}>
          <Text style={[styles.initial, dark && styles.initialDark]}>{initial}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  wrapDark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: Pink.border,
  },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontFamily: Fonts.sans },
  initialDark: { color: Pink.primaryDark },
  pressed: { opacity: 0.75 },
});
