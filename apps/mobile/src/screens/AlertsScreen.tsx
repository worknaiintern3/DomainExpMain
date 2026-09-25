import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  StatusBadge,
} from '../components/common';
import { mobileApiClient } from '../services/api-client';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

export interface AlertRecord {
  id: string;
  title: string;
  resourceId?: string | null | undefined;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
}

export const AlertsScreen: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setError(null);
      const data = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/alerts');
      const items = data.items || data.data || [];
      setAlerts(
        items.map((a: any) => ({
          id: a.id,
          title: a.title || a.resourceId || 'Alert Notification',
          resourceId: a.resourceId || null,
          message: a.message || a.description || 'System state alert',
          severity:
            a.severity?.toLowerCase() === 'critical' || a.level === 'CRITICAL'
              ? 'critical'
              : a.severity?.toLowerCase() === 'warning' || a.level === 'WARN'
              ? 'warning'
              : 'info',
          status: a.acknowledgedAt ? 'acknowledged' : a.resolvedAt ? 'resolved' : 'active',
          createdAt: a.createdAt || new Date().toISOString(),
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load alerts from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await mobileApiClient.request(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)),
      );
    } catch {
      // ignore
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedFilter === 'All') return true;
      if (selectedFilter === 'Critical') return a.severity === 'critical';
      if (selectedFilter === 'Warning') return a.severity === 'warning';
      if (selectedFilter === 'Resolved')
        return a.status === 'resolved' || a.status === 'acknowledged';
      return true;
    });
  }, [alerts, selectedFilter]);

  const renderAlertItem = ({ item }: { item: AlertRecord }) => {
    const isCritical = item.severity === 'critical';
    const isWarning = item.severity === 'warning';

    return (
      <View
        style={[
          styles.alertCard,
          isCritical && styles.cardCritical,
          isWarning && styles.cardWarning,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Icon
              name="alert-triangle"
              size={18}
              color={isCritical ? colors.danger : isWarning ? colors.warning : colors.neonCyan}
            />
            <Text style={styles.alertTitle}>{item.title}</Text>
          </View>
          <StatusBadge status={item.severity} size="sm" />
        </View>

        <Text style={styles.alertMessage}>{item.message}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.timestampRow}>
            <Icon name="clock" size={12} color={colors.textMuted} />
            <Text style={styles.timestampText}>
              {new Date(item.createdAt).toLocaleDateString()} ·{' '}
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          {item.status === 'active' ? (
            <TouchableOpacity
              style={styles.ackBtn}
              onPress={() => handleAcknowledge(item.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.ackBtnText}>Acknowledge</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ackPill}>
              <Icon name="check" size={12} color={colors.success} />
              <Text style={styles.ackPillText}>Acknowledged</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <Text style={styles.headerSubtitle}>
          {alerts.filter((a) => a.status === 'active').length} Active Issues
        </Text>
      </View>

      {/* Filter Chips */}
      <FilterChips
        options={['All', 'Critical', 'Warning', 'Resolved']}
        selected={selectedFilter}
        onSelect={setSelectedFilter}
      />

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <LoadingSkeleton height={85} style={styles.skeleton} />
          <LoadingSkeleton height={85} style={styles.skeleton} />
          <LoadingSkeleton height={85} style={styles.skeleton} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAlerts} />
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.neonCyan}
              colors={[colors.neonCyan]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="shield"
              title="All systems clear"
              description="No active infrastructure alerts or domain expiration notices recorded."
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  loadingWrapper: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeleton: {
    borderRadius: radius.lg,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  alertCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  cardCritical: {
    borderColor: colors.borderCritical,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  cardWarning: {
    borderColor: colors.warningGlow,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  alertTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    flex: 1,
  },
  alertMessage: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: 4,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampText: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
  },
  ackBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.neonCyan,
  },
  ackBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  ackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ackPillText: {
    color: colors.success,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.medium,
  },
});
