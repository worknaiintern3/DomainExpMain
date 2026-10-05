import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { useAuth } from '../../store/auth-context';
import { fetchInventorySummary } from '../../services/monitoring';
import { fetchDomainsList } from '../../services/domains';
import { fetchServersList } from '../../services/servers';
import { fetchApplicationsList } from '../../services/applications';
import { fetchWebsitesList } from '../../services/websites';
import { fetchProviderAccountsList } from '../../services/accounts';
import { fetchAlertsList, fetchActivitiesList, deleteActivity, clearAllActivities } from '../../services/monitoring';
import type { InventorySummary, DomainItem, ServerItem, ApplicationItem, AlertItem, WebsiteItem, ProviderAccount } from '../../types';

// Micro vertical bar-chart component matching the mockup UI
function MicroBarChart({ color = '#3b82f6' }: { color?: string }) {
  const bars = [0.35, 0.55, 0.75, 0.45, 0.95];
  return (
    <View style={styles.chartContainer}>
      {bars.map((heightFraction, idx) => (
        <View
          key={idx}
          style={[
            styles.chartBar,
            {
              height: 22 * heightFraction,
              backgroundColor: color,
              opacity: 0.3 + heightFraction * 0.7,
            },
          ]}
        />
      ))}
    </View>
  );
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [sumData, domList, srvList, appList, webList, provList, altList] = await Promise.all([
        fetchInventorySummary(),
        fetchDomainsList(),
        fetchServersList(),
        fetchApplicationsList(),
        fetchWebsitesList(),
        fetchProviderAccountsList(),
        fetchActivitiesList(),
      ]);
      setSummary(sumData);
      setDomains(domList);
      setServers(srvList);
      setApps(appList);
      setWebsites(webList);
      setProviders(provList);
      setAlerts(altList);
    } catch {
      // API fallback handles offline gracefully
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteActivity = async (id: string) => {
    await deleteActivity(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAllActivities = async () => {
    const ids = alerts.map((a) => a.id);
    await clearAllActivities(ids);
    setAlerts([]);
  };

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Good Morning', icon: '☀️' };
    if (hour >= 12 && hour < 18) return { text: 'Good Afternoon', icon: '🌤️' };
    return { text: 'Good Evening', icon: '🌙' };
  }, []);

  // Real metric counts
  const totalDomains = summary?.domains ?? domains.length;
  const totalServers = summary?.servers ?? servers.length;
  const totalApps = summary?.applications ?? apps.length;
  const totalWebsites = websites.length;
  const totalProviders = providers.length;
  const totalAlerts = summary?.alerts ?? alerts.length;


  // Active unread alerts count
  const unreadAlertsCount = useMemo(() => {
    return alerts.filter(
      (a) => (a.severity === 'critical' || a.severity === 'warning') && a.status === 'active'
    ).length;
  }, [alerts]);

  // Live system status calculation
  const systemStatus = useMemo(() => {
    const hasCritical = alerts.some((a) => a.severity === 'critical');
    const hasWarning = alerts.some((a) => a.severity === 'warning') || servers.some((s) => s.status === 'warning');
    const hasOffline = servers.some((s) => s.status === 'offline');

    if (hasCritical || hasOffline) {
      return { text: 'Critical Issues Detected', color: '#ef4444' };
    }
    if (hasWarning) {
      return { text: 'System Warnings Active', color: '#f59e0b' };
    }
    if (servers.length > 0 || domains.length > 0) {
      return { text: 'All Systems Operational', color: '#10b981' };
    }
    return { text: 'Systems Synchronized', color: '#10b981' };
  }, [alerts, servers, domains]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.brandText, { color: colors.text }]}>DomainPulse</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.bellButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/alerts')}
            activeOpacity={0.7}
            accessibilityLabel="Alerts"
          >
            <Ionicons name="notifications-outline" size={17} color={colors.textSecondary} />
            {unreadAlertsCount > 0 && (
              <View style={[styles.unreadDot, { borderColor: colors.surfaceElevated }]} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.avatarButton, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Greeting Card */}
        <ImageBackground
          source={require('../../../assets/images/hero-card-bg.png')}
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#111726' : '#f0f9ff',
              borderColor: isDark ? colors.border : '#bae6fd',
            },
          ]}
          imageStyle={[
            styles.heroCardImage,
            isDark && { opacity: 0.15 },
          ]}
          resizeMode="cover"
        >
          <View style={styles.heroLeft}>
            <Text style={[styles.greetingTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              {greeting.text} {greeting.icon}
            </Text>
            <Text style={[styles.heroSubtitle, { color: isDark ? '#94a3b8' : '#334155' }]}>
              {totalDomains > 0 || totalServers > 0 || totalWebsites > 0
                ? `${totalDomains} domains, ${totalServers} servers & ${totalWebsites} websites active`
                : 'All infrastructure nodes and domain portfolios are currently synchronized.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.statusPill,
                {
                  backgroundColor: isDark ? 'rgba(24, 32, 50, 0.92)' : 'rgba(255, 255, 255, 0.95)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.8)',
                },
              ]}
              onPress={() => router.push('/(tabs)/alerts')}
              activeOpacity={0.8}
            >
              <View style={[styles.greenPulseDot, { backgroundColor: systemStatus.color }]} />
              <Text style={[styles.statusPillText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {systemStatus.text}
              </Text>
              <Text style={[styles.statusPillChevron, { color: isDark ? colors.primary : '#64748b' }]}>›</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* 6 Stat Cards (3x2 Grid) */}
        <View style={styles.statsGrid}>
          {/* Card 1: Domains */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/domains')}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                <Text style={styles.iconGlyph}>🌐</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#f0f9ff' }]}>
                <Text style={[styles.arrowCircleText, { color: '#0284c7' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalDomains}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Total Domains</Text>
              </View>
              <MicroBarChart color="#0284c7" />
            </View>
          </TouchableOpacity>

          {/* Card 2: Servers */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/servers')}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#f3e8ff' }]}>
                <Text style={styles.iconGlyph}>🖥️</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : '#faf5ff' }]}>
                <Text style={[styles.arrowCircleText, { color: '#9333ea' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalServers}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Active Servers</Text>
              </View>
              <MicroBarChart color="#9333ea" />
            </View>
          </TouchableOpacity>

          {/* Card 3: Websites */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/applications?section=websites' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5' }]}>
                <Text style={styles.iconGlyph}>💻</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
                <Text style={[styles.arrowCircleText, { color: '#10b981' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalWebsites}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Live Websites</Text>
              </View>
              <MicroBarChart color="#10b981" />
            </View>
          </TouchableOpacity>

          {/* Card 4: Applications */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/applications?section=apps' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fef3c7' }]}>
                <Text style={styles.iconGlyph}>📦</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#fffbeb' }]}>
                <Text style={[styles.arrowCircleText, { color: '#d97706' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalApps}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Total Apps</Text>
              </View>
              <MicroBarChart color="#d97706" />
            </View>
          </TouchableOpacity>

          {/* Card 5: Accounts */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe' }]}>
                <Text style={styles.iconGlyph}>☁️</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(14, 165, 233, 0.15)' : '#f0f9ff' }]}>
                <Text style={[styles.arrowCircleText, { color: '#0284c7' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalProviders}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Cloud Accounts</Text>
              </View>
              <MicroBarChart color="#0284c7" />
            </View>
          </TouchableOpacity>

          {/* Card 6: Alerts */}
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/alerts')}
            activeOpacity={0.85}
          >
            <View style={styles.statCardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6' }]}>
                <Text style={styles.iconGlyph}>🔔</Text>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#fff1f2' }]}>
                <Text style={[styles.arrowCircleText, { color: '#e11d48' }]}>→</Text>
              </View>
            </View>

            <View style={styles.statCardBottom}>
              <View>
                <Text style={[styles.statNumber, { color: colors.text }]}>{totalAlerts}</Text>
                <Text style={[styles.statSublabel, { color: colors.textSecondary }]}>Open Alerts</Text>
              </View>
              <MicroBarChart color="#e11d48" />
            </View>
          </TouchableOpacity>
        </View>


        {/* Quick Connect Integrations Strip */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl, marginBottom: 10 }]}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionIcon}>🔗</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Connect</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/more')} activeOpacity={0.7}>
            <Text style={[styles.viewAllLink, { color: colors.primary }]}>Manage →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 4, gap: 10 }}
          style={{ marginBottom: Spacing.xl }}
        >
          {/* Card 1: Google Play Console → Applications */}
          <TouchableOpacity
            style={[
              styles.quickConnectCard,
              { backgroundColor: isDark ? '#0a1628' : '#f0fdf4', borderColor: isDark ? '#1a2e4a' : '#bbf7d0' },
            ]}
            onPress={() => router.push('/(tabs)/applications')}
            activeOpacity={0.82}
          >
            <View style={[styles.quickConnectIconBox, { backgroundColor: isDark ? '#112240' : '#dcfce7' }]}>
              <Text style={{ fontSize: 20 }}>▶</Text>
            </View>
            <Text style={[styles.quickConnectTitle, { color: colors.text }]}>Play Console</Text>
            <Text style={[styles.quickConnectSubtitle, { color: colors.textSecondary }]}>
              Sync Android apps from your Google developer console
            </Text>
            <View style={[styles.quickConnectBtn, { backgroundColor: '#16a34a' }]}>
              <Text style={styles.quickConnectBtnText}>Connect →</Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Domain Registrar → More */}
          <TouchableOpacity
            style={[
              styles.quickConnectCard,
              { backgroundColor: isDark ? '#0a1628' : '#eff6ff', borderColor: isDark ? '#1a2e4a' : '#bfdbfe' },
            ]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.82}
          >
            <View style={[styles.quickConnectIconBox, { backgroundColor: isDark ? '#112240' : '#dbeafe' }]}>
              <Text style={{ fontSize: 20 }}>🌐</Text>
            </View>
            <Text style={[styles.quickConnectTitle, { color: colors.text }]}>Domain Registrar</Text>
            <Text style={[styles.quickConnectSubtitle, { color: colors.textSecondary }]}>
              Connect Cloudflare, GoDaddy, Namecheap or Hostinger
            </Text>
            <View style={[styles.quickConnectBtn, { backgroundColor: '#0284c7' }]}>
              <Text style={styles.quickConnectBtnText}>Connect →</Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Cloud Servers → More */}
          <TouchableOpacity
            style={[
              styles.quickConnectCard,
              { backgroundColor: isDark ? '#0a1628' : '#fdf4ff', borderColor: isDark ? '#1a2e4a' : '#e9d5ff' },
            ]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.82}
          >
            <View style={[styles.quickConnectIconBox, { backgroundColor: isDark ? '#112240' : '#f3e8ff' }]}>
              <Text style={{ fontSize: 20 }}>☁️</Text>
            </View>
            <Text style={[styles.quickConnectTitle, { color: colors.text }]}>Cloud Servers</Text>
            <Text style={[styles.quickConnectSubtitle, { color: colors.textSecondary }]}>
              Import nodes from AWS, DigitalOcean, Hetzner or Hostinger
            </Text>
            <View style={[styles.quickConnectBtn, { backgroundColor: '#7c3aed' }]}>
              <Text style={styles.quickConnectBtnText}>Connect →</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Recent Activity Section */}
        <View style={[styles.sectionHeader, { marginTop: Spacing.xl }]}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionIcon}>📈</Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          </View>
          {alerts.length > 4 && (
            <TouchableOpacity onPress={() => setShowAllActivities((prev) => !prev)} activeOpacity={0.7}>
              <Text style={[styles.viewAllLink, { color: colors.primary }]}>
                {showAllActivities ? 'Show Less ↑' : 'View All →'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {alerts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: '#f0fdf4' }]}>
              <Text style={styles.emptyIcon}>⚡</Text>
            </View>
            <View style={styles.emptyTextBox}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No recent activity recorded.
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Infrastructure events and system alerts will appear here in real-time.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(showAllActivities ? alerts : alerts.slice(0, 5)).map((item, idx) => {
              const handleActivityPress = () => {
                if (item.domainId) {
                  router.push(`/domain/${item.domainId}` as any);
                } else if (item.id.includes('app')) {
                  router.push('/(tabs)/applications');
                } else if (item.id.includes('srv')) {
                  router.push('/(tabs)/servers');
                } else {
                  router.push('/(tabs)/alerts');
                }
              };

              const isCritical = item.severity === 'critical';
              const isWarning = item.severity === 'warning';
              const iconColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#0284c7';
              const iconBg = isCritical
                ? 'rgba(239, 68, 68, 0.12)'
                : isWarning
                ? 'rgba(245, 158, 11, 0.12)'
                : isDark
                ? 'rgba(56, 189, 248, 0.12)'
                : '#f0f9ff';

              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <View style={[styles.activityDivider, { backgroundColor: colors.borderSubtle }]} />}
                  <TouchableOpacity
                    style={styles.activityItem}
                    onPress={handleActivityPress}
                    onLongPress={() => handleDeleteActivity(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.activityIconBox, { backgroundColor: iconBg }]}>
                      <Ionicons
                        name={
                          isCritical
                            ? 'alert-circle'
                            : isWarning
                            ? 'warning-outline'
                            : item.id.includes('dom')
                            ? 'globe-outline'
                            : item.id.includes('app')
                            ? 'apps-outline'
                            : 'notifications-outline'
                        }
                        size={18}
                        color={iconColor}
                      />
                    </View>
                    <View style={styles.activityCenter}>
                      <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.detail ? (
                        <Text style={[styles.activitySubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.detail}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.activityTime, { color: colors.textMuted }]}>
                      {formatRelativeTime(item.createdAt)}
                    </Text>
                  </TouchableOpacity>
                </React.Fragment>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg + 4,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    ...Typography.titleMedium,
    fontWeight: '800',
    fontSize: 21,
    letterSpacing: -0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellIcon: {
    fontSize: 16,
  },
  unreadDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.caption,
    color: '#0284c7',
    fontWeight: '800',
    fontSize: 12,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl + 120,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    minHeight: 145,
    overflow: 'hidden',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroCardImage: {
    borderRadius: 20,
  },
  heroLeft: {
    maxWidth: '65%',
    zIndex: 2,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPillChevron: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: '47.5%',
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
    minHeight: 115,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 19,
  },
  arrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowCircleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.md,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  statSublabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    paddingBottom: 2,
  },
  chartBar: {
    width: 3.5,
    borderRadius: 2,
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
    gap: 6,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearActLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 24,
  },
  emptyTextBox: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: Spacing.xs,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    gap: Spacing.md,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityGlyph: {
    fontSize: 16,
  },
  activityCenter: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  activitySubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  activityTime: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },
  activityDivider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  deleteActBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  quickConnectCard: {
    width: 200,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
    gap: 8,
  },
  quickConnectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickConnectTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  quickConnectSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  quickConnectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  quickConnectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
