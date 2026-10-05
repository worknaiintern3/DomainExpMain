import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { useAuth } from '../../store/auth-context';
import { useSettings } from '../../store/settings-context';
import { fetchDomainsList, importDomainsBatch } from '../../services/domains';
import {
  fetchProviderAccountsList,
  createProviderAccount,
  deleteProviderAccount,
  fetchEmailAccountsList,
  createEmailAccount,
  deleteEmailAccount,
} from '../../services/accounts';
import { getEffectiveApiUrl, setCustomApiUrl, apiGet } from '../../services/api';
import { syncConsoleAccount, syncDomainRegistrar, syncCloudServers } from '../../services/providerSync';
import { API_CONFIG } from '../../constants/config';
import type { ProviderAccount, EmailAccount } from '../../types';

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

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, themeMode, setThemeMode, isDark, toggleTheme } = useTheme();
  const { user, logout, deleteAccount, updateUser, changePassword } = useAuth();
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
  const [accountsView, setAccountsView] = useState<'providers' | 'emails'>('providers');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [newAccType, setNewAccType] = useState<'provider' | 'email'>('provider');
  const [newAccProviderKey, setNewAccProviderKey] = useState('hostinger');
  const [newAccLabel, setNewAccLabel] = useState('');
  const [newAccExternalId, setNewAccExternalId] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccNotes, setNewAccNotes] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // API Server Config State
  const [currentApiUrl, setCurrentApiUrl] = useState(getEffectiveApiUrl());
  const [apiDraftUrl, setApiDraftUrl] = useState(getEffectiveApiUrl());
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'unknown' | 'testing' | 'online' | 'offline'>('unknown');
  const [apiPingLatency, setApiPingLatency] = useState<number | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const [pList, eList] = await Promise.all([
        fetchProviderAccountsList(),
        fetchEmailAccountsList(),
      ]);
      setProviderAccounts(pList);
      setEmailAccounts(eList);
    } catch {}
  }, []);

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

  const handleCreateAccount = async () => {
    if (newAccType === 'provider') {
      if (!newAccLabel.trim()) {
        showFeedback('Missing Label', 'Please enter a descriptive label for this provider account.', 'error');
        return;
      }
      setIsCreatingAccount(true);
      try {
        await createProviderAccount({
          providerKey: newAccProviderKey,
          label: newAccLabel.trim(),
          externalAccountId: newAccExternalId.trim() || undefined,
          notes: newAccNotes.trim() || undefined,
        });

        // Trigger resource sync based on provider key
        if (newAccProviderKey === 'google-play' || newAccProviderKey === 'googleplay') {
          await syncConsoleAccount({
            developerName: newAccExternalId.trim() || newAccLabel.trim() || 'WorknAi Technologies India Pvt Ltd',
          });
        } else if (['cloudflare', 'godaddy', 'namecheap', 'hostinger'].includes(newAccProviderKey)) {
          await syncDomainRegistrar({
            providerKey: newAccProviderKey,
            accountName: newAccLabel.trim(),
            apiKey: newAccExternalId.trim() || undefined,
          });
        } else if (['aws', 'digitalocean', 'hetzner'].includes(newAccProviderKey)) {
          await syncCloudServers({
            providerKey: newAccProviderKey,
            accountName: newAccLabel.trim(),
            apiKey: newAccExternalId.trim() || undefined,
          });
        }

        await loadAccounts();
        setIsAddAccountModalOpen(false);
        setNewAccLabel('');
        setNewAccExternalId('');
        setNewAccNotes('');
        showFeedback(
          'Account Connected & Synced',
          `Successfully linked ${newAccLabel} to DomainPulse and synchronized inventory!`,
          'success'
        );
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

  const menuItems = [
    {
      id: 'profile' as ModalType,
      icon: '👤',
      iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
      iconColor: '#0284c7',
      label: 'Profile',
      subtitle: 'View and edit your personal information',
    },
    {
      id: 'providers' as ModalType,
      icon: '🔗',
      iconBg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
      iconColor: '#10b981',
      label: 'Provider Connections',
      subtitle: 'Manage your DNS & cloud provider accounts',
    },
    {
      id: 'import_export' as ModalType,
      icon: '📤',
      iconBg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      iconColor: '#f59e0b',
      label: 'Import / Export',
      subtitle: 'Import or export your domain data',
    },
    {
      id: 'settings' as ModalType,
      icon: '⚙️',
      iconBg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f3e8ff',
      iconColor: '#8b5cf6',
      label: 'Settings',
      subtitle: 'App preferences and customization',
    },
    {
      id: 'security' as ModalType,
      icon: '🛡️',
      iconBg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
      iconColor: '#f43f5e',
      label: 'Security',
      subtitle: 'Password, 2FA and security options',
    },
    {
      id: 'billing' as ModalType,
      icon: '💳',
      iconBg: isDark ? 'rgba(249, 115, 22, 0.15)' : '#ffedd5',
      iconColor: '#f97316',
      label: 'Billing',
      subtitle: 'Manage your subscription and payments',
    },
    {
      id: 'help' as ModalType,
      icon: '❓',
      iconBg: isDark ? 'rgba(244, 63, 94, 0.15)' : '#ffe4e6',
      iconColor: '#f43f5e',
      label: 'Help & Support',
      subtitle: 'Get help or contact our support team',
    },
    {
      id: 'about' as ModalType,
      icon: 'ℹ️',
      iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
      iconColor: '#0284c7',
      label: 'About DomainPulse',
      subtitle: 'App version, terms and privacy policy',
    },
  ];

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
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              ) : activeModal === 'providers' ? (
                <View style={styles.providerHeaderRow}>
                  <View style={[styles.providerHeaderIconBox, { backgroundColor: '#0284c7' }]}>
                    <Text style={styles.providerHeaderIconGlyph}>🔗</Text>
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.providerHeaderTitle, { color: colors.text }]}>Provider Connections</Text>
                    <Text style={[styles.providerHeaderSubtitle, { color: colors.textSecondary }]}>
                      Manage synced DNS registries and cloud providers to auto-discover domains and servers.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.providerCloseBtn, { backgroundColor: isDark ? colors.surfaceHighlight : '#f1f5f9' }]}
                    onPress={() => setActiveModal(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={[styles.providerCloseText, { color: colors.text }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.sheetHeader, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>
                    {activeModal === 'profile' && 'User Profile'}
                    {activeModal === 'settings' && 'App Settings'}
                    {activeModal === 'security' && 'Security & Auth'}
                    {activeModal === 'billing' && 'Subscription & Billing'}
                    {activeModal === 'help' && 'Help & Support'}
                    {activeModal === 'about' && 'About DomainPulse'}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setActiveModal(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView
                contentContainerStyle={[
                  styles.sheetBody,
                  { paddingBottom: Spacing.xxl },
                ]}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. PROFILE */}
                {activeModal === 'profile' && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      value={draftName}
                      onChangeText={setDraftName}
                      placeholder="Your Name"
                      placeholderTextColor={colors.textMuted}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                      Email Address
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      value={draftEmail}
                      onChangeText={setDraftEmail}
                      placeholder="email@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.textMuted}
                    />

                    <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                      Organization / Company
                    </Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                      value={draftOrg}
                      onChangeText={setDraftOrg}
                      placeholder="Organization Name"
                      placeholderTextColor={colors.textMuted}
                    />

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
                      onPress={handleSaveProfile}
                    >
                      <Text style={styles.primaryActionBtnText}>Save Profile Changes</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 2. PROVIDER CONNECTIONS & ACCOUNTS */}
                {activeModal === 'providers' && (
                  <View style={{ gap: Spacing.lg }}>
                    {/* Hero Banner Card */}
                    <View
                      style={[
                        styles.providerHeroCard,
                        {
                          backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
                          borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#bae6fd',
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.providerHeroTitle, { color: isDark ? '#38bdf8' : '#0369a1' }]}>
                          Accounts & Integrations
                        </Text>
                        <Text style={[styles.providerHeroSubtitle, { color: colors.textSecondary }]}>
                          Synchronize DNS providers, registrar credentials and infrastructure email accounts.
                        </Text>
                        <View style={styles.heroTagsRow}>
                          <View style={[styles.heroTagPill, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
                            <Text style={[styles.heroTagCheck, { color: '#16a34a' }]}>✓</Text>
                            <Text style={[styles.heroTagText, { color: colors.text }]}>{providerAccounts.length} Providers</Text>
                          </View>
                          <View style={[styles.heroTagPill, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
                            <Text style={styles.heroTagIcon}>✉️</Text>
                            <Text style={[styles.heroTagText, { color: colors.text }]}>{emailAccounts.length} Emails</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.heroGlobeBox}>
                        <Text style={styles.heroGlobeIcon}>🌐</Text>
                      </View>
                    </View>

                    {/* View Switcher: Provider Accounts vs Email Accounts */}
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: isDark ? colors.surfaceElevated : '#f1f5f9',
                        borderRadius: 12,
                        padding: 4,
                      }}
                    >
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderRadius: 8,
                          backgroundColor: accountsView === 'providers' ? colors.primary : 'transparent',
                        }}
                        onPress={() => setAccountsView('providers')}
                      >
                        <Text
                          style={{
                            color: accountsView === 'providers' ? '#ffffff' : colors.textSecondary,
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
                          Provider Accounts ({providerAccounts.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          alignItems: 'center',
                          borderRadius: 8,
                          backgroundColor: accountsView === 'emails' ? colors.primary : 'transparent',
                        }}
                        onPress={() => setAccountsView('emails')}
                      >
                        <Text
                          style={{
                            color: accountsView === 'emails' ? '#ffffff' : colors.textSecondary,
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
                          Email Accounts ({emailAccounts.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Section Header with Add Button */}
                    <View style={styles.providerSectionHeader}>
                      <View style={styles.providerSectionTitleLeft}>
                        <Text style={[styles.providerSectionTitle, { color: colors.text }]}>
                          {accountsView === 'providers' ? 'Connected Providers' : 'Managed Email Accounts'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{
                          backgroundColor: '#0284c7',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        onPress={() => {
                          setNewAccType(accountsView === 'providers' ? 'provider' : 'email');
                          setIsAddAccountModalOpen(true);
                        }}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>+ Add Account</Text>
                      </TouchableOpacity>
                    </View>

                    {/* List Section */}
                    {accountsView === 'providers' ? (
                      <View style={styles.providerCardsList}>
                        {providerAccounts.length === 0 ? (
                          <View style={{ padding: 24, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No provider accounts connected yet.</Text>
                          </View>
                        ) : (
                          providerAccounts.map((p) => {
                            const key = (p.providerKey || '').toLowerCase();
                            return (
                              <View
                                key={p.id}
                                style={[
                                  styles.providerCard,
                                  {
                                    backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                    borderColor: isDark ? colors.border : '#e2e8f0',
                                  },
                                ]}
                              >
                                <View style={styles.providerCardLeft}>
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
                                      <Text style={styles.providerLogoGlyph}>🌐</Text>
                                    )}
                                  </View>
                                  <View style={styles.providerTextCol}>
                                    <Text style={[styles.providerItemName, { color: colors.text }]}>{p.label}</Text>
                                    <View style={styles.statusDotRow}>
                                      <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                                      <Text style={[styles.statusDotText, { color: '#10b981' }]}>
                                        {p.providerKey.toUpperCase()}
                                      </Text>
                                    </View>
                                    <Text style={[styles.lastSyncedText, { color: colors.textMuted }]}>
                                      {p.externalAccountId ? `ID: ${p.externalAccountId}` : 'Active API Sync'}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.providerCardRight}>
                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 6,
                                    }}
                                    onPress={async () => {
                                      await deleteProviderAccount(p.id);
                                      await loadAccounts();
                                      showFeedback('Disconnected', `Removed ${p.label}.`, 'info');
                                    }}
                                  >
                                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Disconnect</Text>
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
                          <View style={{ padding: 24, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>No email accounts added yet.</Text>
                          </View>
                        ) : (
                          emailAccounts.map((e) => (
                            <View
                              key={e.id}
                              style={[
                                styles.providerCard,
                                {
                                  backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                  borderColor: isDark ? colors.border : '#e2e8f0',
                                },
                              ]}
                            >
                              <View style={styles.providerCardLeft}>
                                <View
                                  style={[
                                    styles.providerLogoBox,
                                    {
                                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
                                      borderColor: isDark ? colors.border : '#e2e8f0',
                                    },
                                  ]}
                                >
                                  <Text style={{ fontSize: 20 }}>✉️</Text>
                                </View>
                                <View style={styles.providerTextCol}>
                                  <Text style={[styles.providerItemName, { color: colors.text }]}>{e.email}</Text>
                                  <Text style={[styles.lastSyncedText, { color: colors.textSecondary }]}>
                                    {e.label || 'Login / Notifications Account'}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.providerCardRight}>
                                <TouchableOpacity
                                  style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                    paddingHorizontal: 10,
                                    paddingVertical: 6,
                                    borderRadius: 6,
                                  }}
                                  onPress={async () => {
                                    await deleteEmailAccount(e.id);
                                    await loadAccounts();
                                    showFeedback('Removed', `Removed email account ${e.email}.`, 'info');
                                  }}
                                >
                                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))
                        )}
                      </View>
                    )}

                    {/* Available Integrations */}
                    <View style={styles.providerSection}>
                      <View style={styles.providerSectionHeader}>
                        <View style={styles.providerSectionTitleLeft}>
                          <Text style={[styles.providerSectionTitle, { color: colors.text }]}>Supported Cloud Providers</Text>
                        </View>
                      </View>

                      <View style={styles.providerCardsList}>
                        {[
                          { key: 'google-play', name: 'Google Play Console', desc: 'Sync mobile apps from developer account' },
                          { key: 'hostinger', name: 'Hostinger Cloud & VPS', desc: 'Sync VPS servers and domains' },
                          { key: 'cloudflare', name: 'Cloudflare DNS', desc: 'Sync DNS zones, SSL and edge rules' },
                          { key: 'godaddy', name: 'GoDaddy Domains & DNS', desc: 'Sync domains and DNS records' },
                          { key: 'aws', name: 'Amazon Route 53 & EC2', desc: 'Sync AWS instances and DNS' },
                          { key: 'namecheap', name: 'Namecheap API', desc: 'Sync registered domain portfolio' },
                          { key: 'digitalocean', name: 'DigitalOcean Droplets', desc: 'Sync droplets, IP addresses & DNS' },
                          { key: 'hetzner', name: 'Hetzner Cloud', desc: 'Sync bare metal & cloud VPS nodes' },
                        ].map((prov) => (
                          <View
                            key={prov.key}
                            style={[
                              styles.providerCard,
                              {
                                backgroundColor: isDark ? colors.surfaceElevated : '#ffffff',
                                borderColor: isDark ? colors.border : '#e2e8f0',
                              },
                            ]}
                          >
                            <View style={styles.providerCardLeft}>
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
                                  <Text style={styles.providerLogoGlyph}>☁️</Text>
                                )}
                              </View>
                              <View style={styles.providerTextCol}>
                                <Text style={[styles.providerItemName, { color: colors.text }]}>{prov.name}</Text>
                                <Text style={[styles.lastSyncedText, { color: colors.textMuted }]}>{prov.desc}</Text>
                              </View>
                            </View>

                            <View style={styles.providerCardRight}>
                              <TouchableOpacity
                                style={[styles.connectSolidBtn, { backgroundColor: '#0284c7' }]}
                                onPress={() => {
                                  setNewAccType('provider');
                                  setNewAccProviderKey(prov.key);
                                  setNewAccLabel(`${prov.name} Account`);
                                  setIsAddAccountModalOpen(true);
                                }}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.connectSolidBtnText}>+ Connect</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
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
                        <Text style={[styles.switchTitle, { color: colors.text }]}>Push Notifications</Text>
                        <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                          Instant alerts for domain down-time and DNS drift
                        </Text>
                      </View>
                      <Switch
                        value={pushAlerts}
                        onValueChange={setPushAlerts}
                        trackColor={{ false: '#cbd5e1', true: '#38bdf8' }}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <View style={styles.switchTextCol}>
                        <Text style={[styles.switchTitle, { color: colors.text }]}>Domain Expiry Reminders</Text>
                        <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                          Receive notices at 60, 30, and 7 days before expiration
                        </Text>
                      </View>
                      <Switch
                        value={expiryReminders}
                        onValueChange={setExpiryReminders}
                        trackColor={{ false: '#cbd5e1', true: '#38bdf8' }}
                      />
                    </View>

                    <View style={styles.switchRow}>
                      <View style={styles.switchTextCol}>
                        <Text style={[styles.switchTitle, { color: colors.text }]}>Weekly Portfolio Digest</Text>
                        <Text style={[styles.switchSubtitle, { color: colors.textMuted }]}>
                          Executive summary of SSL certificates and server uptime
                        </Text>
                      </View>
                      <Switch
                        value={weeklyDigest}
                        onValueChange={setWeeklyDigest}
                        trackColor={{ false: '#cbd5e1', true: '#38bdf8' }}
                      />
                    </View>

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
                  <View style={styles.aboutContainer}>
                    <View style={styles.aboutLogoBox}>
                      <Text style={{ fontSize: 40 }}>🌐</Text>
                    </View>
                    <Text style={[styles.aboutTitle, { color: colors.text }]}>DomainPulse</Text>
                    <Text style={[styles.aboutVersion, { color: colors.textMuted }]}>
                      Version 1.0.4 (Build 2026.09.28)
                    </Text>
                    <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
                      DomainPulse is an enterprise infrastructure and domain portfolio monitoring suite designed for modern DevOps and site reliability engineers.
                    </Text>
                    <View style={[styles.divider, { backgroundColor: colors.borderSubtle, marginVertical: Spacing.lg }]} />
                    <Text style={[styles.copyrightText, { color: colors.textMuted }]}>
                      © 2026 DomainPulse Inc. All rights reserved.
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
        <View style={styles.providerModalOverlay}>
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsAddAccountModalOpen(false)}
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? '#0f172a' : '#ffffff', maxHeight: '85%', paddingBottom: Math.max(insets.bottom, 20) },
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
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
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

                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {newAccProviderKey === 'google-play' ? 'Developer ID / Organization Key (Optional)' : 'External Account ID / API Key (Optional)'}
                  </Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, marginBottom: 12 }]}
                    placeholder={newAccProviderKey === 'google-play' ? 'e.g. WorknAi Technologies India Pvt Ltd' : 'e.g. hst-99182 or cf-zone-xyz'}
                    placeholderTextColor={colors.textMuted}
                    value={newAccExternalId}
                    onChangeText={setNewAccExternalId}
                  />

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

              <TouchableOpacity
                style={{
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
                    {newAccType === 'provider' ? 'Connect Provider' : 'Save Email Account'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
    maxHeight: '90%',
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
    paddingVertical: Spacing.md,
    gap: 12,
  },
  providerHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerHeaderIconGlyph: {
    fontSize: 22,
    color: '#ffffff',
  },
  providerHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
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
  },
  providerCloseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  providerHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  providerHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  providerHeroSubtitle: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 10,
    lineHeight: 16,
  },
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  heroTagCheck: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroTagIcon: {
    fontSize: 10,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroGlobeBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  heroGlobeIcon: {
    fontSize: 32,
  },
  providerSection: {
    gap: 10,
  },
  providerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  providerSectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  connectedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  connectedBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '800',
  },
  availableBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  availableBadgeText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  manageAllLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  providerCardsList: {
    gap: 10,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  providerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  providerLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    padding: 6,
  },
  providerLogoImg: {
    width: 28,
    height: 28,
  },
  providerLogoGlyph: {
    fontSize: 22,
  },
  providerTextCol: {
    flex: 1,
  },
  providerItemName: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lastSyncedText: {
    fontSize: 11,
    marginTop: 2,
  },
  providerCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  configureBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configureBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectSolidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  connectSolidBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
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
});

