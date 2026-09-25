import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface Props {
  appName: string;
  message?: string | null | undefined;
}

export const MaintenanceNotice: React.FC<Props> = ({ appName, message }) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Icon name="shield-alert" size={48} color={colors.neonAmber} />
      </View>
      <Text style={styles.title}>{appName} Under Maintenance</Text>
      <Text style={styles.message}>
        {message || 'We are performing scheduled system upgrades. Please check back shortly.'}
      </Text>
      <View style={styles.badge}>
        <Icon name="refresh" size={12} color={colors.neonCyan} />
        <Text style={styles.badgeText}>Auto-reconnecting every 30s</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  badgeText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
