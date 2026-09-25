import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBadge } from '../common/StatusBadge';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';

export interface DomainSummaryItem {
  id: string;
  name: string;
  status: string;
  expiresInDays?: number | null | undefined;
  expiryDate?: string | null | undefined;
  autoRenew?: boolean | undefined;
}

interface Props {
  title?: string | undefined;
  domains?: DomainSummaryItem[] | undefined;
  onViewAll?: (() => void) | undefined;
  onSelectDomain?: ((domainId: string) => void) | undefined;
}

export const DomainsSection: React.FC<Props> = ({
  title = 'Domains Expiring Soon',
  domains = [],
  onViewAll,
  onSelectDomain,
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

      {domains.length === 0 ? (
        <View style={styles.emptyCard}>
          <Icon name="globe" size={20} color={colors.textMuted} />
          <Text style={styles.emptyText}>No domains requiring urgent renewal</Text>
        </View>
      ) : (
        domains.slice(0, 4).map((dom) => (
          <TouchableOpacity
            key={dom.id}
            style={styles.domainCard}
            onPress={() => onSelectDomain?.(dom.id)}
            activeOpacity={0.75}
          >
            <View style={styles.iconCircle}>
              <Icon name="globe" size={18} color={colors.neonCyan} />
            </View>

            <View style={styles.domainInfo}>
              <Text style={styles.domainName}>{dom.name}</Text>
              <Text style={styles.expiryMeta}>
                {dom.expiresInDays !== undefined && dom.expiresInDays !== null
                  ? dom.expiresInDays <= 7
                    ? `⚠️ ${dom.expiresInDays} days remaining`
                    : `Expires in ${dom.expiresInDays} days`
                  : dom.expiryDate
                  ? `Expires on ${new Date(dom.expiryDate).toLocaleDateString()}`
                  : 'Monitored'}
              </Text>
            </View>

            <View style={styles.badgeCol}>
              <StatusBadge status={dom.status} size="sm" />
            </View>

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
  domainCard: {
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
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainInfo: {
    flex: 1,
  },
  domainName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  expiryMeta: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  badgeCol: {
    marginRight: spacing.xs,
  },
});
