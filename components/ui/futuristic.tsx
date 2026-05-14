import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { FuturisticTheme, FuturisticRadii, FuturisticSizes } from '@/constants/futuristic-theme';

export function FuturisticButton({
  title,
  onPress,
  disabled,
  variant = 'primary',
  size = 'default',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'default' | 'large';
}) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const styleMap = {
    primary: styles.primary,
    secondary: styles.secondary,
    ghost: styles.ghost,
    danger: styles.danger,
  };

  const sizeStyle = isSmall ? styles.sizeSmall : isLarge ? styles.sizeLarge : styles.sizeDefault;

  const content = (
    <Text
      style={[
        styles.buttonText,
        isSmall && styles.textSmall,
        isLarge && styles.textLarge,
        variant !== 'secondary' && variant !== 'ghost' ? styles.textLight : styles.textDark,
      ]}>
      {title}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        sizeStyle,
        styleMap[variant],
        (pressed || disabled) && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {content}
    </Pressable>
  );
}

export function FuturisticInput({
  label,
  error,
  icon,
  ...props
}: TextInputProps & { label?: string; error?: string; icon?: React.ReactNode }) {
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused, error && styles.inputWrapperError]}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          placeholderTextColor={FuturisticTheme.textTertiary}
          autoCapitalize="none"
          {...props}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, icon && styles.inputWithIcon, props.style]}
        />
      </View>
      {error && <Text style={styles.inputError}>{error}</Text>}
    </View>
  );
}

export function FuturisticCard({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'gradient';
}) {
  const styleMap = {
    default: styles.cardDefault,
    glass: styles.cardGlass,
    gradient: styles.cardGradient,
  };

  return <View style={[styles.card, styleMap[variant]]}>{children}</View>;
}

export function FuturisticBadge({
  label,
  variant = 'primary',
}: {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}) {
  const variantMap = {
    primary: styles.badgePrimary,
    secondary: styles.badgeSecondary,
    success: styles.badgeSuccess,
    warning: styles.badgeWarning,
    error: styles.badgeError,
  };

  const textColorMap = {
    primary: styles.badgeTextLight,
    secondary: styles.badgeTextDark,
    success: styles.badgeTextLight,
    warning: styles.badgeTextLight,
    error: styles.badgeTextLight,
  };

  return (
    <View style={[styles.badge, variantMap[variant]]}>
      <Text style={[styles.badgeText, textColorMap[variant]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Button styles
  button: {
    borderRadius: FuturisticRadii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sizeSmall: {
    height: 36,
    paddingHorizontal: FuturisticSizes.md,
  },
  sizeDefault: {
    height: 48,
    paddingHorizontal: FuturisticSizes.lg,
  },
  sizeLarge: {
    height: 56,
    paddingHorizontal: FuturisticSizes.xl,
  },
  primary: {
    backgroundColor: FuturisticTheme.primary,
  },
  secondary: {
    backgroundColor: FuturisticTheme.surface,
    borderWidth: 1.5,
    borderColor: FuturisticTheme.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: FuturisticTheme.textTertiary,
  },
  danger: {
    backgroundColor: FuturisticTheme.error,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  textSmall: {
    fontSize: 13,
  },
  textDark: {
    color: FuturisticTheme.textPrimary,
  },
  textLight: {
    color: '#FFFFFF',
  },
  textLarge: {
    fontSize: 17,
  },

  // Input styles
  inputContainer: {
    gap: FuturisticSizes.sm,
  },
  label: {
    color: FuturisticTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: FuturisticRadii.md,
    paddingHorizontal: FuturisticSizes.md,
    backgroundColor: FuturisticTheme.surface,
    borderWidth: 1,
    borderColor: FuturisticTheme.border,
  },
  inputWrapperFocused: {
    borderColor: FuturisticTheme.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  inputWrapperError: {
    borderColor: FuturisticTheme.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  input: {
    flex: 1,
    color: FuturisticTheme.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  inputWithIcon: {
    marginLeft: FuturisticSizes.sm,
  },
  icon: {
    marginRight: FuturisticSizes.sm,
  },
  inputError: {
    color: FuturisticTheme.error,
    fontSize: 12,
    fontWeight: '500',
  },

  // Card styles
  card: {
    borderRadius: FuturisticRadii.xl,
    padding: FuturisticSizes.lg,
    borderWidth: 1,
  },
  cardDefault: {
    backgroundColor: FuturisticTheme.surfaceLight,
    borderColor: FuturisticTheme.border,
  },
  cardGlass: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  cardGradient: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },

  // Badge styles
  badge: {
    paddingHorizontal: FuturisticSizes.md,
    paddingVertical: FuturisticSizes.xs,
    borderRadius: FuturisticRadii.full,
    alignSelf: 'flex-start',
  },
  badgePrimary: {
    backgroundColor: FuturisticTheme.primary,
  },
  badgeSecondary: {
    backgroundColor: FuturisticTheme.surface,
    borderWidth: 1,
    borderColor: FuturisticTheme.border,
  },
  badgeSuccess: {
    backgroundColor: FuturisticTheme.success,
  },
  badgeWarning: {
    backgroundColor: FuturisticTheme.warning,
  },
  badgeError: {
    backgroundColor: FuturisticTheme.error,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  badgeTextLight: {
    color: '#FFFFFF',
  },
  badgeTextDark: {
    color: FuturisticTheme.textPrimary,
  },
});
