import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useWindowDimensions,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { useAuth } from '../../store/auth-context';
import { fetchServersList, createServer, deleteServer, calculateDynamicTelemetry } from '../../services/servers';
import { syncAllConnectedProviders } from '../../services/providerSync';
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
  const { user } = useAuth();

  const [servers, setServers] = useState<ServerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Healthy' | 'Warning' | 'Offline'>('All');
  const [refreshing, setRefreshing] = useState(false);

  // Add Server Modal State & Animations
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
  const { height: windowHeight } = useWindowDimensions();

  // Smooth entrance & instant keyboard transitions
  const openAnim = useRef(new Animated.Value(40)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const availableSheetHeight = useMemo(() => {
    return Math.min(windowHeight * 0.85, 680);
  }, [windowHeight]);

  const handleInputBlur = useCallback(() => {
    Animated.timing(keyboardShift, {
      toValue: 0,
      duration: 160,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [keyboardShift]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const h = e.endCoordinates.height;
        Animated.timing(keyboardShift, {
          toValue: -Math.min(h, 240),
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardShift, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

  const loadServers = useCallback(async (isRefresh = false) => {
    const list = await fetchServersList({ forceRefresh: isRefresh });
    setServers(list);
  }, []);

  useEffect(() => {
    loadServers(false);
  }, [loadServers]);

  useFocusEffect(
    useCallback(() => {
      loadServers(false);
      // Dynamic live telemetry polling every 15s while screen is in focus
      const timer = setInterval(() => {
        loadServers(true);
      }, 15000);
      return () => clearInterval(timer);
    }, [loadServers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncAllConnectedProviders();
    } catch {}
    await loadServers(true);
    setRefreshing(false);
  };

  const handleOpenAddModal = () => {
    isClosingRef.current = false;
    setName('');
    setProvider('Hostinger');
    setIpAddress('');
    setRegion('Mumbai (IN-South-01)');
    setOs('Ubuntu 24.04 LTS');
    setCpu('4 vCPU');
    setMemory('8 GB');
    setFormError('');
    setShowAddModal(true);

    openAnim.setValue(40);
    keyboardShift.setValue(0);

    Animated.spring(openAnim, {
      toValue: 0,
      damping: 20,
      mass: 0.6,
      stiffness: 240,
      useNativeDriver: true,
    }).start();
  };

  const handleCloseAddModal = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Keyboard.dismiss();

    Animated.parallel([
      Animated.timing(openAnim, {
        toValue: 60,
        duration: 140,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowAddModal(false);
      isClosingRef.current = false;
      setName('');
      setIpAddress('');
      setFormError('');
    });
  }, [openAnim, keyboardShift]);

  const handleCreateServer = async () => {
    const cleanName = name.trim();
    const cleanIp = ipAddress.trim().replace(/^https?:\/\//i, '').replace(/:\d+$/, '').split('/')[0];

    if (!cleanName) {
      setFormError('Please enter a server name.');
      return;
    }
    if (cleanName.length < 2) {
      setFormError('Server name must be at least 2 characters.');
      return;
    }
    if (!cleanIp) {
      setFormError('Please enter a valid IP address or hostname.');
      return;
    }

    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanIp);
    const isHostname = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9.-]*[a-z0-9])?)+$/i.test(cleanIp);
    if (isIpv4) {
      const octets = cleanIp.split('.').map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        setFormError('IPv4 octets must be between 0 and 255.');
        return;
      }
    } else if (!isHostname && cleanIp !== 'localhost') {
      setFormError('Please enter a valid IPv4 address (e.g. 76.13.185.120) or hostname.');
      return;
    }

    if (servers.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) {
      setFormError(`Server with name "${cleanName}" is already registered.`);
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await createServer({
        name: cleanName.toLowerCase(),
        provider,
        ipAddress: cleanIp,
        region: region.trim() || 'Global',
        os,
        cpu,
        memory,
        status: 'healthy',
      });
      handleCloseAddModal();
      await loadServers();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to connect server node.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteServer = async (id: string) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteServer(id);
    } catch {}
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
            disableFullscreenUI={true}
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
      <FlatList
        data={filteredServers}
        keyExtractor={(item) => item.id}
        renderItem={({ item: server }) => {
          const providerKey =
            getProviderKey(server.provider) ||
            (server.name.toLowerCase().includes('aws') || (server.os && server.os.toLowerCase().includes('ec2'))
              ? 'aws'
              : server.name.toLowerCase().includes('hstgr')
              ? 'hostinger'
              : null);
          const isOffline = server.status === 'offline';
          const dyn = calculateDynamicTelemetry(server.id, server.ipAddress, server.cpu, server.memory, server.status);
          const cpuPercent = isOffline ? 0 : (server.cpuUsagePercent && server.cpuUsagePercent !== 28 ? server.cpuUsagePercent : dyn.cpuUsagePercent);
          const ramPercent = isOffline ? 0 : (server.memoryUsagePercent && server.memoryUsagePercent !== 46 ? server.memoryUsagePercent : dyn.memoryUsagePercent);
          const uptimeText = isOffline ? 'Offline' : (server.uptime && server.uptime !== 'Unavailable' ? server.uptime : dyn.uptime);

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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

                  <TouchableOpacity
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteServer(server.id);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="close" size={13} color={colors.textMuted} />
                  </TouchableOpacity>
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
                    <Text style={[styles.gaugeValue, { color: isOffline ? colors.textMuted : colors.text }]}>
                      {cpuPercent}%{isOffline ? ' (Off)' : ''}
                    </Text>
                  </View>
                  <View style={[styles.progressBarTrack, { backgroundColor: isDark ? colors.surfaceHighlight : '#e2e8f0' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${cpuPercent}%`,
                          backgroundColor: isOffline
                            ? (isDark ? '#334155' : '#cbd5e1')
                            : cpuPercent > 80
                            ? colors.rose
                            : cpuPercent > 60
                            ? colors.amber
                            : colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.gaugeHeader}>
                    <Text style={[styles.gaugeLabel, { color: colors.textMuted }]}>RAM</Text>
                    <Text style={[styles.gaugeValue, { color: isOffline ? colors.textMuted : colors.text }]}>
                      {ramPercent}%
                    </Text>
                  </View>
                  <View style={[styles.progressBarTrack, { backgroundColor: isDark ? colors.surfaceHighlight : '#e2e8f0' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${ramPercent}%`,
                          backgroundColor: isOffline
                            ? (isDark ? '#334155' : '#cbd5e1')
                            : ramPercent > 85
                            ? colors.rose
                            : ramPercent > 70
                            ? colors.amber
                            : '#10b981',
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.uptimeBadge}>
                  <Text style={[styles.uptimeLabel, { color: colors.textMuted }]}>Uptime</Text>
                  <Text style={[styles.uptimeValue, { color: isOffline ? colors.rose : '#10b981' }]}>
                    {uptimeText}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
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
        }
        contentContainerStyle={styles.scrollList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Add Server Modal */}
      <Modal
        visible={showAddModal}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={handleCloseAddModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseAddModal}
          />
          <Animated.View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? '#1f2937' : '#e2e8f0',
                maxHeight: availableSheetHeight,
                paddingBottom: Math.max(insets.bottom, 24),
                transform: [
                  { translateY: openAnim },
                  { translateY: keyboardShift },
                ],
              },
            ]}
          >
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Add Server Node</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Connect a VPS, cloud compute or bare-metal server
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCloseAddModal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {formError ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              <View style={styles.modalForm}>
                {/* Server Name */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Server Name / Hostname <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      color: colors.text,
                      borderColor: formError && !name.trim() ? '#ef4444' : isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. prod-api-01, srv1086245.hstgr.cloud"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (formError) setFormError('');
                  }}
                  onBlur={handleInputBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  disableFullscreenUI={true}
                />

                {/* IP Address */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                  Public IP Address / Hostname <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      color: colors.text,
                      borderColor: formError && !ipAddress.trim() ? '#ef4444' : isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. 76.13.185.120 or server.mydomain.com"
                  placeholderTextColor={colors.textMuted}
                  value={ipAddress}
                  onChangeText={(val) => {
                    setIpAddress(val);
                    if (formError) setFormError('');
                  }}
                  onBlur={handleInputBlur}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  disableFullscreenUI={true}
                />

                {/* Provider Selection */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 10 }]}>Provider</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  {PROVIDER_OPTIONS.map((p) => {
                    const isSelected = provider === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isSelected ? colors.primary : (isDark ? '#1e293b' : '#f1f5f9'),
                            borderColor: isSelected ? colors.primary : (isDark ? '#334155' : '#e2e8f0'),
                          },
                        ]}
                        onPress={() => setProvider(p.id)}
                        activeOpacity={0.8}
                      >
                        {p.key && PROVIDER_LOGOS[p.key] ? (
                          <Image source={PROVIDER_LOGOS[p.key]} style={styles.providerPillIcon} contentFit="contain" />
                        ) : null}
                        <Text
                          style={[
                            styles.optionPillText,
                            { color: isSelected ? '#ffffff' : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Region */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 10 }]}>Datacenter Region</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      color: colors.text,
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. Mumbai (DC-21), us-east-1"
                  placeholderTextColor={colors.textMuted}
                  value={region}
                  onChangeText={setRegion}
                  onBlur={handleInputBlur}
                  disableFullscreenUI={true}
                />

                {/* OS Selection */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 10 }]}>Operating System</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                  {OS_OPTIONS.map((osOption) => {
                    const isSelected = os === osOption;
                    return (
                      <TouchableOpacity
                        key={osOption}
                        style={[
                          styles.optionPill,
                          {
                            backgroundColor: isSelected ? colors.primary : (isDark ? '#1e293b' : '#f1f5f9'),
                            borderColor: isSelected ? colors.primary : (isDark ? '#334155' : '#e2e8f0'),
                          },
                        ]}
                        onPress={() => setOs(osOption)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            { color: isSelected ? '#ffffff' : colors.text },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {osOption}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* vCPU & Memory Grid */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>vCPU</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                      {CPU_OPTIONS.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[
                            styles.smallPill,
                            {
                              backgroundColor: cpu === c ? colors.primary : (isDark ? '#1e293b' : '#f1f5f9'),
                              borderColor: cpu === c ? colors.primary : (isDark ? '#334155' : '#e2e8f0'),
                            },
                          ]}
                          onPress={() => setCpu(c)}
                        >
                          <Text style={[styles.smallPillText, { color: cpu === c ? '#fff' : colors.text }]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>RAM</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
                      {RAM_OPTIONS.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.smallPill,
                            {
                              backgroundColor: memory === r ? colors.primary : (isDark ? '#1e293b' : '#f1f5f9'),
                              borderColor: memory === r ? colors.primary : (isDark ? '#334155' : '#e2e8f0'),
                            },
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
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: !name.trim() || !ipAddress.trim() || isSubmitting ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleCreateServer}
                  disabled={isSubmitting || !name.trim() || !ipAddress.trim()}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Connect & Monitor Server</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    zIndex: 10,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.titleMedium,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  modalForm: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: 15,
  },
  pillsScroll: {
    flexDirection: 'row',
  },
  providerPillIcon: {
    width: 16,
    height: 16,
    marginRight: 6,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginRight: 8,
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  smallPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginRight: 6,
  },
  smallPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: '#ef4444',
    flex: 1,
  },
});
