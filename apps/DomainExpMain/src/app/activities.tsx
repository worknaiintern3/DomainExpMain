import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../store/theme-context';
import {
  fetchActivitiesList,
  deleteActivity,
  clearAllActivities,
} from '../services/monitoring';
import type { AlertItem } from '../types';

type FilterCategory = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'DOMAINS' | 'SERVERS' | 'APPS';

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RecentActivitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activities, setActivities] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('ALL');

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      const list = await fetchActivitiesList({ forceRefresh: isRefresh });
      setActivities(list || []);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const handleDeleteItem = async (id: string, e?: any) => {
    e?.stopPropagation?.();
    setActivities((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteActivity(id);
    } catch {}
  };

  const handleClearAll = () => {
    if (activities.length === 0) return;

    Alert.alert(
      'Clear All Activities',
      'Are you sure you want to dismiss all recorded infrastructure activity logs? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const ids = activities.map((a) => a.id);
            setActivities([]);
            try {
              await clearAllActivities(ids);
            } catch {}
          },
        },
      ]
    );
  };

  const handleNavigateAsset = (item: AlertItem) => {
    if (item.domainId) {
      router.push(`/domain/${item.domainId}` as any);
    } else if (item.id.includes('app') || item.title.toLowerCase().includes('play store') || item.title.toLowerCase().includes('app')) {
      router.push('/(tabs)/applications' as any);
    } else if (item.id.includes('srv') || item.title.toLowerCase().includes('server') || item.title.toLowerCase().includes('vps')) {
      router.push('/(tabs)/servers' as any);
    } else {
      router.push('/(tabs)/alerts' as any);
    }
  };

  // Activity breakdown counts
  const stats = useMemo(() => {
    const critical = activities.filter((a) => a.severity === 'critical').length;
    const warning = activities.filter((a) => a.severity === 'warning').length;
    const info = activities.filter((a) => a.severity === 'info').length;
    const domains = activities.filter((a) => Boolean(a.domainId) || a.id.includes('dom')).length;
    const servers = activities.filter((a) => a.id.includes('srv') || a.title.toLowerCase().includes('server')).length;
    const apps = activities.filter((a) => a.id.includes('app') || a.title.toLowerCase().includes('app')).length;
    return { critical, warning, info, domains, servers, apps, total: activities.length };
  }, [activities]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      // 1. Category filter
      if (selectedFilter === 'CRITICAL' && item.severity !== 'critical') return false;
      if (selectedFilter === 'WARNING' && item.severity !== 'warning') return false;
      if (selectedFilter === 'INFO' && item.severity !== 'info') return false;
      if (selectedFilter === 'DOMAINS') {
        const isDom = Boolean(item.domainId) || item.id.includes('dom') || item.title.toLowerCase().includes('domain');
        if (!isDom) return false;
      }
      if (selectedFilter === 'SERVERS') {
        const isSrv = item.id.includes('srv') || item.title.toLowerCase().includes('server') || item.title.toLowerCase().includes('vps');
        if (!isSrv) return false;
      }
      if (selectedFilter === 'APPS') {
        const isApp = item.id.includes('app') || item.title.toLowerCase().includes('app') || item.title.toLowerCase().includes('play store');
        if (!isApp) return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.domainName?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDetail = item.detail?.toLowerCase().includes(q);
        const matchesSeverity = item.severity?.toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesDetail && !matchesSeverity) {
          return false;
        }
      }

      return true;
    });
  }, [activities, selectedFilter, searchQuery]);

  const filterOptions: { id: FilterCategory; label: string; count: number; icon: string }[] = [
    { id: 'ALL', label: 'All', count: stats.total, icon: 'layers-outline' },
    { id: 'CRITICAL', label: 'Critical', count: stats.critical, icon: 'alert-circle' },
    { id: 'WARNING', label: 'Warning', count: stats.warning, icon: 'warning' },
    { id: 'INFO', label: 'Verified', count: stats.info, icon: 'checkmark-circle' },
    { id: 'DOMAINS', label: 'Domains', count: stats.domains, icon: 'globe-outline' },
    { id: 'SERVERS', label: 'Servers', count: stats.servers, icon: 'server-outline' },
    { id: 'APPS', label: 'Apps', count: stats.apps, icon: 'phone-portrait-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 10 : 6),
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceHighlight,
                borderColor: colors.border,
              },
            ]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
            activeOpacity={0.7}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.titleColumn}>
            <View style={styles.titleRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Recent Activity</Text>
              <View style={[styles.liveBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: colors.primary }]}>
                <View style={[styles.liveBeacon, { backgroundColor: colors.primary }]} />
                <Text style={[styles.liveBadgeText, { color: colors.primary }]}>LIVE FEED</Text>
              </View>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Real-time audit log across domains, servers & apps
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[
              styles.actionIconButton,
              {
                backgroundColor: isDark ? colors.surfaceElevated : colors.surfaceHighlight,
                borderColor: colors.border,
              },
            ]}
            onPress={onRefresh}
            activeOpacity={0.7}
            accessibilityLabel="Refresh activities"
          >
            <Ionicons name="refresh-outline" size={18} color={colors.text} />
          </TouchableOpacity>

          {activities.length > 0 && (
            <TouchableOpacity
              style={[
                styles.actionIconButton,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
                },
              ]}
              onPress={handleClearAll}
              activeOpacity={0.7}
              accessibilityLabel="Clear all activities"
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top 4 Telemetry Metrics */}
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#131b2e' : '#ffffff',
                borderColor: isDark ? colors.border : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text style={styles.metricLabel}>TOTAL LOGS</Text>
              <Ionicons name="pulse" size={14} color={colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: colors.text }]}>{stats.total}</Text>
            <Text style={[styles.metricSub, { color: colors.textMuted }]}>Captured events</Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#1a141f' : '#fff1f2',
                borderColor: isDark ? 'rgba(244, 63, 94, 0.25)' : '#fecdd3',
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: '#f43f5e' }]}>CRITICAL</Text>
              <Ionicons name="alert-circle" size={14} color="#f43f5e" />
            </View>
            <Text style={[styles.metricValue, { color: '#f43f5e' }]}>{stats.critical}</Text>
            <Text style={[styles.metricSub, { color: isDark ? '#94a3b8' : '#e11d48' }]}>Urgent action</Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#1e1c14' : '#fffbeb',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#fef3c7',
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: '#f59e0b' }]}>WARNINGS</Text>
              <Ionicons name="warning" size={14} color="#f59e0b" />
            </View>
            <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{stats.warning}</Text>
            <Text style={[styles.metricSub, { color: isDark ? '#94a3b8' : '#b45309' }]}>Attention needed</Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? '#11221f' : '#f0fdf4',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#bbf7d0',
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <Text style={[styles.metricLabel, { color: '#10b981' }]}>VERIFIED</Text>
              <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            </View>
            <Text style={[styles.metricValue, { color: '#10b981' }]}>{stats.info}</Text>
            <Text style={[styles.metricSub, { color: isDark ? '#94a3b8' : '#047857' }]}>Healthy state</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDark ? colors.surface : '#ffffff',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Filter by domain, server, app or keyword..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterOptions.map((opt) => {
            const isSelected = selectedFilter === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isDark
                      ? colors.surfaceElevated
                      : colors.surfaceHighlight,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedFilter(opt.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={14}
                  color={isSelected ? '#ffffff' : colors.textSecondary}
                  style={styles.chipIcon}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#ffffff' : colors.text },
                    isSelected && { fontWeight: '700' },
                  ]}
                >
                  {opt.label}
                </Text>
                <View
                  style={[
                    styles.chipBadge,
                    {
                      backgroundColor: isSelected
                        ? 'rgba(255, 255, 255, 0.25)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      { color: isSelected ? '#ffffff' : colors.textSecondary },
                    ]}
                  >
                    {opt.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Activity Stream Section */}
        <View style={styles.streamHeader}>
          <Text style={[styles.streamTitle, { color: colors.text }]}>
            Activity Stream ({filteredActivities.length})
          </Text>
          <Text style={[styles.streamSubtitle, { color: colors.textMuted }]}>
            Chronological event timeline
          </Text>
        </View>

        {/* Empty State */}
        {filteredActivities.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: isDark ? colors.surface : '#ffffff',
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe' },
              ]}
            >
              <Ionicons name="checkmark-done-circle-outline" size={42} color={colors.primary} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
              {searchQuery ? 'No Matching Activities' : 'No Activities in this Filter'}
            </Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
              {searchQuery
                ? `No event logs matched "${searchQuery}". Try a different keyword.`
                : 'All infrastructure nodes, domains, and applications are operating smoothly.'}
            </Text>
            {(searchQuery.length > 0 || selectedFilter !== 'ALL') && (
              <TouchableOpacity
                style={[styles.resetButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedFilter('ALL');
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.resetButtonText}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          /* Timeline Activity Cards */
          <View style={styles.timelineContainer}>
            {filteredActivities.map((item, idx) => {
              const isCritical = item.severity === 'critical';
              const isWarning = item.severity === 'warning';
              const isInfo = item.severity === 'info';

              // Visual styling per severity
              const accentColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#0ea5e9';
              const badgeBg = isCritical
                ? 'rgba(239, 68, 68, 0.14)'
                : isWarning
                ? 'rgba(245, 158, 11, 0.14)'
                : 'rgba(14, 165, 233, 0.14)';

              // Deduce icon based on title or ID
              let eventIcon = 'globe-outline';
              let iconBgColor = 'rgba(56, 189, 248, 0.15)';
              let iconColor = '#38bdf8';
              let categoryTag = 'DOMAIN';

              if (item.id.includes('app') || item.title.toLowerCase().includes('app') || item.title.toLowerCase().includes('play store')) {
                eventIcon = 'logo-google-playstore';
                iconBgColor = 'rgba(251, 191, 36, 0.15)';
                iconColor = '#fbbf24';
                categoryTag = 'MOBILE APP';
              } else if (item.id.includes('srv') || item.title.toLowerCase().includes('server') || item.title.toLowerCase().includes('vps')) {
                eventIcon = 'server-outline';
                iconBgColor = 'rgba(192, 132, 252, 0.15)';
                iconColor = '#c084fc';
                categoryTag = 'SERVER';
              } else if (item.title.toLowerCase().includes('ssl') || item.title.toLowerCase().includes('https')) {
                eventIcon = 'shield-checkmark-outline';
                iconBgColor = 'rgba(52, 211, 153, 0.15)';
                iconColor = '#34d399';
                categoryTag = 'SECURITY';
              } else if (isCritical) {
                eventIcon = 'alert-triangle-outline';
                iconBgColor = 'rgba(239, 68, 68, 0.15)';
                iconColor = '#ef4444';
              }

              return (
                <View key={item.id} style={styles.timelineRow}>
                  {/* Left Timeline Indicator */}
                  <View style={styles.timelineLeftTrack}>
                    <View style={[styles.timelineNode, { borderColor: accentColor, backgroundColor: isDark ? colors.background : '#ffffff' }]}>
                      <View style={[styles.timelineCore, { backgroundColor: accentColor }]} />
                    </View>
                    {idx < filteredActivities.length - 1 && (
                      <View style={[styles.timelineLine, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />
                    )}
                  </View>

                  {/* Right Event Card */}
                  <TouchableOpacity
                    style={[
                      styles.card,
                      {
                        backgroundColor: isDark ? colors.surface : '#ffffff',
                        borderColor: isCritical
                          ? 'rgba(239, 68, 68, 0.35)'
                          : isWarning
                          ? 'rgba(245, 158, 11, 0.35)'
                          : colors.border,
                      },
                    ]}
                    onPress={() => handleNavigateAsset(item)}
                    activeOpacity={0.75}
                  >
                    {/* Top Row: Category + Severity Badge + Timestamp */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.badgeGroup}>
                        <View style={[styles.categoryBadge, { backgroundColor: iconBgColor }]}>
                          <Text style={[styles.categoryBadgeText, { color: iconColor }]}>
                            {categoryTag}
                          </Text>
                        </View>
                        <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
                          <View style={[styles.severityDot, { backgroundColor: accentColor }]} />
                          <Text style={[styles.severityBadgeText, { color: accentColor }]}>
                            {item.severity.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timestampContainer}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={[styles.timestampText, { color: colors.textMuted }]}>
                          {formatRelativeTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>

                    {/* Middle Row: Icon + Title & Details */}
                    <View style={styles.cardBodyRow}>
                      <View style={[styles.eventIconBox, { backgroundColor: iconBgColor }]}>
                        <Ionicons name={eventIcon as any} size={22} color={iconColor} />
                      </View>

                      <View style={styles.cardTextContent}>
                        <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {Boolean(item.detail) && (
                          <Text style={[styles.eventDetail, { color: colors.textSecondary }]} numberOfLines={3}>
                            {item.detail}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Bottom Action Footer */}
                    <View style={[styles.cardFooter, { borderTopColor: isDark ? colors.borderSubtle : '#f1f5f9' }]}>
                      <View style={styles.targetAssetBadge}>
                        <Text style={[styles.targetAssetText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.domainName || 'Infrastructure Event'}
                        </Text>
                      </View>

                      <View style={styles.footerActions}>
                        <TouchableOpacity
                          style={styles.openAssetBtn}
                          onPress={() => handleNavigateAsset(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.openAssetText, { color: colors.primary }]}>Inspect</Text>
                          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.dismissBtn, { backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9' }]}
                          onPress={(e) => handleDeleteItem(item.id, e)}
                          activeOpacity={0.7}
                          accessibilityLabel="Dismiss this activity"
                        >
                          <Ionicons name="close" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  titleColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  liveBeacon: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  liveBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  // Top 4 Telemetry Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricSub: {
    fontSize: 9,
    marginTop: 2,
  },
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  // Filter Chips
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: Spacing.lg,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 6,
  },
  chipIcon: {
    marginRight: -2,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  // Stream Header
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  streamSubtitle: {
    fontSize: 12,
  },
  // Timeline Elements
  timelineContainer: {
    marginTop: Spacing.xs,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  timelineLeftTrack: {
    width: 28,
    alignItems: 'center',
    marginRight: 6,
  },
  timelineNode: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    zIndex: 2,
  },
  timelineCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 2,
  },
  // Card
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  severityBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestampText: {
    fontSize: 11,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  eventIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 3,
  },
  eventDetail: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetAssetBadge: {
    flex: 1,
    marginRight: 10,
  },
  targetAssetText: {
    fontSize: 11,
    fontWeight: '500',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openAssetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openAssetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty State
  emptyStateCard: {
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
