import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Fonts } from '@/constants/theme';

export type EnergyPoint = {
  ymd: string;
  energy: number; // 1..5
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CycleEnergyChart({
  points,
  width = 320,
  height = 140,
  selectedYmd,
  onSelect,
}: {
  points: EnergyPoint[];
  width?: number;
  height?: number;
  selectedYmd?: string | null;
  onSelect?: (ymd: string) => void;
}) {
  const paddingX = 12;
  const paddingY = 14;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const normalized = useMemo(() => {
    if (!points.length) return [];
    return points.map((p, idx) => {
      const x = paddingX + (points.length === 1 ? innerW / 2 : (idx / (points.length - 1)) * innerW);
      const e = clamp(p.energy, 1, 5);
      const t = (e - 1) / 4; // 0..1
      const y = paddingY + (1 - t) * innerH;
      return { ...p, x, y };
    });
  }, [points, innerW, innerH]);

  const poly = useMemo(() => normalized.map((p) => `${p.x},${p.y}`).join(' '), [normalized]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = paddingY + t * innerH;
          return (
            <Line
              key={t}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
          );
        })}

        <Polyline
          points={poly}
          fill="none"
          stroke="#E563B9"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {normalized.map((p) => {
          const selected = selectedYmd === p.ymd;
          return (
            <Circle
              key={p.ymd}
              cx={p.x}
              cy={p.y}
              r={selected ? 6 : 4}
              fill={selected ? '#E563B9' : '#E8EEFC'}
              stroke="#E563B9"
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      <View style={styles.hitRow} pointerEvents="box-none">
        {points.map((p) => (
          <Pressable
            key={p.ymd}
            onPress={() => onSelect?.(p.ymd)}
            style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendText}>Energy (last {points.length} days)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  hitRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  hit: { flex: 1 },
  pressed: { opacity: 0.6 },
  legend: { position: 'absolute', left: 12, bottom: 10 },
  legendText: { color: '#9FB0CB', fontWeight: '800', fontSize: 11, fontFamily: Fonts.sans },
});

