import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut, updateProfile } from 'firebase/auth';
import { onValue, ref, set } from 'firebase/database';
import { StatusBar } from 'expo-status-bar';

import { Icon } from '@/components/ui/icon';
import { Fonts } from '@/constants/theme';
import { auth, db } from '@/lib/firebase';
import { clearProfileAvatar, saveProfileAvatar } from '@/lib/profile-avatar';
import { saveStoredProfileName } from '@/lib/profile-name';
import { useAuth } from '@/providers/AuthProvider';

type UserProfile = {
  name: string;
  phone: string;
  updatedAt: number;
};

export default function ProfileModal() {
  const insets = useSafeAreaInsets();
  const { user, profileAvatarUri, profileName, setProfileAvatarUri, setProfileName } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const name = (nameInput || profileName || user?.displayName || '').trim() || 'Pink Care User';
  const email = user?.email || '';
  const avatarUri = profileAvatarUri ?? user?.photoURL ?? null;
  const initials = useMemo(() => (name[0] || 'P').toUpperCase(), [name]);

  useEffect(() => {
    if (!user) return;
    const profileRef = ref(db, `users/${user.uid}/profile`);
    const unsub = onValue(profileRef, (snap) => {
      const val = snap.val() as UserProfile | null;
      if (val?.name && !nameInput) setNameInput(val.name);
      if (val?.phone && !phoneInput) setPhoneInput(val.phone);
    });
    return () => unsub();
    // intentionally not depending on inputs to avoid overwriting user edits mid-typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!nameInput) {
      const nextName = profileName || user.displayName;
      if (nextName) setNameInput(nextName);
    }
  }, [user, profileName, nameInput]);

  async function pickAvatar() {
    if (!user || saving) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to pick a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    setSaving(true);
    try {
      const savedUri = await saveProfileAvatar(user.uid, result.assets[0].uri);
      setProfileAvatarUri(savedUri);
    } catch {
      Alert.alert('Upload failed', 'We could not save the selected image on this device.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAvatar() {
    if (!user || saving) return;

    setSaving(true);
    try {
      await clearProfileAvatar(user.uid);
      setProfileAvatarUri(null);
    } catch {
      Alert.alert('Remove failed', 'We could not clear the stored profile image.');
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    if (!user || savingProfile) return;

    const nextName = nameInput.trim();
    const nextPhone = phoneInput.trim();

    if (nextName.length < 2) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    setSavingProfile(true);
    try {
      await set(ref(db, `users/${user.uid}/profile`), {
        name: nextName,
        phone: nextPhone,
        updatedAt: Date.now(),
      } satisfies UserProfile);

      const localName = await saveStoredProfileName(user.uid, nextName);
      setProfileName(localName);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: nextName });
      }

      Alert.alert('Saved', 'Your profile was updated.');
    } catch {
      Alert.alert('Save failed', 'Could not update your profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.bgGlowOne} />
      <View pointerEvents="none" style={styles.bgGlowTwo} />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Keep your details up to date</Text>
          </View>
          <Link href="/" dismissTo asChild>
            <Pressable style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarFrame}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </View>
              )}
              {saving ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}
            </View>

            <View style={styles.avatarCopy}>
              <Text style={styles.name}>{name}</Text>
              {!!email && <Text style={styles.email}>{email}</Text>}
              <Text style={styles.savedNote}>Profile photo is stored on this device</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={pickAvatar} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
              <Text style={styles.primaryActionText}>{avatarUri ? 'Change Photo' : 'Upload Photo'}</Text>
            </Pressable>
            <Pressable
              onPress={removeAvatar}
              disabled={!avatarUri || saving}
              style={({ pressed }) => [styles.secondaryAction, (!avatarUri || saving) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.secondaryActionText}>Remove</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Personal details</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              autoComplete="name"
              placeholderTextColor="#7783A0"
              style={styles.input}
            />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.label}>Telephone</Text>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="07X XXX XXXX"
              keyboardType="phone-pad"
              placeholderTextColor="#7783A0"
              style={styles.input}
            />
          </View>
          <Pressable onPress={saveProfile} disabled={savingProfile} style={({ pressed }) => [styles.saveButton, (pressed || savingProfile) && styles.pressed]}>
            <Text style={styles.saveButtonText}>{savingProfile ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.reportWrap}>
            <Link href="/(tabs)/report" asChild>
              <Pressable style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                <Icon name="chart" size={24} color="#FFFFFF" />
              </Pressable>
            </Link>
            <Text style={styles.reportLabel}>Monthly Report</Text>
          </View>
          <Pressable onPress={() => signOut(auth)} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060912' },
  container: { paddingHorizontal: 20, gap: 14 },
  bgGlowOne: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: 'rgba(58, 227, 255, 0.14)',
  },
  bgGlowTwo: {
    position: 'absolute',
    left: -110,
    top: 170,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(228, 95, 179, 0.12)',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 22, fontWeight: '900', color: '#F5F8FF', fontFamily: Fonts.serif, letterSpacing: -0.3 },
  subtitle: { marginTop: 4, color: '#8F9BB5', fontSize: 12, fontWeight: '600', fontFamily: Fonts.sans },
  close: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  closeText: { color: '#F5F8FF', fontWeight: '900', fontFamily: Fonts.sans },
  heroCard: {
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  avatarSection: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarFrame: {
    width: 76,
    height: 76,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#F5F8FF', fontWeight: '900', fontSize: 24, fontFamily: Fonts.sans },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
  },
  avatarCopy: { flex: 1, gap: 4 },
  name: { color: '#F5F8FF', fontWeight: '900', fontSize: 16, fontFamily: Fonts.sans },
  email: { color: '#8F9BB5', fontWeight: '700', fontFamily: Fonts.sans },
  savedNote: {
    color: '#9FDCEA',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryAction: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FF4FA3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E7338D',
  },
  primaryActionText: { color: 'white', fontWeight: '900', fontFamily: Fonts.sans },
  secondaryAction: {
    width: 110,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { color: '#F5F8FF', fontWeight: '900', fontFamily: Fonts.sans },
  formCard: {
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  formTitle: { color: '#F7F9FF', fontWeight: '900', fontSize: 14, fontFamily: Fonts.sans },
  inputWrap: { gap: 8 },
  label: {
    color: '#9AA9C3',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: Fonts.sans,
  },
  input: {
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: '#F1F5FF',
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  saveButton: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF4FA3',
    borderWidth: 1,
    borderColor: '#E7338D',
    marginTop: 2,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '900', fontFamily: Fonts.sans },
  footer: { marginTop: 6, gap: 20 },
  reportWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  reportButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A74FF',
    borderWidth: 1,
    borderColor: '#7861EF',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  reportLabel: {
    marginTop: 8,
    color: '#DADFFF',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  logout: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  logoutText: { color: '#F5F8FF', fontWeight: '900', fontFamily: Fonts.sans },
});
