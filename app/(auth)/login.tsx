import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  findNodeHandle,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinkButton, PinkInput } from "@/components/ui/pink";
import { Fonts } from "@/constants/theme";
import { auth } from "@/lib/firebase";
import { showInstantNotification } from "@/lib/notifications";

function friendlyAuthError(code?: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Login failed. Please try again.";
  }
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => email.trim().length > 3 && password.length >= 6,
    [email, password],
  );

  async function onLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      await showInstantNotification({
        title: "Signed in",
        body: "Welcome back to Pink Care.",
      });
    } catch (e: any) {
      setError(friendlyAuthError(e?.code));
    } finally {
      setSubmitting(false);
    }
  }

  function scrollInputIntoView(inputRef: React.RefObject<TextInput | null>) {
    requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      const input = inputRef.current;
      const target = input ? findNodeHandle(input) : null;

      if (scroll && target) {
        scroll.scrollResponderScrollNativeHandleToKeyboard(target, 24, true);
      } else {
        scroll?.scrollToEnd({ animated: true });
      }
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      enabled
    >
      <StatusBar
        style="light"
        translucent={false}
        backgroundColor="#060912"
        hidden={false}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 18,
            paddingBottom: Math.max(insets.bottom + 24, 250),
          },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroTopRow}>
            <View style={styles.brandMark}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.logo}
              />
            </View>
            <View style={styles.brandPill}>
              <Text style={styles.brandPillText}>Pink Care</Text>
            </View>
          </View>

          <Text style={styles.kicker}>Welcome back</Text>
          <Text style={styles.title}>Sign in to your health dashboard</Text>
          <Text style={styles.subtitle}>
            Track your cycle, reminders, and AI support in one calm place.
          </Text>

          <View style={styles.featureRow}>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>Cycle sync</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>Self-check</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featureText}>Ask AI</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in</Text>
          <Text style={styles.cardSubtitle}>
            Use the same email and password you created for Pink Care.
          </Text>

          <View style={styles.form}>
            <PinkInput
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              onFocus={() => scrollInputIntoView(emailRef)}
            />
            <PinkInput
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoComplete="password"
              onFocus={() => scrollInputIntoView(passwordRef)}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.actions}>
              <PinkButton
                title={submitting ? "Signing in..." : "Sign in"}
                onPress={onLogin}
                disabled={!canSubmit || submitting}
              />
              {submitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FF4FA3" />
                  <Text style={styles.loadingText}>Checking your details</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.links}>
              <Link href="/(auth)/register" asChild>
                <Text style={styles.link}>Create account</Text>
              </Link>
              <Text style={styles.dot}>·</Text>
              <Link href="/(auth)/forgot-password" asChild>
                <Text style={styles.link}>Forgot password</Text>
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
    backgroundColor: "#060912",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 14,
  },
  hero: {
    borderRadius: 32,
    padding: 18,
    overflow: "hidden",
    backgroundColor: "#11182A",
    borderWidth: 1,
    borderColor: "rgba(140, 170, 255, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  heroGlowOne: {
    position: "absolute",
    top: -80,
    right: -70,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "rgba(58, 227, 255, 0.12)",
  },
  heroGlowTwo: {
    position: "absolute",
    left: -90,
    bottom: -100,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255, 79, 163, 0.12)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  brandPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  brandPillText: {
    color: "#E8EEF9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: Fonts.sans,
  },
  logo: {
    width: 54,
    height: 54,
    borderRadius: 16,
  },
  kicker: {
    color: "#9AA7C0",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
    fontFamily: Fonts.sans,
  },
  title: {
    color: "#F7F9FF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: Fonts.serif,
    letterSpacing: -0.5,
    maxWidth: 290,
  },
  subtitle: {
    color: "#B9C5DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    maxWidth: 290,
  },
  featureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  featurePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  featureText: {
    color: "#DCE4F3",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Fonts.sans,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: "rgba(17, 24, 42, 0.94)",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(140, 170, 255, 0.14)",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  cardTitle: {
    color: "#F7F9FF",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    fontFamily: Fonts.serif,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: "#B9C5DB",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  loadingText: {
    color: "#B9C5DB",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  links: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  link: {
    color: "#FF9ED0",
    fontWeight: "800",
    fontSize: 12,
    fontFamily: Fonts.sans,
  },
  dot: {
    color: "#7F8DAA",
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: "#FF9CB0",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
  footer: {
    textAlign: "center",
    color: "#7F8DAA",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
});
