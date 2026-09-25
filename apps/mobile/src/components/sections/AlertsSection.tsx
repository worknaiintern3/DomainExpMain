import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBadge } from '../common/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';

interface AlertItem {
  id: string;
  title: string;
  desc: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp?: string | undefined;
}

interface Props {
  title?: string | undefined;
  alerts?: AlertItem[] | undefined;
  onViewAll?: (() => void) | undefined;
}

export const AlertsSection: React.FC<Props> = ({
  title = 'Recent Alerts',
  alerts,
  onViewAll,
}) => {
  // If alerts prop not provided, show empty or minimal items
  const items: AlertItem[] = alerts || [];

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionHeader}>{title}</Text>
        </View>
        <View style={styles.emptyCard}>
          <Icon name="check-circle" size={20} color={colors.success} />
          <Text style={styles.emptyText}>All systems and domains operational</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionHeader}>{title}</Text>
        {onViewAll ? (
          <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {items.map((alt) => (
        <View
          key={alt.id}
          style={[
            styles.alertCard,
            alt.severity === 'critical' ? styles.criticalBorder : styles.warningBorder,
          ]}
        >
          <View style={styles.iconWrapper}>
            <Icon
              name="alert-triangle"
              size={18}
              color={alt.severity === 'critical' ? colors.danger : colors.warning}
            />
          </View>
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.alertDomain}>{alt.title}</Text>
              <StatusBadge status={alt.severity} size="sm" />
            </View>
            <Text style={styles.alertDesc}>{alt.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  viewAllText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
  },
  alertCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  criticalBorder: {
    borderColor: colors.borderCritical,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  warningBorder: {
    borderColor: colors.warningGlow,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  iconWrapper: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertDomain: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  alertDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
});
