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

export interface ProviderConnectionItem {
  id: string;
  authType: string;
  credentialMask: string;
  syncStatus: string;
  validationStatus: string;
  lastValidatedAt?: string | null | undefined;
  lastSyncAt?: string | null | undefined;
  createdAt: string;
}

export const ProvidersScreen: React.FC<{ onBack?: (() => void) | undefined }> = ({
  onBack,
}) => {
  const [connections, setConnections] = useState<ProviderConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = async () => {
    try {
      setError(null);
      const data = await mobileApiClient.request<{ items?: any[]; data?: any[] }>(
        '/provider-connections',
      );
      const items = data.items || data.data || [];
      setConnections(
        items.map((c: any) => ({
          id: c.id,
          authType: c.authType || 'API_KEY',
          credentialMask: c.credentialMask || '••••••••',
          syncStatus: c.syncStatus || 'IDLE',
          validationStatus: c.validationStatus || 'VALID',
          lastValidatedAt: c.lastValidatedAt || null,
          lastSyncAt: c.lastSyncAt || null,
          createdAt: c.createdAt,
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load provider connections.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleValidate = async (id: string) => {
    try {
      setValidatingId(id);
      await mobileApiClient.request(`/provider-connections/${id}/validate`, {
        method: 'POST',
      });
      // Refresh after validation
      await fetchProviders();
    } catch (err: any) {
      setError(err?.message || 'Validation failed.');
    } finally {
      setValidatingId(null);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProviders();
  };

  const formatAuthType = (authType: string) => {
    return authType
      .replace(/_/g, ' ')
      .replace(/API TOKEN/g, 'Token')
      .replace(/API KEY/g, 'Key')
      .replace(/PAT/g, 'Token');
  };

  const renderItem = ({ item }: { item: ProviderConnectionItem }) => {
    const isValid = item.validationStatus === 'VALID';
    const isPending = item.validationStatus === 'PENDING';
    const isValidating = validatingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.providerInfo}>
            <View style={styles.iconCircle}>
              <Icon name="cloud" size={20} color={colors.sky} />
            </View>
            <View>
              <Text style={styles.providerName}>{formatAuthType(item.authType)}</Text>
              <Text style={styles.maskText}>{item.credentialMask}</Text>
            </View>
          </View>

          <StatusBadge
            status={isValid ? 'active' : isPending ? 'warning' : 'critical'}
            label={item.validationStatus}
            size="sm"
          />
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Sync Status</Text>
            <Text style={styles.metaValue}>{item.syncStatus}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Last Synced</Text>
            <Text style={styles.metaValue}>
              {item.lastSyncAt ? new Date(item.lastSyncAt).toLocaleDateString() : 'Never'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.validateBtn, isValidating && styles.validateBtnDisabled]}
            disabled={isValidating}
            onPress={() => handleValidate(item.id)}
            activeOpacity={0.7}
          >
            <Icon
              name="refresh"
              size={13}
              color={isValidating ? colors.textMuted : colors.neonCyan}
            />
            <Text
              style={[
                styles.validateBtnText,
                isValidating && styles.validateBtnTextDisabled,
              ]}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </Text>
          </TouchableOpacity>
        </View>
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
          <Text style={styles.headerTitle}>Provider Connections</Text>
          <Text style={styles.headerSubtitle}>
            {connections.length} Connected Registrars & Clouds
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <LoadingSkeleton height={110} style={styles.skeleton} />
          <LoadingSkeleton height={110} style={styles.skeleton} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProviders} />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
              icon="cloud"
              title="No providers connected"
              description="Connect Cloudflare, GoDaddy, Namecheap, AWS, or Vultr in the web console."
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
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
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
  providerName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  maskText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  metaCol: {
    gap: 2,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
  },
  metaValue: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  validateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  validateBtnDisabled: {
    opacity: 0.5,
  },
  validateBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  validateBtnTextDisabled: {
    color: colors.textMuted,
  },
});
