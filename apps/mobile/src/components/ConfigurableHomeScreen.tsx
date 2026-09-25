import React, { useEffect, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MobileBootstrapConfigResponse } from '@domainpulse/contracts';
import { AlertsSection } from './sections/AlertsSection';
import { BannerSection } from './sections/BannerSection';
import { DomainsSection, DomainSummaryItem } from './sections/DomainsSection';
import { QuickActionsSection } from './sections/QuickActionsSection';
import { ServersSection, ServerSummaryItem } from './sections/ServersSection';
import { StatsSection } from './sections/StatsSection';
import { mobileApiClient } from '../services/api-client';
import { colors, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface Props {
  config: MobileBootstrapConfigResponse;
  onQuickAction?: ((action: string) => void) | undefined;
  onNavigate?: ((screen: string) => void) | undefined;
  onSelectDomain?: ((domainId: string) => void) | undefined;
}

export const ConfigurableHomeScreen: React.FC<Props> = ({
  config,
  onQuickAction,
  onNavigate,
  onSelectDomain,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [domains, setDomains] = useState<DomainSummaryItem[]>([]);
  const [servers, setServers] = useState<ServerSummaryItem[]>([]);
  const [websitesCount, setWebsitesCount] = useState<number>(0);
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      // 1. Fetch domains
      try {
        const domData = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/domains');
        const items = domData.items || domData.data || [];
        setDomains(
          items.map((d: any) => ({
            id: d.id,
            name: d.name || d.domainName || 'unknown.com',
            status: d.status || 'Active',
            expiresInDays: d.expiresInDays ?? null,
            expiryDate: d.expiresAt || d.expiryDate || null,
          })),
        );
      } catch {
        // Unauthenticated or offline fallback to empty list
      }

      // 2. Fetch servers
      try {
        const srvData = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/servers');
        const items = srvData.items || srvData.data || [];
        setServers(
          items.map((s: any) => ({
            id: s.id,
            name: s.name || s.hostname || 'Server',
            ipAddress: s.ipAddress || s.ipv4 || null,
            status: s.status || 'Online',
            region: s.region || null,
          })),
        );
      } catch {
        // Fallback
      }

      // 3. Fetch applications/websites count
      try {
        const appData = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/applications');
        const items = appData.items || appData.data || [];
        setWebsitesCount(items.length);
      } catch {
        // Fallback
      }

      // 4. Fetch alerts
      try {
        const altData = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/alerts');
        const items = altData.items || altData.data || [];
        setAlerts(
          items.map((a: any) => ({
            id: a.id,
            title: a.title || a.resourceId || 'Alert',
            desc: a.message || a.description || 'System warning',
            severity: a.severity || (a.status === 'CRITICAL' ? 'critical' : 'warning'),
          })),
        );
      } catch {
        // Fallback
      }
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const activeSections = [...config.homeSections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const renderSection = (sectionKey: string, title: string) => {
    switch (sectionKey) {
      case 'banner':
        return (
          <BannerSection
            key={sectionKey}
            announcements={config.announcements}
            title={title}
          />
        );
      case 'stats':
        return (
          <StatsSection
            key={sectionKey}
            title={title}
            domainsCount={domains.length}
            serversCount={servers.length}
            websitesCount={websitesCount}
            alertsCount={alerts.length}
            onNavigate={onNavigate}
          />
        );
      case 'quickActions':
        return (
          <QuickActionsSection
            key={sectionKey}
            title={title}
            onAction={onQuickAction}
          />
        );
      case 'alerts':
        if (!config.features.alerts) return null;
        return (
          <AlertsSection
            key={sectionKey}
            title={title}
            alerts={alerts}
            onViewAll={() => onNavigate?.('alerts')}
          />
        );
      case 'domains':
        if (!config.features.domains) return null;
        return (
          <DomainsSection
            key={sectionKey}
            title={title}
            domains={domains}
            onViewAll={() => onNavigate?.('domains')}
            onSelectDomain={onSelectDomain}
          />
        );
      case 'servers':
        if (!config.features.servers) return null;
        return (
          <ServersSection
            key={sectionKey}
            title={title}
            servers={servers}
            onViewAll={() => onNavigate?.('servers')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.neonCyan}
          colors={[colors.neonCyan]}
        />
      }
    >
      {/* Premium Dark Greeting Header with Brand Logo */}
      <View style={styles.greetingHeader}>
        <View style={styles.headerBrandRow}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="cover"
          />
          <View style={styles.greetingTextCol}>
            <Text style={styles.greetingTitle}>DomainPulse</Text>
            <Text style={styles.greetingSubtitle}>Infrastructure Intelligence</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notificationBell}
          onPress={() => onNavigate?.('alerts')}
          activeOpacity={0.75}
        >
          <Icon name="bell" size={20} color={colors.textPrimary} />
          {alerts.length > 0 ? <View style={styles.alertDot} /> : null}
        </TouchableOpacity>
      </View>

      {/* Admin-Controllable Ordered Sections */}
      {activeSections.map((sec) => renderSection(sec.sectionKey, sec.title))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    paddingBottom: 40,
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  greetingTextCol: {
    flex: 1,
  },
  greetingTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  greetingSubtitle: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: 1,
  },
  notificationBell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  alertDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.bgCard,
  },
});
