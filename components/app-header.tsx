import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';

import { Pink } from '@/constants/theme';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';

export function AppHeader({
  title,
  subtitle,
  rightElement,
}: {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profileAvatarUri } = useAuth();

  const initials = useMemo(() => {
    const name = user?.displayName?.trim() || 'P';
    return (name[0] || 'P').toUpperCase();
  }, [user?.displayName]);

  const avatarUri = profileAvatarUri ?? user?.photoURL ?? null;

  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.actions}>
        {rightElement}
        <Pressable
          onPress={() => router.push('/modal')}
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarDot} />
        </Pressable>

        <Pressable onPress={() => signOut(auth)} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  title: { color: Pink.primary, fontWeight: '900', fontSize: 24, letterSpacing: -0.2 },
  subtitle: { marginTop: 6, color: Pink.muted, fontWeight: '700', fontSize: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Pink.border,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: Pink.primaryDark, fontWeight: '900' },
  avatarDot: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 9,
    height: 9,
    borderRadius: 6,
    backgroundColor: Pink.primary,
    borderWidth: 2,
    borderColor: 'white',
  },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Pink.soft2,
    borderWidth: 1,
    borderColor: Pink.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: Pink.primaryDark, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
