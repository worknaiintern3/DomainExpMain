import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { fetchServersList, deleteServer } from '../../services/servers';
import type { ServerItem } from '../../types';

const PROVIDER_LOGOS: Record<string, any> = {
  hostinger: require('../../../assets/images/providers/hostinger.png'),
  hetzner: require('../../../assets/images/providers/hetzner.png'),
  aws: require('../../../assets/images/providers/aws.png'),
  digitalocean: require('../../../assets/images/providers/digitalocean.png'),
  gcp: require('../../../assets/images/providers/gcp.png'),
  azure: require('../../../assets/images/providers/azure.png'),
  vultr: require('../../../assets/images/providers/vultr.png'),
  linode: require('../../../assets/images/providers/linode.png'),
};

export default function ServerDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [server, setServer] = useState<ServerItem | null>(null);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Monitoring' | 'Applications'>('Overview');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);

  const loadServer = useCallback(async () => {
    const list = await fetchServersList();
    const serverIdOrName = decodeURIComponent(id || '');
    const found = list.find((s) => s.id === id || s.name.toLowerCase() === serverIdOrName.toLowerCase());
    if (found) {
      setServer(found);
    } else {
      setServer({
        id: serverIdOrName,
        name: serverIdOrName,
        provider: serverIdOrName.includes('hetzner') ? 'Hetzner' : 'Hostinger',
        region: serverIdOrName.includes('hetzner') ? 'Frankfurt (EU-Central)' : 'Mumbai (IN-South-01)',
        ipAddress: serverIdOrName.includes('hetzner') ? '159.69.214.88' : '194.195.112.45',
        cpu: serverIdOrName.includes('hetzner') ? '8 vCPU' : '4 vCPU',
        memory: serverIdOrName.includes('hetzner') ? '16 GB' : '8 GB',
        os: serverIdOrName.includes('hetzner') ? 'Debian 12 Bookworm' : 'Ubuntu 24.04 LTS',
        status: 'healthy',
        uptime: '99.99%',
        cpuUsagePercent: 24,
        memoryUsagePercent: 48,
        diskUsagePercent: 36,
        connectedDomains: ['uweservices.com', 'pulsecloud.io'],
      });
    }
  }, [id]);

  useEffect(() => {
    loadServer();
  }, [loadServer]);

  const handlePingRefresh = () => {
    setShowMenuModal(false);
    setIsRefreshingTelemetry(true);
    setTimeout(() => {
      if (server) {
        setServer({
          ...server,
          cpuUsagePercent: Math.floor(Math.random() * 20) + 18,
          memoryUsagePercent: Math.floor(Math.random() * 15) + 42,
          diskUsagePercent: server.diskUsagePercent || 36,
          uptime: '99.99%',
        });
      }
      setIsRefreshingTelemetry(false);
    }, 700);
  };

  const handleCopyIp = () => {
    if (!server) return;
    setShowMenuModal(false);
  };

  const handleCopySsh = () => {
    if (!server) return;
    setShowMenuModal(false);
  };

  const handleRestartServices = () => {
    setShowMenuModal(false);
  };

  const handleDeleteServer = async () => {
    if (!server) return;
    await deleteServer(server.id);
    setShowMenuModal(false);
    router.replace('/(tabs)/servers');
  };

  const getProviderKey = (p?: string) => {
    if (!p) return 'hostinger';
    const lower = p.toLowerCase();
    if (lower.includes('hetzner')) return 'hetzner';
    if (lower.includes('hostinger')) return 'hostinger';
    if (lower.includes('aws') || lower.includes('amazon')) return 'aws';
    if (lower.includes('digital') || lower.includes('ocean')) return 'digitalocean';
    if (lower.includes('google') || lower.includes('gcp')) return 'gcp';
    if (lower.includes('azure') || lower.includes('microsoft')) return 'azure';
    if (lower.includes('vultr')) return 'vultr';
    if (lower.includes('linode')) return 'linode';
    return 'hostinger';
  };

  if (!server) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading server telemetry...</Text>
      </View>
    );
  }

  const providerKey = getProviderKey(server.provider);
  const cpuPercent = server.cpuUsagePercent ?? 24;
  const ramPercent = server.memoryUsagePercent ?? 48;
  const diskPercent = server.diskUsagePercent ?? 36;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b0f19' : '#f8fafc', paddingTop: insets.top }]}>
      {/* Top Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.circleNavBtn, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {server.name}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {server.provider} • Node Telemetry
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.circleNavBtn, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={() => setShowMenuModal(true)}
          activeOpacity={0.6}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Text style={[styles.moreDots, { color: colors.text }]}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Primary Hero Header Card */}
        <View style={[styles.heroCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroLeft}>
              <View
                style={[
                  styles.providerLogoContainer,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  },
                ]}
              >
                {PROVIDER_LOGOS[providerKey] ? (
                  <Image source={PROVIDER_LOGOS[providerKey]} style={{ width: 28, height: 28 }} contentFit="contain" />
                ) : (
                  <Text style={{ fontSize: 22 }}>🖥️</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.serverHeroName, { color: colors.text }]}>{server.name}</Text>
                  <View style={[styles.codeBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                    <Text style={[styles.codeBadgeText, { color: '#0284c7' }]}>{server.id}</Text>
                  </View>
                </View>
                <Text style={[styles.heroSubtext, { color: colors.textSecondary }]}>
                  {server.provider} • Server Inventory Record
                </Text>
              </View>
            </View>

            <View style={[styles.statusPillActive, { backgroundColor: '#dcfce7' }]}>
              <View style={styles.greenLiveDot} />
              <Text style={styles.statusPillActiveText}>
                {isRefreshingTelemetry ? 'Pinging...' : 'Active'}
              </Text>
            </View>
          </View>

          {/* Quick Action Toolbar Buttons */}
          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={handlePingRefresh}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickActionText, { color: colors.text }]}>🔄 Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={handleCopyIp}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickActionText, { color: colors.text }]}>📋 Copy IP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={handleCopySsh}
              activeOpacity={0.7}
            >
              <Text style={[styles.quickActionText, { color: colors.text }]}>💻 SSH</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4-KPI Grid Strip */}
        <View style={styles.kpiGrid}>
          {/* Card 1: Cloud Provider */}
          <View style={[styles.kpiCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>CLOUD PROVIDER</Text>
              <Text style={{ color: '#0284c7', fontSize: 13 }}>☁️</Text>
            </View>
            <Text style={[styles.kpiMainValue, { color: colors.text }]}>{server.provider}</Text>
            <Text style={[styles.kpiSubValue, { color: colors.textMuted }]}>WorknAi Infrastructure Main</Text>
            <View style={[styles.kpiBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]}>
              <View style={[styles.smallDot, { backgroundColor: '#16a34a' }]} />
              <Text style={[styles.kpiBadgeText, { color: '#16a34a' }]}>Provider Synced</Text>
            </View>
          </View>

          {/* Card 2: Network & Location */}
          <View style={[styles.kpiCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
            <View style={styles.kpiHeader}>
              <Text style={[styles.kpiTitle, { color: colors.textSecondary }]}>NETWORK &amp; IP</Text>
              <Text style={{ color: '#0284c7', fontSize: 13 }}>🌐</Text>
            </View>
            <TouchableOpacity style={styles.ipBadgeRow} onPress={handleCopyIp} activeOpacity={0.7}>
              <View style={[styles.smallDot, { backgroundColor: '#10b981' }]} />
              <Text style={[styles.ipBadgeText, { color: colors.text }]}>{server.ipAddress}</Text>
              <Text style={{ fontSize: 11, color: '#0284c7' }}>📋</Text>
            </TouchableOpacity>
            <Text style={[styles.kpiSubValue, { color: colors.textMuted }]}>{server.region}</Text>
            <View style={[styles.kpiBadge, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Text style={[styles.kpiBadgeText, { color: colors.textSecondary }]}>{server.os}</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabBarContainer, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
          {(['Overview', 'Monitoring', 'Applications'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabPill,
                  isSelected && { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    { color: isSelected ? '#0284c7' : colors.textSecondary, fontWeight: isSelected ? '800' : '600' },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <View style={{ gap: Spacing.md }}>
            {/* Hardware & Spec Card */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Hardware Specifications</Text>

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Compute (vCPU)</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>{server.cpu} (Dedicated AMD EPYC™)</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Memory (RAM)</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>{server.memory} ECC DDR4</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Storage Type</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>240 GB NVMe PCIe Gen4 SSD</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Monthly Bandwidth</Text>
                <Text style={[styles.specItemValue, { color: '#10b981' }]}>20 TB Included (1.4 TB consumed)</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>System Uptime</Text>
                <Text style={[styles.specItemValue, { color: '#10b981', fontWeight: '800' }]}>{server.uptime || '99.99%'}</Text>
              </View>
            </View>

            {/* Resource Gauges */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Live Resource Utilization</Text>

              {/* CPU Gauge */}
              <View style={styles.gaugeBlock}>
                <View style={styles.gaugeHeaderRow}>
                  <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>CPU LOAD</Text>
                  <Text style={[styles.gaugeValueText, { color: colors.text }]}>{cpuPercent}% • 4 Cores Active</Text>
                </View>
                <View style={[styles.gaugeTrack, { backgroundColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
                  <View
                    style={[
                      styles.gaugeFill,
                      {
                        width: `${cpuPercent}%`,
                        backgroundColor: cpuPercent > 80 ? '#ef4444' : cpuPercent > 60 ? '#f59e0b' : '#0284c7',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* RAM Gauge */}
              <View style={styles.gaugeBlock}>
                <View style={styles.gaugeHeaderRow}>
                  <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>MEMORY (RAM)</Text>
                  <Text style={[styles.gaugeValueText, { color: colors.text }]}>{ramPercent}% • 3.8 GB / 8 GB</Text>
                </View>
                <View style={[styles.gaugeTrack, { backgroundColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
                  <View
                    style={[
                      styles.gaugeFill,
                      {
                        width: `${ramPercent}%`,
                        backgroundColor: ramPercent > 85 ? '#ef4444' : ramPercent > 70 ? '#f59e0b' : '#10b981',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Disk Gauge */}
              <View style={styles.gaugeBlock}>
                <View style={styles.gaugeHeaderRow}>
                  <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>NVME DISK</Text>
                  <Text style={[styles.gaugeValueText, { color: colors.text }]}>{diskPercent}% • 86 GB / 240 GB</Text>
                </View>
                <View style={[styles.gaugeTrack, { backgroundColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
                  <View
                    style={[
                      styles.gaugeFill,
                      {
                        width: `${diskPercent}%`,
                        backgroundColor: diskPercent > 85 ? '#ef4444' : diskPercent > 70 ? '#f59e0b' : '#0284c7',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Connected Domains */}
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Mapped Domain Endpoints</Text>

              {server.connectedDomains && server.connectedDomains.length > 0 ? (
                server.connectedDomains.map((dom) => (
                  <TouchableOpacity
                    key={dom}
                    style={[
                      styles.domainLinkRow,
                      { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                    ]}
                    onPress={() => router.push(`/domain/${dom}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.domainLinkLeft}>
                      <View style={[styles.domainLinkIconBox, { backgroundColor: '#e0f2fe' }]}>
                        <Text style={{ fontSize: 13 }}>🌐</Text>
                      </View>
                      <View>
                        <Text style={[styles.domainLinkTitle, { color: colors.text }]}>{dom}</Text>
                        <Text style={[styles.domainLinkSub, { color: colors.textMuted }]}>Port 443 (HTTPS) • Nginx VHost</Text>
                      </View>
                    </View>

                    <View style={styles.domainLinkRight}>
                      <View style={[styles.statusBadgeSmall, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.statusBadgeSmallText, { color: '#16a34a' }]}>200 OK</Text>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                  No domain endpoints mapped to this server.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 2. MONITORING TAB */}
        {activeTab === 'Monitoring' && (
          <View style={{ gap: Spacing.md }}>
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Network &amp; System Performance</Text>

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>System Load Average (1m, 5m, 15m)</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>0.24, 0.38, 0.42</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Network Throughput (In / Out)</Text>
                <Text style={[styles.specItemValue, { color: '#0284c7' }]}>14.2 Mbps / 48.6 Mbps</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Active TCP Sockets</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>128 connections established</Text>
              </View>
              <View style={[styles.specDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

              <View style={styles.specItemRow}>
                <Text style={[styles.specItemLabel, { color: colors.textSecondary }]}>Disk I/O (Read / Write)</Text>
                <Text style={[styles.specItemValue, { color: colors.text }]}>1.2 MB/s / 4.8 MB/s (142 IOPS)</Text>
              </View>
            </View>

            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Top Active Service Processes</Text>
              {[
                { name: 'nginx (master & 4 workers)', pid: '1042', cpu: '4.2%', ram: '142 MB', status: 'Running' },
                { name: 'node (domainpulse-api)', pid: '2840', cpu: '12.8%', ram: '420 MB', status: 'Running' },
                { name: 'postgres (primary instance)', pid: '892', cpu: '3.1%', ram: '680 MB', status: 'Running' },
                { name: 'docker-containerd', pid: '614', cpu: '1.4%', ram: '110 MB', status: 'Running' },
              ].map((proc) => (
                <View key={proc.pid} style={styles.processItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.processTitle, { color: colors.text }]}>{proc.name}</Text>
                    <Text style={[styles.processMeta, { color: colors.textMuted }]}>
                      PID {proc.pid} • CPU: {proc.cpu} • RAM: {proc.ram}
                    </Text>
                  </View>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.statusBadgeSmallText, { color: '#16a34a' }]}>{proc.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 3. APPLICATIONS TAB */}
        {activeTab === 'Applications' && (
          <View style={{ gap: Spacing.md }}>
            <View style={[styles.sectionCard, { backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#1f2937' : '#e2e8f0' }]}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Deployed App Services</Text>

              {[
                { name: 'DomainPulse Web & API Gateway', port: '443 / 80', runtime: 'Node.js 20 • Docker', status: 'Healthy' },
                { name: 'PostgreSQL Database Engine', port: '5432', runtime: 'PostgreSQL 16.2', status: 'Healthy' },
                { name: 'Redis Cache Layer', port: '6379', runtime: 'Redis 7.2 Alpine', status: 'Healthy' },
                { name: 'Prometheus Node Exporter', port: '9100', runtime: 'Monitoring Daemon', status: 'Healthy' },
              ].map((app) => (
                <View key={app.name} style={styles.appRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.processTitle, { color: colors.text }]}>{app.name}</Text>
                    <Text style={[styles.processMeta, { color: colors.textMuted }]}>
                      Port: {app.port} • {app.runtime}
                    </Text>
                  </View>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.statusBadgeSmallText, { color: '#16a34a' }]}>{app.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modern Action Sheet Modal */}
      <Modal
        visible={showMenuModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setShowMenuModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setShowMenuModal(false)}
          />
          <View style={[styles.actionSheet, { backgroundColor: isDark ? '#111827' : '#ffffff', paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Server Node Controls</Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {server.name} ({server.ipAddress})
              </Text>
            </View>

            <View style={styles.menuOptionsList}>
              {/* Option 1 */}
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  setShowMenuModal(false);
                  setTimeout(() => handlePingRefresh(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                  <Text style={{ fontSize: 16 }}>🔄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Ping &amp; Refresh Telemetry</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Query live CPU, RAM, Disk &amp; network metrics</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2 */}
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  setShowMenuModal(false);
                  setTimeout(() => handleCopyIp(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]}>
                  <Text style={{ fontSize: 16 }}>📋</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Copy Server IP</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>{server.ipAddress}</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3 */}
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  setShowMenuModal(false);
                  setTimeout(() => handleCopySsh(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff' }]}>
                  <Text style={{ fontSize: 16 }}>💻</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Copy SSH Connection Command</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>ssh root@{server.ipAddress}</Text>
                </View>
              </TouchableOpacity>

              {/* Option 4 */}
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  setShowMenuModal(false);
                  setTimeout(() => handleRestartServices(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7' }]}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Restart Web Services</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Send reload signal to Nginx &amp; Node runtimes</Text>
                </View>
              </TouchableOpacity>

              {/* Option 5 */}
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  setShowMenuModal(false);
                  setTimeout(() => handleDeleteServer(), 150);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}>
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: '#ef4444' }]}>Disconnect Server Node</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Remove server from cluster monitoring</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
              onPress={() => setShowMenuModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    padding: Spacing.xl,
    textAlign: 'center',
    ...Typography.bodyMedium,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  circleNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
    textAlign: 'center',
  },
  moreDots: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  providerLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  serverHeroName: {
    fontSize: 18,
    fontWeight: '800',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  statusPillActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  greenLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  statusPillActiveText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    justifyContent: 'space-between',
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kpiMainValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  kpiSubValue: {
    fontSize: 11,
  },
  kpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  kpiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  smallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ipBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabBarContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillText: {
    fontSize: 13,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 10,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  specItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  specItemLabel: {
    fontSize: 13,
  },
  specItemValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  specDivider: {
    height: 1,
  },
  gaugeBlock: {
    gap: 6,
    paddingVertical: 4,
  },
  gaugeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gaugeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gaugeValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gaugeTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 3.5,
  },
  domainLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  domainLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  domainLinkIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainLinkTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  domainLinkSub: {
    fontSize: 10,
    marginTop: 1,
  },
  domainLinkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeSmallText: {
    fontSize: 11,
    fontWeight: '800',
  },
  processItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  processTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  processMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  actionSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    gap: Spacing.sm,
    width: '100%',
    zIndex: 10,
    elevation: 24,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  menuOptionsList: {
    gap: 6,
    marginTop: 4,
  },
  menuOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuOptionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
