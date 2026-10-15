import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Radius, Spacing, Typography } from '../constants/theme';
import {
  disconnectGooglePlay,
  fetchGooglePlayApps,
  fetchGooglePlayStatus,
  openGooglePlayStoreUrl,
  refreshGooglePlayTokens,
  startGooglePlayConnectFlow,
  verifyGooglePlayDeveloperAccount,
  type GooglePlayApp,
  type GooglePlayStatus,
} from '../services/googlePlay';
import {
  createApplication,
  syncGooglePlayAppsToWorkspace,
  getStoredApps,
  saveStoredApps,
  WORKNAI_CONSOLE_APPS,
} from '../services/applications';
import {
  fetchDeveloperPublicApps,
  searchGooglePlayDevelopers,
} from '../services/playStoreService';
import { deleteUserItem, STORAGE_KEYS } from '../services/storage';
import { useTheme } from '../store/theme-context';
import type {
  GooglePlayDeveloperSearchResult,
  PlayStoreAppDetail,
} from '../types';

const WORKNAI_ICON_MAP = new Map<string, string>();
for (const a of WORKNAI_CONSOLE_APPS) {
  if (a.packageId && a.iconUrl) {
    WORKNAI_ICON_MAP.set(a.packageId.toLowerCase(), a.iconUrl);
  }
}

function getPlayAppIconUrl(app: PlayStoreAppDetail): string | undefined {
  if (app.iconUrl) return app.iconUrl;
  const pkg = (app.packageId || '').toLowerCase().trim();
  if (pkg && WORKNAI_ICON_MAP.has(pkg)) return WORKNAI_ICON_MAP.get(pkg);
  const nameLower = (app.name || '').toLowerCase();
  for (const [p, url] of WORKNAI_ICON_MAP.entries()) {
    const last = p.split('.').pop() || '';
    if (p.includes(pkg) || (last.length >= 4 && nameLower.includes(last))) {
      return url;
    }
  }
  return undefined;
}

const POPULAR_DEVELOPER_SUGGESTIONS = [
  'Student Factory',
  'Google LLC',
  'Microsoft Corporation',
  'Adobe',
  'Spotify',
  'Duolingo',
];

function GoogleGLogo({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.75, fontWeight: '800', color: '#4285F4' }}>
        G
      </Text>
    </View>
  );
}

function DeveloperAvatar({ name, icon, size = 44 }: { name: string; icon?: string; size?: number }) {
  const { colors, isDark } = useTheme();
  const initials = (name || 'Dev')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  if (icon) {
    return (
      <Image
        source={{ uri: icon }}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.25),
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
        }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        backgroundColor: isDark ? 'rgba(1, 135, 95, 0.2)' : '#e6f4ea',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(1, 135, 95, 0.4)' : '#a8dab5',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: Math.max(12, Math.round(size * 0.35)), fontWeight: '700', color: '#01875f' }}>
        {initials || 'GP'}
      </Text>
    </View>
  );
}

export default function GooglePlayConsoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ section?: string; dev?: string }>();

  // Top Section Switcher: 'search' | 'console'
  const [activeSection, setActiveSection] = useState<'search' | 'console'>(
    params.section === 'console' ? 'console' : 'search'
  );

  // ---------------------------------------------------------------------------
  // UNIVERSAL DEVELOPER SEARCH STATE
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState(params.dev || '');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<GooglePlayDeveloperSearchResult[]>([]);

  // Selected developer state
  const [selectedDeveloper, setSelectedDeveloper] = useState<GooglePlayDeveloperSearchResult | null>(null);
  const [developerApps, setDeveloperApps] = useState<PlayStoreAppDetail[]>([]);
  const [isLoadingDevApps, setIsLoadingDevApps] = useState(false);
  const [devAppsError, setDevAppsError] = useState<string | null>(null);
  const [appFilterQuery, setAppFilterQuery] = useState('');
  const [trackedPackageIds, setTrackedPackageIds] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // PRIVATE CONSOLE ACCOUNT STATE
  // ---------------------------------------------------------------------------
  const [isLoadingConsole, setIsLoadingConsole] = useState(true);
  const [isRefreshingConsole, setIsRefreshingConsole] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [consoleStatus, setConsoleStatus] = useState<GooglePlayStatus>({ connected: false });
  const [consoleApps, setConsoleApps] = useState<GooglePlayApp[]>([]);
  const [developerAccountIdInput, setDeveloperAccountIdInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------------------------
  const loadConsoleData = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setIsRefreshingConsole(true);
    } else {
      setIsLoadingConsole(true);
    }
    setErrorMessage(null);

    try {
      const currentStatus = await fetchGooglePlayStatus();
      setConsoleStatus(currentStatus);

      if (currentStatus.connected && currentStatus.developerAccount?.id) {
        setDeveloperAccountIdInput(currentStatus.developerAccount.id);
        const appsRes = await fetchGooglePlayApps();
        const playApps = appsRes.apps || [];
        setConsoleApps(playApps);

        if (playApps.length > 0) {
          const devName =
            currentStatus.developerAccount.id ||
            currentStatus.googleAccount?.email ||
            'Google Play Console';
          await syncGooglePlayAppsToWorkspace(playApps, devName);
        }
      } else {
        setConsoleApps([]);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoadingConsole(false);
      setIsRefreshingConsole(false);
    }
  }, []);

  useEffect(() => {
    loadConsoleData();
    // Auto-search if a developer was passed in URL params
    if (params.dev) {
      handleSearchDevelopers(params.dev);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // UNIVERSAL SEARCH HANDLERS
  // ---------------------------------------------------------------------------
  const handleSearchDevelopers = async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    if (!q) {
      Alert.alert('Required', 'Please enter a Google Play developer name to search.');
      return;
    }

    Keyboard.dismiss();
    setSearchQuery(q);
    setIsSearching(true);
    setSearchError(null);
    setSelectedDeveloper(null);
    setDeveloperApps([]);

    try {
      const results = await searchGooglePlayDevelopers(q);
      setSearchResults(results);
      setHasSearched(true);
    } catch (err: any) {
      setSearchError(err?.message || 'Failed to search Google Play developers.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectDeveloper = async (dev: GooglePlayDeveloperSearchResult) => {
    setSelectedDeveloper(dev);
    setIsLoadingDevApps(true);
    setDevAppsError(null);
    setDeveloperApps([]);
    setAppFilterQuery('');

    try {
      const apps = await fetchDeveloperPublicApps(dev.id || dev.name);
      setDeveloperApps(apps);
    } catch (err: any) {
      setDevAppsError(err?.message || `Could not fetch apps for ${dev.name}.`);
    } finally {
      setIsLoadingDevApps(false);
    }
  };

  const handleBackToSearch = () => {
    setSelectedDeveloper(null);
    setDeveloperApps([]);
    setDevAppsError(null);
  };

  const handleTrackApp = async (app: PlayStoreAppDetail) => {
    try {
      await createApplication({
        name: app.name,
        packageId: app.packageId,
        playStoreUrl: app.playStoreUrl,
        developerName: app.developerName || selectedDeveloper?.name,
        url: app.playStoreUrl,
        environment: 'Production',
      });
      setTrackedPackageIds((prev) => new Set([...prev, app.packageId]));
      Alert.alert(
        'App Added!',
        `"${app.name}" is now tracked in your DomainPulse applications inventory.`
      );
    } catch (err: any) {
      Alert.alert('Notice', err?.message || 'Could not add app to workspace.');
    }
  };

  const handleOpenPlayStoreUrl = async (url?: string) => {
    const targetUrl = url || (selectedDeveloper ? `https://play.google.com/store/apps/developer?id=${encodeURIComponent(selectedDeveloper.id || selectedDeveloper.name)}` : 'https://play.google.com/store');
    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (canOpen) {
        await Linking.openURL(targetUrl);
      } else {
        await openGooglePlayStoreUrl(targetUrl);
      }
    } catch {
      await openGooglePlayStoreUrl(targetUrl);
    }
  };

  // Filtered developer apps
  const filteredDevApps = useMemo(() => {
    if (!appFilterQuery.trim()) return developerApps;
    const q = appFilterQuery.toLowerCase().trim();
    return developerApps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.packageId.toLowerCase().includes(q) ||
        (a.summary && a.summary.toLowerCase().includes(q))
    );
  }, [developerApps, appFilterQuery]);

  // ---------------------------------------------------------------------------
  // CONSOLE ACCOUNT HANDLERS
  // ---------------------------------------------------------------------------
  const handleContinueWithGoogle = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await startGooglePlayConnectFlow(
        developerAccountIdInput.trim() || undefined
      );

      if (result.cancelled) {
        setInfoMessage('Google sign-in was cancelled.');
        setIsConnecting(false);
        return;
      }

      if (!result.success) {
        setErrorMessage(result.message || 'Google authorization could not be completed.');
        setIsConnecting(false);
        return;
      }

      await loadConsoleData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to authenticate Google Play account.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVerifyDeveloperAccount = async () => {
    const devId = developerAccountIdInput.trim();
    if (!devId) {
      Alert.alert('Required', 'Please enter your Play Console Developer Account ID.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await verifyGooglePlayDeveloperAccount(devId);
      setInfoMessage('Developer Account verified successfully!');
      await loadConsoleData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to verify developer account.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshingConsole(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      await refreshGooglePlayTokens();
      setInfoMessage('Tokens refreshed successfully.');
      await loadConsoleData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to refresh tokens.');
    } finally {
      setIsRefreshingConsole(false);
    }
  };

  const handleDismissDevApp = (packageId: string) => {
    setDeveloperApps((prev) => prev.filter((a) => a.packageId !== packageId && a.id !== packageId));
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Google Play Console',
      'Are you sure you want to disconnect this Google Play Console account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsLoadingConsole(true);
            try {
              await disconnectGooglePlay();
              setConsoleStatus({ connected: false });
              setConsoleApps([]);
              setDeveloperAccountIdInput('');
              await deleteUserItem(STORAGE_KEYS.CONSOLE_ACCOUNT);
              const stored = await getStoredApps();
              const remaining = stored.filter((a) => a.serverName !== 'Google Play Console');
              await saveStoredApps(remaining);
              setInfoMessage('Google Play Console account disconnected.');
            } catch (err: any) {
              setErrorMessage(err?.message || 'Failed to disconnect account.');
            } finally {
              setIsLoadingConsole(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top, 16),
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
            maxWidth: 960,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Google Play Apps
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Universal Developer & App Discovery
          </Text>
        </View>

        <View style={styles.headerIconBadge}>
          <Ionicons name="logo-google-playstore" size={20} color="#01875f" />
        </View>
      </View>

      {/* Main Mode Switcher: Universal Search vs Connected Console */}
      <View
        style={[
          styles.tabSwitcherWrap,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
            maxWidth: 960,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
      >
        <View style={[styles.tabSwitcher, { backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9' }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeSection === 'search' && { backgroundColor: '#01875f' },
            ]}
            onPress={() => setActiveSection('search')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="search"
              size={15}
              color={activeSection === 'search' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeSection === 'search' ? '#ffffff' : colors.textSecondary },
              ]}
            >
              Developer Search
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeSection === 'console' && { backgroundColor: '#01875f' },
            ]}
            onPress={() => setActiveSection('console')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="key-outline"
              size={15}
              color={activeSection === 'console' ? '#ffffff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeSection === 'console' ? '#ffffff' : colors.textSecondary },
              ]}
            >
              Connected Console
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* =================================================================== */}
        {/* TAB 1: UNIVERSAL DEVELOPER SEARCH                                   */}
        {/* =================================================================== */}
        {activeSection === 'search' ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: Math.max(insets.bottom, 24) + 24,
                maxWidth: 960,
                width: '100%',
                alignSelf: 'center',
              },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* VIEW B: SELECTED DEVELOPER APPS */}
            {selectedDeveloper ? (
              <View style={styles.selectedDevContainer}>
                {/* Back to Results Button */}
                <TouchableOpacity
                  style={[styles.backToSearchBtn, { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceElevated : '#ffffff' }]}
                  onPress={handleBackToSearch}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={18} color="#01875f" />
                  <Text style={[styles.backToSearchText, { color: colors.text }]}>
                    Back to Developer Search
                  </Text>
                </TouchableOpacity>

                {/* Developer Profile Card */}
                <Card elevated style={[styles.devHeaderCard, { borderColor: colors.border }]}>
                  <View style={styles.devHeaderRow}>
                    <DeveloperAvatar
                      name={selectedDeveloper.name}
                      icon={selectedDeveloper.icon}
                      size={54}
                    />
                    <View style={styles.devHeaderInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={[styles.devHeaderName, { color: colors.text }]}>
                          {selectedDeveloper.name}
                        </Text>
                        {selectedDeveloper.verified && (
                          <View style={styles.verifiedTag}>
                            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                            <Text style={styles.verifiedTagText}>Verified</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.devHeaderId, { color: colors.textSecondary }]}>
                        Developer ID: {selectedDeveloper.id || selectedDeveloper.name}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <Badge
                          label={`${developerApps.length} Apps Published`}
                          variant="success"
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.devHeaderActionsRow}>
                    <TouchableOpacity
                      style={[styles.openStoreBtn, { backgroundColor: isDark ? 'rgba(1, 135, 95, 0.15)' : '#e6f4ea', borderColor: '#01875f' }]}
                      onPress={() => handleOpenPlayStoreUrl()}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-google-playstore" size={16} color="#01875f" />
                      <Text style={styles.openStoreBtnText}>Open Developer Page ↗</Text>
                    </TouchableOpacity>
                  </View>
                </Card>

                {/* Filter within apps input */}
                {developerApps.length > 3 && (
                  <View style={[styles.appsFilterBar, { backgroundColor: isDark ? colors.surfaceElevated : '#ffffff', borderColor: colors.border }]}>
                    <Ionicons name="filter-outline" size={18} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.appsFilterInput, { color: colors.text }]}
                      placeholder={`Filter ${selectedDeveloper.name}'s apps...`}
                      placeholderTextColor={colors.textMuted}
                      value={appFilterQuery}
                      onChangeText={setAppFilterQuery}
                    />
                    {appFilterQuery ? (
                      <TouchableOpacity onPress={() => setAppFilterQuery('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {/* Loading Apps State */}
                {isLoadingDevApps && (
                  <View style={styles.devLoadingBox}>
                    <ActivityIndicator size="large" color="#01875f" />
                    <Text style={[styles.devLoadingText, { color: colors.textSecondary }]}>
                      Fetching published apps for {selectedDeveloper.name}...
                    </Text>
                  </View>
                )}

                {/* Dev Apps Error */}
                {devAppsError && !isLoadingDevApps && (
                  <View style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', borderColor: '#ef4444' }]}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.alertText, { color: '#ef4444' }]}>{devAppsError}</Text>
                    <TouchableOpacity
                      style={[styles.retrySmallBtn, { backgroundColor: '#ef4444' }]}
                      onPress={() => handleSelectDeveloper(selectedDeveloper)}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Empty Apps State */}
                {!isLoadingDevApps && !devAppsError && filteredDevApps.length === 0 && (
                  <EmptyState
                    title="No Applications Found"
                    description={`No publicly visible applications were found matching "${appFilterQuery || selectedDeveloper.name}".`}
                  />
                )}

                {/* Apps Cards List */}
                {!isLoadingDevApps && filteredDevApps.length > 0 && (
                  <View style={styles.appsListSection}>
                    <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                      PUBLISHED APPLICATIONS ({filteredDevApps.length})
                    </Text>

                    {filteredDevApps.map((app) => {
                      const isTracked = trackedPackageIds.has(app.packageId);
                      return (
                        <Card key={app.id} elevated style={[styles.appItemCard, { borderColor: colors.border }]}>
                          <View style={styles.appCardTop}>
                            {(() => {
                              const iconUri = getPlayAppIconUrl(app);
                              return iconUri ? (
                                <Image
                                  source={{ uri: iconUri }}
                                  style={styles.appIconImg}
                                  contentFit="cover"
                                  transition={200}
                                  cachePolicy="memory-disk"
                                />
                              ) : (
                                <View style={[styles.appIconPlaceholder, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                                  <Ionicons name="logo-android" size={28} color="#01875f" />
                                </View>
                              );
                            })()}

                            <View style={styles.appCardInfo}>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <Text style={[styles.appTitle, { color: colors.text, flex: 1, marginRight: 6 }]} numberOfLines={2}>
                                  {app.name}
                                </Text>
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
                                    handleDismissDevApp(app.packageId || app.id);
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  activeOpacity={0.6}
                                >
                                  <Ionicons name="close" size={13} color={colors.textMuted} />
                                </TouchableOpacity>
                              </View>

                              <Text style={[styles.appPackageId, { color: colors.textMuted }]} numberOfLines={1}>
                                {app.packageId}
                              </Text>

                              <View style={styles.appMetaRow}>
                                {app.score !== undefined && (
                                  <View style={styles.ratingBadge}>
                                    <Ionicons name="star" size={13} color="#f59e0b" />
                                    <Text style={styles.ratingText}>{app.scoreText || app.score}</Text>
                                  </View>
                                )}
                                <View style={[styles.priceTag, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#e6f4ea' }]}>
                                  <Text style={styles.priceTagText}>
                                    {app.free ? 'Free' : (app.price || 'Store')}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>

                          {app.summary && (
                            <Text style={[styles.appSummary, { color: colors.textSecondary }]} numberOfLines={2}>
                              {app.summary.replace(/<[^>]*>/g, '')}
                            </Text>
                          )}

                          {/* App Action Buttons */}
                          <View style={styles.appActionsRow}>
                            <TouchableOpacity
                              style={[styles.appStoreBtn, { backgroundColor: '#01875f' }]}
                              onPress={() => handleOpenPlayStoreUrl(app.playStoreUrl)}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="logo-google-playstore" size={15} color="#ffffff" />
                              <Text style={styles.appStoreBtnText}>Open in Play Store ↗</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.appTrackBtn,
                                {
                                  backgroundColor: isTracked ? 'rgba(16, 185, 129, 0.15)' : isDark ? colors.surfaceElevated : '#f8fafc',
                                  borderColor: isTracked ? '#10b981' : colors.border,
                                },
                              ]}
                              onPress={() => handleTrackApp(app)}
                              disabled={isTracked}
                              activeOpacity={0.8}
                            >
                              <Ionicons
                                name={isTracked ? 'checkmark' : 'add'}
                                size={15}
                                color={isTracked ? '#10b981' : colors.text}
                              />
                              <Text style={[styles.appTrackBtnText, { color: isTracked ? '#10b981' : colors.text }]}>
                                {isTracked ? 'Tracked' : 'Track in App'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              /* VIEW A: DEVELOPER SEARCH BAR & MATCHING RESULTS */
              <View style={styles.searchSection}>
                {/* Search Bar Input */}
                <Card elevated style={[styles.searchBarCard, { borderColor: colors.border }]}>
                  <Text style={[styles.searchBarTitle, { color: colors.text }]}>
                    Universal Google Play Developer Search
                  </Text>
                  <Text style={[styles.searchBarSubtitle, { color: colors.textSecondary }]}>
                    Search any public Google Play developer account worldwide to view all published apps.
                  </Text>

                  <View style={[styles.searchInputContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderColor: colors.border }]}>
                    <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      placeholder="e.g. Student Factory, Google LLC, Adobe..."
                      placeholderTextColor={colors.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={() => handleSearchDevelopers()}
                      returnKeyType="search"
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          setHasSearched(false);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.searchSubmitBtn, { backgroundColor: '#01875f', opacity: isSearching ? 0.7 : 1 }]}
                    onPress={() => handleSearchDevelopers()}
                    disabled={isSearching}
                    activeOpacity={0.8}
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="search" size={16} color="#ffffff" />
                        <Text style={styles.searchSubmitBtnText}>Search Developers</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Suggestion Chips */}
                  <View style={styles.suggestionsSection}>
                    <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>
                      Try Popular Developers:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                      {POPULAR_DEVELOPER_SUGGESTIONS.map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={[styles.suggestionChip, { backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9', borderColor: colors.borderSubtle }]}
                          onPress={() => handleSearchDevelopers(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.suggestionChipText, { color: colors.text }]}>
                            {item}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </Card>

                {/* Error Banner */}
                {searchError && (
                  <View style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', borderColor: '#ef4444' }]}>
                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                    <Text style={[styles.alertText, { color: '#ef4444' }]}>{searchError}</Text>
                    <TouchableOpacity
                      style={[styles.retrySmallBtn, { backgroundColor: '#ef4444' }]}
                      onPress={() => handleSearchDevelopers()}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Loading State */}
                {isSearching && (
                  <View style={styles.devLoadingBox}>
                    <ActivityIndicator size="large" color="#01875f" />
                    <Text style={[styles.devLoadingText, { color: colors.textSecondary }]}>
                      Searching Google Play developer accounts...
                    </Text>
                  </View>
                )}

                {/* Empty Results State */}
                {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
                  <EmptyState
                    title="No Developers Found"
                    description={`No public Google Play developer accounts found matching "${searchQuery}". Check the spelling or try searching another developer.`}
                  />
                )}

                {/* Initial Welcome Hero Card (when user hasn't searched yet) */}
                {!isSearching && !hasSearched && (
                  <Card elevated style={[styles.welcomeHeroCard, { borderColor: colors.borderSubtle }]}>
                    <View style={styles.welcomeHeroIcon}>
                      <Ionicons name="earth" size={32} color="#01875f" />
                    </View>
                    <Text style={[styles.welcomeHeroTitle, { color: colors.text }]}>
                      Universal Multi-Developer Explorer
                    </Text>
                    <Text style={[styles.welcomeHeroDesc, { color: colors.textSecondary }]}>
                      Discover, inspect, and track applications published by ANY Android developer worldwide on Google Play. Type any name above or tap a suggestion to begin.
                    </Text>
                  </Card>
                )}

                {/* Matching Developers Results */}
                {!isSearching && searchResults.length > 0 && (
                  <View style={styles.devResultsSection}>
                    <View style={styles.resultsHeaderRow}>
                      <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                        MATCHING DEVELOPERS ({searchResults.length})
                      </Text>
                    </View>

                    {searchResults.map((dev) => (
                      <Card
                        key={dev.id}
                        elevated
                        style={[styles.devResultCard, { borderColor: colors.border }]}
                      >
                        <TouchableOpacity
                          onPress={() => handleSelectDeveloper(dev)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.devResultCardTop}>
                            <DeveloperAvatar name={dev.name} icon={dev.icon} size={46} />

                            <View style={styles.devResultCardInfo}>
                              <View style={styles.devNameRow}>
                                <Text style={[styles.devResultName, { color: colors.text }]}>
                                  {dev.name}
                                </Text>
                                {dev.verified && (
                                  <View style={styles.verifiedTag}>
                                    <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                                    <Text style={styles.verifiedTagText}>Verified</Text>
                                  </View>
                                )}
                              </View>

                              <Text style={[styles.devResultId, { color: colors.textMuted }]}>
                                ID: {dev.id || dev.name}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                                  setSearchResults((prev) => prev.filter((d) => d.id !== dev.id));
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="close" size={13} color={colors.textMuted} />
                              </TouchableOpacity>
                              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                            </View>
                          </View>

                          {/* Sample Apps Preview Chips */}
                          {dev.sampleApps && dev.sampleApps.length > 0 && (
                            <View style={styles.sampleAppsRow}>
                              <Text style={[styles.sampleAppsLabel, { color: colors.textMuted }]}>
                                Apps:
                              </Text>
                              {dev.sampleApps.map((s, idx) => (
                                <View
                                  key={idx}
                                  style={[
                                    styles.sampleAppChip,
                                    { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' },
                                  ]}
                                >
                                  <Text
                                    style={[styles.sampleAppChipText, { color: colors.textSecondary }]}
                                    numberOfLines={1}
                                  >
                                    {s}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* View Apps Action Bar */}
                          <View style={[styles.viewAppsBar, { borderTopColor: colors.borderSubtle }]}>
                            <Text style={styles.viewAppsBarText}>
                              View Published Apps →
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </Card>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        ) : (
          /* =================================================================== */
          /* TAB 2: CONNECTED CONSOLE ACCOUNT (OAUTH PRIVATE API)                */
          /* =================================================================== */
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: Math.max(insets.bottom, 24) + 24,
                maxWidth: 960,
                width: '100%',
                alignSelf: 'center',
              },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshingConsole}
                onRefresh={() => loadConsoleData(true)}
                tintColor={colors.primary}
              />
            }
          >
            {/* Error & Info Alerts */}
            {errorMessage && (
              <View
                style={[
                  styles.alertBanner,
                  {
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                    borderColor: '#ef4444',
                  },
                ]}
              >
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <Text style={[styles.alertText, { color: '#ef4444' }]}>{errorMessage}</Text>
              </View>
            )}

            {infoMessage && (
              <View
                style={[
                  styles.alertBanner,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    borderColor: '#10b981',
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                <Text style={[styles.alertText, { color: '#10b981' }]}>{infoMessage}</Text>
              </View>
            )}

            {isLoadingConsole ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#01875f" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading Play Console connection state...
                </Text>
              </View>
            ) : !consoleStatus.connected ? (
              /* CONNECT ACCOUNT PROMPT */
              <Card elevated style={styles.connectCard}>
                <View style={styles.connectIconWrap}>
                  <Ionicons name="logo-google-playstore" size={48} color="#01875f" />
                </View>

                <Text style={[styles.connectTitle, { color: colors.text }]}>
                  Connect Private Play Console Account
                </Text>
                <Text style={[styles.connectDesc, { color: colors.textSecondary }]}>
                  Authorize DomainPulse with Google Play Developer OAuth API to securely sync your private release tracks, internal builds, and reporting metrics.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    Play Console Developer Account ID (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    placeholder="e.g. 1234567890123456789"
                    placeholderTextColor={colors.textMuted}
                    value={developerAccountIdInput}
                    onChangeText={setDeveloperAccountIdInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, { opacity: isConnecting ? 0.7 : 1 }]}
                  onPress={handleContinueWithGoogle}
                  disabled={isConnecting}
                  activeOpacity={0.8}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <GoogleGLogo size={22} />
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Card>
            ) : (
              /* CONNECTED CONSOLE ACCOUNT VIEW */
              <View style={styles.connectedSection}>
                <Card elevated style={styles.accountCard}>
                  <View style={styles.accountCardHeader}>
                    <View style={styles.connectedBadgeWrap}>
                      <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                    <TouchableOpacity onPress={handleDisconnect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.accountEmail, { color: colors.text }]}>
                    {consoleStatus.googleAccount?.email || 'Connected Google Account'}
                  </Text>
                  <Text style={[styles.accountIdText, { color: colors.textSecondary }]}>
                    Dev ID: {consoleStatus.developerAccount?.id || 'Unassigned'}
                  </Text>

                  <View style={styles.consoleBtnRow}>
                    <TouchableOpacity
                      style={[styles.consoleSmallBtn, { backgroundColor: '#01875f' }]}
                      onPress={handleRefreshToken}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>🔄 Refresh Sync</Text>
                    </TouchableOpacity>
                  </View>
                </Card>

                {/* Console Apps List */}
                <View style={{ marginTop: 20 }}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary, marginBottom: 12 }]}>
                    MANAGED APPLICATIONS ({consoleApps.length})
                  </Text>
                  {consoleApps.length === 0 ? (
                    <EmptyState
                      title="No Console Apps"
                      description="No authorized applications returned from Google Play Console API for this developer account."
                    />
                  ) : (
                    consoleApps.map((a) => (
                      <Card key={a.packageName} elevated style={[styles.appItemCard, { borderColor: colors.border }]}>
                        <Text style={[styles.appTitle, { color: colors.text }]}>{a.appName || a.packageName}</Text>
                        <Text style={[styles.appPackageId, { color: colors.textMuted }]}>{a.packageName}</Text>
                        <View style={{ marginTop: 8, flexDirection: 'row', gap: 6 }}>
                          <Badge label="Active" variant="success" />
                        </View>
                      </Card>
                    ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerIconBadge: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(1, 135, 95, 0.1)',
  },
  tabSwitcherWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  retrySmallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  searchSection: {
    gap: 16,
  },
  searchBarCard: {
    padding: 16,
    borderRadius: 14,
  },
  searchBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  searchBarSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  searchSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionsSection: {
    marginTop: 14,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  devLoadingBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  devLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeHeroCard: {
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    textAlign: 'center',
  },
  welcomeHeroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(1, 135, 95, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  welcomeHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeHeroDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  devResultsSection: {
    gap: 12,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  devResultCard: {
    padding: 14,
    borderRadius: 12,
  },
  devResultCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  devResultCardInfo: {
    flex: 1,
  },
  devNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  devResultName: {
    fontSize: 15,
    fontWeight: '800',
  },
  devResultId: {
    fontSize: 12,
    marginTop: 2,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  sampleAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  sampleAppsLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sampleAppChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 150,
  },
  sampleAppChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  viewAppsBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  viewAppsBarText: {
    color: '#01875f',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedDevContainer: {
    gap: 14,
  },
  backToSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  backToSearchText: {
    fontSize: 13,
    fontWeight: '700',
  },
  devHeaderCard: {
    padding: 16,
    borderRadius: 14,
  },
  devHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  devHeaderInfo: {
    flex: 1,
  },
  devHeaderName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  devHeaderId: {
    fontSize: 12,
    marginTop: 2,
  },
  devHeaderActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  openStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  openStoreBtnText: {
    color: '#01875f',
    fontSize: 13,
    fontWeight: '700',
  },
  appsFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  appsFilterInput: {
    flex: 1,
    fontSize: 13,
  },
  appsListSection: {
    gap: 12,
    marginTop: 4,
  },
  appItemCard: {
    padding: 14,
    borderRadius: 12,
  },
  appCardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  appIconImg: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  appIconPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCardInfo: {
    flex: 1,
  },
  appTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  appPackageId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  appMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  priceTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  appSummary: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  appActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  appStoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  appStoreBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  appTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  appTrackBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    textAlign: 'center',
  },
  connectIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(1, 135, 95, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  connectTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  connectDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  googleBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 10,
  },
  googleBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  connectedSection: {
    gap: 16,
  },
  accountCard: {
    padding: 16,
    borderRadius: 14,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  connectedBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectedBadgeText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
  },
  accountEmail: {
    fontSize: 16,
    fontWeight: '800',
  },
  accountIdText: {
    fontSize: 13,
    marginTop: 2,
  },
  consoleBtnRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  consoleSmallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
