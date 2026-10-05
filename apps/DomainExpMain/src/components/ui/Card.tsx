import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { Radius, Spacing } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';

interface CardProps extends ViewProps {
  elevated?: boolean;
  borderAccent?: string;
}

export function Card({ style, elevated, borderAccent, children, ...props }: CardProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderColor: borderAccent || colors.border,
          borderWidth: 1,
        },
        elevated && (isDark ? styles.elevatedDark : styles.elevatedLight),
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  elevatedDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  elevatedLight: {
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
});
