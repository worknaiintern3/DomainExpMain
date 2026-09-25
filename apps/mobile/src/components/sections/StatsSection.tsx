import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

interface MetricItem {
  id: string;
  label: string;
  value: number | string;
  icon: IconName;
  color: string;
  change?: string | undefined;
}

interface StatsSectionProps {
  title?: string | undefined;
  domainsCount?: number | undefined;
  serversCount?: number | undefined;
  websitesCount?: number | undefined;
  alertsCount?: number | undefined;
  onNavigate?: ((section: string) => void) | undefined;
}

export const StatsSection: React.FC<StatsSectionProps> = ({
  title = 'Overview',
  domainsCount = 0,
  serversCount = 0,
  websitesCount = 0,
  alertsCount = 0,
  onNavigate,
}) => {
  const metrics: MetricItem[] = [
    {
      id: 'domains',
      label: 'Domains',
      value: domainsCount,
      icon: 'globe',
      color: colors.neonCyan,
    },
    {
      id: 'servers',
      label: 'Servers',
      value: serversCount,
      icon: 'server',
      color: colors.sky,
    },
    {
      id: 'websites',
      label: 'Websites',
      value: websitesCount,
      icon: 'layers',
      color: colors.neonGreen,
    },
    {
      id: 'alerts',
      label: 'Alerts',
      value: alertsCount,
      icon: 'bell',
      color: alertsCount > 0 ? colors.warning : colors.textMuted,
    },
  ];

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.sectionHeader}>{title}</Text> : null}
      <View style={styles.grid}>
        {metrics.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => onNavigate?.(item.id)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { borderColor: `${item.color}40` }]}>
                <Icon name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
                {item.value}
              </Text>
            </View>
            <Text style={styles.metricLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '48.5%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
