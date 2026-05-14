import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Pink } from '@/constants/theme';

export function PinkButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const style =
    variant === 'danger'
      ? styles.danger
      : variant === 'secondary'
        ? styles.secondary
        : styles.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, style, (pressed || disabled) && styles.pressed]}>
      <Text style={[styles.buttonText, variant !== 'secondary' ? styles.buttonTextOn : styles.buttonTextOff]}>
        {title}
      </Text>
    </Pressable>
  );
}

export const PinkInput = React.forwardRef<TextInput, TextInputProps & { label: string; error?: string }>(
  function PinkInput({ label, error, ...props }, ref) {
    return (
      <View style={styles.inputWrap}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={ref}
          placeholderTextColor={Pink.muted}
          autoCapitalize="none"
          {...props}
          style={[styles.input, props.style]}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: '#FF4FA3',
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#FF4FA3',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  danger: {
    backgroundColor: '#D11A2A',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonTextOn: {
    color: 'white',
  },
  buttonTextOff: {
    color: '#F5F8FF',
  },
  inputWrap: {
    gap: 8,
  },
  label: {
    color: '#D8E1F0',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: '#F7F9FF',
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: '#FF9CB0',
    fontSize: 12,
    fontWeight: '700',
  },
});

