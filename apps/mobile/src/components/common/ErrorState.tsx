import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';
import { NeonButton } from './NeonButton';

interface ErrorStateProps {
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to connect to DomainPulse servers. Check network connection.',
  onRetry,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name="alert-triangle" size={28} color={colors.danger} />
      </View>
      <Text style={styles.title}>Connection Error</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <NeonButton
          title="Try Again"
          onPress={onRetry}
          variant="secondary"
          size="sm"
          icon="refresh"
          style={styles.retryBtn}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderCritical,
    margin: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryBtn: {
    minWidth: 120,
  },
});
