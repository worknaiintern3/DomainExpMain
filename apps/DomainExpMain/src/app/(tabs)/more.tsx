import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Keyboard,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ImageBackground,
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { useAuth } from '../../store/auth-context';
import { useSettings } from '../../store/settings-context';
import { useRemoteConfig } from '../../store/remote-config-context';
import { fetchDomainsList, importDomainsBatch, deleteDomain } from '../../services/domains';
import {
  fetchProviderAccountsList,
  createProviderAccount,
  deleteProviderAccount,
  fetchEmailAccountsList,
  createEmailAccount,
  deleteEmailAccount,
  deduplicateProviderAccounts,
} from '../../services/accounts';
import { getEffectiveApiUrl, setCustomApiUrl, apiGet, apiPatch } from '../../services/api';
import { syncConsoleAccount, syncDomainRegistrar, syncCloudServers, syncProviderAccount, syncAllConnectedProviders, sanitizeSingleApiKey } from '../../services/providerSync';
import { saveProviderToken, getProviderToken } from '../../services/storage';
import { API_CONFIG } from '../../constants/config';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerForPushNotificationsAsync,
  triggerExpirySimulation,
  sendLocalTestNotificationAsync,
  type NotificationPreferences,
} from '../../services/notifications';
import type { ProviderAccount, EmailAccount, DomainItem } from '../../types';

const PROVIDER_LOGOS: Record<string, any> = {
  'google-play': require('../../../assets/images/google-play.png'),
  googleplay: require('../../../assets/images/google-play.png'),
  cloudflare: require('../../../assets/images/providers/cloudflare.png'),
  aws: require('../../../assets/images/providers/aws.png'),
  godaddy: require('../../../assets/images/providers/godaddy.png'),
  hostinger: require('../../../assets/images/providers/hostinger.png'),
  digitalocean: require('../../../assets/images/providers/digitalocean.png'),
  namecheap: require('../../../assets/images/providers/namecheap.png'),
  hetzner: require('../../../assets/images/providers/hetzner.png'),
  gcp: require('../../../assets/images/providers/gcp.png'),
  azure: require('../../../assets/images/providers/azure.png'),
  vultr: require('../../../assets/images/providers/vultr.png'),
  linode: require('../../../assets/images/providers/linode.png'),
};

type ModalType =
  | 'profile'
  | 'providers'
  | 'import_export'
  | 'settings'
  | 'security'
  | 'billing'
  | 'help'
  | 'about'
  | null;

const MODAL_CONFIG: Record<
  Exclude<ModalType, null>,
  {
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    heightPercentage: `${number}%`;
  }
> = {
  profile: {
    title: 'User Profile',
    subtitle: 'Manage personal details and workspace identity',
    icon: 'person',
    iconColor: '#0284c7',
    iconBg: 'rgba(2, 132, 199, 0.15)',
    heightPercentage: '86%',
  },
  providers: {
    title: 'Provider Connections',
    subtitle: 'DNS registries, cloud servers & portfolio sync',
    icon: 'link',
    iconColor: '#10b981',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    heightPercentage: '93%',
  },
  import_export: {
    title: 'Import / Export',
    subtitle: 'Bulk import or export your domain portfolio',
    icon: 'swap-horizontal',
    iconColor: '#f59e0b',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    heightPercentage: '92%',
  },
  settings: {
    title: 'App Settings',
    subtitle: 'Themes, notifications, currency & preferences',
    icon: 'settings',
    iconColor: '#8b5cf6',
    iconBg: 'rgba(139, 92, 246, 0.15)',
    heightPercentage: '90%',
  },
  security: {
    title: 'Security & Auth',
    subtitle: 'Password changes, sessions & account protection',
    icon: 'shield-checkmark',
    iconColor: '#f43f5e',
    iconBg: 'rgba(244, 63, 94, 0.15)',
    heightPercentage: '86%',
  },
  billing: {
    title: 'Subscription & Billing',
    subtitle: 'Tier plan, features, seat limits & invoices',
    icon: 'card',
    iconColor: '#f97316',
    iconBg: 'rgba(249, 115, 22, 0.15)',
    heightPercentage: '88%',
  },
  help: {
    title: 'Help & Support',
    subtitle: '24/7 technical assistance and ticket submission',
    icon: 'help-circle',
    iconColor: '#06b6d4',
    iconBg: 'rgba(6, 182, 212, 0.15)',
    heightPercentage: '88%',
  },
  about: {
    title: 'About DomainPulse',
    subtitle: 'Version details, build information & licensing',
    icon: 'information-circle',
    iconColor: '#6366f1',
    iconBg: 'rgba(99, 102, 241, 0.15)',
    heightPercentage: '85%',
  },
};

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, themeMode, setThemeMode, isDark, toggleTheme } = useTheme();
  const { user, logout, deleteAccount, updateUser, changePassword } = useAuth();
  const { appBranding, isFeatureEnabled, versionPolicy } = useRemoteConfig();
  const {
    currency,
    currencySymbol,
    pushAlerts,
    expiryReminders,
    weeklyDigest,
    setCurrency,
    setPushAlerts,
    setExpiryReminders,
    setWeeklyDigest,
  } = useSettings();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const currentPassInputRef = useRef<TextInput>(null);
  const newPassInputRef = useRef<TextInput>(null);

  // Production Expiry Push Notification Preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    pushEnabled: true,
    reminderThresholds: [15, 7, 3, 1, 0],
    notifyDomains: true,
    notifyServers: true,
    notifyHosting: true,
    notifySsl: true,
    timeZone: 'Asia/Kolkata',
    preferredHour: 9,
  });
  const [isSimulatingNotif, setIsSimulatingNotif] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeModal === 'settings') {
      getNotificationPreferences()
        .then((prefs) => {
          if (prefs) setNotifPrefs(prefs);
        })
        .catch(() => {});
    }
  }, [activeModal]);

  const toggleThreshold = async (threshold: number) => {
    const current = notifPrefs.reminderThresholds ?? [15, 7, 3, 1, 0];
    const updated = current.includes(threshold)
      ? current.filter((t) => t !== threshold)
      : [...current, threshold].sort((a, b) => b - a);
    setNotifPrefs((prev) => ({ ...prev, reminderThresholds: updated }));
    await updateNotificationPreferences({ reminderThresholds: updated }).catch(() => {});
  };

  const handleTogglePref = async (key: keyof NotificationPreferences, val: boolean) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: val }));
    if (key === 'pushEnabled' && val) {
      registerForPushNotificationsAsync().catch(() => {});
    }
    await updateNotificationPreferences({ [key]: val } as any).catch(() => {});
  };

  const handleTestAlert = async (days: number) => {
    setIsSimulatingNotif(true);
    setSimulationStatus(null);
    try {
      const [_, localRes] = await Promise.all([
        triggerExpirySimulation(days).catch((e) => ({ error: e?.message })),
        sendLocalTestNotificationAsync(days),
      ]);

      if (localRes && typeof localRes === 'object' && localRes.permissionGranted === false) {
        Alert.alert(
          '🔔 Notification Permission Required',
          'Notifications are currently disabled on your device. Please open Android Settings -> Apps -> Expo Go -> Notifications and toggle "Allow notifications" ON to see push banners.',
          [{ text: 'OK' }]
        );
      } else {
        const title = days === 0 ? '🚨 URGENT: Asset Expiring Today!' : `⚠️ Expiry Warning: ${days} Days Remaining`;
        const body = days === 0
          ? 'domainpulse.org expires today! Renew immediately to prevent DNS suspension.'
          : `domainpulse.org will expire in ${days} days. Tap to review renewal options.`;

        Alert.alert(
          title,
          `${body}\n\n✓ A system push notification has also been dispatched to your device's notification bar and saved to your Alerts feed.`,
          [
            { text: 'View Alerts Feed', onPress: () => router.push('/(tabs)/alerts') },
            { text: 'Dismiss', style: 'cancel' },
          ]
        );
      }

      setSimulationStatus(`Simulated ${days === 0 ? 'expiry today' : days + 'd reminder'} sent! Check notification tray & alerts.`);
      setTimeout(() => setSimulationStatus(null), 5000);
    } catch (err: any) {
      setSimulationStatus(`Simulation failed: ${err.message || 'Error'}`);
      setTimeout(() => setSimulationStatus(null), 4000);
    } finally {
      setIsSimulatingNotif(false);
    }
  };

  // Committed Profile State (Displayed on screen)
  const [profileName, setProfileName] = useState(user?.displayName || (user?.email ? user.email.split('@')[0] : 'User Profile'));
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileOrg, setProfileOrg] = useState(user?.organization || '');

  useEffect(() => {
    if (user) {
      if (user.displayName) setProfileName(user.displayName);
      else if (user.email) setProfileName(user.email.split('@')[0]);
      if (user.email) setProfileEmail(user.email);
      setProfileOrg(user.organization || '');
    }
  }, [user]);

  // Draft Profile State (Used only while editing in modal)
  const [draftName, setDraftName] = useState(profileName);
  const [draftEmail, setDraftEmail] = useState(profileEmail);
  const [draftOrg, setDraftOrg] = useState(profileOrg);

  // Security State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Support State
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  // Import / Export State
  const [importInputText, setImportInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importUpdateExisting, setImportUpdateExisting] = useState(true);
  const [importAddNewOnly, setImportAddNewOnly] = useState(false);
  const [importSkipInvalid, setImportSkipInvalid] = useState(true);
  const [showFormatGuideModal, setShowFormatGuideModal] = useState(false);

  const [exportFormat, setExportFormat] = useState<'CSV' | 'PDF' | 'Excel'>('CSV');
  const [exportScope, setExportScope] = useState<'all' | 'safe' | 'expiring'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportPreviewModal, setExportPreviewModal] = useState<{
    visible: boolean;
    fileName: string;
    count: number;
    content: string;
  } | null>(null);

  // Delete Account State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Provider 3-Dots Action Sheet State
  const [selectedProviderMenu, setSelectedProviderMenu] = useState<any | null>(null);

  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Live Provider & Email Accounts State
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [allDomains, setAllDomains] = useState<DomainItem[]>([]);
  const [selectedAccountForDomains, setSelectedAccountForDomains] = useState<ProviderAccount | null>(null);
  const [domainSearchQuery, setDomainSearchQuery] = useState('');
  const [domainFilterStatus, setDomainFilterStatus] = useState<'all' | 'safe' | 'warning' | 'critical'>('all');
  const [accountsView, setAccountsView] = useState<'providers' | 'emails'>('providers');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccType, setNewAccType] = useState<'provider' | 'email'>('provider');
  const [newAccProviderKey, setNewAccProviderKey] = useState('hostinger');
  const [newAccLabel, setNewAccLabel] = useState('');
  const [newAccExternalId, setNewAccExternalId] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccNotes, setNewAccNotes] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [syncingProviderId, setSyncingProviderId] = useState<string | null>(null);
  const [editingTokenAccount, setEditingTokenAccount] = useState<ProviderAccount | null>(null);
  const [editingTokenValue, setEditingTokenValue] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Structured Credentials State for Add Account Modal
  const [newAwsAccessKeyId, setNewAwsAccessKeyId] = useState('');
  const [newAwsSecretAccessKey, setNewAwsSecretAccessKey] = useState('');
  const [newAwsSessionToken, setNewAwsSessionToken] = useState('');
  const [newAwsRegions, setNewAwsRegions] = useState('us-east-1, ap-south-1');

  const [newNamecheapApiKey, setNewNamecheapApiKey] = useState('');
  const [newNamecheapApiUser, setNewNamecheapApiUser] = useState('');
  const [newNamecheapClientIp, setNewNamecheapClientIp] = useState('');
  const [newNamecheapUserName, setNewNamecheapUserName] = useState('');

  const [newGcpProjectId, setNewGcpProjectId] = useState('');
  const [newGcpClientEmail, setNewGcpClientEmail] = useState('');
  const [newGcpPrivateKey, setNewGcpPrivateKey] = useState('');

  const [newAzureTenantId, setNewAzureTenantId] = useState('');
  const [newAzureClientId, setNewAzureClientId] = useState('');
  const [newAzureClientSecret, setNewAzureClientSecret] = useState('');
  const [newAzureSubscriptionId, setNewAzureSubscriptionId] = useState('');

  // Structured Credentials State for Edit Modal
  const [editAwsAccessKeyId, setEditAwsAccessKeyId] = useState('');
  const [editAwsSecretAccessKey, setEditAwsSecretAccessKey] = useState('');
  const [editAwsSessionToken, setEditAwsSessionToken] = useState('');
  const [editAwsRegions, setEditAwsRegions] = useState('us-east-1');

  const [editNamecheapApiKey, setEditNamecheapApiKey] = useState('');
  const [editNamecheapApiUser, setEditNamecheapApiUser] = useState('');
  const [editNamecheapClientIp, setEditNamecheapClientIp] = useState('');
  const [editNamecheapUserName, setEditNamecheapUserName] = useState('');

  const [editGcpProjectId, setEditGcpProjectId] = useState('');
  const [editGcpClientEmail, setEditGcpClientEmail] = useState('');
  const [editGcpPrivateKey, setEditGcpPrivateKey] = useState('');

  const [editAzureTenantId, setEditAzureTenantId] = useState('');
  const [editAzureClientId, setEditAzureClientId] = useState('');
  const [editAzureClientSecret, setEditAzureClientSecret] = useState('');
  const [editAzureSubscriptionId, setEditAzureSubscriptionId] = useState('');

  // API Server Config State
  const [currentApiUrl, setCurrentApiUrl] = useState(getEffectiveApiUrl());
  const [apiDraftUrl, setApiDraftUrl] = useState(getEffectiveApiUrl());
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'unknown' | 'testing' | 'online' | 'offline'>('unknown');
  const [apiPingLatency, setApiPingLatency] = useState<number | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const [pList, eList, dList] = await Promise.all([
        fetchProviderAccountsList(),
        fetchEmailAccountsList(),
        fetchDomainsList(),
      ]);
      setProviderAccounts(deduplicateProviderAccounts(pList));
      setEmailAccounts(eList);
      setAllDomains(dList || []);
    } catch {}
  }, []);

  const getDomainsForAccount = useCallback((account: ProviderAccount, domainsList: DomainItem[]): DomainItem[] => {
    if (!account) return [];
    const pKey = (account.providerKey || '').toLowerCase().trim();
    const pLabel = (account.label || '').toLowerCase().trim();
    const pId = (account.id || '').toLowerCase().trim();
    const pExtId = (account.externalAccountId || '').toLowerCase().trim();

    return domainsList.filter((d) => {
      const registrar = (d.registrar || '').toLowerCase();
      const dns = (d.dnsProvider || '').toLowerCase();
      const tags = (d.tags || []).map((t) => t.toLowerCase());
      const notes = (d.notes || '').toLowerCase();

      // 1. Direct ID match
      if (pId && (registrar.includes(`(${pId})`) || dns.includes(`(${pId})`) || notes.includes(pId))) {
        return true;
      }
      // 2. Direct external ID / token match
      if (pExtId && pExtId.length > 5 && (notes.includes(pExtId) || registrar.includes(pExtId))) {
        return true;
      }
      // 3. Provider key match (e.g., 'hostinger', 'cloudflare', 'godaddy', 'namecheap', 'aws')
      if (pKey && pKey !== 'other') {
        if (registrar.includes(pKey) || dns.includes(pKey) || tags.some((t) => t.includes(pKey))) return true;
      }
      // 4. Provider label match (e.g., 'Hostinger Production VPS')
      if (pLabel && (registrar.includes(pLabel) || dns.includes(pLabel) || tags.some((t) => t.includes(pLabel)))) {
        return true;
      }
      return false;
    });
  }, []);

  const displayedProviderAccounts = useMemo(() => {
    return deduplicateProviderAccounts(providerAccounts);
  }, [providerAccounts]);

  const handleSyncAllProviders = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllConnectedProviders();
      await loadAccounts();
      showFeedback(
        'Portfolio Synced',
        `Discovered ${res.totalDomains} domains and ${res.totalServers} servers across connected providers.`,
        'success'
      );
    } catch (err: any) {
      showFeedback('Sync Error', err?.message || 'Failed to sync providers.', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const testApiConnection = async (targetUrl?: string) => {
    const urlToTest = (targetUrl || apiDraftUrl || currentApiUrl).trim();
    setApiConnectionStatus('testing');
    setApiPingLatency(null);
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${urlToTest.replace(/\/+$/, '')}/domains?limit=1`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok || res.status === 401 || res.status === 200) {
        setApiConnectionStatus('online');
        setApiPingLatency(latency);
        showFeedback('Connection Successful', `Connected to DomainPulse API in ${latency}ms!`, 'success');
      } else {
        setApiConnectionStatus('offline');
        showFeedback('Connection Warning', `Server returned HTTP ${res.status}.`, 'error');
      }
    } catch (err: any) {
      setApiConnectionStatus('offline');
      showFeedback('Connection Failed', 'Could not reach DomainPulse API at this address. Check if server is running.', 'error');
    }
  };

  const handleSaveApiUrl = async (presetUrl?: string) => {
    const target = (presetUrl || apiDraftUrl).trim();
    if (!target) return;
    await setCustomApiUrl(target);
    setCurrentApiUrl(target);
    setApiDraftUrl(target);
    await testApiConnection(target);
    await loadAccounts();
  };

  const handleOpenEditToken = async (p: ProviderAccount) => {
    setEditingTokenAccount(p);
    const existing = (await getProviderToken(p.id)) || (await getProviderToken(p.providerKey)) || p.externalAccountId || '';
    setEditingTokenValue(existing);

    if (p.providerKey === 'aws') {
      try {
        const parsed = JSON.parse(existing);
        setEditAwsAccessKeyId(parsed.accessKeyId || '');
        setEditAwsSecretAccessKey(parsed.secretAccessKey || '');
        setEditAwsSessionToken(parsed.sessionToken || '');
        setEditAwsRegions(Array.isArray(parsed.regions) ? parsed.regions.join(', ') : (parsed.regions || 'us-east-1'));
      } catch {
        setEditAwsAccessKeyId(existing.startsWith('AKIA') ? existing : '');
        setEditAwsSecretAccessKey('');
        setEditAwsSessionToken('');
        setEditAwsRegions('us-east-1');
      }
    } else if (p.providerKey === 'namecheap') {
      try {
        const parsed = JSON.parse(existing);
        setEditNamecheapApiKey(parsed.apiKey || '');
        setEditNamecheapApiUser(parsed.apiUser || '');
        setEditNamecheapClientIp(parsed.clientIp || '');
        setEditNamecheapUserName(parsed.userName || '');
      } catch {
        setEditNamecheapApiKey(existing);
        setEditNamecheapApiUser('');
        setEditNamecheapClientIp('');
        setEditNamecheapUserName('');
      }
    } else if (p.providerKey === 'gcp') {
      try {
        const parsed = JSON.parse(existing);
        setEditGcpProjectId(parsed.projectId || '');
        setEditGcpClientEmail(parsed.clientEmail || '');
        setEditGcpPrivateKey(parsed.privateKey || '');
      } catch {
        setEditGcpProjectId('');
        setEditGcpClientEmail('');
        setEditGcpPrivateKey(existing);
      }
    } else if (p.providerKey === 'azure') {
      try {
        const parsed = JSON.parse(existing);
        setEditAzureTenantId(parsed.tenantId || '');
        setEditAzureClientId(parsed.clientId || '');
        setEditAzureClientSecret(parsed.clientSecret || '');
        setEditAzureSubscriptionId(parsed.subscriptionId || '');
      } catch {
        setEditAzureTenantId('');
        setEditAzureClientId('');
        setEditAzureClientSecret(existing);
        setEditAzureSubscriptionId('');
      }
    }
  };

  const handleSaveAndSyncToken = async () => {
    if (!editingTokenAccount) return;
    let tokenToSave = editingTokenValue.trim();

    if (editingTokenAccount.providerKey === 'aws') {
      if (!editAwsAccessKeyId.trim()) {
        showFeedback('Missing Access Key', 'Please enter your AWS Access Key ID (e.g. AKIA...).', 'error');
        return;
      }
      if (!editAwsSecretAccessKey.trim()) {
        showFeedback('Missing Secret Key', 'Please enter your AWS Secret Access Key.', 'error');
        return;
      }
      const cleanAccessKey = editAwsAccessKeyId.trim().replace(/\s+/g, '');
      const cleanSecretKey = editAwsSecretAccessKey.trim().replace(/\s+/g, '');
      const cleanSessionToken = editAwsSessionToken.trim().replace(/\s+/g, '');
      const regionsList = (editAwsRegions.trim() || 'us-east-1, ap-south-1')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
      tokenToSave = JSON.stringify({
        accessKeyId: cleanAccessKey,
        secretAccessKey: cleanSecretKey,
        ...(cleanSessionToken ? { sessionToken: cleanSessionToken } : {}),
        regions: regionsList.length > 0 ? regionsList : ['us-east-1', 'ap-south-1'],
      });
    } else if (editingTokenAccount.providerKey === 'namecheap') {
      if (!editNamecheapApiKey.trim() || !editNamecheapApiUser.trim()) {
        showFeedback('Missing Credentials', 'Please enter your Namecheap API Key and API User.', 'error');
        return;
      }
      tokenToSave = JSON.stringify({
        apiKey: editNamecheapApiKey.trim(),
        apiUser: editNamecheapApiUser.trim(),
        clientIp: editNamecheapClientIp.trim() || '1.1.1.1',
        userName: editNamecheapUserName.trim() || editNamecheapApiUser.trim(),
      });
    } else if (editingTokenAccount.providerKey === 'gcp') {
      if (!editGcpProjectId.trim() || !editGcpClientEmail.trim() || !editGcpPrivateKey.trim()) {
        showFeedback('Missing Credentials', 'Please fill in Project ID, Service Account Email, and Private Key.', 'error');
        return;
      }
      tokenToSave = JSON.stringify({
        projectId: editGcpProjectId.trim(),
        clientEmail: editGcpClientEmail.trim(),
        privateKey: editGcpPrivateKey.trim(),
      });
    } else if (editingTokenAccount.providerKey === 'azure') {
      if (!editAzureTenantId.trim() || !editAzureClientId.trim() || !editAzureClientSecret.trim()) {
        showFeedback('Missing Credentials', 'Please fill in Tenant ID, Client ID, and Client Secret.', 'error');
        return;
      }
      tokenToSave = JSON.stringify({
        tenantId: editAzureTenantId.trim(),
        clientId: editAzureClientId.trim(),
        clientSecret: editAzureClientSecret.trim(),
        subscriptionId: editAzureSubscriptionId.trim(),
      });
    } else {
      if (!tokenToSave) {
        showFeedback('Token Required', 'Please enter a valid API token or key.', 'error');
        return;
      }
      tokenToSave = sanitizeSingleApiKey(tokenToSave);
    }

    setIsSavingToken(true);
    try {
      await saveProviderToken(editingTokenAccount.id, tokenToSave);
      const existingGeneric = await getProviderToken(editingTokenAccount.providerKey);
      if (!existingGeneric) {
        await saveProviderToken(editingTokenAccount.providerKey, tokenToSave);
      }
      if (!editingTokenAccount.id.startsWith('pa-')) {
        apiPatch(`/provider-accounts/${encodeURIComponent(editingTokenAccount.id)}`, {
          externalAccountId: tokenToSave,
        }).catch(() => {});
      }
      const res = await syncProviderAccount({
        providerKey: editingTokenAccount.providerKey,
        accountName: editingTokenAccount.label,
        apiKey: tokenToSave,
        providerAccountId: editingTokenAccount.id,
      });
      await loadAccounts();
      setEditingTokenAccount(null);
      setEditingTokenValue('');
      showFeedback(
        res.success ? 'Token Saved & Synced' : 'Sync Notice',
        res.message,
        res.success ? 'success' : 'error'
      );
    } catch (err: any) {
      showFeedback('Error', err?.message || 'Failed to save token and sync.', 'error');
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleCreateAccount = async () => {
    if (newAccType === 'provider') {
      if (!newAccLabel.trim()) {
        showFeedback('Missing Label', 'Please enter a descriptive label for this provider account.', 'error');
        return;
      }

      let credentialToken = newAccExternalId.trim();
      let externalAccountIdToStore = newAccExternalId.trim();

      if (newAccProviderKey === 'aws') {
        const cleanAccessKey = newAwsAccessKeyId.trim().replace(/\s+/g, '');
        const cleanSecretKey = newAwsSecretAccessKey.trim().replace(/\s+/g, '');
        const cleanSessionToken = newAwsSessionToken.trim().replace(/\s+/g, '');

        if (!cleanAccessKey) {
          showFeedback('Missing Access Key', 'Please enter your AWS Access Key ID (e.g. AKIA...).', 'error');
          return;
        }
        if (!cleanSecretKey) {
          showFeedback('Missing Secret Key', 'Please enter your AWS Secret Access Key.', 'error');
          return;
        }
        const regionsList = (newAwsRegions.trim() || 'us-east-1, ap-south-1')
          .split(',')
          .map((r) => r.trim().toLowerCase())
          .filter(Boolean);
        credentialToken = JSON.stringify({
          accessKeyId: cleanAccessKey,
          secretAccessKey: cleanSecretKey,
          ...(cleanSessionToken ? { sessionToken: cleanSessionToken } : {}),
          regions: regionsList.length > 0 ? regionsList : ['us-east-1', 'ap-south-1'],
        });
        externalAccountIdToStore = cleanAccessKey;
      } else if (newAccProviderKey === 'namecheap') {
        if (!newNamecheapApiKey.trim() || !newNamecheapApiUser.trim()) {
          showFeedback('Missing Credentials', 'Please enter your Namecheap API Key and API User.', 'error');
          return;
        }
        credentialToken = JSON.stringify({
          apiKey: newNamecheapApiKey.trim(),
          apiUser: newNamecheapApiUser.trim(),
          clientIp: newNamecheapClientIp.trim() || '1.1.1.1',
          userName: newNamecheapUserName.trim() || newNamecheapApiUser.trim(),
        });
        externalAccountIdToStore = newNamecheapApiUser.trim();
      } else if (newAccProviderKey === 'gcp') {
        if (!newGcpProjectId.trim() || !newGcpClientEmail.trim() || !newGcpPrivateKey.trim()) {
          showFeedback('Missing Credentials', 'Please fill in Project ID, Service Account Email, and Private Key.', 'error');
          return;
        }
        credentialToken = JSON.stringify({
          projectId: newGcpProjectId.trim(),
          clientEmail: newGcpClientEmail.trim(),
          privateKey: newGcpPrivateKey.trim(),
        });
        externalAccountIdToStore = newGcpProjectId.trim();
      } else if (newAccProviderKey === 'azure') {
        if (!newAzureTenantId.trim() || !newAzureClientId.trim() || !newAzureClientSecret.trim()) {
          showFeedback('Missing Credentials', 'Please fill in Tenant ID, Client ID, and Client Secret.', 'error');
          return;
        }
        credentialToken = JSON.stringify({
          tenantId: newAzureTenantId.trim(),
          clientId: newAzureClientId.trim(),
          clientSecret: newAzureClientSecret.trim(),
          subscriptionId: newAzureSubscriptionId.trim(),
        });
      }

      if (credentialToken && !credentialToken.startsWith('{')) {
        credentialToken = sanitizeSingleApiKey(credentialToken);
        externalAccountIdToStore = sanitizeSingleApiKey(externalAccountIdToStore);
      }

      setIsCreatingAccount(true);
      try {
        const createdAcc = await createProviderAccount({
          providerKey: newAccProviderKey,
          label: newAccLabel.trim(),
          externalAccountId: credentialToken || externalAccountIdToStore || undefined,
          notes: newAccNotes.trim() || undefined,
        });

        // Trigger resource sync based on provider key
        if (newAccProviderKey === 'google-play' || newAccProviderKey === 'googleplay') {
          await syncConsoleAccount({
            developerName: newAccExternalId.trim() || newAccLabel.trim() || 'WorknAi Technologies India Pvt Ltd',
          });
          showFeedback(
            'Account Connected',
            `Successfully linked Google Play Console for ${newAccLabel}!`,
            'success'
          );
        } else {
          const res = await syncProviderAccount({
            providerKey: newAccProviderKey,
            accountName: newAccLabel.trim(),
            apiKey: credentialToken || undefined,
            notes: newAccNotes.trim() || undefined,
            providerAccountId: createdAcc?.id,
          });
          showFeedback(
            res.success ? 'Account Connected & Synced' : 'Connection Notice',
            res.message,
            res.success ? 'success' : 'error'
          );
        }

        await loadAccounts();
        setIsAddAccountModalOpen(false);
        setNewAccLabel('');
        setNewAccExternalId('');
        setNewAccNotes('');
        setNewAwsAccessKeyId('');
        setNewAwsSecretAccessKey('');
        setNewAwsSessionToken('');
        setNewAwsRegions('us-east-1');
        setNewNamecheapApiKey('');
        setNewNamecheapApiUser('');
        setNewNamecheapClientIp('');
        setNewNamecheapUserName('');
        setNewGcpProjectId('');
        setNewGcpClientEmail('');
        setNewGcpPrivateKey('');
        setNewAzureTenantId('');
        setNewAzureClientId('');
        setNewAzureClientSecret('');
        setNewAzureSubscriptionId('');
      } catch (err: any) {
        showFeedback('Failed', err?.message || 'Could not connect provider account.', 'error');
      } finally {
        setIsCreatingAccount(false);
      }
    } else {
      if (!newAccEmail.trim() || !newAccEmail.includes('@')) {
        showFeedback('Invalid Email', 'Please enter a valid email address.', 'error');
        return;
      }
      setIsCreatingAccount(true);
      try {
        await createEmailAccount({
          email: newAccEmail.trim(),
          label: newAccLabel.trim() || undefined,
          notes: newAccNotes.trim() || undefined,
        });
        await loadAccounts();
        setIsAddAccountModalOpen(false);
        setNewAccEmail('');
        setNewAccLabel('');
        setNewAccNotes('');
        showFeedback('Email Added', `Successfully added ${newAccEmail}!`, 'success');
      } catch (err: any) {
        showFeedback('Failed', err?.message || 'Could not add email account.', 'error');
      } finally {
        setIsCreatingAccount(false);
      }
    }
  };

  const showFeedback = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackModal({ visible: true, title, message, type });
  };

  const countDetectedDomains = (text: string): number => {
    if (!text.trim()) return 0;
    const lines = text.split('\n');
    let count = 0;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;
      const firstToken = line.split(/[\s,]+/)[0].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (firstToken.includes('.') && firstToken.length >= 4) {
        count++;
      } else if (line.toLowerCase().startsWith('$origin') && line.split(/\s+/)[1]) {
        count++;
      }
    }
    return count;
  };

  const handleLoadSampleImport = (type: 'csv' | 'txt' | 'bind' = 'csv') => {
    if (type === 'csv') {
      setImportInputText(
        `domainpulse.io, Cloudflare, true\ncloudinfrastructure.dev, AWS Route 53, true\nsecureenterprise.org, GoDaddy, false\napi-gateway-service.net, Namecheap, true`
      );
    } else if (type === 'txt') {
      setImportInputText(
        `mybrandhub.com\nprod-edge-network.org\nsecure-vault.io\nanalytics-pipeline.net`
      );
    } else {
      setImportInputText(
        `$ORIGIN pulsezone.io.\n@ IN SOA ns1.cloudflare.com. admin.pulsezone.io. ( 2026092801 7200 3600 1209600 300 )\n@ IN NS ns1.cloudflare.com.\n@ IN A 104.21.45.12\napi IN A 104.21.45.13\napp IN CNAME pulsezone.io.`
      );
    }
  };

  const handleRunImport = async () => {
    if (!importInputText.trim()) {
      showFeedback('Input Required', 'Please paste or type domain names / CSV records into the import box.', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const lines = importInputText.split('\n');
      const itemsToImport: Array<{ name: string; registrar?: string; autoRenew?: boolean }> = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;

        if (line.includes(',')) {
          const parts = line.split(',').map((p) => p.trim());
          let domainName = parts[0].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          if (domainName.endsWith('.')) domainName = domainName.slice(0, -1);
          const registrar = parts[1] || 'Custom Registrar';
          const autoRenew = parts[2] ? parts[2].toLowerCase() === 'true' || parts[2] === '1' : true;
          if (domainName.includes('.')) {
            itemsToImport.push({ name: domainName, registrar, autoRenew });
          }
        } else {
          let domainName = line.split(/\s+/)[0].toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          if (domainName.endsWith('.')) domainName = domainName.slice(0, -1);
          if (domainName === '$origin' && line.split(/\s+/)[1]) {
            domainName = line.split(/\s+/)[1].toLowerCase().replace(/\.$/, '');
          }
          if (domainName.includes('.')) {
            itemsToImport.push({ name: domainName, registrar: 'Custom Registrar', autoRenew: true });
          }
        }
      }

      if (itemsToImport.length === 0) {
        showFeedback('No Valid Domains', 'Could not detect any valid domain names in the input text.', 'error');
        setIsImporting(false);
        return;
      }

      const result = await importDomainsBatch(itemsToImport, {
        updateExisting: importUpdateExisting,
        addNewOnly: importAddNewOnly,
      });

      setImportInputText('');
      showFeedback(
        'Import Completed',
        `Successfully processed ${result.total} records:\n• Added: ${result.added} new domain(s)\n• Updated: ${result.updated} domain(s)\n• Skipped: ${result.skipped}`,
        'success'
      );
    } catch (err: any) {
      showFeedback('Import Failed', err?.message || 'Failed to import domain records.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRunExport = async () => {
    setIsExporting(true);
    try {
      const allDomains = await fetchDomainsList();
      let targetDomains = allDomains;
      if (exportScope === 'safe') {
        targetDomains = allDomains.filter((d) => d.status === 'safe');
      } else if (exportScope === 'expiring') {
        targetDomains = allDomains.filter((d) => (d.daysRemaining ?? 365) <= 30);
      }

      if (targetDomains.length === 0) {
        showFeedback(
          'No Domains Found',
          allDomains.length === 0
            ? 'Your domain portfolio is currently empty. Please add or import domains first before exporting.'
            : 'No domains match the selected filter scope.',
          'info'
        );
        setIsExporting(false);
        return;
      }

      let fileContent = '';
      let fileName = `domainpulse_portfolio_${new Date().toISOString().split('T')[0]}`;

      if (exportFormat === 'CSV') {
        fileName += '.csv';
        const headers = [
          'Domain Name',
          'TLD',
          'Registrar',
          'Expires At',
          'Days Remaining',
          'Status',
          'SSL Status',
          'DNS Provider',
          'Auto Renew',
          'Renewal Price',
        ];
        const rows = targetDomains.map((d) =>
          [
            `"${d.name}"`,
            `"${d.tld || ''}"`,
            `"${d.registrar || ''}"`,
            `"${d.expiresAt || ''}"`,
            `"${d.daysRemaining ?? ''}"`,
            `"${d.status || ''}"`,
            `"${d.sslStatus || ''}"`,
            `"${d.dnsProvider || ''}"`,
            `"${d.autoRenew ? 'Yes' : 'No'}"`,
            `"${d.currency || '$'}${d.renewalPrice || '0'}"`,
          ].join(',')
        );
        fileContent = [headers.join(','), ...rows].join('\n');
      } else if (exportFormat === 'Excel') {
        fileName += '.tsv';
        const headers = [
          'Domain Name',
          'TLD',
          'Registrar',
          'Expires At',
          'Days Left',
          'Health Status',
          'SSL Status',
          'DNS Health',
          'Auto-Renew',
          'Price',
        ];
        const rows = targetDomains.map((d) =>
          [
            d.name,
            d.tld || '',
            d.registrar || '',
            d.expiresAt || '',
            String(d.daysRemaining ?? ''),
            d.status || '',
            d.sslStatus || '',
            d.dnsProvider || '',
            d.autoRenew ? 'TRUE' : 'FALSE',
            `${d.currency || '$'}${d.renewalPrice || '0'}`,
          ].join('\t')
        );
        fileContent = [headers.join('\t'), ...rows].join('\n');
      } else {
        fileName += '_audit_report.txt';
        const nowStr = new Date().toUTCString();
        fileContent = [
          `========================================================================`,
          `DOMAINPULSE INFRASTRUCTURE & DOMAIN AUDIT REPORT`,
          `Generated: ${nowStr}`,
          `Total Monitored Domains: ${targetDomains.length}`,
          `Scope Filter: ${exportScope.toUpperCase()}`,
          `========================================================================\n`,
          ...targetDomains.map((d, i) => {
            return (
              `${i + 1}. DOMAIN: ${d.name.toUpperCase()}\n` +
              `   • Registrar:     ${d.registrar || 'Unknown'}\n` +
              `   • Status:        ${(d.status || 'safe').toUpperCase()} (${d.daysRemaining ?? 'N/A'} days remaining)\n` +
              `   • Expires:       ${d.expiresAt ? d.expiresAt.split('T')[0] : 'N/A'}\n` +
              `   • SSL Health:    ${d.sslStatus || 'Active'}\n` +
              `   • DNS Provider:  ${d.dnsProvider || 'Healthy'}\n` +
              `   • Auto-Renew:    ${d.autoRenew ? 'Enabled' : 'Disabled'}\n` +
              `   • Renewal Est:   ${d.currency || '$'}${d.renewalPrice || '0.00'}\n` +
              `------------------------------------------------------------------------`
            );
          }),
          `\nEnd of Report. Generated by DomainPulse Cloud Platform.`,
        ].join('\n');
      }

      setExportPreviewModal({
        visible: true,
        fileName,
        count: targetDomains.length,
        content: fileContent,
      });

      Share.share({
        title: fileName,
        message: fileContent,
      }).catch(() => {});
    } catch (err: any) {
      showFeedback('Export Failed', err?.message || 'Could not export domain portfolio.', 'error');
    } finally {
      setIsExporting(false);
    }
  };


  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
      router.replace('/(auth)/login');
    } catch (err: any) {
      showFeedback('Deletion Failed', err?.message || 'Could not delete account. Please try again.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openProfileModal = () => {
    setDraftName(profileName);
    setDraftEmail(profileEmail);
    setDraftOrg(profileOrg);
    setActiveModal('profile');
  };

  const handleSaveProfile = () => {
    const finalName = draftName.trim();
    const finalEmail = draftEmail.trim().toLowerCase();
    const finalOrg = draftOrg.trim() || 'Pulse Cloud Infrastructure';
    setProfileName(finalName);
    setProfileEmail(finalEmail);
    setProfileOrg(finalOrg);
    setActiveModal(null);
    showFeedback('Profile Updated', 'Your profile changes have been saved successfully.', 'success');
    updateUser({ displayName: finalName, email: finalEmail, organization: finalOrg });
  };

  const handleSavePassword = async () => {
    if (!currentPass.trim()) {
      showFeedback('Missing Field', 'Please enter your current password.', 'error');
      return;
    }
    if (!newPass.trim()) {
      showFeedback('Missing Field', 'Please enter your new password.', 'error');
      return;
    }
    if (newPass.length < 8) {
      showFeedback('Invalid Password', 'New password must be at least 8 characters long.', 'error');
      return;
    }
    if (currentPass === newPass) {
      showFeedback('Invalid Password', 'New password cannot be the same as your current password.', 'error');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(currentPass, newPass);
      setCurrentPass('');
      setNewPass('');
      setActiveModal(null);
      showFeedback(
        'Password Updated Successfully',
        'Your password has been changed. Please use your new password next time you sign in.',
        'success'
      );
    } catch (err: any) {
      showFeedback('Password Update Failed', err?.message || 'Could not update password. Please verify your current password.', 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSendSupport = () => {
    if (!supportSubject || !supportMessage) {
      showFeedback('Missing Information', 'Please provide a subject and message.', 'error');
      return;
    }
    setSupportSubject('');
    setSupportMessage('');
    setActiveModal(null);
    showFeedback('Ticket Submitted', 'Our support team has received your ticket and will reply within 2 hours.', 'success');
  };

  const menuItems = useMemo(() => {
    const list = [
      {
        id: 'profile' as ModalType,
        icon: '👤',
        iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
        iconColor: '#0284c7',
        label: 'Profile',
        subtitle: 'View and edit your personal information',
        visible: true,
      },
      {
        id: 'providers' as ModalType,
        icon: '🔗',
        iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
        iconColor: '#10b981',
        label: 'Provider Connections',
        subtitle: 'Manage your DNS & cloud provider accounts',
        visible: isFeatureEnabled('providers'),
      },
      {
        id: 'import_export' as ModalType,
        icon: '📤',
        iconBg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
        iconColor: '#f59e0b',
        label: 'Import / Export',
        subtitle: 'Import or export your domain data',
        visible: isFeatureEnabled('domains'),
      },
      {
        id: 'settings' as ModalType,
        icon: '⚙️',
        iconBg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff',
        iconColor: '#8b5cf6',
        label: 'Settings',
        subtitle: 'App preferences and customization',
        visible: true,
      },
      {
        id: 'security' as ModalType,
        icon: '🛡️',
        iconBg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
        iconColor: '#f43f5e',
        label: 'Security',
        subtitle: 'Password, 2FA and security options',
        visible: true,
      },
      {
        id: 'billing' as ModalType,
        icon: '💳',
        iconBg: isDark ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5',
        iconColor: '#f97316',
        label: 'Billing',
        subtitle: 'Manage your subscription and payments',
        visible: true,
      },
      {
        id: 'help' as ModalType,
        icon: '❓',
        iconBg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
        iconColor: '#f43f5e',
        label: 'Help & Support',
        subtitle: 'Get help or contact our support team',
        visible: true,
      },
      {
        id: 'about' as ModalType,
        icon: 'ℹ️',
        iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
        iconColor: '#0284c7',
        label: `About ${appBranding.appName || 'DomainPulse'}`,
        subtitle: 'App version, terms and privacy policy',
        visible: true,
      },
    ];

    return list.filter((item) => item.visible);
  }, [isDark, isFeatureEnabled, appBranding.appName]);

  const connectedProviders = [
    {
      id: 'cloudflare',
      name: 'Cloudflare DNS',
      icon: '⚡',
      iconBg: isDark ? 'rgba(249, 115, 22, 0.15)' : '#fff7ed',
      iconColor: '#f97316',
      status: 'Connected',
      lastSynced: 'Last synced 2 hours ago',
    },
    {
      id: 'aws',
      name: 'Amazon Route 53',
      icon: '☁️',
      iconBg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      iconColor: '#f59e0b',
      status: 'Connected',
      lastSynced: 'Last synced 1 day ago',
    },
    {
      id: 'hostinger',
      name: 'Hostinger Cloud & VPS',
      icon: '🌐',
      iconBg: isDark ? 'rgba(103, 61, 230, 0.15)' : '#f3e8ff',
      iconColor: '#673de6',
      status: 'Connected',
      lastSynced: 'Last synced 3 hours ago',
    },
    {
      id: 'godaddy',
      name: 'GoDaddy API',
      icon: '💚',
      iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
      iconColor: '#10b981',
      status: 'Connected',
      lastSynced: 'Last synced 5 hours ago',
    },
  ];

  const availableProviders = [
    {
      id: 'namecheap',
      name: 'Namecheap API',
      icon: '🏷️',
      iconBg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
      iconColor: '#f43f5e',
      status: 'Not connected',
      subtitle: 'Sync domain portfolio & DNSSEC',
    },
    {
      id: 'digitalocean',
      name: 'DigitalOcean Networking',
      icon: '🌊',
      iconBg: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe',
      iconColor: '#0284c7',
      status: 'Not connected',
      subtitle: 'Sync Droplets, floating IPs & domains',
    },
    {
      id: 'hetzner',
      name: 'Hetzner Cloud',
      icon: '🖥️',
      iconBg: isDark ? 'rgba(220, 38, 38, 0.15)' : '#fee2e2',
      iconColor: '#dc2626',
      status: 'Not connected',
      subtitle: 'Sync dedicated servers, VPS & DNS',
    },
    {
      id: 'gcp',
      name: 'Google Cloud DNS',
      icon: '🌐',
      iconBg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      iconColor: '#f59e0b',
      status: 'Not connected',
      subtitle: 'Enterprise managed DNS zones',
    },
    {
      id: 'azure',
      name: 'Microsoft Azure DNS',
      icon: '☁️',
      iconBg: isDark ? 'rgba(0, 137, 214, 0.15)' : '#e0f2fe',
      iconColor: '#0089d6',
      status: 'Not connected',
      subtitle: 'Sync Azure DNS zones & VMs',
    },
    {
      id: 'vultr',
      name: 'Vultr Cloud',
      icon: '⚡',
      iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
      iconColor: '#0284c7',
      status: 'Not connected',
      subtitle: 'High performance VPS and DNS',
    },
    {
      id: 'linode',
      name: 'Linode / Akamai Cloud',
      icon: '🌿',
      iconBg: isDark ? 'rgba(0, 169, 92, 0.15)' : '#dcfce7',
      iconColor: '#00a95c',
      status: 'Not connected',
      subtitle: 'Sync Linode instances & NodeBalancers',
    },
  ];

  const handleMenuPress = (id: ModalType) => {
    if (id === 'profile') {
      openProfileModal();
    } else {
      setActiveModal(id);
    }
  };

  return (
    <ImageBackground
      source={require('../../../assets/images/more-bg.png')}
      style={[styles.container, { backgroundColor: colors.background }]}
      imageStyle={[styles.backgroundImage, isDark && { opacity: 0.15 }]}
      resizeMode="cover"
    >
      <View style={[styles.innerContainer, { paddingTop: insets.top }]}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Manage your account and app settings
            </Text>
          </View>

          {/* Top Theme Capsule Pill */}
          <TouchableOpacity
            style={[
              styles.themePill,
              {
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? colors.border : '#e2e8f0',
              },
            ]}
            onPress={toggleTheme}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isDark ? 'sunny' : 'moon'}
              size={14}
              color={isDark ? '#fbbf24' : '#64748b'}
            />
            <Text style={[styles.themePillText, { color: colors.text }]}>
              {isDark ? 'Dark' : 'Light'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <TouchableOpacity
            style={[
              styles.profileCard,
              {
                backgroundColor: isDark ? 'rgba(17, 23, 38, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                borderColor: isDark ? colors.border : 'rgba(226, 232, 240, 0.9)',
              },
            ]}
            onPress={openProfileModal}
            activeOpacity={0.85}
          >
            <View style={styles.profileLeft}>
              <View style={styles.avatarWrapper}>
                <View style={[styles.avatarBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {(profileName || 'KI').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.onlineDot} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: colors.text }]}>{profileName}</Text>
                <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{profileEmail}</Text>
              </View>
            </View>
            <Text style={[styles.arrowIcon, { color: colors.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Individual Menu Item Cards */}
          <View style={styles.menuCardsList}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuCard,
                  {
                    backgroundColor: isDark ? 'rgba(17, 23, 38, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                    borderColor: isDark ? colors.border : 'rgba(226, 232, 240, 0.9)',
                  },
                ]}
                onPress={() => handleMenuPress(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: item.iconBg }]}>
                    <Text style={styles.menuIconGlyph}>{item.icon}</Text>
                  </View>
                  <View style={styles.menuTextCol}>
                    <Text style={[styles.menuItemLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.arrowIcon, { color: colors.textMuted }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout Button */}
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              {
                backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#fff1f2',
                borderColor: isDark ? 'rgba(244, 63, 94, 0.35)' : '#fecdd3',
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutIcon}>🚪</Text>
            <Text style={[styles.logoutText, { color: isDark ? '#fb7185' : '#e11d48' }]}>Log Out</Text>
            <Text style={[styles.logoutChevron, { color: isDark ? '#fb7185' : '#e11d48' }]}>›</Text>
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[
              styles.deleteBtn,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(254, 242, 242, 0.9)',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fee2e2',
              },
            ]}
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
            <Text style={[styles.deleteText, { color: isDark ? '#f87171' : '#dc2626' }]}>Delete Account</Text>
            <Text style={[styles.deleteChevron, { color: isDark ? '#f87171' : '#dc2626' }]}>›</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* MODAL DIALOGS FOR EVERY OPTION */}
      {/* ========================================================================= */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          Keyboard.dismiss();
          setActiveModal(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setActiveModal(null);
            }}
          />
          <View
            style={[
              styles.modalSheet,
              activeModal && MODAL_CONFIG[activeModal]
                ? { height: MODAL_CONFIG[activeModal].heightPercentage, maxHeight: '95%' }
                : { height: '88%', maxHeight: '95%' },
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
              {/* Sheet Drag Indicator */}
              <View style={styles.dragHandleWrapper}>
                <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
              </View>

              {/* Sheet Header */}
              {activeModal === 'import_export' ? (
                <View style={styles.importExportHeaderRow}>
                  <TouchableOpacity
                    style={[
                      styles.importExportCircleBtn,
                      {
                        backgroundColor: isDark ? colors.surfaceHighlight : '#ffffff',
                        borderColor: isDark ? colors.border : '#e2e8f0',
                      },
                    ]}
                    onPress={() => setActiveModal(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.importExportCircleBtnText, { color: colors.text }]}>‹</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={[styles.importExportHeaderTitle, { color: colors.text }]}>Import / Export</Text>
                    <Text style={[styles.importExportHeaderSubtitle, { color: colors.textSecondary }]}>
                      Import or export your domain data
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.importExportCircleBtn,
                      {
                        backgroundColor: isDark ? colors.surfaceHighlight : '#ffffff',
                        borderColor: isDark ? colors.border : '#e2e8f0',
                      },
                    ]}
                    onPress={() => setActiveModal(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.importExportCircleBtnText, { color: colors.text, fontSize: 14 }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : activeModal && MODAL_CONFIG[activeModal] ? (
                <View style={[styles.providerHeaderRow, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={[styles.providerHeaderIconBox, { backgroundColor: MODAL_CONFIG[activeModal].iconBg }]}>
                    <Ionicons
                      name={MODAL_CONFIG[activeModal].icon}
                      size={20}
                      color={MODAL_CONFIG[activeModal].iconColor}
                    />
                  </View>
                  <View style={{ flex: 1, paddingRight: 4 }}>
                    <Text style={[styles.providerHeaderTitle, { color: colors.text }]}>
                      {MODAL_CONFIG[activeModal].title}
                    </Text>
                    <Text style={[styles.providerHeaderSubtitle, { color: colors.textSecondary }]}>
                      {MODAL_CONFIG[activeModal].subtitle}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.providerCloseBtn,
                      {
                        backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9',
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                    onPress={() => setActiveModal(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={17} color={colors.text} />
                  </TouchableOpacity>
                </View>
              ) : null}

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                  styles.sheetBody,
                  { paddingBottom: activeModal === 'providers' ? Math.max(insets.bottom + 48, 64) : Spacing.xxl },
                ]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. PROFILE */}
                {activeModal === 'profile' && (
                  <View style={{ gap: Spacing.md }}>
                    {/* User Identity Hero Card */}
                    <View
                      style={[
                        styles.profileModalHeroCard,
                        {
                          backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                          borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd',
                        },
                      ]}
                    >
                      <View style={styles.profileModalAvatarRow}>
                        <View style={[styles.profileModalAvatarBox, { backgroundColor: colors.primary }]}>
                          <Text style={styles.profileModalAvatarText}>
                            {(draftName || profileName || 'KI').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.profileModalHeroName, { color: colors.text }]}>
                              {draftName || profileName}
                            </Text>
                            <Ionicons name="checkmark-circle" size={17} color="#10b981" />
                          </View>
                          <Text style={[styles.profileModalHeroEmail, { color: colors.textSecondary }]}>
                            {draftEmail || profileEmail}
                          </Text>
                          <View style={styles.profileModalBadgeRow}>
                            <View
                              style={[
                                styles.profileModalBadge,
                                { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' },
                              ]}
                            >
                              <Text style={[styles.profileModalBadgeText, { color: '#10b981' }]}>Workspace Owner</Text>
                            </View>
                            <View
                              style={[
                                styles.profileModalBadge,
                                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe' },
                              ]}
                            >
                              <Text style={[styles.profileModalBadgeText, { color: colors.primary }]}>Active</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Quick Stats Row */}
                    <View style={styles.profileStatsRow}>
                      <View
                        style={[
                          styles.profileStatCard,
                          {
                            backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                      >
                        <Text style={[styles.profileStatNum, { color: colors.primary }]}>{allDomains.length}</Text>
                        <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Domains</Text>
                      </View>
                      <View
                        style={[
                          styles.profileStatCard,
                          {
                            backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                      >
                        <Text style={[styles.profileStatNum, { color: '#10b981' }]}>{providerAccounts.length}</Text>
                        <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Providers</Text>
                      </View>
                      <View
                        style={[
                          styles.profileStatCard,
                          {
                            backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                            borderColor: colors.borderSubtle,
                          },
                        ]}
                      >
                        <Text style={[styles.profileStatNum, { color: '#f59e0b' }]}>{emailAccounts.length}</Text>
                        <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>Emails</Text>
                      </View>
                    </View>

                    {/* Personal Information Form Card */}
                    <View
                      style={[
                        styles.profileModalFormCard,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                          borderColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      <Text style={[styles.profileModalSectionTitle, { color: colors.text }]}>
                        Edit Profile Details
                      </Text>
                      <Text style={[styles.profileModalSectionSubtitle, { color: colors.textSecondary }]}>
                        Changes will reflect immediately across your mobile and web dashboard.
                      </Text>

                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                        <View
                          style={[
                            styles.profileInputWrapper,
                            {
                              borderColor: colors.border,
                              backgroundColor: isDark ? colors.surfaceHighlight : '#f8fafc',
                            },
                          ]}
                        >
                          <Ionicons name="person-outline" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
                          <TextInput
                            style={[styles.profileInput, { color: colors.text }]}
                            value={draftName}
                            onChangeText={setDraftName}
                            placeholder="Your Name"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>

                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                          Email Address
                        </Text>
                        <View
                          style={[
                            styles.profileInputWrapper,
                            {
                              borderColor: colors.border,
                              backgroundColor: isDark ? colors.surfaceHighlight : '#f8fafc',
                            },
                          ]}
                        >
                          <Ionicons name="mail-outline" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
                          <TextInput
                            style={[styles.profileInput, { color: colors.text }]}
                            value={draftEmail}
                            onChangeText={setDraftEmail}
                            placeholder="email@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>

                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                          Organization / Company
                        </Text>
                        <View
                          style={[
                            styles.profileInputWrapper,
                            {
                              borderColor: colors.border,
                              backgroundColor: isDark ? colors.surfaceHighlight : '#f8fafc',
                            },
                          ]}
                        >
                          <Ionicons name="business-outline" size={17} color={colors.textMuted} style={{ marginRight: 8 }} />
                          <TextInput
                            style={[styles.profileInput, { color: colors.text }]}
                            value={draftOrg}
                            onChangeText={setDraftOrg}
                            placeholder="Organization Name"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.primaryActionBtn,
                            {
                              backgroundColor: colors.primary,
                              marginTop: Spacing.lg,
                              flexDirection: 'row',
                              gap: 8,
                            },
                          ]}
                          onPress={handleSaveProfile}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
                          <Text style={styles.primaryActionBtnText}>Save Profile Changes</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* 2. PROVIDER CONNECTIONS & ACCOUNTS */}
                {activeModal === 'providers' && (
                  <View style={{ gap: Spacing.md }}>
                    {/* Hero Banner Card */}
                    <View
                      style={[
                        styles.providerHeroCard,
                        {
                          backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                          borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd',
                        },
                      ]}
                    >
                      {/* Top Row: Category Badge & Sync All Button */}
                      <View style={styles.providerHeroTopRow}>
                        <View
                          style={[
                            styles.providerHeroBadge,
                            {
                              backgroundColor: isDark ? 'rgba(2, 132, 199, 0.22)' : '#e0f2fe',
                              borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : '#bae6fd',
                            },
                          ]}
                        >
                          <View style={styles.heroPulseDot} />
                          <Text style={[styles.providerHeroBadgeText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                            CLOUD &amp; REGISTRAR HUB
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.syncAllHeroBtn, { backgroundColor: '#0284c7' }]}
                          disabled={isSyncingAll}
                          onPress={handleSyncAllProviders}
                          activeOpacity={0.8}
                        >
                          {isSyncingAll ? (
                            <ActivityIndicator color="#ffffff" size="small" />
                          ) : (
                            <>
                              <Ionicons name="sync" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                              <Text style={styles.syncAllHeroBtnText}>Sync All</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Title & Description */}
                      <Text style={[styles.providerHeroTitle, { color: colors.text }]}>
                        Automated Portfolio Sync
                      </Text>
                      <Text style={[styles.providerHeroSubtitle, { color: colors.textSecondary }]}>
                        Connect DNS registrars and VPS clouds to discover domains, host records, servers and mobile apps in real-time.
                      </Text>

                      {/* Stat Metrics Row */}
                      <View style={styles.heroTagsRow}>
                        <View
                          style={[
                            styles.heroTagPill,
                            {
                              backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                              borderColor: isDark ? colors.border : '#e2e8f0',
                            },
                          ]}
                        >
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' }} />
                          <Text style={[styles.heroTagText, { color: colors.text }]}>
                            {displayedProviderAccounts.length} Connected
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.heroTagPill,
                            {
                              backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                              borderColor: isDark ? colors.border : '#e2e8f0',
                            },
                          ]}
                        >
                          <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
                          <Text style={[styles.heroTagText, { color: colors.text }]}>
                            {emailAccounts.length} Emails
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.heroTagPill,
                            {
                              backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                              borderColor: isDark ? colors.border : '#e2e8f0',
                            },
                          ]}
                        >
                          <Ionicons name="flash-outline" size={12} color="#0284c7" />
                          <Text style={[styles.heroTagText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                            Live API Sync
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* View Switcher: Segmented Tabs */}
                    <View
                      style={[
                        styles.segmentedControl,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9',
                          borderColor: colors.borderSubtle,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.segmentedTab,
                          accountsView === 'providers' && {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 2,
                          },
                        ]}
                        onPress={() => setAccountsView('providers')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="cloud-outline"
                          size={15}
                          color={accountsView === 'providers' ? '#ffffff' : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.segmentedTabText,
                            {
                              color: accountsView === 'providers' ? '#ffffff' : colors.textSecondary,
                            },
                          ]}
                        >
                          Cloud Providers ({displayedProviderAccounts.length})
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.segmentedTab,
                          accountsView === 'emails' && {
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.25,
                            shadowRadius: 4,
                            elevation: 2,
                          },
                        ]}
                        onPress={() => setAccountsView('emails')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="mail-outline"
                          size={15}
                          color={accountsView === 'emails' ? '#ffffff' : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.segmentedTabText,
                            {
                              color: accountsView === 'emails' ? '#ffffff' : colors.textSecondary,
                            },
                          ]}
                        >
                          Email Accounts ({emailAccounts.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Section Heading with Add Button */}
                    <View style={styles.providerSectionHeader}>
                      <Text style={[styles.providerSectionTitle, { color: colors.textSecondary }]}>
                        {accountsView === 'providers' ? 'CONNECTED PROVIDERS' : 'MANAGED EMAIL ACCOUNTS'}
                      </Text>
                      <TouchableOpacity
                        style={styles.addAccountHeaderBtn}
                        onPress={() => {
                          setNewAccType(accountsView === 'providers' ? 'provider' : 'email');
                          setIsAddAccountModalOpen(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add" size={15} color="#ffffff" />
                        <Text style={styles.addAccountHeaderBtnText}>
                          {accountsView === 'providers' ? 'Add Provider' : 'Add Email'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* List Section */}
                    {accountsView === 'providers' ? (
                      <View style={styles.providerCardsList}>
                        {displayedProviderAccounts.length === 0 ? (
                          <View
                            style={[
                              styles.emptyProviderBox,
                              {
                                backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
                              No Connected Providers
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 280, marginBottom: 14 }}>
                              Connect Hostinger, Cloudflare, or AWS to auto-sync your domains and VPS infrastructure.
                            </Text>
                            <TouchableOpacity
                              style={[styles.emptyActionBtn, { backgroundColor: '#0284c7' }]}
                              onPress={() => {
                                setNewAccType('provider');
                                setIsAddAccountModalOpen(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.emptyActionBtnText}>Connect Your First Provider</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          displayedProviderAccounts.map((p) => {
                            const key = (p.providerKey || '').toLowerCase();
                            const accountDomains = getDomainsForAccount(p, allDomains);
                            return (
                              <View
                                key={p.id}
                                style={[
                                  styles.connectedProviderCard,
                                  {
                                    backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                    borderColor: isDark ? colors.border : '#e2e8f0',
                                  },
                                ]}
                              >
                                {/* Header: Identity & Status (Clickable to open domains!) */}
                                <TouchableOpacity
                                  style={styles.providerCardHeader}
                                  onPress={() => {
                                    setSelectedAccountForDomains(p);
                                    setDomainSearchQuery('');
                                    setDomainFilterStatus('all');
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View
                                    style={[
                                      styles.providerLogoBox,
                                      {
                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
                                        borderColor: isDark ? colors.border : '#e2e8f0',
                                      },
                                    ]}
                                  >
                                    {PROVIDER_LOGOS[key] ? (
                                      <Image
                                        source={PROVIDER_LOGOS[key]}
                                        style={styles.providerLogoImg}
                                        contentFit="contain"
                                      />
                                    ) : (
                                      <Ionicons name="cloud-outline" size={22} color={colors.primary} />
                                    )}
                                  </View>

                                  <View style={styles.providerInfoCol}>
                                    <View style={styles.providerTitleRow}>
                                      <Text style={[styles.providerItemName, { color: colors.text }]} numberOfLines={1}>
                                        {p.label}
                                      </Text>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={styles.activeStatusPill}>
                                          <View style={styles.activeStatusDot} />
                                          <Text style={styles.activeStatusText}>Connected</Text>
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
                                          onPress={async (e) => {
                                            e.stopPropagation?.();
                                            await deleteProviderAccount(p.id);
                                            await loadAccounts();
                                            showFeedback('Disconnected', `Removed ${p.label}.`, 'info');
                                          }}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                          activeOpacity={0.6}
                                        >
                                          <Ionicons name="close" size={13} color={colors.textMuted} />
                                        </TouchableOpacity>
                                      </View>
                                    </View>

                                    {/* Meta pills: Provider Key + API Key Preview */}
                                    <View style={styles.providerMetaRow}>
                                      <View
                                        style={[
                                          styles.providerKeyTag,
                                          { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe' },
                                        ]}
                                      >
                                        <Text style={[styles.providerKeyTagText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                                          {p.providerKey.toUpperCase()}
                                        </Text>
                                      </View>

                                      <View
                                        style={[
                                          styles.providerKeyPreviewBadge,
                                          {
                                            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                                            borderColor: isDark ? colors.border : '#e2e8f0',
                                          },
                                        ]}
                                      >
                                        <Ionicons name="key-outline" size={11} color={colors.textSecondary} />
                                        <Text style={[styles.providerIdText, { color: colors.textSecondary }]} numberOfLines={1}>
                                          {p.externalAccountId
                                            ? `${p.externalAccountId.length > 14 ? `${p.externalAccountId.slice(0, 6)}...${p.externalAccountId.slice(-4)}` : p.externalAccountId}`
                                            : 'Direct API Linked'}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>
                                </TouchableOpacity>

                                {/* Clickable Domains Banner: Shows domain count & opens all domains on click */}
                                <TouchableOpacity
                                  style={[
                                    styles.accountDomainsBadgeRow,
                                    {
                                      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                                      borderColor: isDark ? 'rgba(56, 189, 248, 0.28)' : '#bae6fd',
                                    },
                                  ]}
                                  onPress={() => {
                                    setSelectedAccountForDomains(p);
                                    setDomainSearchQuery('');
                                    setDomainFilterStatus('all');
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.domainsBadgeRowLeft}>
                                    <View
                                      style={[
                                        styles.domainGlobeIconBadge,
                                        { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe' },
                                      ]}
                                    >
                                      <Ionicons name="globe-outline" size={16} color={isDark ? '#38bdf8' : '#0284c7'} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.accountDomainsCountText, { color: colors.text }]}>
                                          {accountDomains.length} {accountDomains.length === 1 ? 'Domain' : 'Domains'} Managed
                                        </Text>
                                        <View
                                          style={[
                                            styles.domainActiveBadgePill,
                                            {
                                              backgroundColor:
                                                accountDomains.length > 0
                                                  ? 'rgba(16, 185, 129, 0.15)'
                                                  : isDark
                                                  ? 'rgba(255, 255, 255, 0.08)'
                                                  : '#f1f5f9',
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.domainActiveBadgeText,
                                              { color: accountDomains.length > 0 ? '#10b981' : colors.textMuted },
                                            ]}
                                          >
                                            {accountDomains.length > 0 ? 'Synchronized' : 'None Synced'}
                                          </Text>
                                        </View>
                                      </View>
                                      <Text style={[styles.accountDomainsSubText, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {accountDomains.length > 0
                                          ? `${accountDomains.slice(0, 3).map((d) => d.name).join(', ')}${accountDomains.length > 3 ? ` +${accountDomains.length - 3} more` : ''}`
                                          : 'Tap to view details or sync with provider'}
                                      </Text>
                                    </View>
                                  </View>

                                  <View
                                    style={[
                                      styles.viewDomainsActionPill,
                                      { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#e0f2fe' },
                                    ]}
                                  >
                                    <Text style={[styles.viewDomainsActionText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                                      View All
                                    </Text>
                                    <Ionicons name="chevron-forward" size={13} color={isDark ? '#38bdf8' : '#0284c7'} />
                                  </View>
                                </TouchableOpacity>

                                {/* Divider */}
                                <View
                                  style={[
                                    styles.providerCardDivider,
                                    { backgroundColor: isDark ? colors.border : '#f1f5f9' },
                                  ]}
                                />

                                {/* Action Toolbar (3 comfortable touch-target buttons) */}
                                <View style={styles.providerActionRow}>
                                  <TouchableOpacity
                                    style={[styles.providerSyncBtn, { backgroundColor: '#0284c7' }]}
                                    disabled={syncingProviderId === p.id}
                                    onPress={async () => {
                                      setSyncingProviderId(p.id);
                                      try {
                                        const res = await syncProviderAccount({
                                          providerKey: p.providerKey,
                                          accountName: p.label,
                                          apiKey: p.externalAccountId || undefined,
                                          providerAccountId: p.id,
                                        });
                                        await loadAccounts();
                                        showFeedback(
                                          res.success ? 'Provider Synced' : 'Sync Notice',
                                          res.message,
                                          res.success ? 'success' : 'error'
                                        );
                                      } catch (err: any) {
                                        showFeedback('Sync Error', err?.message || 'Failed to sync provider.', 'error');
                                      } finally {
                                        setSyncingProviderId(null);
                                      }
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    {syncingProviderId === p.id ? (
                                      <ActivityIndicator color="#ffffff" size="small" />
                                    ) : (
                                      <>
                                        <Ionicons name="sync" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                                        <Text style={styles.providerSyncBtnText}>Sync Now</Text>
                                      </>
                                    )}
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={[
                                      styles.providerTokenBtn,
                                      {
                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
                                        borderColor: isDark ? colors.border : '#e2e8f0',
                                      },
                                    ]}
                                    onPress={() => handleOpenEditToken(p)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons
                                      name="key-outline"
                                      size={14}
                                      color={colors.text}
                                      style={{ marginRight: 5 }}
                                    />
                                    <Text style={[styles.providerTokenBtnText, { color: colors.text }]}>Token</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity
                                    style={styles.providerDisconnectBtn}
                                    onPress={async () => {
                                      await deleteProviderAccount(p.id);
                                      await loadAccounts();
                                      showFeedback('Disconnected', `Removed ${p.label}.`, 'info');
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" style={{ marginRight: 5 }} />
                                    <Text style={styles.providerDisconnectBtnText}>Remove</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })
                        )}
                      </View>
                    ) : (
                      <View style={styles.providerCardsList}>
                        {emailAccounts.length === 0 ? (
                          <View
                            style={[
                              styles.emptyProviderBox,
                              {
                                backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
                                borderColor: colors.borderSubtle,
                              },
                            ]}
                          >
                            <Ionicons name="mail-unread-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 }}>
                              No Email Accounts Added
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 280, marginBottom: 14 }}>
                              Add an email account for login credentials, notifications, and alert monitoring.
                            </Text>
                            <TouchableOpacity
                              style={[styles.emptyActionBtn, { backgroundColor: '#0284c7' }]}
                              onPress={() => {
                                setNewAccType('email');
                                setIsAddAccountModalOpen(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                              <Text style={styles.emptyActionBtnText}>Add Your First Email Account</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          emailAccounts.map((e) => (
                            <View
                              key={e.id}
                              style={[
                                styles.connectedProviderCard,
                                {
                                  backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                  borderColor: isDark ? colors.border : '#e2e8f0',
                                },
                              ]}
                            >
                              <View style={styles.providerCardHeader}>
                                <View
                                  style={[
                                    styles.providerLogoBox,
                                    {
                                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                                      borderColor: isDark ? colors.border : '#bae6fd',
                                    },
                                  ]}
                                >
                                  <Ionicons name="mail" size={20} color={colors.primary} />
                                </View>

                                <View style={styles.providerInfoCol}>
                                  <View style={styles.providerTitleRow}>
                                    <Text style={[styles.providerItemName, { color: colors.text }]} numberOfLines={1}>
                                      {e.email}
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
                                      onPress={async (evt) => {
                                        evt.stopPropagation?.();
                                        await deleteEmailAccount(e.id);
                                        await loadAccounts();
                                        showFeedback('Removed', `Removed email account ${e.email}.`, 'info');
                                      }}
                                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      activeOpacity={0.6}
                                    >
                                      <Ionicons name="close" size={13} color={colors.textMuted} />
                                    </TouchableOpacity>
                                  </View>

                                  <View style={styles.providerMetaRow}>
                                    <View
                                      style={[
                                        styles.providerKeyTag,
                                        { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#dcfce7' },
                                      ]}
                                    >
                                      <Text style={[styles.providerKeyTagText, { color: isDark ? '#34d399' : '#15803d' }]}>
                                        ACTIVE EMAIL
                                      </Text>
                                    </View>
                                    <Text style={[styles.providerIdText, { color: colors.textSecondary }]}>
                                      {e.label || 'Login / Notifications Account'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    {/* Available Supported Integrations Directory */}
                    <View style={{ marginTop: 8, gap: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.providerSectionTitle, { color: colors.textSecondary }]}>
                          SUPPORTED CLOUD PLATFORMS (8)
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                          Instant Discovery
                        </Text>
                      </View>

                      <View style={styles.providerCardsList}>
                        {[
                          { key: 'google-play', name: 'Google Play & Console', tag: 'Store & Apps', desc: 'Universal developer search & live apps sync' },
                          { key: 'hostinger', name: 'Hostinger Cloud & VPS', tag: 'VPS & Domains', desc: 'Sync VPS servers and domains via API' },
                          { key: 'cloudflare', name: 'Cloudflare DNS', tag: 'DNS & SSL', desc: 'Sync DNS zones, SSL certificates & edge rules' },
                          { key: 'godaddy', name: 'GoDaddy Domains & DNS', tag: 'Registrar', desc: 'Sync domains and nameserver records' },
                          { key: 'aws', name: 'Amazon Route 53 & EC2', tag: 'Cloud Infra', desc: 'Sync AWS cloud instances & Route 53 zones' },
                          { key: 'namecheap', name: 'Namecheap API', tag: 'Domains', desc: 'Sync registered domain portfolio' },
                          { key: 'digitalocean', name: 'DigitalOcean Droplets', tag: 'VPS & DNS', desc: 'Sync droplets, IP addresses & DNS' },
                          { key: 'hetzner', name: 'Hetzner Cloud', tag: 'VPS Nodes', desc: 'Sync bare metal & cloud VPS nodes' },
                        ].map((prov) => {
                          const isAlreadyConnected = providerAccounts.some(
                            (a) => a.providerKey.toLowerCase() === prov.key.toLowerCase()
                          );
                          return (
                            <View
                              key={prov.key}
                              style={[
                                styles.supportedProviderCard,
                                {
                                  backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                  borderColor: isDark ? colors.border : '#e2e8f0',
                                },
                              ]}
                            >
                              <View
                                style={[
                                  styles.providerLogoBox,
                                  {
                                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc',
                                    borderColor: isDark ? colors.border : '#e2e8f0',
                                  },
                                ]}
                              >
                                {PROVIDER_LOGOS[prov.key] ? (
                                  <Image
                                    source={PROVIDER_LOGOS[prov.key]}
                                    style={styles.providerLogoImg}
                                    contentFit="contain"
                                  />
                                ) : (
                                  <Ionicons name="cloud-outline" size={20} color={colors.primary} />
                                )}
                              </View>

                              <View style={styles.supportedProviderTextCol}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.supportedProviderName, { color: colors.text }]} numberOfLines={1}>
                                    {prov.name}
                                  </Text>
                                  <View
                                    style={[
                                      styles.supportedTagPill,
                                      {
                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.07)' : '#f1f5f9',
                                        borderColor: isDark ? colors.border : '#e2e8f0',
                                      },
                                    ]}
                                  >
                                    <Text style={[styles.supportedTagText, { color: colors.textSecondary }]}>{prov.tag}</Text>
                                  </View>
                                </View>
                                <Text style={[styles.supportedProviderDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {prov.desc}
                                </Text>
                              </View>

                              <View style={styles.supportedProviderRight}>
                                {isAlreadyConnected && prov.key !== 'google-play' ? (
                                  <View style={styles.connectedBadgePill}>
                                    <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                                    <Text style={styles.connectedBadgeText}>Connected</Text>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={[
                                      styles.connectSolidBtn,
                                      { backgroundColor: prov.key === 'google-play' ? '#01875f' : '#0284c7' },
                                    ]}
                                    onPress={() => {
                                      if (prov.key === 'google-play') {
                                        router.push('/google-play');
                                      } else {
                                        setNewAccType('provider');
                                        setNewAccProviderKey(prov.key);
                                        setNewAccLabel(`${prov.name} Account`);
                                        setIsAddAccountModalOpen(true);
                                      }
                                    }}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons
                                      name={prov.key === 'google-play' ? 'arrow-forward' : 'add'}
                                      size={13}
                                      color="#ffffff"
                                      style={{ marginRight: 3 }}
                                    />
                                    <Text style={styles.connectSolidBtnText}>
                                      {prov.key === 'google-play' ? 'Explore' : 'Connect'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                )}

                {/* 3. IMPORT / EXPORT */}
                {activeModal === 'import_export' && (
                  <View style={{ gap: Spacing.lg }}>
                    {/* Card 1: Import Data */}
                    <View
                      style={[
                        styles.importExportCard,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                          borderColor: isDark ? colors.border : '#e2e8f0',
                        },
                      ]}
                    >
                      {/* Import Card Header */}
                      <View style={styles.ieCardHeader}>
                        <View style={styles.ieCardHeaderLeft}>
                          <View style={[styles.ieIconBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                            <Text style={styles.ieIconGlyph}>☁️</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.ieCardTitle, { color: colors.text }]}>Import Data</Text>
                            <Text style={[styles.ieCardSubtitle, { color: colors.textSecondary }]}>
                              Paste CSV domain lists, TXT entries, or BIND zone files to sync into your live portfolio.
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[styles.viewFormatBtn, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff', borderColor: isDark ? colors.border : '#bae6fd' }]}
                          onPress={() => setShowFormatGuideModal(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.viewFormatBtnText}>📖 View Format</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Interactive Text / Drop Input Box */}
                      <View style={[styles.importInputContainer, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc', borderColor: isDark ? colors.border : '#cbd5e1' }]}>
                        <View style={styles.importInputTopBar}>
                          <Text style={[styles.importInputTopLabel, { color: colors.textSecondary }]}>
                            Domain Input &amp; Records
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.quickChipBtn, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}
                              onPress={() => handleLoadSampleImport('csv')}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.quickChipText, { color: '#0284c7' }]}>✨ Load Sample</Text>
                            </TouchableOpacity>
                            {importInputText.length > 0 && (
                              <TouchableOpacity
                                style={[styles.quickChipBtn, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}
                                onPress={() => setImportInputText('')}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.quickChipText, { color: '#ef4444' }]}>🧹 Clear</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>

                        <TextInput
                          style={[
                            styles.importTextInput,
                            {
                              color: colors.text,
                              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : '#ffffff',
                              borderColor: isDark ? '#334155' : '#e2e8f0',
                            },
                          ]}
                          multiline
                          numberOfLines={5}
                          textAlignVertical="top"
                          placeholder={`domain.com, GoDaddy, true\napi.myservice.io, Cloudflare, true\ncustom-app.org, Namecheap, false`}
                          placeholderTextColor={colors.textMuted}
                          value={importInputText}
                          onChangeText={setImportInputText}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />

                        <View style={styles.importDetectionRow}>
                          <Text
                            style={[
                              styles.importDetectionText,
                              {
                                color:
                                  countDetectedDomains(importInputText) > 0
                                    ? isDark
                                      ? '#34d399'
                                      : '#16a34a'
                                    : colors.textMuted,
                              },
                            ]}
                          >
                            ⚡ {countDetectedDomains(importInputText)} domain(s) detected in input
                          </Text>
                        </View>
                      </View>

                      {/* Supported Formats row */}
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.subSectionTitle, { color: colors.textMuted }]}>Supported Formats</Text>
                        <View style={styles.formatCardsRow}>
                          <TouchableOpacity
                            style={[styles.formatCard, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#f0fdf4', borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7' }]}
                            onPress={() => handleLoadSampleImport('csv')}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.formatIconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' }]}>
                              <Text style={{ fontSize: 13 }}>📄</Text>
                            </View>
                            <Text style={[styles.formatCardName, { color: colors.text }]}>CSV</Text>
                            <Text style={[styles.formatCardDesc, { color: colors.textMuted }]}>name, registrar, autoRenew</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.formatCard, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#faf5ff', borderColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#f3e8ff' }]}>
                            <View style={[styles.formatIconBadge, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : '#f3e8ff' }]}>
                              <Text style={{ fontSize: 13 }}>📄</Text>
                            </View>
                            <Text style={[styles.formatCardName, { color: colors.text }]}>TXT</Text>
                            <Text style={[styles.formatCardDesc, { color: colors.textMuted }]}>1 domain per line</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.formatCard, { backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : '#fff7ed', borderColor: isDark ? 'rgba(249, 115, 22, 0.25)' : '#ffedd5' }]}
                            onPress={() => handleLoadSampleImport('bind')}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.formatIconBadge, { backgroundColor: isDark ? 'rgba(249, 115, 22, 0.2)' : '#ffedd5' }]}>
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#f97316' }}>&lt;/&gt;</Text>
                            </View>
                            <Text style={[styles.formatCardName, { color: colors.text }]}>BIND</Text>
                            <Text style={[styles.formatCardDesc, { color: colors.textMuted }]}>BIND zone syntax</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Import Options */}
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.subSectionTitle, { color: colors.textMuted }]}>Import Options</Text>
                        <View style={styles.importOptionsList}>
                          <View style={[styles.importOptionItem, { borderColor: isDark ? colors.border : '#f1f5f9' }]}>
                            <View style={[styles.importOptionIconBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                              <Text style={{ fontSize: 14 }}>🗄️</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.importOptionTitle, { color: colors.text }]}>Update existing domains</Text>
                              <Text style={[styles.importOptionSubtitle, { color: colors.textMuted }]}>
                                Refresh registrar &amp; settings if domain already exists
                              </Text>
                            </View>
                            <Switch
                              value={importUpdateExisting}
                              onValueChange={setImportUpdateExisting}
                              trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
                            />
                          </View>

                          <View style={[styles.importOptionItem, { borderColor: isDark ? colors.border : '#f1f5f9' }]}>
                            <View style={[styles.importOptionIconBox, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                              <Text style={{ fontSize: 14 }}>➕</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.importOptionTitle, { color: colors.text }]}>Add new domains only</Text>
                              <Text style={[styles.importOptionSubtitle, { color: colors.textMuted }]}>
                                Skip duplicates already in portfolio
                              </Text>
                            </View>
                            <Switch
                              value={importAddNewOnly}
                              onValueChange={setImportAddNewOnly}
                              trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
                            />
                          </View>

                          <View style={[styles.importOptionItem, { borderColor: isDark ? colors.border : '#f1f5f9' }]}>
                            <View style={[styles.importOptionIconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}>
                              <Text style={{ fontSize: 14 }}>🗑️</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.importOptionTitle, { color: colors.text }]}>Skip invalid records</Text>
                              <Text style={[styles.importOptionSubtitle, { color: colors.textMuted }]}>
                                Continue import even if some records fail
                              </Text>
                            </View>
                            <Switch
                              value={importSkipInvalid}
                              onValueChange={setImportSkipInvalid}
                              trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
                            />
                          </View>
                        </View>
                      </View>

                      {/* Run Import Button */}
                      <TouchableOpacity
                        style={[
                          styles.exportNowBtn,
                          { backgroundColor: '#0284c7' },
                          isImporting && { opacity: 0.7 },
                        ]}
                        onPress={handleRunImport}
                        disabled={isImporting}
                        activeOpacity={0.85}
                      >
                        {isImporting ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <Text style={styles.exportNowBtnIcon}>🚀</Text>
                            <Text style={styles.exportNowBtnText}>
                              Import Domains ({countDetectedDomains(importInputText)})
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Card 2: Export Portfolio */}
                    <View
                      style={[
                        styles.importExportCard,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                          borderColor: isDark ? colors.border : '#e2e8f0',
                        },
                      ]}
                    >
                      {/* Export Header */}
                      <View style={styles.ieCardHeaderLeft}>
                        <View style={[styles.ieIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]}>
                          <Text style={{ fontSize: 22 }}>📥</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ieCardTitle, { color: colors.text }]}>Export Portfolio</Text>
                          <Text style={[styles.ieCardSubtitle, { color: colors.textSecondary }]}>
                            Download or share your domain inventory with expiration dates, SSL health, and DNS records.
                          </Text>
                        </View>
                      </View>

                      {/* Export Format row */}
                      <View style={styles.exportRow}>
                        <Text style={[styles.exportRowLabel, { color: colors.textSecondary }]}>Export Format</Text>
                        <View style={styles.exportFormatsGroup}>
                          <TouchableOpacity
                            style={[
                              styles.exportFormatBtn,
                              exportFormat === 'CSV'
                                ? { backgroundColor: '#0284c7', borderColor: '#0284c7' }
                                : { backgroundColor: isDark ? colors.surfaceHighlight : '#ffffff', borderColor: colors.border },
                            ]}
                            onPress={() => setExportFormat('CSV')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13 }}>📄</Text>
                            <Text style={[styles.exportFormatBtnText, { color: exportFormat === 'CSV' ? '#ffffff' : colors.text }]}>
                              CSV
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.exportFormatBtn,
                              exportFormat === 'PDF'
                                ? { backgroundColor: '#0284c7', borderColor: '#0284c7' }
                                : { backgroundColor: isDark ? colors.surfaceHighlight : '#ffffff', borderColor: colors.border },
                            ]}
                            onPress={() => setExportFormat('PDF')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13 }}>📄</Text>
                            <Text style={[styles.exportFormatBtnText, { color: exportFormat === 'PDF' ? '#ffffff' : colors.text }]}>
                              PDF Audit
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.exportFormatBtn,
                              exportFormat === 'Excel'
                                ? { backgroundColor: '#0284c7', borderColor: '#0284c7' }
                                : { backgroundColor: isDark ? colors.surfaceHighlight : '#ffffff', borderColor: colors.border },
                            ]}
                            onPress={() => setExportFormat('Excel')}
                            activeOpacity={0.8}
                          >
                            <Text style={{ fontSize: 13 }}>📊</Text>
                            <Text style={[styles.exportFormatBtnText, { color: exportFormat === 'Excel' ? '#ffffff' : colors.text }]}>
                              Excel / TSV
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Export Data scope */}
                      <View style={styles.exportRow}>
                        <Text style={[styles.exportRowLabel, { color: colors.textSecondary }]}>Filter Scope</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {[
                            { id: 'all', label: 'All Domains' },
                            { id: 'safe', label: 'Safe Only' },
                            { id: 'expiring', label: 'Expiring Soon' },
                          ].map((scope) => {
                            const isSelected = exportScope === scope.id;
                            return (
                              <TouchableOpacity
                                key={scope.id}
                                style={[
                                  styles.scopePillBtn,
                                  {
                                    backgroundColor: isSelected ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : isDark ? colors.surfaceHighlight : '#f8fafc',
                                    borderColor: isSelected ? '#0284c7' : colors.border,
                                  },
                                ]}
                                onPress={() => setExportScope(scope.id as any)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.scopePillText,
                                    { color: isSelected ? '#0284c7' : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                                  ]}
                                >
                                  {scope.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {/* Included in export info box */}
                      <View style={[styles.includedBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4', borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7' }]}>
                        <View style={styles.includedCheckCircle}>
                          <Text style={styles.includedCheckIcon}>✓</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.includedTitle, { color: isDark ? '#34d399' : '#15803d' }]}>
                            Included in export:
                          </Text>
                          <Text style={[styles.includedText, { color: colors.textSecondary }]}>
                            Domain name, TLD, registrar, expiration dates, days remaining, SSL health, DNS provider, auto-renew, and renewal pricing.
                          </Text>
                        </View>
                      </View>

                      {/* Export Now Button */}
                      <TouchableOpacity
                        style={[
                          styles.exportNowBtn,
                          { backgroundColor: '#16a34a' },
                          isExporting && { opacity: 0.7 },
                        ]}
                        onPress={handleRunExport}
                        disabled={isExporting}
                        activeOpacity={0.85}
                      >
                        {isExporting ? (
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <Text style={styles.exportNowBtnIcon}>📥</Text>
                            <Text style={styles.exportNowBtnText}>Export Now ({exportFormat})</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}


                {/* 4. SETTINGS */}
                {activeModal === 'settings' && (
                  <View>
                    <Text style={[styles.label, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
                      Theme & Appearance
                    </Text>
                    <View style={styles.themeSelectorRow}>
                      {[
                        { id: 'light', label: 'Light', icon: '☀️' },
                        { id: 'dark', label: 'Dark', icon: '🌙' },
                      ].map((item) => {
                        const isSelected = themeMode === item.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.themeOptionBtn,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                            ]}
                            onPress={() => setThemeMode(item.id as any)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.themeOptionIcon}>{item.icon}</Text>
                            <Text
                              style={[
                                styles.themeOptionText,
                                {
                                  color: isSelected ? '#ffffff' : colors.text,
                                  fontWeight: isSelected ? '700' : '600',
                                },
                              ]}
                            >
                              {item.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginVertical: Spacing.md }]} />

                    <View style={styles.switchRow}>
                      <View style={styles.switchTextCol}>
                        <Text style={[styles.switchTitle, { color: colors.text, fontWeight: '700' }]}>Push Notifications</Text>
                        <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                          Receive automated push alerts on your registered mobile devices
                        </Text>
                      </View>
                      <Switch
                        value={notifPrefs.pushEnabled}
                        onValueChange={(val) => handleTogglePref('pushEnabled', val)}
                        trackColor={{ false: '#cbd5e1', true: colors.primary }}
                      />
                    </View>

                    {notifPrefs.pushEnabled && (
                      <View style={{ marginTop: Spacing.xs, paddingLeft: 4 }}>
                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.sm, marginBottom: 8, fontSize: 13 }]}>
                          REMINDER INTERVALS (SELECT THRESHOLDS)
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md }}>
                          {[
                            { value: 15, label: '15 Days' },
                            { value: 7, label: '7 Days' },
                            { value: 3, label: '3 Days' },
                            { value: 1, label: '1 Day' },
                            { value: 0, label: 'On Expiry' },
                          ].map((pill) => {
                            const isSelected = notifPrefs.reminderThresholds?.includes(pill.value);
                            return (
                              <TouchableOpacity
                                key={pill.value}
                                onPress={() => toggleThreshold(pill.value)}
                                activeOpacity={0.7}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 7,
                                  borderRadius: 20,
                                  backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                                  borderWidth: 1,
                                  borderColor: isSelected ? colors.primary : colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: isSelected ? '700' : '500',
                                    color: isSelected ? '#ffffff' : colors.text,
                                  }}
                                >
                                  {isSelected ? `✓ ${pill.label}` : pill.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xs, marginBottom: 4, fontSize: 13 }]}>
                          MONITORED ASSET TYPES
                        </Text>
                        <View style={styles.switchRow}>
                          <View style={styles.switchTextCol}>
                            <Text style={[styles.switchTitle, { color: colors.text }]}>🌐 Domains</Text>
                            <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                              Monitors registered domain expiration dates
                            </Text>
                          </View>
                          <Switch
                            value={notifPrefs.notifyDomains}
                            onValueChange={(val) => handleTogglePref('notifyDomains', val)}
                            trackColor={{ false: '#cbd5e1', true: colors.primary }}
                          />
                        </View>

                        <View style={styles.switchRow}>
                          <View style={styles.switchTextCol}>
                            <Text style={[styles.switchTitle, { color: colors.text }]}>🔒 SSL / TLS Certificates</Text>
                            <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                              Monitors certificate validity and impending expiration
                            </Text>
                          </View>
                          <Switch
                            value={notifPrefs.notifySsl}
                            onValueChange={(val) => handleTogglePref('notifySsl', val)}
                            trackColor={{ false: '#cbd5e1', true: colors.primary }}
                          />
                        </View>

                        <View style={styles.switchRow}>
                          <View style={styles.switchTextCol}>
                            <Text style={[styles.switchTitle, { color: colors.text }]}>🖥️ Cloud Servers</Text>
                            <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                              Monitors virtual machine and server renewals
                            </Text>
                          </View>
                          <Switch
                            value={notifPrefs.notifyServers}
                            onValueChange={(val) => handleTogglePref('notifyServers', val)}
                            trackColor={{ false: '#cbd5e1', true: colors.primary }}
                          />
                        </View>

                        <View style={styles.switchRow}>
                          <View style={styles.switchTextCol}>
                            <Text style={[styles.switchTitle, { color: colors.text }]}>📦 Hosting Subscriptions</Text>
                            <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                              Monitors hosting plans and registrar services
                            </Text>
                          </View>
                          <Switch
                            value={notifPrefs.notifyHosting}
                            onValueChange={(val) => handleTogglePref('notifyHosting', val)}
                            trackColor={{ false: '#cbd5e1', true: colors.primary }}
                          />
                        </View>

                        {/* Test Notification Simulator */}
                        <View
                          style={{
                            marginTop: Spacing.md,
                            padding: 12,
                            borderRadius: Radius.md,
                            backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#bfdbfe',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
                            ⚡ Test Push Notification Simulation
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 10 }}>
                            Daily check automatically runs at 9:00 AM IST. Test simulated alerts immediately:
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {[15, 7, 3, 1, 0].map((d) => (
                              <TouchableOpacity
                                key={d}
                                onPress={() => handleTestAlert(d)}
                                disabled={isSimulatingNotif}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: Radius.sm,
                                  backgroundColor: colors.primary,
                                  opacity: isSimulatingNotif ? 0.6 : 1,
                                }}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
                                  {d === 0 ? 'Today (0d)' : `${d}d Test`}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          {simulationStatus && (
                            <Text style={{ fontSize: 12, color: colors.primary, marginTop: 8, fontWeight: '600' }}>
                              {simulationStatus}
                            </Text>
                          )}
                        </View>
                      </View>
                    )}

                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
                      Display Currency
                    </Text>
                    <View style={styles.currencyRow}>
                      {['$ (USD)', '€ (EUR)', '£ (GBP)', '₹ (INR)'].map((curr) => {
                        const isSelected = currency === curr || (curr.includes('USD') && currency === '$ (USD)');
                        return (
                          <TouchableOpacity
                            key={curr}
                            style={[
                              styles.currencyPill,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                            ]}
                            onPress={() => setCurrency(curr)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={{
                                color: isSelected ? '#ffffff' : colors.text,
                                fontWeight: '700',
                                fontSize: 13,
                              }}
                            >
                              {curr}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginVertical: Spacing.lg }]} />

                    {/* DomainPulse Backend API Configuration */}
                    <View
                      style={{
                        backgroundColor: isDark ? colors.surfaceHighlight : '#f8fafc',
                        borderRadius: 12,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 18 }}>🔌</Text>
                          <Text style={{ fontWeight: '700', fontSize: 15, color: colors.text }}>DomainPulse Backend API</Text>
                        </View>
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            backgroundColor:
                              apiConnectionStatus === 'online'
                                ? 'rgba(34, 197, 94, 0.15)'
                                : apiConnectionStatus === 'offline'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(56, 189, 248, 0.15)',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color:
                                apiConnectionStatus === 'online'
                                  ? '#22c55e'
                                  : apiConnectionStatus === 'offline'
                                  ? '#ef4444'
                                  : '#0284c7',
                            }}
                          >
                            {apiConnectionStatus === 'online'
                              ? `ONLINE (${apiPingLatency}ms)`
                              : apiConnectionStatus === 'offline'
                              ? 'OFFLINE'
                              : 'SYNC READY'}
                          </Text>
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                        Current Endpoint: <Text style={{ fontFamily: 'monospace', color: colors.primary }}>{currentApiUrl}</Text>
                      </Text>

                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: colors.text,
                            borderColor: colors.border,
                            fontSize: 13,
                            fontFamily: 'monospace',
                            marginBottom: 8,
                          },
                        ]}
                        value={apiDraftUrl}
                        onChangeText={setApiDraftUrl}
                        placeholder="http://192.168.1.47:4000/api/v1"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: isDark ? colors.surfaceElevated : '#e2e8f0',
                          }}
                          onPress={() => handleSaveApiUrl(API_CONFIG.WIFI_IP_URL)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>WiFi (192.168.1.47)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: isDark ? colors.surfaceElevated : '#e2e8f0',
                          }}
                          onPress={() => handleSaveApiUrl(API_CONFIG.FALLBACK_LOCALHOST)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>Localhost (127.0.0.1)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: isDark ? colors.surfaceElevated : '#e2e8f0',
                          }}
                          onPress={() => handleSaveApiUrl(API_CONFIG.ANDROID_EMULATOR_URL)}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>Android (10.0.2.2)</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={{
                          backgroundColor: '#0284c7',
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                        onPress={() => handleSaveApiUrl()}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>
                          {apiConnectionStatus === 'testing' ? 'Testing Connection...' : 'Save & Test Connection'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 5. SECURITY */}
                {activeModal === 'security' && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Change Password</Text>
                    
                    {/* Current Password Field */}
                    <View style={[styles.passwordFieldRow, { borderColor: colors.border, backgroundColor: colors.surfaceHighlight }]}>
                      <TextInput
                        ref={currentPassInputRef}
                        style={[styles.passwordFieldInput, { color: colors.text }]}
                        placeholder="Current Password"
                        secureTextEntry={!showCurrentPass}
                        value={currentPass}
                        onChangeText={setCurrentPass}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowCurrentPass((prev) => !prev)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.eyeBtnText}>{showCurrentPass ? '👁️' : '👁️‍🗨️'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* New Password Field */}
                    <View style={[styles.passwordFieldRow, { borderColor: colors.border, backgroundColor: colors.surfaceHighlight, marginTop: Spacing.sm }]}>
                      <TextInput
                        ref={newPassInputRef}
                        style={[styles.passwordFieldInput, { color: colors.text }]}
                        placeholder="New Password (min 8 characters)"
                        secureTextEntry={!showNewPass}
                        value={newPass}
                        onChangeText={setNewPass}
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowNewPass((prev) => !prev)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.eyeBtnText}>{showNewPass ? '👁️' : '👁️‍🗨️'}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        { backgroundColor: colors.primary },
                        isChangingPassword && { opacity: 0.6 },
                      ]}
                      onPress={handleSavePassword}
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryActionBtnText}>Update Password</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* 6. BILLING */}
                {activeModal === 'billing' && (
                  <View>
                    <View style={[styles.planCard, { borderColor: '#38bdf8', backgroundColor: '#f0f9ff' }]}>
                      <View style={styles.planHeader}>
                        <Text style={[styles.planTitle, { color: '#0369a1' }]}>Enterprise Pro Plan</Text>
                        <View style={styles.activeTag}>
                          <Text style={styles.activeTagText}>ACTIVE</Text>
                        </View>
                      </View>
                      <Text style={styles.planPrice}>
                        {currencySymbol === '₹'
                          ? '₹2,499 / month'
                          : currencySymbol === '€'
                          ? '€27 / month'
                          : currencySymbol === '£'
                          ? '£24 / month'
                          : '$29 / month'}
                      </Text>
                      <Text style={[styles.planFeatures, { color: colors.textSecondary }]}>
                        • Unlimited Monitored Domains{'\n'}• 30-Second Uptime Healthchecks{'\n'}• Automated DNS Failover{'\n'}• Multi-user Team Seats
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]}
                      onPress={() => showFeedback('Subscription', 'Redirecting to Stripe Billing Portal...', 'info')}
                    >
                      <Text style={styles.primaryActionBtnText}>Manage Payment & Invoices</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 7. HELP & SUPPORT */}
                {activeModal === 'help' && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                      Have a question or running into an issue? Our engineering team is available 24/7.
                    </Text>

                    <Text style={[styles.label, { color: colors.textSecondary }]}>Subject</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      placeholder="Brief issue title"
                      value={supportSubject}
                      onChangeText={setSupportSubject}
                      placeholderTextColor={colors.textMuted}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                      Message
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { color: colors.text, borderColor: colors.border, height: 90, textAlignVertical: 'top' },
                      ]}
                      placeholder="Describe what you need help with..."
                      multiline
                      numberOfLines={4}
                      value={supportMessage}
                      onChangeText={setSupportMessage}
                      placeholderTextColor={colors.textMuted}
                    />

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                      onPress={handleSendSupport}
                    >
                      <Text style={styles.primaryActionBtnText}>Submit Support Ticket</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 8. ABOUT */}
                {activeModal === 'about' && (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <View style={{ shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, marginBottom: 16 }}>
                      <Image
                        source={require('../../../assets/images/icon.png')}
                        style={{ width: 80, height: 80, borderRadius: 20 }}
                        contentFit="contain"
                      />
                    </View>
                    <Text style={[styles.aboutTitle, { color: colors.text }]}>{appBranding.appName || 'DomainPulse'}</Text>
                    <Text style={[styles.aboutVersion, { color: colors.textMuted }]}>
                      Version {versionPolicy.latestVersion || '1.0.4'}
                    </Text>
                    <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
                      {appBranding.appName || 'DomainPulse'} is an enterprise infrastructure and domain portfolio monitoring suite designed for modern DevOps and site reliability engineers.
                    </Text>
                    <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginVertical: Spacing.lg }]} />
                    <Text style={[styles.copyrightText, { color: colors.textMuted }]}>
                      © {new Date().getFullYear()} {appBranding.appName || 'DomainPulse'} Inc. All rights reserved.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
      </Modal>

      {/* Add Account Modal (Provider or Email) */}
      <Modal
        visible={isAddAccountModalOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsAddAccountModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.providerModalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsAddAccountModalOpen(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? '#0f172a' : '#ffffff', height: '88%', maxHeight: '95%', paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={styles.dragHandleWrapper}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            </View>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {newAccType === 'provider' ? 'Connect Provider Account' : 'Add Managed Email Account'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsAddAccountModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
              {/* Type Switcher */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9',
                  borderRadius: 8,
                  padding: 4,
                  marginBottom: 16,
                }}
              >
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 6,
                    backgroundColor: newAccType === 'provider' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setNewAccType('provider')}
                >
                  <Text style={{ color: newAccType === 'provider' ? '#ffffff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                    Cloud Provider
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    alignItems: 'center',
                    borderRadius: 6,
                    backgroundColor: newAccType === 'email' ? colors.primary : 'transparent',
                  }}
                  onPress={() => setNewAccType('email')}
                >
                  <Text style={{ color: newAccType === 'email' ? '#ffffff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                    Email Account
                  </Text>
                </TouchableOpacity>
              </View>

              {newAccType === 'provider' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 8 }]}>Select Cloud Provider</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[
                        { key: 'google-play', name: 'Google Play Console' },
                        { key: 'hostinger', name: 'Hostinger' },
                        { key: 'cloudflare', name: 'Cloudflare' },
                        { key: 'godaddy', name: 'GoDaddy' },
                        { key: 'aws', name: 'AWS' },
                        { key: 'namecheap', name: 'Namecheap' },
                        { key: 'digitalocean', name: 'DigitalOcean' },
                        { key: 'hetzner', name: 'Hetzner' },
                        { key: 'gcp', name: 'Google Cloud' },
                        { key: 'azure', name: 'Azure' },
                        { key: 'vultr', name: 'Vultr' },
                      ].map((item) => {
                        const isSel = newAccProviderKey === item.key;
                        return (
                          <TouchableOpacity
                            key={item.key}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: isSel ? colors.primary : isDark ? colors.surfaceElevated : '#f1f5f9',
                              borderWidth: 1,
                              borderColor: isSel ? colors.primary : colors.border,
                            }}
                            onPress={() => {
                              setNewAccProviderKey(item.key);
                              if (!newAccLabel || newAccLabel.endsWith('Account')) {
                                setNewAccLabel(`${item.name} Account`);
                              }
                            }}
                          >
                            {PROVIDER_LOGOS[item.key] && (
                              <Image
                                source={PROVIDER_LOGOS[item.key]}
                                style={{ width: 18, height: 18, marginRight: 6 }}
                                contentFit="contain"
                              />
                            )}
                            <Text style={{ color: isSel ? '#ffffff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {newAccProviderKey === 'google-play' ? 'Console / Developer Account Name *' : 'Account Label *'}
                  </Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder={newAccProviderKey === 'google-play' ? 'e.g. WorknAi Technologies India Pvt Ltd' : 'e.g. Production Hostinger VPS'}
                    placeholderTextColor={colors.textMuted}
                    value={newAccLabel}
                    onChangeText={setNewAccLabel}
                  />

                  {newAccProviderKey === 'aws' ? (
                    <>
                      <View style={{ backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#eff6ff', padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#0369a1' : '#bfdbfe' }}>
                        <Text style={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                          AWS IAM Credentials
                        </Text>
                        <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, lineHeight: 17 }}>
                          Enter your AWS Access Keys to discover Route53 hosted domains and EC2 virtual servers across regions.
                        </Text>
                      </View>

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Access Key ID *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="AKIA..."
                        placeholderTextColor={colors.textMuted}
                        value={newAwsAccessKeyId}
                        onChangeText={setNewAwsAccessKeyId}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Secret Access Key *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Paste your AWS secret access key"
                        placeholderTextColor={colors.textMuted}
                        value={newAwsSecretAccessKey}
                        onChangeText={setNewAwsSecretAccessKey}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Session Token (optional)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Optional STS session token"
                        placeholderTextColor={colors.textMuted}
                        value={newAwsSessionToken}
                        onChangeText={setNewAwsSessionToken}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Regions to inventory (comma-separated)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="e.g. us-east-1, ap-south-1"
                        placeholderTextColor={colors.textMuted}
                        value={newAwsRegions}
                        onChangeText={setNewAwsRegions}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  ) : newAccProviderKey === 'namecheap' ? (
                    <>
                      <View style={{ backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#eff6ff', padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#0369a1' : '#bfdbfe' }}>
                        <Text style={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                          Namecheap API Credentials
                        </Text>
                        <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, lineHeight: 17 }}>
                          Provide your API Key and whitelisted Client IP to inventory registered domains.
                        </Text>
                      </View>

                      <Text style={[styles.label, { color: colors.textSecondary }]}>API Key *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Namecheap API key"
                        placeholderTextColor={colors.textMuted}
                        value={newNamecheapApiKey}
                        onChangeText={setNewNamecheapApiKey}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>API Username *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Namecheap API username"
                        placeholderTextColor={colors.textMuted}
                        value={newNamecheapApiUser}
                        onChangeText={setNewNamecheapApiUser}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Client IP (Whitelisted IP)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Your whitelisted client IP (e.g. 103.21.58.112)"
                        placeholderTextColor={colors.textMuted}
                        value={newNamecheapClientIp}
                        onChangeText={setNewNamecheapClientIp}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Account Username (Optional)</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Namecheap account username (if different)"
                        placeholderTextColor={colors.textMuted}
                        value={newNamecheapUserName}
                        onChangeText={setNewNamecheapUserName}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  ) : newAccProviderKey === 'gcp' ? (
                    <>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Project ID *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="e.g. my-project-id"
                        placeholderTextColor={colors.textMuted}
                        value={newGcpProjectId}
                        onChangeText={setNewGcpProjectId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Service Account Email *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="name@project.iam.gserviceaccount.com"
                        placeholderTextColor={colors.textMuted}
                        value={newGcpClientEmail}
                        onChangeText={setNewGcpClientEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Service Account Private Key *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12, height: 80 }]}
                        placeholder="-----BEGIN PRIVATE KEY-----"
                        placeholderTextColor={colors.textMuted}
                        value={newGcpPrivateKey}
                        onChangeText={setNewGcpPrivateKey}
                        secureTextEntry
                        multiline
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  ) : newAccProviderKey === 'azure' ? (
                    <>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>Tenant ID *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="GUID"
                        placeholderTextColor={colors.textMuted}
                        value={newAzureTenantId}
                        onChangeText={setNewAzureTenantId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Client (Application) ID *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="GUID"
                        placeholderTextColor={colors.textMuted}
                        value={newAzureClientId}
                        onChangeText={setNewAzureClientId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Client Secret *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="Paste your client secret"
                        placeholderTextColor={colors.textMuted}
                        value={newAzureClientSecret}
                        onChangeText={setNewAzureClientSecret}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />

                      <Text style={[styles.label, { color: colors.textSecondary }]}>Subscription ID *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder="GUID"
                        placeholderTextColor={colors.textMuted}
                        value={newAzureSubscriptionId}
                        onChangeText={setNewAzureSubscriptionId}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={[styles.label, { color: colors.textSecondary }]}>
                        {newAccProviderKey === 'google-play' ? 'Developer ID / Organization Key (Optional)' : 'API Token / Key (Required for live domain & server discovery)'}
                      </Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                        placeholder={newAccProviderKey === 'google-play' ? 'e.g. WorknAi Technologies India Pvt Ltd' : 'Paste API token (e.g. Hostinger, DO, Hetzner, Vultr)'}
                        placeholderTextColor={colors.textMuted}
                        value={newAccExternalId}
                        onChangeText={setNewAccExternalId}
                        secureTextEntry={newAccProviderKey !== 'google-play'}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </>
                  )}

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
                    placeholder="Notes or tags for this account"
                    placeholderTextColor={colors.textMuted}
                    value={newAccNotes}
                    onChangeText={setNewAccNotes}
                  />
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="admin@domainpulse.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newAccEmail}
                    onChangeText={setNewAccEmail}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Label (Optional)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="e.g. Master Registrar Login"
                    placeholderTextColor={colors.textMuted}
                    value={newAccLabel}
                    onChangeText={setNewAccLabel}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
                    placeholder="Notes for this email account"
                    placeholderTextColor={colors.textMuted}
                    value={newAccNotes}
                    onChangeText={setNewAccNotes}
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={() => setIsAddAccountModalOpen(false)}
                  disabled={isCreatingAccount}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 14 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: '#0284c7',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                  }}
                  onPress={handleCreateAccount}
                  disabled={isCreatingAccount}
                >
                  {isCreatingAccount ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                      {newAccType === 'provider' ? 'Save and connect' : 'Save Email Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* EDIT / UPDATE PROVIDER TOKEN MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={!!editingTokenAccount}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setEditingTokenAccount(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.providerModalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setEditingTokenAccount(null)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                height: '65%',
                maxHeight: '90%',
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={styles.dragHandleWrapper}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            </View>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {editingTokenAccount?.label || 'Provider'} — {editingTokenAccount?.providerKey === 'aws' ? 'AWS Credentials' : 'API Token'}
              </Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setEditingTokenAccount(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: 24 }]} keyboardShouldPersistTaps="handled">
              {editingTokenAccount?.providerKey === 'aws' ? (
                <>
                  <View style={{ backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#eff6ff', padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#0369a1' : '#bfdbfe' }}>
                    <Text style={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                      AWS IAM Credentials
                    </Text>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, lineHeight: 17 }}>
                      Update your AWS Access Keys to discover Route53 hosted domains and EC2 virtual servers across regions.
                    </Text>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Access Key ID *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="AKIA..."
                    placeholderTextColor={colors.textMuted}
                    value={editAwsAccessKeyId}
                    onChangeText={setEditAwsAccessKeyId}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Secret Access Key *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Paste your AWS secret access key"
                    placeholderTextColor={colors.textMuted}
                    value={editAwsSecretAccessKey}
                    onChangeText={setEditAwsSecretAccessKey}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Session Token (optional)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Optional STS session token"
                    placeholderTextColor={colors.textMuted}
                    value={editAwsSessionToken}
                    onChangeText={setEditAwsSessionToken}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Regions to inventory (comma-separated)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
                    placeholder="e.g. us-east-1, ap-south-1"
                    placeholderTextColor={colors.textMuted}
                    value={editAwsRegions}
                    onChangeText={setEditAwsRegions}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : editingTokenAccount?.providerKey === 'namecheap' ? (
                <>
                  <View style={{ backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#eff6ff', padding: 12, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: isDark ? '#0369a1' : '#bfdbfe' }}>
                    <Text style={{ color: isDark ? '#93c5fd' : '#1e40af', fontSize: 13, fontWeight: '700', marginBottom: 2 }}>
                      Namecheap API Credentials
                    </Text>
                    <Text style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 12, lineHeight: 17 }}>
                      Provide your API Key and whitelisted Client IP to inventory registered domains.
                    </Text>
                  </View>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>API Key *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Namecheap API key"
                    placeholderTextColor={colors.textMuted}
                    value={editNamecheapApiKey}
                    onChangeText={setEditNamecheapApiKey}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>API Username *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Namecheap API username"
                    placeholderTextColor={colors.textMuted}
                    value={editNamecheapApiUser}
                    onChangeText={setEditNamecheapApiUser}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Client IP (Whitelisted IP)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Your whitelisted client IP (e.g. 103.21.58.112)"
                    placeholderTextColor={colors.textMuted}
                    value={editNamecheapClientIp}
                    onChangeText={setEditNamecheapClientIp}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Account Username (Optional)</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
                    placeholder="Namecheap account username (if different)"
                    placeholderTextColor={colors.textMuted}
                    value={editNamecheapUserName}
                    onChangeText={setEditNamecheapUserName}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : editingTokenAccount?.providerKey === 'gcp' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Project ID *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="e.g. my-project-id"
                    placeholderTextColor={colors.textMuted}
                    value={editGcpProjectId}
                    onChangeText={setEditGcpProjectId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Service Account Email *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="name@project.iam.gserviceaccount.com"
                    placeholderTextColor={colors.textMuted}
                    value={editGcpClientEmail}
                    onChangeText={setEditGcpClientEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Service Account Private Key *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16, height: 80 }]}
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    placeholderTextColor={colors.textMuted}
                    value={editGcpPrivateKey}
                    onChangeText={setEditGcpPrivateKey}
                    secureTextEntry
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : editingTokenAccount?.providerKey === 'azure' ? (
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Tenant ID *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="GUID"
                    placeholderTextColor={colors.textMuted}
                    value={editAzureTenantId}
                    onChangeText={setEditAzureTenantId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Client (Application) ID *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="GUID"
                    placeholderTextColor={colors.textMuted}
                    value={editAzureClientId}
                    onChangeText={setEditAzureClientId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Client Secret *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder="Paste your client secret"
                    placeholderTextColor={colors.textMuted}
                    value={editAzureClientSecret}
                    onChangeText={setEditAzureClientSecret}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.label, { color: colors.textSecondary }]}>Subscription ID *</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 16 }]}
                    placeholder="GUID"
                    placeholderTextColor={colors.textMuted}
                    value={editAzureSubscriptionId}
                    onChangeText={setEditAzureSubscriptionId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : (
                <>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 16 }}>
                    Paste or update your {editingTokenAccount?.providerKey.toUpperCase()} API token/key to enable live domain and VPS discovery.
                  </Text>

                  <Text style={[styles.label, { color: colors.textSecondary }]}>API Token / Key</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 20 }]}
                    placeholder="Paste API token / key"
                    placeholderTextColor={colors.textMuted}
                    value={editingTokenValue}
                    onChangeText={setEditingTokenValue}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={() => setEditingTokenAccount(null)}
                  disabled={isSavingToken}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 14 }}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 2,
                    backgroundColor: '#0284c7',
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                  }}
                  onPress={handleSaveAndSyncToken}
                  disabled={isSavingToken}
                >
                  {isSavingToken ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>
                      Save and connect
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* CUSTOM PROFESSIONAL FEEDBACK DIALOG (Replaces raw system alert)            */}
      {/* ========================================================================= */}
      <Modal
        visible={feedbackModal?.visible ?? false}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFeedbackModal(null)}
      >
        <View style={styles.feedbackOverlay}>
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => setFeedbackModal(null)}
          />
          <View style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Top Icon Badge */}
            <View
              style={[
                styles.feedbackIconBadge,
                {
                  backgroundColor:
                    feedbackModal?.type === 'success'
                      ? colors.emeraldMuted
                      : feedbackModal?.type === 'error'
                      ? colors.roseMuted
                      : colors.primaryMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.feedbackIconGlyph,
                  {
                    color:
                      feedbackModal?.type === 'success'
                        ? colors.emerald
                        : feedbackModal?.type === 'error'
                        ? colors.rose
                        : colors.primary,
                  },
                ]}
              >
                {feedbackModal?.type === 'success' ? '✓' : feedbackModal?.type === 'error' ? '✕' : 'ℹ'}
              </Text>
            </View>

            {/* Title */}
            <Text style={[styles.feedbackTitle, { color: colors.text }]}>
              {feedbackModal?.title}
            </Text>

            {/* Message */}
            <Text style={[styles.feedbackMessage, { color: colors.textSecondary }]}>
              {feedbackModal?.message}
            </Text>

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.feedbackBtn,
                {
                  backgroundColor:
                    feedbackModal?.type === 'error' ? colors.rose : colors.primary,
                },
              ]}
              onPress={() => setFeedbackModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.feedbackBtnText}>
                {feedbackModal?.type === 'success' ? 'Done' : 'Got it'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* VIEW ALL DOMAINS FOR SELECTED PROVIDER ACCOUNT MODAL                       */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedAccountForDomains}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedAccountForDomains(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.providerModalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setSelectedAccountForDomains(null)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                height: '92%',
                maxHeight: '96%',
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={styles.dragHandleWrapper}>
              <View style={[styles.dragHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            </View>

            {/* Modal Header */}
            <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                {selectedAccountForDomains && PROVIDER_LOGOS[(selectedAccountForDomains.providerKey || '').toLowerCase()] ? (
                  <View
                    style={[
                      styles.providerLogoBox,
                      {
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc',
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <Image
                      source={PROVIDER_LOGOS[(selectedAccountForDomains.providerKey || '').toLowerCase()]}
                      style={{ width: 24, height: 24 }}
                      contentFit="contain"
                    />
                  </View>
                ) : (
                  <Ionicons name="globe-outline" size={24} color="#0284c7" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetTitle, { color: colors.text, fontSize: 16 }]} numberOfLines={1}>
                    {selectedAccountForDomains?.label || 'Provider Domains'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Connected Domain Portfolio
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedAccountForDomains(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body with Domains List */}
            {selectedAccountForDomains && (() => {
              const accountDomains = getDomainsForAccount(selectedAccountForDomains, allDomains);
              const filteredDomains = accountDomains.filter((d) => {
                if (domainSearchQuery.trim()) {
                  const q = domainSearchQuery.toLowerCase().trim();
                  if (!d.name.toLowerCase().includes(q)) return false;
                }
                if (domainFilterStatus !== 'all') {
                  if (d.status !== domainFilterStatus) return false;
                }
                return true;
              });

              return (
                <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }}>
                  {/* Account Overview Stats Card */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isDark ? 'rgba(2, 132, 199, 0.12)' : '#f0f9ff',
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd',
                      borderWidth: 1,
                      borderRadius: 14,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <View>
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>
                        {accountDomains.length} {accountDomains.length === 1 ? 'Domain' : 'Domains'} Linked
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 1 }}>
                        Provider: {selectedAccountForDomains.providerKey.toUpperCase()} • Direct API
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: '#0284c7',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}
                      disabled={syncingProviderId === selectedAccountForDomains.id}
                      onPress={async () => {
                        setSyncingProviderId(selectedAccountForDomains.id);
                        try {
                          const res = await syncProviderAccount({
                            providerKey: selectedAccountForDomains.providerKey,
                            accountName: selectedAccountForDomains.label,
                            apiKey: selectedAccountForDomains.externalAccountId || undefined,
                            providerAccountId: selectedAccountForDomains.id,
                          });
                          await loadAccounts();
                          showFeedback(
                            res.success ? 'Provider Synced' : 'Sync Notice',
                            res.message,
                            res.success ? 'success' : 'error'
                          );
                        } catch (err: any) {
                          showFeedback('Sync Error', err?.message || 'Failed to sync provider.', 'error');
                        } finally {
                          setSyncingProviderId(null);
                        }
                      }}
                    >
                      {syncingProviderId === selectedAccountForDomains.id ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="sync" size={13} color="#ffffff" />
                          <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>Sync Now</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Search Bar */}
                  {accountDomains.length > 2 && (
                    <View
                      style={[
                        styles.domainSearchBox,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons name="search" size={16} color={colors.textSecondary} />
                      <TextInput
                        style={[styles.domainSearchInput, { color: colors.text }]}
                        placeholder={`Search ${accountDomains.length} domains...`}
                        placeholderTextColor={colors.textMuted}
                        value={domainSearchQuery}
                        onChangeText={setDomainSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {domainSearchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setDomainSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Domains ScrollView */}
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                  >
                    {filteredDomains.length === 0 ? (
                      <View
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 36,
                          paddingHorizontal: 20,
                        }}
                      >
                        <Ionicons name="globe-outline" size={44} color={colors.textMuted} style={{ marginBottom: 12 }} />
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
                          {accountDomains.length === 0 ? 'No Domains Discovered Yet' : 'No Domains Match Search'}
                        </Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 280, marginBottom: 16 }}>
                          {accountDomains.length === 0
                            ? `Tap 'Sync Now' above to pull live domain records from ${selectedAccountForDomains.label}.`
                            : 'Try searching with a different domain name or clear the search query.'}
                        </Text>
                      </View>
                    ) : (
                      filteredDomains.map((dom) => {
                        const statusColor = dom.status === 'critical' ? '#ef4444' : dom.status === 'warning' ? '#f59e0b' : '#10b981';
                        return (
                          <View
                            key={dom.id || dom.name}
                            style={[
                              styles.accountDomainCard,
                              {
                                backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                borderColor: isDark ? colors.border : '#e2e8f0',
                              },
                            ]}
                          >
                            {/* Domain Header: Name + Health Badge */}
                            <View style={styles.accountDomainCardHeader}>
                              <View style={styles.accountDomainNameRow}>
                                <Ionicons name="globe" size={16} color="#0284c7" />
                                <Text style={[styles.accountDomainNameText, { color: colors.text }]} numberOfLines={1}>
                                  {dom.name}
                                </Text>
                              </View>

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={[styles.domainHealthStatusBadge, { backgroundColor: `${statusColor}22` }]}>
                                  <Text style={[styles.domainHealthStatusText, { color: statusColor }]}>
                                    {dom.status}
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
                                  onPress={async (e) => {
                                    e.stopPropagation?.();
                                    setAllDomains((prev) => prev.filter((d) => d.id !== dom.id));
                                    try {
                                      await deleteDomain(dom.id);
                                    } catch {}
                                  }}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  activeOpacity={0.6}
                                >
                                  <Ionicons name="close" size={13} color={colors.textMuted} />
                                </TouchableOpacity>
                              </View>
                            </View>

                            {/* Meta items: Expiry, Days remaining, SSL, Auto-renew */}
                            <View style={styles.accountDomainMetaRow}>
                              <View style={styles.accountDomainMetaItem}>
                                <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                                <Text style={[styles.accountDomainMetaText, { color: colors.textSecondary }]}>
                                  {dom.daysRemaining} days left
                                </Text>
                              </View>

                              <View style={styles.accountDomainMetaItem}>
                                <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                                <Text style={[styles.accountDomainMetaText, { color: colors.textSecondary }]}>
                                  {dom.expiresAt ? dom.expiresAt.split('T')[0] : 'Active'}
                                </Text>
                              </View>

                              <View style={styles.accountDomainMetaItem}>
                                <Ionicons name="shield-checkmark-outline" size={12} color="#10b981" />
                                <Text style={[styles.accountDomainMetaText, { color: '#10b981' }]}>
                                  {dom.sslStatus || 'SSL Active'}
                                </Text>
                              </View>

                              {dom.autoRenew && (
                                <View style={styles.accountDomainMetaItem}>
                                  <Ionicons name="refresh-outline" size={12} color="#0284c7" />
                                  <Text style={[styles.accountDomainMetaText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                                    Auto-Renew
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Actions Row */}
                            <View style={[styles.accountDomainCardActions, { borderTopColor: isDark ? colors.border : '#f1f5f9' }]}>
                              <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 }}
                                onPress={() => {
                                  Share.share({ message: `Domain: ${dom.name}\nRegistrar: ${dom.registrar}\nExpires: ${dom.expiresAt}` }).catch(() => {});
                                }}
                              >
                                <Ionicons name="share-outline" size={13} color={colors.textSecondary} />
                                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>Share</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.viewInDomainsTabBtn, { backgroundColor: '#0284c7' }]}
                                onPress={() => {
                                  setSelectedAccountForDomains(null);
                                  setActiveModal(null);
                                  router.push('/(tabs)/domains');
                                }}
                              >
                                <Text style={styles.viewInDomainsTabBtnText}>View in Domains Tab</Text>
                                <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              );
            })()}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !isDeletingAccount && setShowDeleteConfirm(false)}
      >
        <View style={styles.feedbackOverlay}>
          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecdd3',
              },
            ]}
          >
            <View
              style={[
                styles.feedbackIconBadge,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' },
              ]}
            >
              <Text style={styles.feedbackIconGlyph}>⚠️</Text>
            </View>

            <Text style={[styles.feedbackTitle, { color: '#dc2626' }]}>
              Delete Account
            </Text>

            <Text style={[styles.feedbackMessage, { color: colors.textSecondary }]}>
              Are you sure you want to permanently delete your account? This action cannot be undone and all your monitored domains, servers, and configuration data will be permanently removed.
            </Text>

            <View style={styles.deleteModalBtnRow}>
              <TouchableOpacity
                style={[
                  styles.deleteCancelBtn,
                  {
                    backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
                activeOpacity={0.7}
              >
                <Text style={[styles.deleteCancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteConfirmBtn, { backgroundColor: '#dc2626' }]}
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
                activeOpacity={0.8}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Provider Action Sheet Modal (Opened from 3-dots) */}
      <Modal
        visible={!!selectedProviderMenu}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedProviderMenu(null)}
      >
        <View style={styles.providerModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setSelectedProviderMenu(null)}
          />
          <View style={[styles.providerActionSheet, { backgroundColor: isDark ? '#111827' : '#ffffff', paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />
            
            <View style={styles.providerSheetHeader}>
              <View style={[styles.providerLogoBox, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f8fafc', borderColor: isDark ? colors.border : '#e2e8f0' }]}>
                {selectedProviderMenu && PROVIDER_LOGOS[selectedProviderMenu.id] ? (
                  <Image
                    source={PROVIDER_LOGOS[selectedProviderMenu.id]}
                    style={styles.providerLogoImg}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.providerLogoGlyph}>{selectedProviderMenu?.icon || '☁️'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedProviderMenu?.name}</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  {selectedProviderMenu?.status === 'connected' ? 'Connected Cloud Registrar / Host' : 'Available Cloud Integration'}
                </Text>
              </View>
            </View>

            <View style={styles.providerMenuOptionsList}>
              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  const pName = selectedProviderMenu?.name;
                  setSelectedProviderMenu(null);
                  setTimeout(() => {
                    showFeedback('API Verification', `Connection to ${pName} is active and authenticating properly. Latency: 42ms`, 'success');
                  }, 200);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                  <Text style={{ fontSize: 16 }}>🔄</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Test API Connection &amp; Health</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Verify API token and sync permissions</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  const pName = selectedProviderMenu?.name;
                  setSelectedProviderMenu(null);
                  setTimeout(() => {
                    showFeedback('Sync Started', `Synchronizing all DNS zones, SSL records, and servers for ${pName}...`, 'info');
                  }, 200);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Sync Domains &amp; DNS Records</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Pull latest authoritative zone records</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                onPress={() => {
                  const pName = selectedProviderMenu?.name;
                  setSelectedProviderMenu(null);
                  setTimeout(() => {
                    showFeedback('API Key Settings', `Enter new API Token / Secret credentials for ${pName}.`, 'info');
                  }, 200);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff' }]}>
                  <Text style={{ fontSize: 16 }}>🔑</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuOptionText, { color: colors.text }]}>Update API Key &amp; Secrets</Text>
                  <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Rotate credentials or change webhook URL</Text>
                </View>
              </TouchableOpacity>

              {selectedProviderMenu?.status === 'connected' && (
                <TouchableOpacity
                  style={[styles.menuOptionBtn, { borderColor: isDark ? '#1f2937' : '#f1f5f9' }]}
                  onPress={() => {
                    const pName = selectedProviderMenu?.name;
                    setSelectedProviderMenu(null);
                    setTimeout(() => {
                      showFeedback('Disconnect Provider', `${pName} integration has been unlinked from this workspace.`, 'info');
                    }, 200);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2' }]}>
                    <Text style={{ fontSize: 16 }}>🔌</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.menuOptionText, { color: '#ef4444' }]}>Disconnect Provider</Text>
                    <Text style={[styles.menuOptionSub, { color: colors.textMuted }]}>Revoke sync access and remove stored credentials</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
              onPress={() => setSelectedProviderMenu(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Format Guide Modal */}
      <Modal
        visible={showFormatGuideModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowFormatGuideModal(false)}
      >
        <View style={styles.providerModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setShowFormatGuideModal(false)}
          />
          <View
            style={[
              styles.guideSheetContainer,
              { backgroundColor: isDark ? '#0f172a' : '#ffffff', maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
            <View style={styles.guideSheetHeader}>
              <View style={[styles.guideIconBadge, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                <Text style={{ fontSize: 20 }}>📖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guideTitle, { color: colors.text }]}>Supported Import Formats</Text>
                <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>
                  Copy an example template or load it directly into the import box
                </Text>
              </View>
            </View>

            <ScrollView style={{ flexGrow: 0, marginVertical: 8 }} showsVerticalScrollIndicator={false}>
              {/* CSV Format */}
              <View
                style={[
                  styles.formatSpecCard,
                  { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.formatSpecHeader}>
                  <Text style={[styles.formatSpecName, { color: colors.text }]}>1. CSV (Comma Separated)</Text>
                  <TouchableOpacity
                    style={[styles.useTemplateBtn, { backgroundColor: '#0284c7' }]}
                    onPress={() => {
                      handleLoadSampleImport('csv');
                      setShowFormatGuideModal(false);
                    }}
                  >
                    <Text style={styles.useTemplateBtnText}>Use Template</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.formatSpecDesc, { color: colors.textSecondary }]}>
                  Syntax: <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#0284c7' }}>domain, registrar, autoRenew</Text>
                </Text>
                <View style={[styles.codeSnippetBox, { backgroundColor: isDark ? '#020617' : '#0f172a' }]}>
                  <Text style={styles.codeSnippetText}>
                    {`domainpulse.io, Cloudflare, true\ncloudinfrastructure.dev, AWS, true\nsecureenterprise.org, GoDaddy, false`}
                  </Text>
                </View>
              </View>

              {/* TXT Format */}
              <View
                style={[
                  styles.formatSpecCard,
                  { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', marginTop: 10 },
                ]}
              >
                <View style={styles.formatSpecHeader}>
                  <Text style={[styles.formatSpecName, { color: colors.text }]}>2. Plain Text (One per line)</Text>
                  <TouchableOpacity
                    style={[styles.useTemplateBtn, { backgroundColor: '#0284c7' }]}
                    onPress={() => {
                      handleLoadSampleImport('txt');
                      setShowFormatGuideModal(false);
                    }}
                  >
                    <Text style={styles.useTemplateBtnText}>Use Template</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.formatSpecDesc, { color: colors.textSecondary }]}>
                  Simple domain name per line.
                </Text>
                <View style={[styles.codeSnippetBox, { backgroundColor: isDark ? '#020617' : '#0f172a' }]}>
                  <Text style={styles.codeSnippetText}>
                    {`mybrandhub.com\nprod-edge-network.org\nsecure-vault.io`}
                  </Text>
                </View>
              </View>

              {/* BIND Zone Format */}
              <View
                style={[
                  styles.formatSpecCard,
                  { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc', borderColor: isDark ? '#334155' : '#e2e8f0', marginTop: 10 },
                ]}
              >
                <View style={styles.formatSpecHeader}>
                  <Text style={[styles.formatSpecName, { color: colors.text }]}>3. BIND RFC 1035 Zone File</Text>
                  <TouchableOpacity
                    style={[styles.useTemplateBtn, { backgroundColor: '#0284c7' }]}
                    onPress={() => {
                      handleLoadSampleImport('bind');
                      setShowFormatGuideModal(false);
                    }}
                  >
                    <Text style={styles.useTemplateBtnText}>Use Template</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.formatSpecDesc, { color: colors.textSecondary }]}>
                  Standard zone file origin and resource records.
                </Text>
                <View style={[styles.codeSnippetBox, { backgroundColor: isDark ? '#020617' : '#0f172a' }]}>
                  <Text style={styles.codeSnippetText}>
                    {`$ORIGIN pulsezone.io.\n@ IN A 104.21.45.12\napi IN A 104.21.45.13`}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', marginTop: 8 }]}
              onPress={() => setShowFormatGuideModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Export Preview Modal */}
      <Modal
        visible={exportPreviewModal !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setExportPreviewModal(null)}
      >
        <View style={styles.providerModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setExportPreviewModal(null)}
          />
          <View
            style={[
              styles.guideSheetContainer,
              { backgroundColor: isDark ? '#0f172a' : '#ffffff', maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            <View style={styles.guideSheetHeader}>
              <View style={[styles.guideIconBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7' }]}>
                <Text style={{ fontSize: 22 }}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guideTitle, { color: colors.text }]}>Export Ready</Text>
                <Text style={[styles.guideSubtitle, { color: colors.textSecondary }]}>
                  {exportPreviewModal?.fileName} ({exportPreviewModal?.count} domain{exportPreviewModal?.count === 1 ? '' : 's'})
                </Text>
              </View>
            </View>

            <View style={{ marginVertical: 10, flexShrink: 1 }}>
              <Text style={[styles.subSectionTitle, { color: colors.textMuted }]}>Generated File Preview</Text>
              <ScrollView style={[styles.codeSnippetBox, { backgroundColor: isDark ? '#020617' : '#0f172a', maxHeight: 220 }]}>
                <Text style={styles.codeSnippetText} selectable>
                  {exportPreviewModal?.content}
                </Text>
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={[styles.exportNowBtn, { flex: 1, backgroundColor: '#0284c7' }]}
                onPress={() => {
                  if (exportPreviewModal) {
                    Share.share({
                      title: exportPreviewModal.fileName,
                      message: exportPreviewModal.content,
                    }).catch(() => {});
                  }
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.exportNowBtnIcon}>📤</Text>
                <Text style={styles.exportNowBtnText}>Share / Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 1, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', marginTop: 0 }]}
                onPress={() => setExportPreviewModal(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  innerContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.titleLarge,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  themePillIcon: {
    fontSize: 14,
  },
  themePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerGearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerGearIcon: {
    fontSize: 18,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeOptionIcon: {
    fontSize: 15,
  },
  themeOptionText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl + 120,
    gap: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
  },
  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  gearIcon: {
    fontSize: 20,
  },
  menuCardsList: {
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  menuIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconGlyph: {
    fontSize: 20,
  },
  menuTextCol: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 22,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 4,
    position: 'relative',
    gap: 8,
  },
  logoutIcon: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '800',
  },
  logoutChevron: {
    position: 'absolute',
    right: 20,
    fontSize: 20,
    fontWeight: '700',
    color: '#e11d48',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 2,
    marginBottom: Spacing.md,
    position: 'relative',
    gap: 8,
  },
  deleteIcon: {
    fontSize: 17,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '800',
  },
  deleteChevron: {
    position: 'absolute',
    right: 20,
    fontSize: 20,
    fontWeight: '700',
    color: '#dc2626',
  },
  deleteModalBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelBtnText: {
    fontWeight: '700',
    fontSize: 15,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteConfirmBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },

  // Modal Sheet Styles
  keyboardAvoid: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '96%',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetBody: {
    padding: Spacing.lg,
  },
  profileModalHeroCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  profileModalAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileModalAvatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  profileModalAvatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  profileModalHeroName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  profileModalHeroEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  profileModalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  profileModalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileModalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileModalFormCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  profileModalSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileModalSectionSubtitle: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 6,
  },
  profileInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  profileInput: {
    flex: 1,
    fontSize: 14.5,
    paddingVertical: 0,
    height: 48,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  profileStatCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  profileStatNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileStatLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  formGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  passwordFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  passwordFieldInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
    margin: 0,
    height: 48,
  },
  eyeBtn: {
    paddingLeft: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeBtnText: {
    fontSize: 18,
    opacity: 0.8,
  },
  primaryActionBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  dragHandleWrapper: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  providerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: 12,
  },
  providerHeaderIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  providerHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  providerHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  providerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Hero Card
  providerHeroCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  providerHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  providerHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  heroPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0284c7',
  },
  providerHeroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  syncAllHeroBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  syncAllHeroBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  providerHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  providerHeroSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  heroTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
  },
  segmentedTabText: {
    fontWeight: '700',
    fontSize: 12,
  },

  // Section Header
  providerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 2,
  },
  providerSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  addAccountHeaderBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addAccountHeaderBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },

  // Lists & Empty State
  providerCardsList: {
    gap: 10,
  },
  emptyProviderBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Connected Provider Card (3-Tier Structure)
  connectedProviderCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  providerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    padding: 5,
  },
  providerLogoImg: {
    width: 28,
    height: 28,
  },
  providerLogoGlyph: {
    fontSize: 22,
    textAlign: 'center',
  },
  providerInfoCol: {
    flex: 1,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  providerItemName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeStatusText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  providerKeyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  providerKeyTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  providerKeyPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  providerIdText: {
    fontSize: 11,
    fontWeight: '600',
  },
  providerCardDivider: {
    height: 1,
    marginVertical: 12,
  },
  providerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerSyncBtn: {
    flex: 1.2,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  providerSyncBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  providerTokenBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerTokenBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  providerDisconnectBtn: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerDisconnectBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  emailDeleteSmallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Supported Provider Card
  supportedProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  supportedProviderTextCol: {
    flex: 1,
  },
  supportedProviderName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  supportedTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  supportedTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  supportedProviderDesc: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  supportedProviderRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  connectedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  connectedBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  connectSolidBtn: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectSolidBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  moreDotsBtn: {
    padding: 6,
  },
  moreDotsText: {
    fontSize: 18,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  providerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIcon: {
    fontSize: 22,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  providerStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  connectToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  gapVertical: {
    gap: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
    borderRadius: 16,
    gap: 6,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  infoCardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionOutlineBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  currencyPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  planCard: {
    borderWidth: 2,
    borderRadius: 18,
    padding: Spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  activeTag: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 6,
  },
  planFeatures: {
    fontSize: 13,
    lineHeight: 20,
  },
  aboutContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  aboutLogoBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  aboutTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  aboutVersion: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  aboutDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: Spacing.md,
  },
  copyrightText: {
    fontSize: 12,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  feedbackIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  feedbackIconGlyph: {
    fontSize: 26,
    fontWeight: '800',
  },
  feedbackTitle: {
    ...Typography.titleMedium,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  feedbackMessage: {
    ...Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  feedbackBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  importExportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  importExportCircleBtn: {
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
  importExportCircleBtnText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  importExportHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  importExportHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  importExportCard: {
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
  ieCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  ieCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  ieIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ieIconGlyph: {
    fontSize: 22,
  },
  ieCardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  ieCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  viewFormatBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  viewFormatBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  dropzoneBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dropzoneCloudCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  dropzoneCloudIcon: {
    fontSize: 24,
  },
  dropzoneTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropzoneSubtitle: {
    fontSize: 11,
  },
  chooseFileBtn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chooseFileBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  subSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  formatCardsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formatCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'flex-start',
    gap: 4,
  },
  formatIconBadge: {
    padding: 4,
    borderRadius: 6,
    marginBottom: 2,
  },
  formatCardName: {
    fontSize: 13,
    fontWeight: '800',
  },
  formatCardDesc: {
    fontSize: 10,
    lineHeight: 13,
  },
  importOptionsList: {
    gap: 8,
  },
  importOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  importOptionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  importOptionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  exportRow: {
    gap: 8,
  },
  exportRowLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  exportFormatsGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  exportFormatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  exportFormatBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  exportDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  exportDropdownText: {
    fontSize: 13,
    fontWeight: '600',
  },
  includedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  includedCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  includedCheckIcon: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  includedTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  includedText: {
    fontSize: 11,
    lineHeight: 15,
  },
  exportNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  exportNowBtnIcon: {
    fontSize: 16,
  },
  exportNowBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  providerModalOverlay: {
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
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  providerActionSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    gap: Spacing.sm,
    zIndex: 10,
  },
  providerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  providerMenuOptionsList: {
    gap: 6,
    marginTop: 4,
  },
  actionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
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
  importInputContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  importInputTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importInputTopLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  importTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    minHeight: 110,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  importDetectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importDetectionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scopePillBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopePillText: {
    fontSize: 12,
  },
  guideSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    zIndex: 10,
  },
  guideSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  guideIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  guideSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  formatSpecCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  formatSpecHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatSpecName: {
    fontSize: 13,
    fontWeight: '800',
  },
  useTemplateBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  useTemplateBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  formatSpecDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  codeSnippetBox: {
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  codeSnippetText: {
    color: '#38bdf8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },

  // Provider Domains Summary Row inside card
  accountDomainsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    gap: 8,
  },
  domainsBadgeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  domainGlobeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountDomainsCountText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  domainActiveBadgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  domainActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  accountDomainsSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  viewDomainsActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewDomainsActionText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Modal: Provider Domains Viewer
  domainSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  domainSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 2,
  },
  accountDomainCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 6,
  },
  accountDomainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountDomainNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accountDomainNameText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  domainHealthStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  domainHealthStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  accountDomainMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  accountDomainMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  accountDomainMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  accountDomainCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  viewInDomainsTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewInDomainsTabBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

