import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export function HapticTab(props: BottomTabBarButtonProps) {
  const selected = !!props.accessibilityState?.selected;
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(selected ? 1.06 : 1, { damping: 15, stiffness: 220 });
  }, [scale, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: selected ? -2 : 0 }],
  }));

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      style={({ pressed }) => [styles.pressable, props.style, styles.hasContent, pressed && styles.pressed]}>
      <Animated.View style={[styles.content, animatedStyle]}>
        {props.children}
        <View style={[styles.activeDot, selected && styles.activeDotVisible]} />
      </Animated.View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hasContent: {
    minWidth: 56,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    marginTop: 4,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  activeDotVisible: {
    backgroundColor: '#FF4FA3',
    shadowColor: '#FF4FA3',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
