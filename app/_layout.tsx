import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  ensureNotificationPermission,
  initializeNotifications,
} from "@/lib/notifications";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";

function AuthRedirector() {
  const { user, initializing } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAuth = segments[0] === "(auth)";
    const inApp = segments[0] === "(tabs)";
    const inModal = segments[0] === "modal";

    if (!user && !inAuth && !inModal) {
      router.replace("/(auth)/login");
      return;
    }

    if (user && (inAuth || (!inApp && !inModal))) {
      router.replace("/(tabs)");
    }
  }, [user, initializing, segments, router]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    initializeNotifications();
    void ensureNotificationPermission();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <AuthRedirector />
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", headerShown: false }}
          />
        </Stack>
        <StatusBar
          style="dark"
          translucent={false}
          backgroundColor="white"
          hidden={false}
        />
      </ThemeProvider>
    </AuthProvider>
  );
}
