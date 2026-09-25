import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

export type StatusVariant =
  | 'active'
  | 'online'
  | 'healthy'
  | 'expiring'
  | 'warning'
  | 'critical'
  | 'expired'
  | 'offline'
  | 'info'
  | 'neutral';

interface StatusBadgeProps {
  status: string;
  label?: string | undefined;
  variant?: StatusVariant | undefined;
  size?: 'sm' | 'md' | undefined;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant,
  size = 'md',
}) => {
  const getResolvedVariant = (): StatusVariant => {
    if (variant) return variant;
    const lower = status.toLowerCase();
    if (lower.includes('active') || lower.includes('online') || lower.includes('healthy'))
      return 'active';
    if (lower.includes('expir') || lower.includes('warn'))
      return 'warning';
    if (lower.includes('critical') || lower.includes('offline') || lower.includes('error'))
      return 'critical';
    return 'neutral';
  };

  const resolved = getResolvedVariant();

  const getColors = () => {
    switch (resolved) {
      case 'active':
      case 'online':
      case 'healthy':
        return {
          bg: 'rgba(16, 185, 129, 0.12)',
          border: 'rgba(16, 185, 129, 0.3)',
          dot: colors.success,
          text: colors.success,
        };
      case 'expiring':
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
          dot: colors.warning,
          text: colors.warning,
        };
      case 'critical':
      case 'expired':
      case 'offline':
        return {
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.3)',
          dot: colors.danger,
          text: colors.danger,
        };
      case 'info':
        return {
          bg: 'rgba(0, 229, 255, 0.12)',
          border: 'rgba(0, 229, 255, 0.3)',
          dot: colors.neonCyan,
          text: colors.neonCyan,
        };
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.25)',
          dot: colors.textMuted,
          text: colors.textSecondary,
        };
    }
  };

  const c = getColors();

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        { backgroundColor: c.bg, borderColor: c.border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: c.dot }]} />
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: c.text }]}>
        {label || status}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: spacing.xs,
  },
  badgeSm: {
    paddingVertical: 1,
    paddingHorizontal: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'capitalize',
  },
  textSm: {
    fontSize: typography.sizes.tiny,
  },
});
