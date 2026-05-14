import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: styles.tabIcon,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          height: 78,
          borderRadius: 28,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          overflow: 'visible',
        },
        tabBarBackground: () => (
          <View
            style={[
              styles.tabBarShell,
              {
                backgroundColor:
                  colorScheme === 'dark' ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.9)',
                borderColor:
                  colorScheme === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'rgba(255, 79, 163, 0.16)',
              },
            ]}>
            <View
              style={[
                styles.tabBarSheen,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255, 79, 163, 0.08)',
                },
              ]}
            />
          </View>
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="detection"
        options={{
          title: 'Detection',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="heart.text.square" color={color} />,
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: 'Reminders',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cycle"
        options={{
          title: 'Cycle',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
    overflow: 'hidden',
  },
  tabBarSheen: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    opacity: Platform.OS === 'android' ? 0.9 : 1,
  },
  tabItem: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  tabIcon: {
    marginBottom: 0,
  },
});
