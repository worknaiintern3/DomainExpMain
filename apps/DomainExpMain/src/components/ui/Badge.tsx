import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  dot?: boolean;
}

export function Badge({ label, variant = 'neutral', style, textStyle, dot }: BadgeProps) {
  const { colors } = useTheme();
  const variantStyles = getVariantStyle(variant, colors);

  return (
    <View style={[styles.badge, variantStyles.container, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: variantStyles.dotColor }]} />}
      <Text style={[styles.label, { color: variantStyles.textColor }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

function getVariantStyle(variant: BadgeVariant, colors: any) {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
        textColor: colors.primary,
        dotColor: colors.primary,
      };
    case 'success':
      return {
        container: { backgroundColor: colors.emeraldMuted, borderColor: colors.emerald },
        textColor: colors.emerald,
        dotColor: colors.emerald,
      };
    case 'warning':
      return {
        container: { backgroundColor: colors.amberMuted, borderColor: colors.amber },
        textColor: colors.amber,
        dotColor: colors.amber,
      };
    case 'danger':
      return {
        container: { backgroundColor: colors.roseMuted, borderColor: colors.rose },
        textColor: colors.rose,
        dotColor: colors.rose,
      };
    case 'violet':
      return {
        container: { backgroundColor: colors.violetMuted, borderColor: colors.violet },
        textColor: colors.violet,
        dotColor: colors.violet,
      };
    case 'neutral':
    default:
      return {
        container: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        textColor: colors.textSecondary,
        dotColor: colors.textMuted,
      };
  }
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
  },
});
