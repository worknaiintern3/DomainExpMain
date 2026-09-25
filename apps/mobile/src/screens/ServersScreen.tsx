import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState, ErrorState, LoadingSkeleton, StatusBadge } from '../components/common';
import { mobileApiClient } from '../services/api-client';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

export interface ServerItem {
  id: string;
  name: string;
  ipAddress?: string | null | undefined;
  status: string;
  region?: string | null | undefined;
  os?: string | null | undefined;
  provider?: string | null | undefined;
}

export const ServersScreen: React.FC<{ onBack?: (() => void) | undefined }> = ({
  onBack,
}) => {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async () => {
    try {
      setError(null);
      const data = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/servers');
      const items = data.items || data.data || [];
      setServers(
        items.map((s: any) => ({
          id: s.id,
          name: s.name || s.hostname || 'VPS Server',
          ipAddress: s.ipAddress || s.ipv4 || null,
          status: s.status || 'Online',
          region: s.region || s.datacenter || 'us-east',
          os: s.os || s.distribution || 'Ubuntu 22.04 LTS',
          provider: s.provider || null,
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load servers from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchServers();
  };

  const renderServerItem = ({ item }: { item: ServerItem }) => {
    return (
      <View style={styles.serverCard}>
        <View style={styles.iconCircle}>
          <Icon name="server" size={20} color={colors.sky} />
        </View>

        <View style={styles.serverInfo}>
          <Text style={styles.serverName}>{item.name}</Text>
          <Text style={styles.serverMeta}>
            {item.ipAddress || 'Dynamic IP'} · {item.region}
          </Text>
          {item.os ? <Text style={styles.osText}>{item.os}</Text> : null}
        </View>

        <StatusBadge status={item.status} size="sm" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <View>
          <Text style={styles.headerTitle}>Servers</Text>
          <Text style={styles.headerSubtitle}>
            {servers.length} Connected VPS & Baremetal
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <LoadingSkeleton height={75} style={styles.skeleton} />
          <LoadingSkeleton height={75} style={styles.skeleton} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchServers} />
      ) : (
        <FlatList
          data={servers}
          keyExtractor={(item) => item.id}
          renderItem={renderServerItem}
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
              icon="server"
              title="No servers connected"
              description="Connect your cloud provider or monitor your VPS instances."
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
  serverCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverInfo: {
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
  osText: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    marginTop: 2,
  },
});
