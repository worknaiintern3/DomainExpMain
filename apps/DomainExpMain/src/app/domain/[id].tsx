import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { fetchDomainsList, deleteDomain, updateDomainRecord } from '../../services/domains';
import { fetchProviderAccountsList } from '../../services/accounts';
import { fetchServersList, updateServer } from '../../services/servers';
import { fetchLiveDomainDetails, getDomainLogoUrl, type LiveDomainInfo } from '../../services/liveDomainLookup';
import { openWebsiteInBrowser } from '../../services/websites';
import { fetchApplicationsList } from '../../services/applications';
import { DomainLogoImage } from '../../components/ui/DomainLogoImage';
import type { DomainItem, ApplicationItem, ProviderAccount, ServerItem } from '../../types';

const PROVIDER_LOGOS: Record<string, any> = {
  hostinger: require('../../../assets/images/providers/hostinger.png'),
  hetzner: require('../../../assets/images/providers/hetzner.png'),
  aws: require('../../../assets/images/providers/aws.png'),
  digitalocean: require('../../../assets/images/providers/digitalocean.png'),
  cloudflare: require('../../../assets/images/providers/cloudflare.png'),
  godaddy: require('../../../assets/images/providers/godaddy.png'),
  namecheap: require('../../../assets/images/providers/namecheap.png'),
  gcp: require('../../../assets/images/providers/gcp.png'),
  azure: require('../../../assets/images/providers/azure.png'),
  vultr: require('../../../assets/images/providers/vultr.png'),
  linode: require('../../../assets/images/providers/linode.png'),
};

function getProviderDisplayTitle(providerKey?: string | null): string {
  if (!providerKey) return 'Custom Provider';
  const k = providerKey.toLowerCase();
  if (k === 'aws' || k.includes('route53')) return 'Amazon Web Services (AWS)';
  if (k === 'hostinger') return 'Hostinger';
  if (k === 'cloudflare') return 'Cloudflare';
  if (k === 'godaddy') return 'GoDaddy';
  if (k === 'namecheap') return 'Namecheap';
  if (k === 'digitalocean') return 'DigitalOcean';
  if (k === 'hetzner') return 'Hetzner';
  if (k === 'gcp' || k.includes('google')) return 'Google Cloud';
  if (k === 'azure' || k.includes('microsoft')) return 'Microsoft Azure';
  if (k === 'vultr') return 'Vultr';
  if (k === 'linode') return 'Linode / Akamai';
  return providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
}

function detectProviderKey(
  registrar?: string | null,
  dnsProvider?: string | null,
  nameservers?: string[] | null,
  tags?: string[] | null
): string | null {
  const combined = [
    registrar || '',
    dnsProvider || '',
    (nameservers || []).join(' '),
    (tags || []).join(' '),
  ].join(' ').toLowerCase();

  if (combined.includes('hostinger') || combined.includes('hstgr')) return 'hostinger';
  if (combined.includes('amazon') || combined.includes('route 53') || combined.includes('route53') || combined.includes('awsdns')) return 'aws';
  if (combined.includes('cloudflare')) return 'cloudflare';
  if (combined.includes('godaddy') || combined.includes('domaincontrol')) return 'godaddy';
  if (combined.includes('namecheap')) return 'namecheap';
  if (combined.includes('digitalocean')) return 'digitalocean';
  if (combined.includes('hetzner')) return 'hetzner';
  if (combined.includes('google') || combined.includes('googledomains')) return 'gcp';
  if (combined.includes('azure') || combined.includes('microsoft')) return 'azure';
  if (combined.includes('vultr')) return 'vultr';
  if (combined.includes('linode')) return 'linode';
  return null;
}

function getServerProviderKey(
  provider?: string | null,
  name?: string | null,
  os?: string | null
): string {
  const p = (provider || '').toLowerCase();
  const n = (name || '').toLowerCase();
  const o = (os || '').toLowerCase();
  if (p.includes('aws') || p.includes('amazon') || n.includes('aws') || n.includes('ec2') || o.includes('aws')) return 'aws';
  if (p.includes('hostinger') || n.includes('hostinger') || n.includes('hstgr')) return 'hostinger';
  if (p.includes('hetzner') || n.includes('hetzner')) return 'hetzner';
  if (p.includes('digital') || p.includes('ocean') || n.includes('digitalocean')) return 'digitalocean';
  if (p.includes('cloudflare')) return 'cloudflare';
  if (p.includes('gcp') || p.includes('google') || n.includes('gcp')) return 'gcp';
  if (p.includes('azure') || p.includes('microsoft')) return 'azure';
  if (p.includes('vultr') || n.includes('vultr')) return 'vultr';
  if (p.includes('linode') || n.includes('linode')) return 'linode';
  return 'hostinger';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Not Published';
  const clean = dateStr.trim();
  if (!clean || clean.toLowerCase() === 'not published' || clean.toLowerCase() === 'unknown') {
    return 'Not Published';
  }
  try {
    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return clean;
  }
}

const BRAND_APP_CATALOG: Record<string, { name: string; packageId: string; playStoreUrl: string; url?: string }> = {
  cars24: {
    name: 'CARS24: Buy/Sell Used Cars',
    packageId: 'com.cars24.consumerApp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.cars24.consumerApp',
    url: 'https://www.cars24.com',
  },
  onlinegologistics: {
    name: 'OnlineGoLogistics',
    packageId: 'com.onlinegologistics',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
    url: 'https://onlinegologistics.in',
  },
  onlinego: {
    name: 'Online Go',
    packageId: 'com.mantis.onlinego',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
  },
  pginfo: {
    name: 'PGinfo.online',
    packageId: 'com.pginfo.onlinee',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
    url: 'https://pginfo.online',
  },
  namasteyyy: {
    name: 'Namasteyyy',
    packageId: 'com.worknai.namasteyyy',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
    url: 'https://namasteyyy.com',
  },
  hrms: {
    name: 'WorknAI HRMS',
    packageId: 'com.worknai.hrms',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
    url: 'https://hrms.worknai.com',
  },
  worknai: {
    name: 'WorknAI Workspace',
    packageId: 'com.worknai.hrms',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
    url: 'https://worknai.com',
  },
  aitourism: {
    name: 'AiTourism - Travel & Cabs',
    packageId: 'com.aitourism',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aitourism',
  },
  swiggy: {
    name: 'Swiggy: Food & Instamart',
    packageId: 'in.swiggy.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.swiggy.android',
  },
  zomato: {
    name: 'Zomato: Food Delivery & Dining',
    packageId: 'com.application.zomato',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.application.zomato',
  },
  flipkart: {
    name: 'Flipkart Online Shopping',
    packageId: 'com.flipkart.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.flipkart.android',
  },
  amazon: {
    name: 'Amazon India Shopping',
    packageId: 'in.amazon.mShop.android.shopping',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.amazon.mShop.android.shopping',
  },
  paytm: {
    name: 'Paytm: Payments & UPI',
    packageId: 'net.one97.paytm',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm',
  },
  phonepe: {
    name: 'PhonePe: UPI & Payments',
    packageId: 'com.phonepe.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app',
  },
  cred: {
    name: 'CRED: Credit Cards & UPI',
    packageId: 'com.dreamplug.androidapp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.dreamplug.androidapp',
  },
  zepto: {
    name: 'Zepto: 10-Min Delivery',
    packageId: 'com.zeptonow',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.zeptonow',
  },
  blinkit: {
    name: 'Blinkit: Grocery in minutes',
    packageId: 'com.grofers.customerapp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.grofers.customerapp',
  },
  bookmyshow: {
    name: 'BookMyShow: Movies & Events',
    packageId: 'com.bt.bms',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bt.bms',
  },
  makemytrip: {
    name: 'MakeMyTrip: Flight & Hotel',
    packageId: 'com.makemytrip',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.makemytrip',
  },
  urbancompany: {
    name: 'Urban Company: Home Services',
    packageId: 'com.urbanclap.urbanclap',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.urbanclap.urbanclap',
  },
  groww: {
    name: 'Groww: Stocks & Mutual Funds',
    packageId: 'com.nextbillion.groww',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.nextbillion.groww',
  },
  zerodha: {
    name: 'Kite by Zerodha',
    packageId: 'com.zerodha.kite3',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.zerodha.kite3',
  },
  myntra: {
    name: 'Myntra: Online Fashion',
    packageId: 'com.myntra.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.myntra.android',
  },
  ajio: {
    name: 'AJIO: Online Shopping App',
    packageId: 'com.ril.ajio',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ril.ajio',
  },
  nykaa: {
    name: 'Nykaa: Beauty & Cosmetics',
    packageId: 'com.fsn.nykaa',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.fsn.nykaa',
  },
  lenskart: {
    name: 'Lenskart: Eyeglasses & More',
    packageId: 'com.lenskart.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.lenskart.app',
  },
  meesho: {
    name: 'Meesho: Online Shopping',
    packageId: 'com.meesho.supply',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.meesho.supply',
  },
  tataneu: {
    name: 'Tata Neu: Rewards & Shopping',
    packageId: 'com.tatadigital.tcp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.tatadigital.tcp',
  },
  uber: {
    name: 'Uber: Request a ride',
    packageId: 'com.ubercab',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ubercab',
  },
  ola: {
    name: 'Ola Cabs: Book Ride & Auto',
    packageId: 'com.olacabs.customer',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.olacabs.customer',
  },
  spotify: {
    name: 'Spotify: Music and Podcasts',
    packageId: 'com.spotify.music',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.spotify.music',
  },
  netflix: {
    name: 'Netflix',
    packageId: 'com.netflix.mediaclient',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.netflix.mediaclient',
  },
  google: {
    name: 'Google',
    packageId: 'com.google.android.googlequicksearchbox',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.google.android.googlequicksearchbox',
  },
};

function getAppForDomain(domainName: string, allApps: ApplicationItem[]): ApplicationItem {
  const cleanName = (domainName || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .trim();

  // Extract base domain without TLD (e.g. cars24.in -> cars24, onlinegologistics.in -> onlinegologistics)
  const parts = cleanName.split('.');
  const primaryName = parts[0] || cleanName;
  const domainBase = primaryName.replace(/[^a-z0-9]/g, '');

  // 1. Check if user already has an application in their account inventory matching this domain
  if (allApps && allApps.length > 0) {
    const userApp = allApps.find((app) => {
      const pkgClean = (app.packageId || '').toLowerCase().replace(/^com\./, '').replace(/[^a-z0-9]/g, '');
      const nameClean = (app.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const urlClean = (app.url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        pkgClean === domainBase ||
        nameClean === domainBase ||
        nameClean.includes(domainBase) ||
        urlClean.includes(cleanName) ||
        urlClean.includes(domainBase)
      );
    });
    if (userApp) return userApp;
  }

  // 2. Exact match in brand catalog
  if (BRAND_APP_CATALOG[domainBase]) {
    const brand = BRAND_APP_CATALOG[domainBase];
    return {
      id: `brand-${domainBase}`,
      name: brand.name,
      packageId: brand.packageId,
      playStoreUrl: brand.playStoreUrl,
      url: brand.url || `https://${cleanName}`,
      environment: 'Production',
      status: 'healthy',
      updatedAt: new Date().toISOString(),
    };
  }

  // 3. Key inclusion match in brand catalog (e.g. "cars24" in "cars24india" or vice versa)
  for (const [key, brand] of Object.entries(BRAND_APP_CATALOG)) {
    if (domainBase.includes(key) || (key.length >= 4 && key.includes(domainBase))) {
      return {
        id: `brand-${key}`,
        name: brand.name,
        packageId: brand.packageId,
        playStoreUrl: brand.playStoreUrl,
        url: brand.url || `https://${cleanName}`,
        environment: 'Production',
        status: 'healthy',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // 4. Dynamic Play Store brand app for any other domain
  const capitalBrand = primaryName.charAt(0).toUpperCase() + primaryName.slice(1);
  return {
    id: `play-${domainBase}`,
    name: `${capitalBrand} App`,
    packageId: `com.${domainBase}.android`,
    playStoreUrl: `https://play.google.com/store/search?q=${encodeURIComponent(primaryName)}&c=apps`,
    url: `https://${cleanName}`,
    environment: 'Production',
    status: 'healthy',
    updatedAt: new Date().toISOString(),
  };
}

export default function DomainDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [domain, setDomain] = useState<DomainItem | null>(null);
  const [matchedApp, setMatchedApp] = useState<ApplicationItem | null>(null);
  const [liveInfo, setLiveInfo] = useState<LiveDomainInfo | null>(null);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const [lastCheckedDate, setLastCheckedDate] = useState<string>('Just now');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Infrastructure: Provider Account and VPS Server
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [matchedProvider, setMatchedProvider] = useState<ProviderAccount | null>(null);
  const [matchedServer, setMatchedServer] = useState<ServerItem | null>(null);
  const [serverMatchReason, setServerMatchReason] = useState<string>('');
  const [copiedServerIp, setCopiedServerIp] = useState(false);

  // Modals for linking / changing provider and server
  const [isLinkProviderModalOpen, setIsLinkProviderModalOpen] = useState(false);
  const [isLinkServerModalOpen, setIsLinkServerModalOpen] = useState(false);
  const [accountSearchText, setAccountSearchText] = useState('');
  const [serverSearchText, setServerSearchText] = useState('');

  // Edit Domain Draft State
  const [editCreated, setEditCreated] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [editUpdated, setEditUpdated] = useState('');
  const [editRegistrarName, setEditRegistrarName] = useState('');
  const [editIanaId, setEditIanaId] = useState('');
  const [editRegistrantName, setEditRegistrantName] = useState('N/A');
  const [editRegistrantOrg, setEditRegistrantOrg] = useState('');
  const [editRegistrantCountry, setEditRegistrantCountry] = useState('N/A');
  const [editRegistrantState, setEditRegistrantState] = useState('');
  const [editRegistrantEmail, setEditRegistrantEmail] = useState('');
  const [editNameservers, setEditNameservers] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSslIssuer, setEditSslIssuer] = useState('N/A');
  const [editSslValidFrom, setEditSslValidFrom] = useState('Not set');
  const [editSslValidTo, setEditSslValidTo] = useState('Not set');
  const [editTags, setEditTags] = useState<string[]>(['Personal']);
  const [editNotes, setEditNotes] = useState('');

  const populateEditState = (currentDomain: DomainItem, info: LiveDomainInfo | null) => {
    setEditCreated(formatDate(info?.registrationDate || currentDomain.registrationDate));
    setEditExpires(formatDate(info?.expirationDate || (currentDomain.expiresAt ? currentDomain.expiresAt.split('T')[0] : '')));
    setEditUpdated(formatDate(info?.lastUpdatedDate || ''));
    setEditRegistrarName(info?.registrar || currentDomain.registrar || 'Authoritative Registry');
    setEditIanaId(info?.ianaId || 'N/A');
    setEditRegistrantName('N/A');
    setEditRegistrantOrg(info?.registrantOrg || 'Privacy Protected / Redacted');
    setEditRegistrantCountry(info?.registrantCountry || 'N/A');
    setEditRegistrantState(info?.registrantState || 'N/A');
    setEditRegistrantEmail(info?.registrantEmail || 'privacy@domainprotect.org');
    setEditNameservers(
      info?.nameservers && info.nameservers.length > 0
        ? info.nameservers.join('\n')
        : currentDomain.nameservers && currentDomain.nameservers.length > 0
        ? currentDomain.nameservers.join('\n')
        : ''
    );
    setEditStatus(
      info?.statuses && info.statuses.length > 0
        ? info.statuses.join(', ').replace(/([A-Z])/g, ' $1').toLowerCase()
        : 'Active / Registered'
    );
    setEditSslIssuer(info?.sslIssuer || "Let's Encrypt Authority");
    setEditSslValidFrom(formatDate(info?.sslValidFrom || '2026-09-21'));
    setEditSslValidTo(formatDate(info?.sslValidTo || '2026-12-20'));
    setEditTags(currentDomain.tags && currentDomain.tags.length > 0 ? currentDomain.tags : ['Personal']);
    setEditNotes(currentDomain.notes || '');
  };

  const resolveMatchedInfrastructure = useCallback(
    (
      currentDomain: DomainItem,
      currentLive: LiveDomainInfo | null,
      accountList: ProviderAccount[],
      serverList: ServerItem[]
    ) => {
      // 1. Resolve Provider Account
      let matchedAcc: ProviderAccount | null = null;

      // Direct ID link check
      if (currentDomain.providerAccountId) {
        matchedAcc = accountList.find((a) => a.id === currentDomain.providerAccountId) || null;
      }
      if (!matchedAcc && currentDomain.dnsProviderAccountId) {
        matchedAcc = accountList.find((a) => a.id === currentDomain.dnsProviderAccountId) || null;
      }

      // Check tags / notes for account ID or label mention
      if (!matchedAcc) {
        const notesAndTags = `${currentDomain.notes || ''} ${(currentDomain.tags || []).join(' ')}`.toLowerCase();
        for (const a of accountList) {
          if (a.id && notesAndTags.includes(a.id.toLowerCase())) {
            matchedAcc = a;
            break;
          }
          if (a.label && notesAndTags.includes(a.label.toLowerCase())) {
            matchedAcc = a;
            break;
          }
          if (a.externalAccountId && notesAndTags.includes(a.externalAccountId.toLowerCase())) {
            matchedAcc = a;
            break;
          }
        }
      }

      // Check detected provider key against connected accounts
      if (!matchedAcc) {
        const detectedKey = detectProviderKey(
          currentLive?.registrar || currentDomain.registrar,
          currentDomain.dnsProvider,
          currentLive?.nameservers || currentDomain.nameservers,
          currentDomain.tags
        );
        if (detectedKey) {
          matchedAcc =
            accountList.find((a) => (a.providerKey || '').toLowerCase() === detectedKey) || null;
        }
      }

      setMatchedProvider(matchedAcc);

      // 2. Resolve Server / VPS
      let foundServer: ServerItem | null = null;
      let matchType = '';

      const cleanDomainName = currentDomain.name.trim().toLowerCase();

      // Check explicit serverId on domain
      if (currentDomain.serverId) {
        foundServer = serverList.find((s) => s.id === currentDomain.serverId) || null;
        if (foundServer) matchType = 'Directly Assigned';
      }

      // Check server connectedDomains list
      if (!foundServer) {
        for (const s of serverList) {
          if (Array.isArray(s.connectedDomains)) {
            const hasDom = s.connectedDomains.some((cd) => {
              const cdClean = (cd || '').trim().toLowerCase();
              return cdClean === cleanDomainName || cleanDomainName.endsWith(`.${cdClean}`);
            });
            if (hasDom) {
              foundServer = s;
              matchType = 'Connected Domain';
              break;
            }
          }
        }
      }

      // Check live DNS A-records against Server public IP
      if (!foundServer) {
        const candidateIps: string[] = [];
        if (currentLive?.ip) candidateIps.push(currentLive.ip.trim());
        if (Array.isArray(currentLive?.dnsRecords)) {
          for (const rec of currentLive.dnsRecords) {
            if (rec.dnsType === 'A' && rec.address) {
              candidateIps.push(rec.address.trim());
            }
          }
        }
        if (currentDomain.serverIp) candidateIps.push(currentDomain.serverIp.trim());

        for (const ip of candidateIps) {
          const s = serverList.find((srv) => srv.ipAddress && srv.ipAddress.trim() === ip);
          if (s) {
            foundServer = s;
            matchType = `Live DNS A-Record (${ip})`;
            break;
          }
        }
      }

      // Check server name or hostname matches domain name
      if (!foundServer) {
        for (const s of serverList) {
          const sName = (s.name || '').trim().toLowerCase();
          if (sName === cleanDomainName || sName.includes(cleanDomainName)) {
            foundServer = s;
            matchType = 'Hostname Match';
            break;
          }
        }
      }

      setMatchedServer(foundServer);
      setServerMatchReason(matchType);
    },
    []
  );

  const queryLiveTelemetry = useCallback(
    async (domainName: string, currentAccounts?: ProviderAccount[], currentServers?: ServerItem[]) => {
      setIsRefreshingLive(true);
      try {
        const details = await fetchLiveDomainDetails(domainName);
        setLiveInfo(details);
        setLastCheckedDate(
          new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        );

        const exp = details.expirationDate || '';
        const reg = details.registrationDate || '';

        setDomain((prev) => {
          if (!prev) return null;
          const expTime = exp ? new Date(exp).getTime() : NaN;
          const daysRemaining = isNaN(expTime)
            ? prev.daysRemaining
            : Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));

          const updatedDomain: DomainItem = {
            ...prev,
            registrar: details.registrar || prev.registrar,
            registrationDate: reg || prev.registrationDate,
            expiresAt: exp ? new Date(exp).toISOString() : prev.expiresAt,
            daysRemaining,
            logoUrl: details.logoUrl,
            nameservers: details.nameservers.length > 0 ? details.nameservers : prev.nameservers,
          };

          updateDomainRecord(prev.id, updatedDomain).catch(() => {});
          resolveMatchedInfrastructure(
            updatedDomain,
            details,
            currentAccounts || providerAccounts,
            currentServers || servers
          );
          return updatedDomain;
        });
      } catch {
        // Gracefully handle network failures
      } finally {
        setIsRefreshingLive(false);
      }
    },
    [providerAccounts, servers, resolveMatchedInfrastructure]
  );

  useEffect(() => {
    async function loadDomain() {
      const [list, accList, srvList] = await Promise.all([
        fetchDomainsList(),
        fetchProviderAccountsList(),
        fetchServersList(),
      ]);
      setProviderAccounts(accList);
      setServers(srvList);

      const domainNameFromId = decodeURIComponent(id || '').trim().toLowerCase();
      const found = list.find((d) => d.id === id || d.name.toLowerCase() === domainNameFromId);

      setLastCheckedDate(
        new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      );

      let activeDomainName = domainNameFromId;
      if (found) {
        setDomain(found);
        activeDomainName = found.name;
        populateEditState(found, null);
        resolveMatchedInfrastructure(found, null, accList, srvList);
        queryLiveTelemetry(found.name, accList, srvList);
      } else {
        const dynamicDomain: DomainItem = {
          id: domainNameFromId,
          name: domainNameFromId,
          tld: `.${domainNameFromId.split('.').pop() || 'com'}`,
          registrar: 'Authoritative Registry',
          autoRenew: true,
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          daysRemaining: 365,
          renewalPrice: domainNameFromId.endsWith('.ai') ? 5800 : domainNameFromId.endsWith('.io') ? 3200 : domainNameFromId.endsWith('.in') ? 499 : 899,
          currency: '₹',
          status: 'safe',
          dnsProvider: 'Authoritative DNS',
          sslStatus: 'active',
          httpStatus: '200 OK',
          rdapStatus: 'Synchronizing',
          tags: ['Personal'],
          logoUrl: getDomainLogoUrl(domainNameFromId),
        };
        setDomain(dynamicDomain);
        populateEditState(dynamicDomain, null);
        resolveMatchedInfrastructure(dynamicDomain, null, accList, srvList);
        queryLiveTelemetry(domainNameFromId, accList, srvList);
      }

      // Resolve associated mobile & web endpoints reliably
      try {
        const allApps = await fetchApplicationsList();
        const matched = getAppForDomain(activeDomainName, allApps);
        setMatchedApp(matched);
      } catch {
        const fallback = getAppForDomain(activeDomainName, []);
        setMatchedApp(fallback);
      }
    }
    loadDomain();
  }, [id, queryLiveTelemetry, resolveMatchedInfrastructure]);

  const handleNavigateToServer = (serverId: string) => {
    router.push(`/server/${encodeURIComponent(serverId)}` as any);
  };

  const handleCopyServerIp = async (ip: string) => {
    if (!ip) return;
    setCopiedServerIp(true);
    setTimeout(() => setCopiedServerIp(false), 2000);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(ip);
      } else {
        await Share.share({
          message: ip,
          title: 'Server IP Address',
        });
      }
    } catch {}
  };

  const handleSelectProviderAccount = async (account: ProviderAccount | null) => {
    setIsLinkProviderModalOpen(false);
    if (!domain) return;

    if (!account) {
      const updatedDomain: DomainItem = {
        ...domain,
        providerAccountId: undefined,
        providerLabel: undefined,
        providerKey: undefined,
      };
      setDomain(updatedDomain);
      setMatchedProvider(null);
      await updateDomainRecord(domain.id, updatedDomain);
      return;
    }

    const updatedDomain: DomainItem = {
      ...domain,
      providerAccountId: account.id,
      providerLabel: account.label,
      providerKey: account.providerKey,
    };
    setDomain(updatedDomain);
    setMatchedProvider(account);
    await updateDomainRecord(domain.id, updatedDomain);
  };

  const handleSelectServer = async (server: ServerItem | null) => {
    setIsLinkServerModalOpen(false);
    if (!domain) return;

    if (!server) {
      const updatedDomain: DomainItem = {
        ...domain,
        serverId: undefined,
        serverName: undefined,
        serverIp: undefined,
        serverProvider: undefined,
      };
      setDomain(updatedDomain);
      setMatchedServer(null);
      setServerMatchReason('');
      await updateDomainRecord(domain.id, updatedDomain);
      return;
    }

    const domName = domain.name.toLowerCase().trim();
    const existingConnected = server.connectedDomains || [];
    if (!existingConnected.map((d) => d.toLowerCase().trim()).includes(domName)) {
      const updatedConnected = [...existingConnected, domName];
      await updateServer(server.id, { connectedDomains: updatedConnected });
      server.connectedDomains = updatedConnected;
    }

    const updatedDomain: DomainItem = {
      ...domain,
      serverId: server.id,
      serverName: server.name,
      serverIp: server.ipAddress,
      serverProvider: server.provider,
    };
    setDomain(updatedDomain);
    setMatchedServer(server);
    setServerMatchReason('Directly Assigned');
    await updateDomainRecord(domain.id, updatedDomain);
  };

  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleOpenWebsite = async () => {
    if (!domain) return;
    const cleanDomain = domain.name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const targetUrl = `https://${cleanDomain}`;
    await openWebsiteInBrowser(targetUrl);
  };

  const handleOpenApp = async () => {
    if (!matchedApp && !domain) return;

    const brandQuery = matchedApp?.name ? matchedApp.name.replace(/[:\-].*$/, '').trim() : (domain?.name.split('.')[0] || 'cars24');
    const playSearchUrl = `https://play.google.com/store/search?q=${encodeURIComponent(brandQuery)}&c=apps`;
    const marketSearchUrl = `market://search?q=${encodeURIComponent(brandQuery)}`;

    if (matchedApp?.packageId) {
      const marketPkgUrl = `market://details?id=${matchedApp.packageId}`;
      const playPkgUrl = `https://play.google.com/store/apps/details?id=${matchedApp.packageId}`;

      try {
        const canOpenMarket = await Linking.canOpenURL(marketPkgUrl);
        if (canOpenMarket) {
          await Linking.openURL(marketPkgUrl);
          return;
        }
      } catch {}

      try {
        const canOpenMarketSearch = await Linking.canOpenURL(marketSearchUrl);
        if (canOpenMarketSearch) {
          await Linking.openURL(marketSearchUrl);
          return;
        }
      } catch {}

      try {
        const canOpenPlay = await Linking.canOpenURL(playPkgUrl);
        if (canOpenPlay) {
          await Linking.openURL(playPkgUrl);
          return;
        }
      } catch {}

      await openWebsiteInBrowser(playSearchUrl);
      return;
    }

    if (matchedApp?.playStoreUrl) {
      try {
        const can = await Linking.canOpenURL(matchedApp.playStoreUrl);
        if (can) {
          await Linking.openURL(matchedApp.playStoreUrl);
          return;
        }
      } catch {}
      await openWebsiteInBrowser(matchedApp.playStoreUrl);
    } else {
      await openWebsiteInBrowser(playSearchUrl);
    }
  };

  const handleOpenExternal = async () => {
    if (!domain) return;
    const cleanDomain = domain.name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    const targetUrl = `https://${cleanDomain}`;
    try {
      const can = await Linking.canOpenURL(targetUrl);
      if (can) {
        await Linking.openURL(targetUrl);
      } else {
        await openWebsiteInBrowser(targetUrl);
      }
    } catch {
      await openWebsiteInBrowser(targetUrl);
    }
  };

  const handleCopyUrl = async () => {
    if (!domain) return;
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`https://${domain.name}`);
      } else {
        await Share.share({
          message: `https://${domain.name}`,
          url: `https://${domain.name}`,
          title: domain.name,
        });
      }
    } catch {}
  };

  const handleShareUrl = async () => {
    if (!domain) return;
    try {
      await Share.share({
        message: `https://${domain.name}`,
        url: `https://${domain.name}`,
        title: domain.name,
      });
    } catch {}
  };

  const handleOpenEdit = () => {
    if (!domain) return;
    populateEditState(domain, liveInfo);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!domain) return;
    const nsArray = editNameservers
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: DomainItem = {
      ...domain,
      registrar: editRegistrarName.trim() || domain.registrar,
      registrationDate: editCreated.trim() || domain.registrationDate,
      tags: editTags,
      notes: editNotes.trim(),
      nameservers: nsArray.length > 0 ? nsArray : domain.nameservers,
    };

    setDomain(updated);
    if (liveInfo) {
      setLiveInfo({
        ...liveInfo,
        registrar: editRegistrarName.trim() || liveInfo.registrar,
        ianaId: editIanaId.trim() || liveInfo.ianaId,
        registrantOrg: editRegistrantOrg.trim() || liveInfo.registrantOrg,
        registrantState: editRegistrantState.trim() || liveInfo.registrantState,
        registrantEmail: editRegistrantEmail.trim() || liveInfo.registrantEmail,
        nameservers: nsArray.length > 0 ? nsArray : liveInfo.nameservers,
        statuses: [editStatus.trim() || 'active'],
      });
    }

    await updateDomainRecord(domain.id, updated);
    setIsEditModalOpen(false);
  };

  const handleToggleTag = (tag: string) => {
    setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleDelete = async () => {
    if (!domain) return;
    setShowDeleteModal(false);
    await deleteDomain(domain.id);
    router.replace('/(tabs)/domains');
  };

  const handleRefreshPress = async () => {
    if (!domain || isRefreshingLive) return;
    await queryLiveTelemetry(domain.name);
  };

  if (!domain) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0b0f19' : '#f8fafc', paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading domain details...</Text>
      </View>
    );
  }

  // Extracted values
  const effectiveRegistrar = liveInfo?.registrar || domain.registrar || 'Authoritative Registry';
  const effectiveIanaId = liveInfo?.ianaId || 'N/A';
  const effectiveRegistrantOrg = liveInfo?.registrantOrg || 'Privacy Protected / Redacted';
  const effectiveRegistrantState = liveInfo?.registrantState || 'N/A';
  const effectiveRegistrantContact = liveInfo?.registrantEmail || 'Not Published (Privacy Protected)';
  const effectiveCreated = liveInfo?.registrationDate || domain.registrationDate || '';
  const effectiveUpdated = liveInfo?.lastUpdatedDate || '';
  const effectiveExpires = liveInfo?.expirationDate || (domain.expiresAt ? domain.expiresAt.split('T')[0] : '');
  const effectiveDomainAge =
    liveInfo?.domainAgeDays ??
    (effectiveCreated ? Math.max(0, Math.floor((Date.now() - new Date(effectiveCreated).getTime()) / 86400000)) : undefined);
  const effectiveNameservers =
    liveInfo?.nameservers && liveInfo.nameservers.length > 0
      ? liveInfo.nameservers
      : domain.nameservers && domain.nameservers.length > 0
      ? domain.nameservers
      : [];
  const effectiveStatus =
    liveInfo?.statuses && liveInfo.statuses.length > 0
      ? liveInfo.statuses.join(', ').replace(/([A-Z])/g, ' $1').toLowerCase()
      : 'active';
  const effectiveSslValidFrom = liveInfo?.sslValidFrom || '2026-09-21';
  const effectiveSslValidTo = liveInfo?.sslValidTo || '2026-12-20';
  const effectiveSslIssuer = liveInfo?.sslIssuer || "Let's Encrypt Authority";
  const effectiveSslDays = liveInfo?.sslDaysRemaining !== undefined ? liveInfo.sslDaysRemaining : 79;
  const effectiveSslProtocol = liveInfo?.sslProtocol || 'TLS 1.3 / HTTPS (256-bit ECC)';

  const detectedProviderKey = detectProviderKey(
    effectiveRegistrar,
    domain.dnsProvider,
    effectiveNameservers,
    domain.tags
  );
  const serverProviderKey = matchedServer
    ? getServerProviderKey(matchedServer.provider, matchedServer.name, matchedServer.os)
    : null;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b0f19' : '#f8fafc', paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9' }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerIconButton}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Domain Details</Text>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleOpenEdit}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="pencil-outline" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xxxl + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Domain Overview Card */}
        <View
          style={[
            styles.cardBox,
            styles.heroCard,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <DomainLogoImage
            domainName={domain.name}
            logoUrl={domain.logoUrl}
            size={56}
            borderRadius={16}
          />

          <Text style={[styles.heroDomainName, { color: colors.text, marginTop: 10 }]}>{domain.name}</Text>

          <View style={styles.heroStatusPill}>
            <View style={styles.heroStatusDot} />
            <Text style={styles.heroStatusPillText}>
              Expires in {domain.daysRemaining || 94} days
            </Text>
          </View>
        </View>

        {/* 2. ENDPOINTS & LIVE ACCESS CARD */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionHeaderDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              ENDPOINTS & PREVIEW
            </Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          {/* Clean Interactive Website Item */}
          <TouchableOpacity
            style={[
              styles.endpointItemRow,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#f1f5f9',
              },
            ]}
            onPress={handleOpenWebsite}
            activeOpacity={0.7}
          >
            <View style={[styles.endpointIconBadge, { backgroundColor: isDark ? '#0f172a' : '#eff6ff' }]}>
              <Ionicons name="globe-outline" size={20} color="#2563eb" />
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.endpointItemTitle, { color: colors.text }]} numberOfLines={1}>
                {domain.name}
              </Text>
              <Text style={[styles.endpointItemUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                https://{domain.name.replace(/^https?:\/\//i, '')}
              </Text>
            </View>

            <View style={[styles.endpointLaunchPill, { backgroundColor: '#2563eb' }]}>
              <Text style={styles.endpointLaunchPillText}>Web</Text>
              <Ionicons name="open-outline" size={13} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {/* Bottom Micro Utility Bar */}
          <View style={[styles.endpointUtilsRow, { borderTopColor: isDark ? '#1f2937' : '#f1f5f9' }]}>
            <TouchableOpacity
              style={styles.endpointUtilItem}
              onPress={handleOpenExternal}
              activeOpacity={0.7}
            >
              <Ionicons name="browsers-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.endpointUtilText, { color: colors.textSecondary }]}>
                Browser
              </Text>
            </TouchableOpacity>

            <View style={[styles.endpointUtilDivider, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />

            <TouchableOpacity
              style={styles.endpointUtilItem}
              onPress={handleCopyUrl}
              activeOpacity={0.7}
            >
              <Ionicons
                name={copiedUrl ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={copiedUrl ? '#10b981' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.endpointUtilText,
                  { color: copiedUrl ? '#10b981' : colors.textSecondary },
                ]}
              >
                {copiedUrl ? 'Copied!' : 'Copy Link'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.endpointUtilDivider, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />

            <TouchableOpacity
              style={styles.endpointUtilItem}
              onPress={handleShareUrl}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.endpointUtilText, { color: colors.textSecondary }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. INFRASTRUCTURE & ACCOUNTS CARD */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionHeaderDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              INFRASTRUCTURE & ACCOUNTS
            </Text>
            <View style={{ flex: 1 }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#f5f3ff',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                gap: 4,
              }}
            >
              <Ionicons name="cube-outline" size={12} color="#8b5cf6" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#8b5cf6' }}>
                Cloud & Hosting
              </Text>
            </View>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          {/* Subcard 1: Registrar & DNS Provider Account */}
          <View
            style={[
              styles.infraSubCard,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.infraSubCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="business-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                <Text style={[styles.infraSubCardCategory, { color: colors.textSecondary }]}>
                  REGISTRAR & DNS ACCOUNT
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLinkProviderModalOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.infraActionLink, { color: colors.primary }]}>
                  {matchedProvider ? 'Switch Account' : 'Link Account'}
                </Text>
              </TouchableOpacity>
            </View>

            {matchedProvider ? (
              <View style={styles.infraAccountContent}>
                <View style={[styles.infraLogoContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
                  {PROVIDER_LOGOS[(matchedProvider.providerKey || '').toLowerCase()] ? (
                    <Image
                      source={PROVIDER_LOGOS[(matchedProvider.providerKey || '').toLowerCase()]}
                      style={{ width: 32, height: 32 }}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons name="shield-checkmark" size={24} color="#8b5cf6" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.infraAccountTitle, { color: colors.text }]} numberOfLines={1}>
                      {matchedProvider.label}
                    </Text>
                    <View
                      style={[
                        styles.infraBadge,
                        { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' },
                      ]}
                    >
                      <Text style={[styles.infraBadgeText, { color: '#2563eb' }]}>
                        {(matchedProvider.providerKey || 'PROVIDER').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.infraAccountSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {matchedProvider.externalAccountId
                      ? `Account ID: ${matchedProvider.externalAccountId}`
                      : `${getProviderDisplayTitle(matchedProvider.providerKey)} Linked`}
                  </Text>

                  <View style={styles.infraStatusRow}>
                    <View style={styles.infraActiveDot} />
                    <Text style={styles.infraActiveText}>Active & Synced Portfolio</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.infraEmptyStateRow}>
                <View style={[styles.infraLogoContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
                  {detectedProviderKey && PROVIDER_LOGOS[detectedProviderKey] ? (
                    <Image
                      source={PROVIDER_LOGOS[detectedProviderKey]}
                      style={{ width: 32, height: 32 }}
                      contentFit="contain"
                    />
                  ) : (
                    <Ionicons name="globe-outline" size={24} color={colors.textSecondary} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={[styles.infraAccountTitle, { color: colors.text }]} numberOfLines={1}>
                      {effectiveRegistrar || 'Authoritative Registry'}
                    </Text>
                    {detectedProviderKey ? (
                      <View
                        style={[
                          styles.infraBadge,
                          { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7' },
                        ]}
                      >
                        <Text style={[styles.infraBadgeText, { color: '#d97706' }]}>
                          AUTO-DETECTED
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.infraAccountSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                    Detected from WHOIS registry. Link to your connected account for automatic DNS zone sync.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.infraAddPill,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#eff6ff',
                      borderColor: isDark ? '#334155' : '#bfdbfe',
                    },
                  ]}
                  onPress={() => setIsLinkProviderModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="link" size={13} color="#2563eb" />
                  <Text style={[styles.infraAddPillText, { color: '#2563eb' }]}>Link</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Subcard 2: Hosting & VPS Server */}
          <View
            style={[
              styles.infraSubCard,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                marginTop: 10,
              },
            ]}
          >
            <View style={styles.infraSubCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="server-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                <Text style={[styles.infraSubCardCategory, { color: colors.textSecondary }]}>
                  HOSTING & VPS SERVER
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLinkServerModalOpen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.infraActionLink, { color: colors.primary }]}>
                  {matchedServer ? 'Change VPS' : 'Link VPS'}
                </Text>
              </TouchableOpacity>
            </View>

            {matchedServer ? (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.infraAccountContent}
                  onPress={() => handleNavigateToServer(matchedServer.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.infraLogoContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
                    {serverProviderKey && PROVIDER_LOGOS[serverProviderKey] ? (
                      <Image
                        source={PROVIDER_LOGOS[serverProviderKey]}
                        style={{ width: 32, height: 32 }}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons name="hardware-chip-outline" size={24} color="#10b981" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.infraAccountTitle, { color: colors.text }]} numberOfLines={1}>
                        {matchedServer.name}
                      </Text>
                      <View
                        style={[
                          styles.infraBadge,
                          { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5' },
                        ]}
                      >
                        <Text style={[styles.infraBadgeText, { color: '#059669' }]}>
                          {matchedServer.provider || 'VPS'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.infraAccountSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {matchedServer.region || 'Global'} • {matchedServer.os || 'Linux'}
                    </Text>

                    {serverMatchReason ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name="git-branch-outline" size={11} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' }}>
                          {serverMatchReason}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Server IP and View Server Button Bar */}
                <View
                  style={[
                    styles.infraServerBottomRow,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.infraIpWrapper}
                    onPress={() => handleCopyServerIp(matchedServer.ipAddress || '')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.infraIpDot} />
                    <Text style={[styles.infraIpText, { color: colors.text }]}>
                      {matchedServer.ipAddress || '127.0.0.1'}
                    </Text>
                    <Ionicons
                      name={copiedServerIp ? 'checkmark-circle' : 'copy-outline'}
                      size={13}
                      color={copiedServerIp ? '#10b981' : colors.textMuted}
                    />
                    {copiedServerIp && (
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', marginLeft: 2 }}>
                        Copied!
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.infraViewServerBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleNavigateToServer(matchedServer.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.infraViewServerBtnText}>View Server</Text>
                    <Ionicons name="arrow-forward" size={13} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.infraEmptyStateRow}>
                <View style={[styles.infraLogoContainer, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
                  <Ionicons name="cloud-offline-outline" size={24} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infraAccountTitle, { color: colors.text }]}>
                    No VPS Directly Linked
                  </Text>
                  <Text style={[styles.infraAccountSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                    {liveInfo?.ip
                      ? `Points to external IP ${liveInfo.ip}. Link to a tracked VPS node for server telemetry.`
                      : 'Attach this domain to an AWS EC2 instance, Hostinger VPS, or Hetzner server node.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.infraAddPill,
                    {
                      backgroundColor: isDark ? '#0f172a' : '#eff6ff',
                      borderColor: isDark ? '#334155' : '#bfdbfe',
                    },
                  ]}
                  onPress={() => setIsLinkServerModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={14} color="#2563eb" />
                  <Text style={[styles.infraAddPillText, { color: '#2563eb' }]}>Link VPS</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* 4. DATES Section Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderDot} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>DATES</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Created</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{formatDate(effectiveCreated)}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Updated</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{formatDate(effectiveUpdated)}</Text>
          </View>

          {effectiveExpires ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Expires</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{formatDate(effectiveExpires)}</Text>
            </View>
          ) : null}

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Domain Age</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{effectiveDomainAge} days</Text>
          </View>
        </View>

        {/* 3. REGISTRAR Section Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderDot} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>REGISTRAR</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Name</Text>
            <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={2}>
              {effectiveRegistrar}
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>IANA ID</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{effectiveIanaId}</Text>
          </View>
        </View>

        {/* 4. REGISTRANT Section Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderDot} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>REGISTRANT</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Organization</Text>
            <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={2}>
              {effectiveRegistrantOrg}
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>State</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{effectiveRegistrantState}</Text>
          </View>

          {liveInfo?.registrantCountry ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Country</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{liveInfo.registrantCountry}</Text>
            </View>
          ) : null}

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Contact</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{effectiveRegistrantContact}</Text>
          </View>

          {liveInfo?.technicalContact ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Tech Contact</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{liveInfo.technicalContact}</Text>
            </View>
          ) : null}

          {liveInfo?.administrativeContact ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Admin Contact</Text>
              <Text style={[styles.dataValue, { color: colors.text }]}>{liveInfo.administrativeContact}</Text>
            </View>
          ) : null}
        </View>

        {/* 5. TECHNICAL Section Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderDot} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>TECHNICAL</Text>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          <View style={[styles.dataRow, { alignItems: 'flex-start' }]}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary, marginTop: 2 }]}>Name Servers</Text>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {effectiveNameservers.length > 0 ? (
                effectiveNameservers.map((ns, idx) => (
                  <Text
                    key={idx}
                    style={[styles.dataValue, { color: colors.text, marginBottom: 4 }]}
                    numberOfLines={1}
                  >
                    {ns}
                  </Text>
                ))
              ) : (
                <Text style={[styles.dataValue, { color: colors.textSecondary }]}>Authoritative DNS</Text>
              )}
            </View>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={2}>
              {effectiveStatus}
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Last Checked</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>{lastCheckedDate}</Text>
          </View>
        </View>

        {/* 6. LIVE DNS INTELLIGENCE Card (WhoisFreaks) */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionHeaderDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              LIVE DNS RECORDS (WHOISFREAKS)
            </Text>
            <View style={{ flex: 1 }} />
            {liveInfo?.dnsRecords && liveInfo.dnsRecords.length > 0 ? (
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#3b82f6' }}>
                  {liveInfo.dnsRecords.length} records
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          {liveInfo?.dnsRecords && liveInfo.dnsRecords.length > 0 ? (
            <View style={{ gap: 8 }}>
              {liveInfo.dnsRecords.slice(0, 10).map((rec, idx) => {
                const badgeColor =
                  rec.dnsType === 'A'
                    ? '#2563eb'
                    : rec.dnsType === 'AAAA'
                    ? '#0284c7'
                    : rec.dnsType === 'MX'
                    ? '#7c3aed'
                    : rec.dnsType === 'TXT'
                    ? '#d97706'
                    : rec.dnsType === 'NS'
                    ? '#059669'
                    : '#475569';
                const bgBadge = isDark ? `${badgeColor}25` : `${badgeColor}15`;
                const val = rec.address || rec.target || rec.text || '-';

                return (
                  <View
                    key={idx}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 6,
                      borderBottomWidth: idx < Math.min(liveInfo.dnsRecords?.length || 0, 10) - 1 ? 1 : 0,
                      borderBottomColor: isDark ? '#1f2937' : '#f8fafc',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View
                        style={{
                          backgroundColor: bgBadge,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          minWidth: 42,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '800', color: badgeColor }}>
                          {rec.dnsType}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: colors.text,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {typeof rec.priority === 'number' ? `[${rec.priority}] ` : ''}
                        {val}
                      </Text>
                    </View>
                    {rec.ttl ? (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 8 }}>
                        {rec.ttl}s
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Primary A Record</Text>
                <Text style={[styles.dataValue, { color: colors.text }]}>{liveInfo?.ip || 'Resolving...'}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>TTL</Text>
                <Text style={[styles.dataValue, { color: colors.text }]}>{liveInfo?.ttl || 300} seconds</Text>
              </View>
            </View>
          )}
        </View>

        {/* 7. SSL CERTIFICATE Section Card */}
        <View
          style={[
            styles.cardBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionHeaderDot, { backgroundColor: '#10b981' }]} />
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>SSL CERTIFICATE</Text>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 5 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981' }}>Active & Trusted</Text>
            </View>
          </View>
          <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Valid From (Issued)</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {formatDate(effectiveSslValidFrom)}
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Expires On (Valid Until)</Text>
            <Text style={[styles.dataValue, { color: '#10b981', fontWeight: '700' }]}>
              {formatDate(effectiveSslValidTo)}
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Days Remaining</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {effectiveSslDays} days
            </Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Issued By (CA)</Text>
            <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
              {effectiveSslIssuer}
            </Text>
          </View>

          {liveInfo?.sslSubject ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Subject</Text>
              <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
                {liveInfo.sslSubject}
              </Text>
            </View>
          ) : null}

          {liveInfo?.sslSerialNumber ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Serial Number</Text>
              <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
                {liveInfo.sslSerialNumber}
              </Text>
            </View>
          ) : null}

          {liveInfo?.sslAltNames && liveInfo.sslAltNames.length > 0 ? (
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>SANs</Text>
              <Text style={[styles.dataValue, { color: colors.text }]} numberOfLines={1}>
                {liveInfo.sslAltNames.slice(0, 3).join(', ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.textSecondary }]}>Protocol & Security</Text>
            <Text style={[styles.dataValue, { color: colors.text }]}>
              {effectiveSslProtocol}
            </Text>
          </View>
        </View>

        {/* Big Refresh WHOIS Data Action Button */}
        <View style={styles.refreshSection}>
          <TouchableOpacity
            style={[
              styles.refreshButton,
              {
                backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                borderColor: isDark ? '#334155' : '#e2e8f0',
              },
            ]}
            onPress={handleRefreshPress}
            activeOpacity={0.8}
            disabled={isRefreshingLive}
          >
            {isRefreshingLive ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="lock-closed-outline" size={18} color={colors.text} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.refreshButtonText, { color: colors.text }]}>
              {isRefreshingLive ? 'Fetching Live WHOIS...' : 'Refresh WHOIS Data'}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.refreshSubtext, { color: colors.textSecondary }]}>
            Premium — pull the latest registrar & expiry data
          </Text>
        </View>
      </ScrollView>

      {/* FULL-SCREEN EDIT DOMAIN MODAL */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: isDark ? '#0b0f19' : '#f8fafc' }}
        >
          <View style={[styles.container, { backgroundColor: isDark ? '#0b0f19' : '#f8fafc', paddingTop: insets.top }]}>
            {/* Edit Header Bar */}
            <View style={[styles.headerBar, { borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9' }]}>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.headerIconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>

              <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Domain</Text>

              <TouchableOpacity
                onPress={handleSaveEdit}
                style={styles.headerSaveButton}
                activeOpacity={0.7}
              >
                <Text style={[styles.saveButtonText, { color: colors.primary }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Domain Name Hero Preview */}
              <View
                style={[
                  styles.cardBox,
                  styles.editDomainPillCard,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <DomainLogoImage
                  domainName={domain.name}
                  logoUrl={domain.logoUrl}
                  size={44}
                  borderRadius={14}
                />
                <Text style={[styles.editDomainTitle, { color: colors.text }]}>{domain.name}</Text>
              </View>

              {/* 1. DATES Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderDot} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>DATES</Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                {/* Created */}
                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Created</Text>
                  <View style={styles.editInputWrapper}>
                    <TextInput
                      style={[styles.editInputText, { color: colors.text }]}
                      value={editCreated}
                      onChangeText={setEditCreated}
                      placeholder="e.g. Jan 3, 2007"
                      placeholderTextColor={colors.textMuted}
                    />
                    {editCreated.length > 0 && (
                      <TouchableOpacity onPress={() => setEditCreated('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>

                {/* Expires */}
                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Expires</Text>
                  <View style={styles.editInputWrapper}>
                    <TextInput
                      style={[styles.editInputText, { color: colors.text }]}
                      value={editExpires}
                      onChangeText={setEditExpires}
                      placeholder="e.g. Jan 3, 2027"
                      placeholderTextColor={colors.textMuted}
                    />
                    {editExpires.length > 0 && (
                      <TouchableOpacity onPress={() => setEditExpires('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>

                {/* Updated */}
                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Updated</Text>
                  <View style={styles.editInputWrapper}>
                    <TextInput
                      style={[styles.editInputText, { color: colors.text }]}
                      value={editUpdated}
                      onChangeText={setEditUpdated}
                      placeholder="e.g. Aug 1, 2025"
                      placeholderTextColor={colors.textMuted}
                    />
                    {editUpdated.length > 0 && (
                      <TouchableOpacity onPress={() => setEditUpdated('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>
              </View>

              {/* 2. REGISTRAR Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderDot} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>REGISTRAR</Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Name</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrarName}
                    onChangeText={setEditRegistrarName}
                    placeholder="Registrar Name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>IANA ID</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editIanaId}
                    onChangeText={setEditIanaId}
                    placeholder="e.g. 800001"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* 3. REGISTRANT Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderDot} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>REGISTRANT</Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Name</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrantName}
                    onChangeText={setEditRegistrantName}
                    placeholder="N/A"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Organization</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrantOrg}
                    onChangeText={setEditRegistrantOrg}
                    placeholder="Organization Name"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Country</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrantCountry}
                    onChangeText={setEditRegistrantCountry}
                    placeholder="Country"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>State</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrantState}
                    onChangeText={setEditRegistrantState}
                    placeholder="State"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Contact Email</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editRegistrantEmail}
                    onChangeText={setEditRegistrantEmail}
                    placeholder="info@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              {/* 4. TECHNICAL Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderDot} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>TECHNICAL</Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                <View style={[styles.editRow, { alignItems: 'flex-start' }]}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary, marginTop: 6 }]}>Name Servers</Text>
                  <TextInput
                    style={[
                      styles.editSingleInput,
                      {
                        color: colors.text,
                        borderBottomColor: isDark ? '#334155' : '#e2e8f0',
                        minHeight: 50,
                      },
                    ]}
                    value={editNameservers}
                    onChangeText={setEditNameservers}
                    placeholder="ns1.example.com&#10;ns2.example.com"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Status</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editStatus}
                    onChangeText={setEditStatus}
                    placeholder="e.g. client transfer prohibited"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* 5. SSL CERTIFICATE Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionHeaderDot} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>SSL CERTIFICATE</Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Issuer</Text>
                  <TextInput
                    style={[styles.editSingleInput, { color: colors.text, borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
                    value={editSslIssuer}
                    onChangeText={setEditSslIssuer}
                    placeholder="N/A"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Valid From</Text>
                  <View style={styles.editInputWrapper}>
                    <TextInput
                      style={[styles.editInputText, { color: colors.text }]}
                      value={editSslValidFrom}
                      onChangeText={setEditSslValidFrom}
                      placeholder="Not set"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Valid To</Text>
                  <View style={styles.editInputWrapper}>
                    <TextInput
                      style={[styles.editInputText, { color: colors.text }]}
                      value={editSslValidTo}
                      onChangeText={setEditSslValidTo}
                      placeholder="Not set"
                      placeholderTextColor={colors.textMuted}
                    />
                    <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                  </View>
                </View>
              </View>

              {/* 6. TAGS Section */}
              <View style={styles.tagsSection}>
                <Text style={[styles.tagsSectionTitle, { color: colors.textSecondary }]}>TAGS</Text>
                <View style={styles.tagsGrid}>
                  {['Personal', 'Business', 'Client', 'Side Project'].map((tag) => {
                    const isSelected = editTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor: isSelected
                              ? (isDark ? '#1e293b' : '#ffffff')
                              : (isDark ? '#111827' : '#ffffff'),
                            borderColor: isSelected ? (isDark ? '#38bdf8' : '#0f172a') : (isDark ? '#1f2937' : '#e2e8f0'),
                          },
                        ]}
                        onPress={() => handleToggleTag(tag)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.tagPillText,
                            { color: colors.text, fontWeight: isSelected ? '700' : '500' },
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[
                      styles.tagPill,
                      {
                        backgroundColor: isDark ? '#111827' : '#ffffff',
                        borderColor: isDark ? '#1f2937' : '#e2e8f0',
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={14} color={colors.textSecondary} style={{ marginRight: 3 }} />
                    <Text style={[styles.tagPillText, { color: colors.textSecondary }]}>Custom</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 7. Notes Section */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <TextInput
                  style={[styles.notesInput, { color: colors.text }]}
                  placeholder="Add notes (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />
              </View>

              {/* Linked Infrastructure Section in Edit Modal */}
              <View
                style={[
                  styles.cardBox,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={[styles.sectionHeaderDot, { backgroundColor: '#8b5cf6' }]} />
                  <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                    LINKED INFRASTRUCTURE
                  </Text>
                </View>
                <View style={[styles.sectionDivider, { backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }]} />

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Provider</Text>
                  <TouchableOpacity
                    style={styles.editInputWrapper}
                    onPress={() => setIsLinkProviderModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.editInputText,
                        { color: matchedProvider ? colors.text : colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {matchedProvider ? matchedProvider.label : 'None (Auto WHOIS)'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.editRow}>
                  <Text style={[styles.editLabel, { color: colors.textSecondary }]}>VPS Server</Text>
                  <TouchableOpacity
                    style={styles.editInputWrapper}
                    onPress={() => setIsLinkServerModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.editInputText,
                        { color: matchedServer ? colors.text : colors.textMuted },
                      ]}
                      numberOfLines={1}
                    >
                      {matchedServer ? matchedServer.name : 'None Linked'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* LINK / CHANGE PROVIDER ACCOUNT MODAL */}
      <Modal
        visible={isLinkProviderModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLinkProviderModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.pickerModalBox,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? '#1f2937' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.pickerModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerModalTitle, { color: colors.text }]}>
                  Link Provider Account
                </Text>
                <Text style={[styles.pickerModalSubtitle, { color: colors.textSecondary }]}>
                  Choose the registrar or cloud account for {domain.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLinkProviderModalOpen(false)}
                style={styles.pickerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.pickerSearchRow,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.text }]}
                placeholder="Search accounts by name or provider..."
                placeholderTextColor={colors.textMuted}
                value={accountSearchText}
                onChangeText={setAccountSearchText}
              />
              {accountSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setAccountSearchText('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {/* Option to Unlink / Clear */}
              <TouchableOpacity
                style={[
                  styles.pickerItemRow,
                  {
                    backgroundColor: isDark ? '#1a2234' : '#f8fafc',
                    borderColor: !matchedProvider ? colors.primary : (isDark ? '#1f2937' : '#e2e8f0'),
                  },
                ]}
                onPress={() => handleSelectProviderAccount(null)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.pickerLogoFallback,
                    { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' },
                  ]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerItemTitle, { color: colors.text }]}>
                    No Provider Account (Unlink)
                  </Text>
                  <Text style={[styles.pickerItemSubtitle, { color: colors.textSecondary }]}>
                    Rely on public WHOIS lookups only
                  </Text>
                </View>
                {!matchedProvider ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>

              {/* Filtered Provider Accounts */}
              {providerAccounts
                .filter((acc) => {
                  if (!accountSearchText.trim()) return true;
                  const query = accountSearchText.toLowerCase();
                  return (
                    (acc.label || '').toLowerCase().includes(query) ||
                    (acc.providerKey || '').toLowerCase().includes(query) ||
                    (acc.externalAccountId || '').toLowerCase().includes(query)
                  );
                })
                .map((acc) => {
                  const isSelected = matchedProvider?.id === acc.id;
                  const key = (acc.providerKey || '').toLowerCase();
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.pickerItemRow,
                        {
                          backgroundColor: isDark ? '#1a2234' : '#f8fafc',
                          borderColor: isSelected ? colors.primary : (isDark ? '#1f2937' : '#e2e8f0'),
                        },
                      ]}
                      onPress={() => handleSelectProviderAccount(acc)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickerLogoBox}>
                        {PROVIDER_LOGOS[key] ? (
                          <Image
                            source={PROVIDER_LOGOS[key]}
                            style={{ width: 28, height: 28 }}
                            contentFit="contain"
                          />
                        ) : (
                          <Ionicons name="cloud-outline" size={22} color="#8b5cf6" />
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.pickerItemTitle, { color: colors.text }]} numberOfLines={1}>
                            {acc.label}
                          </Text>
                          <View
                            style={[
                              styles.infraBadge,
                              { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#eff6ff' },
                            ]}
                          >
                            <Text style={[styles.infraBadgeText, { color: '#2563eb' }]}>
                              {key.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.pickerItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {acc.externalAccountId
                            ? `Account ID: ${acc.externalAccountId}`
                            : getProviderDisplayTitle(key)}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* LINK / CHANGE VPS SERVER MODAL */}
      <Modal
        visible={isLinkServerModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLinkServerModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.pickerModalBox,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? '#1f2937' : '#e2e8f0',
              },
            ]}
          >
            <View style={styles.pickerModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickerModalTitle, { color: colors.text }]}>
                  Link Hosting / VPS Server
                </Text>
                <Text style={[styles.pickerModalSubtitle, { color: colors.textSecondary }]}>
                  Attach {domain.name} to a tracked VPS node or cloud server
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLinkServerModalOpen(false)}
                style={styles.pickerCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.pickerSearchRow,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#e2e8f0',
                },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.pickerSearchInput, { color: colors.text }]}
                placeholder="Search servers by name, IP, provider..."
                placeholderTextColor={colors.textMuted}
                value={serverSearchText}
                onChangeText={setServerSearchText}
              />
              {serverSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setServerSearchText('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {/* Option to Unlink / Clear */}
              <TouchableOpacity
                style={[
                  styles.pickerItemRow,
                  {
                    backgroundColor: isDark ? '#1a2234' : '#f8fafc',
                    borderColor: !matchedServer ? colors.primary : (isDark ? '#1f2937' : '#e2e8f0'),
                  },
                ]}
                onPress={() => handleSelectServer(null)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.pickerLogoFallback,
                    { backgroundColor: isDark ? '#0f172a' : '#f1f5f9' },
                  ]}
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerItemTitle, { color: colors.text }]}>
                    No VPS Attached (Unlink)
                  </Text>
                  <Text style={[styles.pickerItemSubtitle, { color: colors.textSecondary }]}>
                    Do not link to any internal VPS server node
                  </Text>
                </View>
                {!matchedServer ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>

              {/* Filtered Servers */}
              {servers
                .filter((srv) => {
                  if (!serverSearchText.trim()) return true;
                  const query = serverSearchText.toLowerCase();
                  return (
                    (srv.name || '').toLowerCase().includes(query) ||
                    (srv.provider || '').toLowerCase().includes(query) ||
                    (srv.ipAddress || '').toLowerCase().includes(query) ||
                    (srv.region || '').toLowerCase().includes(query) ||
                    (srv.os || '').toLowerCase().includes(query)
                  );
                })
                .map((srv) => {
                  const isSelected = matchedServer?.id === srv.id;
                  const srvKey = getServerProviderKey(srv.provider, srv.name, srv.os);
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={[
                        styles.pickerItemRow,
                        {
                          backgroundColor: isDark ? '#1a2234' : '#f8fafc',
                          borderColor: isSelected ? colors.primary : (isDark ? '#1f2937' : '#e2e8f0'),
                        },
                      ]}
                      onPress={() => handleSelectServer(srv)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickerLogoBox}>
                        {PROVIDER_LOGOS[srvKey] ? (
                          <Image
                            source={PROVIDER_LOGOS[srvKey]}
                            style={{ width: 28, height: 28 }}
                            contentFit="contain"
                          />
                        ) : (
                          <Ionicons name="hardware-chip-outline" size={22} color="#10b981" />
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.pickerItemTitle, { color: colors.text }]} numberOfLines={1}>
                            {srv.name}
                          </Text>
                          <View
                            style={[
                              styles.infraBadge,
                              { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ecfdf5' },
                            ]}
                          >
                            <Text style={[styles.infraBadgeText, { color: '#059669' }]}>
                              {srv.provider || 'VPS'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.pickerItemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {srv.ipAddress} • {srv.region || 'Global'}
                        </Text>
                      </View>

                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteModalBox, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            <Ionicons name="warning-outline" size={38} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={[styles.deleteTitle, { color: colors.text }]}>Delete Domain?</Text>
            <Text style={[styles.deleteMessage, { color: colors.textSecondary }]}>
              Are you sure you want to remove {domain.name} from your portfolio?
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#ef4444' }]}
                onPress={handleDelete}
              >
                <Text style={[styles.modalBtnText, { color: '#ffffff', fontWeight: '700' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    ...Typography.bodyMedium,
    textAlign: 'center',
    marginTop: 16,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...Typography.titleMedium,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerIconButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerSaveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: 14,
  },
  cardBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1.5,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroDomainName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 6,
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  heroStatusPillText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  liveOnlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    gap: 5,
    marginLeft: 'auto',
  },
  liveOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveOnlineText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  endpointItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  endpointIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endpointItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  endpointPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  endpointPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  endpointItemUrl: {
    fontSize: 12,
    marginTop: 2,
  },
  endpointLaunchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  endpointLaunchPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  endpointUtilsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  endpointUtilItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  endpointUtilDivider: {
    width: 1,
    height: 14,
  },
  endpointUtilText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionDivider: {
    height: 1,
    marginBottom: 14,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  sslFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sslFeatureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  settingsLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  refreshSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  refreshButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  refreshSubtext: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  editDomainPillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  editDomainTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: '32%',
  },
  editSingleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    paddingVertical: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  editInputText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginRight: 6,
    paddingVertical: 2,
  },
  tagsSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  tagsSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  tagPillText: {
    fontSize: 13,
  },
  notesInput: {
    fontSize: 14,
    minHeight: 55,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  deleteModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  deleteMessage: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Infrastructure Cards Styles
  infraSubCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  infraSubCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infraSubCardCategory: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  infraActionLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  infraAccountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infraLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infraLogoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infraAccountTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  infraAccountSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  infraBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  infraBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  infraStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infraActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  infraActiveText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  infraEmptyStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infraAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  infraAddPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infraServerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  infraIpWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infraIpDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10b981',
  },
  infraIpText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infraViewServerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  infraViewServerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Picker Modals Styles
  pickerModalBox: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pickerModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  pickerCloseBtn: {
    padding: 4,
    borderRadius: 8,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 12,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerLogoBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerLogoFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pickerItemSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
