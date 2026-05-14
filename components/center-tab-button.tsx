import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Pink } from '@/constants/theme';

export function CenterTabButton({ accessibilityState, onPress, onLongPress, children }: BottomTabBarButtonProps) {
  const selected = !!accessibilityState?.selected;
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.08 : 0.96, { damping: 14, stiffness: 220 });
  }, [selected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: selected ? -4 : 2 }],
    opacity: selected ? 1 : 0.88,
  }));

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={[styles.outerRing, animStyle]}>
        <View style={[styles.innerGlow, !selected && styles.innerGlowIdle]} />
        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <View style={styles.iconSlot}>{children}</View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
  },
  outerRing: {
    marginTop: -18,
    borderRadius: 24,
    padding: 2,
    shadowColor: Pink.primary,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
  },
  innerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 79, 163, 0.12)',
  },
  innerGlowIdle: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  button: {
    width: 68,
    height: 74,
    borderRadius: 22,
    backgroundColor: '#FF4FA3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#FF4FA3',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  iconSlot: {
    marginTop: 0,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
});

