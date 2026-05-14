import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pink } from '@/constants/theme';
import { Icon } from '@/components/ui/icon';

export function PrivacyBadge({ size = 'medium' }: { size?: 'small' | 'medium' }) {
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, isSmall && styles.badgeSmall]}>
      <Icon name="shield-check" size={isSmall ? 14 : 16} color={Pink.primaryDark} />
      <Text style={[styles.text, isSmall && styles.textSmall]}>Private</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Pink.soft,
    borderWidth: 1,
    borderColor: Pink.border,
  },
  badgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    color: Pink.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 12,
  },
});
