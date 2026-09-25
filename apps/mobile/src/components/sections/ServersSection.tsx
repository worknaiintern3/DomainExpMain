import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBadge } from '../common/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';

export interface ServerSummaryItem {
  id: string;
  name: string;
  ipAddress?: string | null | undefined;
  status: string;
  provider?: string | null | undefined;
  region?: string | null | undefined;
}

interface Props {
  title?: string | undefined;
  servers?: ServerSummaryItem[] | undefined;
  onViewAll?: (() => void) | undefined;
  onSelectServer?: ((serverId: string) => void) | undefined;
}

export const ServersSection: React.FC<Props> = ({
  title = 'Monitored Infrastructure',
  servers = [],
  onViewAll,
  onSelectServer,
}) => {
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

      {servers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="server" size={20} color={colors.textMuted} />
          <Text style={styles.emptyText}>No infrastructure servers added yet</Text>
        </View>
      ) : (
        servers.slice(0, 3).map((srv) => (
          <TouchableOpacity
            key={srv.id}
            style={styles.serverCard}
            onPress={() => onSelectServer?.(srv.id)}
            activeOpacity={0.75}
          >
            <View style={styles.iconCircle}>
              <Icon name="server" size={18} color={colors.sky} />
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.serverName}>{srv.name}</Text>
              <Text style={styles.serverMeta}>
                {srv.ipAddress || 'Dynamic IP'}
                {srv.region ? ` · ${srv.region}` : ''}
              </Text>
            </View>

            <StatusBadge status={srv.status} size="sm" />
            <Icon name="chevron-right" size={18} color={colors.textDim} />
          </TouchableOpacity>
        ))
      )}
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
  serverCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  serverName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  serverMeta: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
});
