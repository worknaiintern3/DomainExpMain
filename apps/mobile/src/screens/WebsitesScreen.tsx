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

export interface WebsiteItem {
  id: string;
  name: string;
  kind: string;
  primaryUrl?: string | null | undefined;
  notes?: string | null | undefined;
  createdAt: string;
}

export const WebsitesScreen: React.FC<{ onBack?: (() => void) | undefined }> = ({
  onBack,
}) => {
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWebsites = async () => {
    try {
      setError(null);
      const data = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/applications');
      const items = data.items || data.data || [];
      setWebsites(
        items.map((w: any) => ({
          id: w.id,
          name: w.name || 'Web Service',
          kind: w.kind || 'WEB_APPLICATION',
          primaryUrl: w.primaryUrl || null,
          notes: w.notes || null,
          createdAt: w.createdAt,
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWebsites();
  };

  const renderItem = ({ item }: { item: WebsiteItem }) => {
    const isWeb = item.kind === 'WEB_APPLICATION';
    const kindLabel = isWeb ? 'Web App' : item.kind.replace('_', ' ');

    return (
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Icon name={isWeb ? 'globe' : 'smartphone'} size={20} color={colors.neonCyan} />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.kindTag}>
              <Text style={styles.kindText}>{kindLabel}</Text>
            </View>
          </View>

          {item.primaryUrl ? (
            <View style={styles.urlRow}>
              <Icon name="link" size={12} color={colors.neonCyan} />
              <Text style={styles.urlText} numberOfLines={1}>
                {item.primaryUrl}
              </Text>
            </View>
          ) : (
            <Text style={styles.noUrlText}>No primary URL attached</Text>
          )}

          {item.notes ? (
            <Text style={styles.notesText} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>

        <StatusBadge status="active" label="Live" size="sm" />
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
          <Text style={styles.headerTitle}>Websites & Apps</Text>
          <Text style={styles.headerSubtitle}>
            {websites.length} Monitored Deployments
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrapper}>
          <LoadingSkeleton height={80} style={styles.skeleton} />
          <LoadingSkeleton height={80} style={styles.skeleton} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWebsites} />
      ) : (
        <FlatList
          data={websites}
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
              icon="globe"
              title="No websites found"
              description="Link your web applications to monitor uptime and health."
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
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  kindTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  kindText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.semibold,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  urlText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
  },
  noUrlText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  notesText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.tiny,
    marginTop: 2,
  },
});
