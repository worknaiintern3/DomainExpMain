import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  imageSource?: ImageSourcePropType;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.md,
        }}
      >
        <Text style={{ fontSize: 28 }}>📦</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.textInverse }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginVertical: Spacing.md,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.titleSmall,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.lg,
  },
  button: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  buttonText: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
});
