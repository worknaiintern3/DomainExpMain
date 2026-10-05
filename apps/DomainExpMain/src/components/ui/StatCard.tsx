import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor?: string;
  style?: ViewStyle;
}

export function StatCard({ title, value, subtitle, accentColor, style }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <Card style={[styles.card, style]} borderAccent={accentColor ? `${accentColor}44` : undefined}>
      {accentColor && <View style={[styles.accentIndicator, { backgroundColor: accentColor }]} />}
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.value, { color: accentColor || colors.text }]}>{value}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: Spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  accentIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  title: {
    ...Typography.bodySmall,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...Typography.titleLarge,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 4,
  },
});
