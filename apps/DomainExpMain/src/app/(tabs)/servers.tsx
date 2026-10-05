import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { fetchServersList, createServer, deleteServer } from '../../services/servers';
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
  cloudflare: require('../../../assets/images/providers/cloudflare.png'),
  godaddy: require('../../../assets/images/providers/godaddy.png'),
  namecheap: require('../../../assets/images/providers/namecheap.png'),
};

const PROVIDER_OPTIONS = [
  { id: 'Hostinger', key: 'hostinger', name: 'Hostinger' },
  { id: 'Hetzner', key: 'hetzner', name: 'Hetzner' },
  { id: 'Amazon AWS', key: 'aws', name: 'AWS' },
  { id: 'DigitalOcean', key: 'digitalocean', name: 'DigitalOcean' },
  { id: 'Google Cloud', key: 'gcp', name: 'GCP' },
  { id: 'Microsoft Azure', key: 'azure', name: 'Azure' },
  { id: 'Vultr', key: 'vultr', name: 'Vultr' },
  { id: 'Linode', key: 'linode', name: 'Linode' },
  { id: 'Custom VPS', key: 'custom', name: 'Custom / Bare Metal' },
];

const OS_OPTIONS = [
  'Ubuntu 24.04 LTS',
  'Debian 12 Bookworm',
  'Rocky Linux 9',
  'Alpine Linux 3.20',
  'Amazon Linux 2023',
];

const CPU_OPTIONS = ['1 vCPU', '2 vCPU', '4 vCPU', '8 vCPU', '16 vCPU'];
const RAM_OPTIONS = ['2 GB', '4 GB', '8 GB', '16 GB', '32 GB', '64 GB'];

export default function ServersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [servers, setServers] = useState<ServerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Healthy' | 'Warning' | 'Offline'>('All');
  const [refreshing, setRefreshing] = useState(false);

  // Add Server Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('Hostinger');
  const [ipAddress, setIpAddress] = useState('');
  const [region, setRegion] = useState('Mumbai (IN-South-01)');
  const [os, setOs] = useState('Ubuntu 24.04 LTS');
  const [cpu, setCpu] = useState('4 vCPU');
  const [memory, setMemory] = useState('8 GB');
  const [formError, setFormError] = useState('');

  const loadServers = useCallback(async () => {
    const list = await fetchServersList();
    setServers(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadServers();
    }, [loadServers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServers();
    setRefreshing(false);
  };

  const handleOpenAddModal = () => {
    setName('');
    setProvider('Hostinger');
    setIpAddress('');
    setRegion('Mumbai (IN-South-01)');
    setOs('Ubuntu 24.04 LTS');
    setCpu('4 vCPU');
    setMemory('8 GB');
    setFormError('');
    setShowAddModal(true);
  };

  const handleCreateServer = async () => {
    if (!name.trim()) {
      setFormError('Please enter a server name.');
      return;
    }
    if (!ipAddress.trim()) {
      setFormError('Please enter a valid IP address or hostname.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await createServer({
        name: name.trim().toLowerCase(),
        provider,
        ipAddress: ipAddress.trim(),
        region: region.trim() || 'Global',
        os,
        cpu,
        memory,
        status: 'healthy',
      });
      setShowAddModal(false);
      await loadServers();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to connect server node.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProviderKey = (p: string) => {
    const lower = p.toLowerCase();
    if (lower.includes('hostinger')) return 'hostinger';
    if (lower.includes('hetzner')) return 'hetzner';
    if (lower.includes('aws') || lower.includes('amazon')) return 'aws';
    if (lower.includes('digital') || lower.includes('ocean')) return 'digitalocean';
    if (lower.includes('google') || lower.includes('gcp')) return 'gcp';
    if (lower.includes('azure') || lower.includes('microsoft')) return 'azure';
    if (lower.includes('vultr')) return 'vultr';
    if (lower.includes('linode')) return 'linode';
    return null;
  };

  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.ipAddress && s.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()));

      if (selectedFilter === 'Healthy') return matchesSearch && s.status === 'healthy';
      if (selectedFilter === 'Warning') return matchesSearch && s.status === 'warning';
      if (selectedFilter === 'Offline') return matchesSearch && s.status === 'offline';
      return matchesSearch;
    });
  }, [servers, searchQuery, selectedFilter]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Servers</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {servers.length} connected infrastructure nodes
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.addServerBtn, { backgroundColor: colors.primary }]}
            onPress={handleOpenAddModal}
            activeOpacity={0.8}
          >
            <Text style={styles.addServerBtnText}>+ Add Server</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search servers by name, IP or provider..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={[styles.clearIcon, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {(['All', 'Healthy', 'Warning', 'Offline'] as const).map((filter) => {
            const isSelected = selectedFilter === filter;
            const count =
              filter === 'All'
                ? servers.length
                : servers.filter((s) => s.status.toLowerCase() === filter.toLowerCase()).length;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe', borderColor: colors.primary },
                ]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: colors.textSecondary },
                    isSelected && { color: colors.primary, fontWeight: '800' },
                  ]}
                >
                  {filter} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Servers List */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filteredServers.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
              <Text style={{ fontSize: 32 }}>🖥️</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No servers found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery ? `No matches found for "${searchQuery}"` : 'You have no connected server nodes yet.'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
              onPress={handleOpenAddModal}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyAddBtnText}>+ Connect Your First Server</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredServers.map((server) => {
            const providerKey = getProviderKey(server.provider);
            const cpuPercent = server.cpuUsagePercent ?? 30;
            const ramPercent = server.memoryUsagePercent ?? 50;

            return (
              <TouchableOpacity
                key={server.id}
                style={[
                  styles.serverCard,
                  {
                    backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                    borderColor: isDark ? colors.border : '#e2e8f0',
                  },
                ]}
                onPress={() => router.push(`/server/${server.id}` as any)}
                activeOpacity={0.8}
              >
                {/* Card Top Row */}
                <View style={styles.serverCardTop}>
                  <View style={styles.serverLeft}>
                    <View
                      style={[
                        styles.serverIconBox,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                          borderColor: isDark ? colors.border : '#e2e8f0',
                        },
                      ]}
                    >
                      {providerKey && PROVIDER_LOGOS[providerKey] ? (
                        <Image
                          source={PROVIDER_LOGOS[providerKey]}
                          style={{ width: 26, height: 26 }}
                          contentFit="contain"
                        />
                      ) : (
                        <Text style={styles.serverIconGlyph}>🖥️</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.serverName, { color: colors.text }]}>{server.name}</Text>
                      <Text style={[styles.serverSubtext, { color: colors.textMuted }]}>
                        {server.ipAddress} • {server.provider}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          server.status === 'healthy'
                            ? colors.emeraldMuted
                            : server.status === 'warning'
                            ? colors.amberMuted
                            : colors.roseMuted,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            server.status === 'healthy'
                              ? colors.emerald
                              : server.status === 'warning'
                              ? colors.amber
                              : colors.rose,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            server.status === 'healthy'
                              ? colors.emerald
                              : server.status === 'warning'
                              ? colors.amber
                              : colors.rose,
                        },
                      ]}
                    >
                      {server.status === 'healthy' ? 'Healthy' : server.status === 'warning' ? 'Warning' : 'Offline'}
                    </Text>
                  </View>
                </View>

                {/* Specs / Meta Badges Row */}
                <View style={styles.specBadgesRow}>
                  <View style={[styles.specBadge, { backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9' }]}>
                    <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>📍 {server.region}</Text>
                  </View>
                  <View style={[styles.specBadge, { backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9' }]}>
                    <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>⚙️ {server.cpu}</Text>
                  </View>
                  <View style={[styles.specBadge, { backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9' }]}>
                    <Text style={[styles.specBadgeText, { color: colors.textSecondary }]}>🧠 {server.memory}</Text>
                  </View>
                </View>

                {/* Resource Gauges */}
                <View style={[styles.resourceGaugesRow, { borderTopColor: isDark ? colors.border : '#f1f5f9' }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.gaugeHeader}>
                      <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>CPU</Text>
                      <Text style={[styles.gaugeValue, { color: colors.text }]}>{cpuPercent}%</Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: isDark ? colors.surfaceHighlight : '#e2e8f0' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${cpuPercent}%`,
                            backgroundColor: cpuPercent > 80 ? colors.rose : cpuPercent > 60 ? colors.amber : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.gaugeHeader}>
                      <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>RAM</Text>
                      <Text style={[styles.gaugeValue, { color: colors.text }]}>{ramPercent}%</Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: isDark ? colors.surfaceHighlight : '#e2e8f0' }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${ramPercent}%`,
                            backgroundColor: ramPercent > 85 ? colors.rose : ramPercent > 70 ? colors.amber : '#10b981',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.uptimeBadge}>
                    <Text style={[styles.uptimeLabel, { color: colors.textMuted }]}>Uptime</Text>
                    <Text style={[styles.uptimeValue, { color: '#10b981' }]}>{server.uptime || '99.9%'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Server Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Server Node</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Connect a VPS, cloud compute or bare-metal server
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>⚠️ {formError}</Text>
                </View>
              ) : null}

              {/* Server Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Server Name / Hostname *</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. prod-api-01, web-frontend"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                />
              </View>

              {/* IP Address */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Public IP Address *</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. 194.195.112.45"
                  placeholderTextColor={colors.textMuted}
                  value={ipAddress}
                  onChangeText={setIpAddress}
                  autoCapitalize="none"
                  keyboardType="numeric"
                />
              </View>

              {/* Provider Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Provider</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  {PROVIDER_OPTIONS.map((p) => {
                    const isSelected = provider === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.optionPill,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setProvider(p.id)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            { color: colors.text },
                            isSelected && { color: '#ffffff', fontWeight: '800' },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Region */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Datacenter Region</Text>
                <TextInput
                  style={[styles.fieldInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. Mumbai, Frankfurt, us-east-1"
                  placeholderTextColor={colors.textMuted}
                  value={region}
                  onChangeText={setRegion}
                />
              </View>

              {/* OS Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Operating System</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  {OS_OPTIONS.map((osOption) => {
                    const isSelected = os === osOption;
                    return (
                      <TouchableOpacity
                        key={osOption}
                        style={[
                          styles.optionPill,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setOs(osOption)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            { color: colors.text },
                            isSelected && { color: '#ffffff', fontWeight: '800' },
                          ]}
                        >
                          {osOption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* vCPU & Memory Grid */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>vCPU</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                    {CPU_OPTIONS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.smallPill,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          cpu === c && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setCpu(c)}
                      >
                        <Text style={[styles.smallPillText, { color: cpu === c ? '#fff' : colors.text }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>RAM</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                    {RAM_OPTIONS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.smallPill,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          memory === r && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => setMemory(r)}
                      >
                        <Text style={[styles.smallPillText, { color: memory === r ? '#fff' : colors.text }]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateServer}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Connect & Monitor Server</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  headerTitle: {
    ...Typography.titleLarge,
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addServerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addServerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  appsShortcut: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  appsShortcutText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyMedium,
  },
  clearIcon: {
    fontSize: 14,
    padding: 4,
  },
  filtersSection: {
    paddingVertical: Spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
  },
  filterPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  filterPillText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  scrollList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl + 120,
    gap: Spacing.md,
  },
  serverCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  serverCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  serverIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  serverIconGlyph: {
    fontSize: 22,
  },
  serverName: {
    ...Typography.bodyLarge,
    fontWeight: '800',
  },
  serverSubtext: {
    ...Typography.caption,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    ...Typography.caption,
    fontWeight: '800',
  },
  specBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  specBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  specBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  resourceGaugesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  gaugeValue: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  uptimeBadge: {
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  uptimeLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  uptimeValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: 10,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    ...Typography.titleSmall,
    fontWeight: '800',
    fontSize: 18,
  },
  emptySubtitle: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  emptyAddBtn: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.4)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  formGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  pillsScroll: {
    flexDirection: 'row',
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
});
