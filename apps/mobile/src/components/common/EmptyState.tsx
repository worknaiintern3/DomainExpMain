import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';
import { NeonButton } from './NeonButton';

interface EmptyStateProps {
  icon?: IconName | undefined;
  title: string;
  description: string;
  actionTitle?: string | undefined;
  onAction?: (() => void) | undefined;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'globe',
  title,
  description,
  actionTitle,
  onAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={32} color={colors.neonCyan} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionTitle && onAction ? (
        <NeonButton
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          size="md"
          icon="plus"
          style={styles.actionBtn}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.xxl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    minWidth: 160,
  },
});
