import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { fetchAlertsList, acknowledgeAlert, deleteAlert, clearAllAlerts } from '../../services/monitoring';
import { fetchDomainsList } from '../../services/domains';
import type { AlertItem, DomainItem } from '../../types';

type FilterType = 'All' | 'Expiring' | 'Critical' | 'Warning' | 'Resolved';

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('All');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [altList, domList] = await Promise.all([
        fetchAlertsList(),
        fetchDomainsList(),
      ]);
      setAlerts(altList);
      setDomains(domList);
    } catch {
      // Offline fallback
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAcknowledge = async (id: string) => {
    await acknowledgeAlert(id);
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a)),
    );
  };

  const handleDeleteAlert = async (id: string) => {
    await deleteAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAllAlerts = async () => {
    const ids = alerts.map((a) => a.id);
    await clearAllAlerts(ids);
    setAlerts([]);
  };

  // Real upcoming expiring domains (<= 10 days before expiration)
  const expiringDomains = useMemo(() => {
    return domains
      .filter((d) => {
        const expTime = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
        const days = !isNaN(expTime)
          ? Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)))
          : d.daysRemaining ?? 365;
        return days <= 10;
      })
      .sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));
  }, [domains]);

  const counts = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
    const warning = alerts.filter((a) => a.severity === 'warning' && a.status === 'active').length;
    const resolved = alerts.filter((a) => a.status === 'resolved' || a.status === 'acknowledged').length;
    const expiring = expiringDomains.length;
    return {
      all: alerts.length,
      expiring,
      critical,
      warning,
      resolved,
      active: critical + warning,
    };
  }, [alerts, expiringDomains]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (selectedFilter === 'Critical') return a.severity === 'critical';
      if (selectedFilter === 'Warning') return a.severity === 'warning';
      if (selectedFilter === 'Resolved') return a.status === 'resolved' || a.status === 'acknowledged';
      return true;
    });
  }, [alerts, selectedFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Professional Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Alerts</Text>
          {counts.active > 0 ? (
            <View style={[styles.activeBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
              <View style={styles.activeDot} />
              <Text style={[styles.activeBadgeText, { color: '#ef4444' }]}>
                {counts.active} Active
              </Text>
            </View>
          ) : (
            <View style={[styles.activeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
              <View style={[styles.activeDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.activeBadgeText, { color: '#10b981' }]}>
                All Normal
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => router.push('/(tabs)/more')}
          activeOpacity={0.7}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* System Alerts Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="notifications-outline" size={20} color="#e11d48" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>System Alerts</Text>
          </View>
          {filteredAlerts.length > 0 && selectedFilter !== 'Expiring' && (
            <TouchableOpacity onPress={handleClearAllAlerts} activeOpacity={0.7}>
              <Text style={[styles.clearAllLink, { color: colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills with Expiring Soon tab */}
        <View style={styles.filtersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            {[
              { key: 'All' as FilterType, label: `All (${counts.all})` },
              { key: 'Expiring' as FilterType, label: `Expiring Soon (${counts.expiring})` },
              { key: 'Critical' as FilterType, label: `Critical (${counts.critical})` },
              { key: 'Warning' as FilterType, label: `Warning (${counts.warning})` },
              { key: 'Resolved' as FilterType, label: `Resolved (${counts.resolved})` },
            ].map(({ key, label }) => {
              const isSelected = selectedFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterPill,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isSelected && { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedFilter(key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: colors.textSecondary },
                      isSelected && { color: colors.primary, fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Dynamic Content Output based on selected tab */}
        {selectedFilter === 'Expiring' ? (
          expiringDomains.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4' }]}>
                <Ionicons name="checkmark-circle-outline" size={28} color="#10b981" />
              </View>
              <Text style={[styles.emptyBoxTitle, { color: colors.text }]}>No Expiring Domains</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                All registered domains have healthy expiration timelines.
              </Text>
            </View>
          ) : (
            expiringDomains.map((domain) => {
              const days = domain.daysRemaining ?? 999;
              const isCritical = days <= 7;
              const isWarning = days <= 30;

              const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
              const statusBg = isCritical
                ? 'rgba(239, 68, 68, 0.1)'
                : isWarning
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(16, 185, 129, 0.1)';

              return (
                <TouchableOpacity
                  key={domain.id}
                  style={[styles.domainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => router.push(`/domain/${domain.id}` as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.domainLeft}>
                    <View style={[styles.domainIconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff', borderColor: isDark ? '#1e293b' : '#e0f2fe' }]}>
                      <Ionicons name="globe-outline" size={19} color="#0284c7" />
                    </View>
                    <View style={styles.domainInfoBox}>
                      <Text style={[styles.domainName, { color: colors.text }]} numberOfLines={1}>
                        {domain.name}
                      </Text>
                      <Text style={[styles.domainRegistrar, { color: colors.textSecondary }]} numberOfLines={1}>
                        {domain.registrar || 'Custom Registrar'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.domainRight}>
                    <View style={[styles.daysPill, { backgroundColor: statusBg }]}>
                      <Text style={[styles.daysPillText, { color: statusColor }]}>
                        {days <= 0 ? 'Expired' : `${days}d`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : filteredAlerts.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4' }]}>
              <Ionicons name="shield-checkmark-outline" size={28} color="#10b981" />
            </View>
            <Text style={[styles.emptyBoxTitle, { color: colors.text }]}>Zero Active Alerts</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              All monitored domains, applications, and infrastructure are operational.
            </Text>
          </View>
        ) : (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical';
            const accentColor = isCritical ? '#ef4444' : '#f59e0b';
            const badgeBg = isCritical ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';

            const handlePress = () => {
              if (alert.domainId) {
                router.push(`/domain/${alert.domainId}` as any);
              } else if (alert.id.startsWith('alt-app-')) {
                router.push('/(tabs)/applications');
              } else if (alert.id.startsWith('alt-srv-')) {
                router.push('/(tabs)/servers');
              }
            };

            return (
              <TouchableOpacity
                key={alert.id}
                style={[
                  styles.alertCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  alert.status === 'acknowledged' && styles.alertCardAcked,
                ]}
                onPress={handlePress}
                activeOpacity={0.8}
              >
                {/* Alert Top Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.topRowLeft}>
                    <View style={[styles.alertIconCircle, { backgroundColor: badgeBg }]}>
                      <Ionicons
                        name={isCritical ? 'alert-circle' : 'warning-outline'}
                        size={19}
                        color={accentColor}
                      />
                    </View>
                    <View style={styles.alertHeaderTextBox}>
                      <Text style={[styles.alertTitleText, { color: colors.text }]} numberOfLines={1}>
                        {alert.title}
                      </Text>
                      <Text style={[styles.domainSubtext, { color: colors.textMuted }]} numberOfLines={1}>
                        {alert.domainName}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.severityBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.severityBadgeText, { color: accentColor }]}>
                      {isCritical ? 'Critical' : 'Warning'}
                    </Text>
                  </View>
                </View>

                {/* Detail text */}
                {alert.detail ? (
                  <Text style={[styles.detailBody, { color: colors.textSecondary }]}>
                    {alert.detail}
                  </Text>
                ) : null}

                {/* Footer */}
                <View style={[styles.cardFooter, { borderTopColor: colors.borderSubtle }]}>
                  <View style={[styles.timeframePill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.timeframeText, { color: accentColor }]}>
                      {isCritical ? 'Action Required' : 'Review Needed'}
                    </Text>
                  </View>

                  <View style={styles.footerRight}>
                    {alert.status === 'active' && (
                      <TouchableOpacity
                        style={[styles.ackBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.border }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(alert.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.ackBtnText, { color: colors.text }]}>Acknowledge</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.dismissBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: colors.border }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteAlert(alert.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dismissBtnText, { color: colors.textSecondary }]}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    ...Typography.titleLarge,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl + 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  clearAllLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  filtersSection: {
    marginBottom: Spacing.md,
  },
  filterScrollContent: {
    paddingVertical: 2,
    gap: Spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  domainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  domainLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minWidth: 0,
  },
  domainIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainInfoBox: {
    flex: 1,
    minWidth: 0,
  },
  domainName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  domainRegistrar: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  domainRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  daysPill: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  alertCard: {
    padding: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  alertCardAcked: {
    opacity: 0.6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  alertIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertHeaderTextBox: {
    flex: 1,
    minWidth: 0,
  },
  alertTitleText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  domainSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: Radius.full,
    marginLeft: 8,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  timeframePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  timeframeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  ackBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  dismissBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyBox: {
    padding: Spacing.xxl,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBoxTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    textAlign: 'center',
  },
});
