import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { auth } from '@/lib/firebase';
import { PinkButton, PinkInput } from '@/components/ui/pink';

function friendlyAuthError(code?: string) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found for this email.';
    default:
      return 'Could not send reset email. Please try again.';
  }
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3, [email]);

  async function onSend() {
    setError(null);
    setSent(false);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e: any) {
      setError(friendlyAuthError(e?.code));
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToBottomSoon() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
      <StatusBar style="light" translucent={false} backgroundColor="#060912" hidden={false} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom + 24, 140) },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroTopRow}>
            <View style={styles.brandMark}>
              <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
            </View>
            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>Pink Care</Text>
            </View>
          </View>
          <Text style={styles.kicker}>Reset access</Text>
          <Text style={styles.title}>Recover your Pink Care password</Text>
          <Text style={styles.subtitle}>We will email you a link to create a new password and sign back in.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Forgot password</Text>
          <Text style={styles.cardSubtitle}>Enter the email attached to your account.</Text>

          <View style={styles.form}>
            <PinkInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              onFocus={scrollToBottomSoon}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}
            {sent && <Text style={styles.success}>Password reset email sent.</Text>}

            <View style={styles.actions}>
              <PinkButton
                title={submitting ? 'Sending...' : 'Send reset email'}
                onPress={onSend}
                disabled={!canSubmit || submitting}
              />
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FF4FA3" />
                  <Text style={styles.loadingText}>Sending secure link</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.links}>
              <Link href="/(auth)/login" asChild>
                <Text style={styles.link}>Back to sign in</Text>
              </Link>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>2026 Pink Care</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060912',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 14,
  },
  hero: {
    borderRadius: 32,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: '#11182A',
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroGlowOne: {
    position: 'absolute',
    top: -80,
    right: -70,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: 'rgba(58, 227, 255, 0.12)',
  },
  heroGlowTwo: {
    position: 'absolute',
    left: -90,
    bottom: -100,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 79, 163, 0.12)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  brandPillText: {
    color: '#E8EEF9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Fonts.sans,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 16,
  },
  kicker: {
    color: '#9AA7C0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: Fonts.sans,
  },
  title: {
    color: '#F7F9FF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: Fonts.serif,
    letterSpacing: -0.5,
    maxWidth: 290,
  },
  subtitle: {
    color: '#B9C5DB',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: '600',
    fontFamily: Fonts.sans,
    maxWidth: 290,
  },
  card: {
    backgroundColor: 'rgba(17, 24, 42, 0.94)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(140, 170, 255, 0.14)',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  cardTitle: {
    color: '#F7F9FF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: Fonts.serif,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: '#B9C5DB',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  form: {
    gap: 14,
  },
  actions: {
    gap: 10,
    marginTop: 6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#B9C5DB',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  links: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  link: {
    color: '#FF9ED0',
    fontWeight: '800',
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  error: {
    color: '#FF9CB0',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  success: {
    color: '#9FF2C6',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  footer: {
    textAlign: 'center',
    color: '#7F8DAA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
});
