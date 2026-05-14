import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type IconName =
  | 'calendar-heart'
  | 'heart-pulse'
  | 'chevron-right'
  | 'notebook'
  | 'pill'
  | 'chat'
  | 'user'
  | 'chart'
  | 'shield-check';

export function Icon({
  name,
  size = 24,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  const map: Record<IconName, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
    'calendar-heart': 'calendar-heart',
    'heart-pulse': 'heart-pulse',
    'chevron-right': 'chevron-right',
    notebook: 'notebook',
    pill: 'pill',
    chat: 'chat',
    user: 'account',
    chart: 'chart-line',
    'shield-check': 'shield-check',
  };

  return <MaterialCommunityIcons name={map[name]} size={size} color={color} />;
}
