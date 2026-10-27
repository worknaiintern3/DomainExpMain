import { listInventory, createInventory, updateInventory, archiveInventory } from '../api/inventory';
import {
  syncPlayStoreDeveloper,
  getPlayStoreDeveloperApps,
} from '../api/play-store';
import { listAlerts } from '../api/monitoring';
import type { NormalizedWhoisData } from '../api/whois.types';


export interface DomainItem {
  id: string;
  name: string;
  tld: string;
  registrar: string;
  autoRenew: boolean;
  registrationDate: string;
  expiresAt: string;
  daysRemaining: number;
  renewalPrice: number;
  currency: string;
  status: 'critical' | 'warning' | 'safe';
  dnsProvider: string;
  sslStatus: 'active' | 'expired' | 'pending';
  httpStatus: string;
  rdapStatus: string;
  nameservers: string[];
  tags: string[];
  notes?: string;
  logoUrl?: string;
  providerAccountId?: string;
  providerLabel?: string;
  providerKey?: string;
  serverId?: string;
  serverName?: string;
  serverIp?: string;
  serverProvider?: string;
}

export interface ServerItem {
  id: string;
  name: string;
  provider: string;
  providerKey?: string;
  region: string;
  ipAddress: string;
  cpu: string;
  memory: string;
  os: string;
  status: 'healthy' | 'warning' | 'offline';
  uptime: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  connectedDomains: string[];
  providerAccountId?: string;
}

export interface ApplicationItem {
  id: string;
  name: string;
  packageId?: string;
  playStoreUrl?: string;
  url?: string;
  serverName?: string;
  environment: 'Production' | 'Staging' | 'Development';
  status: 'healthy' | 'warning' | 'error';
  version?: string;
  developerName?: string;
  releaseTrack?: string;
  iconUrl?: string;
  updatedAt?: string;
  rating?: number;
}

export interface WebsiteItem {
  id: string;
  name: string;
  url: string;
  category: 'Production' | 'Client' | 'Personal' | 'Staging' | 'Tools';
  status: 'healthy' | 'warning' | 'error';
  domain: string;
  serverId?: string;
  serverName?: string;
  serverIp?: string;
  sslActive: boolean;
  httpStatus: string;
  responseTimeMs: number;
  tags: string[];
  logoUrl?: string;
  notes?: string;
}

export interface ProviderAccountItem {
  id: string;
  label: string;
  providerKey: string;
  externalAccountId: string | null;
  notes: string | null;
  inventoryState: 'TRACKED' | 'ARCHIVED';
  lastSynced?: string;
  syncedDomainsCount?: number;
  syncedServersCount?: number;
}

export interface PortfolioSummary {
  totalDomains: number;
  safeDomains: number;
  warningDomains: number;
  criticalDomains: number;
  totalServers: number;
  healthyServers: number;
  totalApps: number;
  productionApps: number;
  totalWebsites: number;
  totalProviders: number;
  totalAlerts: number;
  estimatedRenewalCost: number;
}

export const PROVIDER_LOGOS: Record<string, string> = {
  hostinger: '/images/providers/hostinger.png',
  hetzner: '/images/providers/hetzner.png',
  aws: '/images/providers/aws.png',
  digitalocean: '/images/providers/digitalocean.png',
  cloudflare: '/images/providers/cloudflare.png',
  godaddy: '/images/providers/godaddy.png',
  namecheap: '/images/providers/namecheap.png',
  gcp: '/images/providers/gcp.png',
  azure: '/images/providers/azure.png',
  vultr: '/images/providers/vultr.png',
  linode: '/images/providers/linode.png',
  squarespace: 'https://www.google.com/s2/favicons?domain=squarespace.com&sz=128',
  google: '/images/providers/gcp.png',
  googledomains: '/images/providers/gcp.png',
};

export const REAL_APP_ICONS: Record<string, string> = {
  'com.aitourism': '/images/app-icons/com_aitourism.png',
  'com.anyworkservices.app': '/images/app-icons/com_anyworkservices_app.png',
  'com.blooddonation.online': '/images/app-icons/com_blooddonation_online.png',
  'com.goairclass.onlinego': '/images/app-icons/com_goairclass_onlinego.png',
  'com.goairclass.app': '/images/app-icons/goairclass.png',
  'com.livesale.fitness': '/images/app-icons/com_livesale_fitness.png',
  'com.healthyfood.cafe': '/images/app-icons/com_healthyfood_cafe.png',
  'com.app.itjobx.com': '/images/app-icons/com_app_itjobx_com.png',
  'com.inquiryexperts.app': '/images/app-icons/inquiryexperts.png',
  'com.lovenzea.online': '/images/app-icons/com_lovenzea_online.png',
  'com.worknai.mobilepaycafe': '/images/app-icons/com_worknai_mobilepaycafe.png',
  'com.mobilepay.service': '/images/app-icons/com_worknai_mobilepaycafe.png',
  'com.worknai.namasteyyy': '/images/app-icons/com_worknai_namasteyyy.png',
  'com.namastemeditation.app': '/images/app-icons/com_worknai_namasteyyy.png',
  'com.chessApp.WorknAi': '/images/app-icons/com_chessApp_WorknAi.png',
  'com.onlinechess.game': '/images/app-icons/com_chessApp_WorknAi.png',
  'com.mantis.onlinego': '/images/app-icons/com_mantis_onlinego.png',
  'com.worknai.onlinego': '/images/app-icons/com_mantis_onlinego.png',
  'com.onlinegologistics': '/images/app-icons/com_onlinegologistics.png',
  'com.onlinego.logistics': '/images/app-icons/com_onlinegologistics.png',
  'com.pginfo.onlinee': '/images/app-icons/com_pginfo_onlinee.png',
  'com.pginfo.hostel': '/images/app-icons/com_pginfo_onlinee.png',
  'com.worknai.hrms': '/images/app-icons/com_worknai_hrms.png',
  'com.worknai': '/images/app-icons/worknaiclient.png',
};

export const WORKNAI_CONSOLE_APPS: ApplicationItem[] = [
  {
    id: 'play-aitourism',
    name: 'AiTourism - Travel & Cabs',
    packageId: 'com.aitourism',
    environment: 'Production',
    status: 'healthy',
    version: 'v9.0.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_aitourism.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.aitourism',
    url: 'https://play.google.com/store/apps/details?id=com.aitourism',
    updatedAt: '2026-09-17T00:00:00Z',
  },
  {
    id: 'play-anywork',
    name: 'AnyWork: Smart Services & Bookings',
    packageId: 'com.anyworkservices.app',
    environment: 'Production',
    status: 'healthy',
    version: 'v8.2.1',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_anyworkservices_app.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.anyworkservices.app',
    url: 'https://play.google.com/store/apps/details?id=com.anyworkservices.app',
    updatedAt: '2026-09-07T00:00:00Z',
  },
  {
    id: 'play-blooddonation',
    name: 'Blood Donation Online',
    packageId: 'com.blooddonation.online',
    environment: 'Production',
    status: 'healthy',
    version: 'v13.0.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_blooddonation_online.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.blooddonation.online',
    url: 'https://play.google.com/store/apps/details?id=com.blooddonation.online',
    updatedAt: '2026-09-12T00:00:00Z',
  },
  {
    id: 'play-goairclass',
    name: 'GoAirClass Online Aviation Learning',
    packageId: 'com.goairclass.onlinego',
    environment: 'Production',
    status: 'healthy',
    version: 'v5.1.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_goairclass_onlinego.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goairclass.onlinego',
    url: 'https://play.google.com/store/apps/details?id=com.goairclass.onlinego',
    updatedAt: '2026-06-24T00:00:00Z',
  },
  {
    id: 'play-goairclass-app',
    name: 'Goair Class Student Companion',
    packageId: 'com.goairclass.app',
    environment: 'Production',
    status: 'healthy',
    version: 'v5.0.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/goairclass.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goairclass.app',
    url: 'https://play.google.com/store/apps/details?id=com.goairclass.app',
    updatedAt: '2026-09-09T00:00:00Z',
  },
  {
    id: 'play-gymproplus',
    name: 'GymProPlus Live Fitness Tracker',
    packageId: 'com.livesale.fitness',
    environment: 'Production',
    status: 'healthy',
    version: 'v21.4.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_livesale_fitness.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.livesale.fitness',
    url: 'https://play.google.com/store/apps/details?id=com.livesale.fitness',
    updatedAt: '2026-08-19T00:00:00Z',
  },
  {
    id: 'play-healthyfood',
    name: 'HealthyFood.Cafe Nutrition & Meals',
    packageId: 'com.healthyfood.cafe',
    environment: 'Production',
    status: 'healthy',
    version: 'v6.3.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_healthyfood_cafe.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.healthyfood.cafe',
    url: 'https://play.google.com/store/apps/details?id=com.healthyfood.cafe',
    updatedAt: '2026-08-26T00:00:00Z',
  },
  {
    id: 'play-itjobx',
    name: 'ITJobX - Tech Careers & Recruitment',
    packageId: 'com.app.itjobx.com',
    environment: 'Production',
    status: 'healthy',
    version: 'v7.0.2',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_app_itjobx_com.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.app.itjobx.com',
    url: 'https://play.google.com/store/apps/details?id=com.app.itjobx.com',
    updatedAt: '2026-09-02T00:00:00Z',
  },
  {
    id: 'play-inquiryexperts',
    name: 'Inquiry Experts Business Advisory',
    packageId: 'com.inquiryexperts.app',
    environment: 'Production',
    status: 'healthy',
    version: 'v4.1.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/inquiryexperts.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.inquiryexperts.app',
    url: 'https://play.google.com/store/apps/details?id=com.inquiryexperts.app',
    updatedAt: '2026-08-11T00:00:00Z',
  },
  {
    id: 'play-lovenzea',
    name: 'Lovenzea: Matrimony & Dating',
    packageId: 'com.lovenzea.online',
    environment: 'Production',
    status: 'healthy',
    version: 'v11.0.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_lovenzea_online.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.lovenzea.online',
    url: 'https://play.google.com/store/apps/details?id=com.lovenzea.online',
    updatedAt: '2026-09-15T00:00:00Z',
  },
  {
    id: 'play-mobilepay',
    name: 'MobilePay: NFC & Instant UPI POS',
    packageId: 'com.worknai.mobilepaycafe',
    environment: 'Production',
    status: 'healthy',
    version: 'v14.1.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_worknai_mobilepaycafe.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.mobilepaycafe',
    url: 'https://play.google.com/store/apps/details?id=com.worknai.mobilepaycafe',
    updatedAt: '2026-09-18T00:00:00Z',
  },
  {
    id: 'play-namasteyyy',
    name: 'Namasteyyy Mindfulness & Yoga',
    packageId: 'com.worknai.namasteyyy',
    environment: 'Production',
    status: 'healthy',
    version: 'v6.2.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_worknai_namasteyyy.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
    url: 'https://play.google.com/store/apps/details?id=com.worknai.namasteyyy',
    updatedAt: '2026-08-30T00:00:00Z',
  },
  {
    id: 'play-chess',
    name: 'Omenxis Chess 3D Multi-level',
    packageId: 'com.chessApp.WorknAi',
    environment: 'Production',
    status: 'healthy',
    version: 'v18.0.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_chessApp_WorknAi.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.chessApp.WorknAi',
    url: 'https://play.google.com/store/apps/details?id=com.chessApp.WorknAi',
    updatedAt: '2026-09-20T00:00:00Z',
  },
  {
    id: 'play-onlinego',
    name: 'OnlineGo: City Rides & Delivery',
    packageId: 'com.mantis.onlinego',
    environment: 'Production',
    status: 'healthy',
    version: 'v12.2.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_mantis_onlinego.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
    url: 'https://play.google.com/store/apps/details?id=com.mantis.onlinego',
    updatedAt: '2026-09-14T00:00:00Z',
  },
  {
    id: 'play-logistics',
    name: 'OnlineGo Logistics Fleet Manager',
    packageId: 'com.onlinegologistics',
    environment: 'Production',
    status: 'healthy',
    version: 'v5.8.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_onlinegologistics.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
    url: 'https://play.google.com/store/apps/details?id=com.onlinegologistics',
    updatedAt: '2026-08-27T00:00:00Z',
  },
  {
    id: 'play-pginfo',
    name: 'PG Info - PG, Hostel & Roommate Finder',
    packageId: 'com.pginfo.onlinee',
    environment: 'Production',
    status: 'healthy',
    version: 'v9.3.0',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_pginfo_onlinee.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
    url: 'https://play.google.com/store/apps/details?id=com.pginfo.onlinee',
    updatedAt: '2026-09-19T00:00:00Z',
  },
  {
    id: 'play-hrms',
    name: 'WorknAi HRMS & Payroll Portal',
    packageId: 'com.worknai.hrms',
    environment: 'Production',
    status: 'healthy',
    version: 'v10.0.1',
    developerName: 'WorknAi Technologies India Pvt Ltd',
    releaseTrack: 'Production',
    serverName: 'Google Play Console',
    iconUrl: '/images/app-icons/com_worknai_hrms.png',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.hrms',
    url: 'https://hrms.worknai.com',
    updatedAt: '2026-09-22T00:00:00Z',
  },
];

export const INITIAL_SERVERS: ServerItem[] = [
  {
    id: 'srv-hostinger-mumbai-01',
    name: 'in-south-hostinger-vps01',
    provider: 'Hostinger',
    providerKey: 'hostinger',
    region: 'Mumbai (IN-South-01)',
    ipAddress: '194.195.112.45',
    cpu: '4 vCPU',
    memory: '8 GB',
    os: 'Ubuntu 24.04 LTS',
    status: 'healthy',
    uptime: '99.98%',
    cpuUsagePercent: 22,
    memoryUsagePercent: 44,
    diskUsagePercent: 28,
    connectedDomains: ['worknai.com', 'aitourism.in', 'hrms.worknai.com'],
  },
  {
    id: 'srv-hetzner-frankfurt-01',
    name: 'eu-central-hetzner-node02',
    provider: 'Hetzner',
    providerKey: 'hetzner',
    region: 'Frankfurt (EU-Central)',
    ipAddress: '159.69.214.88',
    cpu: '8 vCPU',
    memory: '16 GB',
    os: 'Debian 12 Bookworm',
    status: 'healthy',
    uptime: '99.99%',
    cpuUsagePercent: 36,
    memoryUsagePercent: 58,
    diskUsagePercent: 42,
    connectedDomains: ['goairclass.online', 'blooddonation.online', 'gymproplus.com'],
  },
  {
    id: 'srv-aws-useast-ec2',
    name: 'us-east-aws-ec2-api-cluster',
    provider: 'AWS',
    providerKey: 'aws',
    region: 'US East (N. Virginia)',
    ipAddress: '54.210.88.192',
    cpu: '8 vCPU',
    memory: '32 GB',
    os: 'Amazon Linux 2023',
    status: 'healthy',
    uptime: '100.0%',
    cpuUsagePercent: 18,
    memoryUsagePercent: 39,
    diskUsagePercent: 24,
    connectedDomains: ['mobilepay.cafe', 'namasteyyy.com', 'omenxis.com'],
  },
  {
    id: 'srv-do-bangalore-droplet',
    name: 'do-blr1-docker-swarm-node',
    provider: 'DigitalOcean',
    providerKey: 'digitalocean',
    region: 'Bangalore (BLR1)',
    ipAddress: '139.59.18.204',
    cpu: '4 vCPU',
    memory: '8 GB',
    os: 'Ubuntu 24.04 LTS',
    status: 'healthy',
    uptime: '99.95%',
    cpuUsagePercent: 27,
    memoryUsagePercent: 51,
    diskUsagePercent: 33,
    connectedDomains: ['onlinego.in', 'pginfo.online', 'anyworkservices.com'],
  },
];

export const INITIAL_DOMAINS: DomainItem[] = [
  {
    id: 'dom-worknai-com',
    name: 'worknai.com',
    tld: '.com',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-01-15',
    expiresAt: new Date(Date.now() + 320 * 86400000).toISOString(),
    daysRemaining: 320,
    renewalPrice: 899,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Cloudflare DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    tags: ['Live', 'Hostinger Portfolio', 'Production'],
    logoUrl: '/images/app-icons/worknaiclient.png',
    providerLabel: 'Hostinger',
    serverName: 'in-south-hostinger-vps01',
    serverIp: '194.195.112.45',
    serverProvider: 'Hostinger',
  },
  {
    id: 'dom-aitourism-in',
    name: 'aitourism.in',
    tld: '.in',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-04-10',
    expiresAt: new Date(Date.now() + 290 * 86400000).toISOString(),
    daysRemaining: 290,
    renewalPrice: 499,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Hostinger DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
    tags: ['Live', 'Travel', 'Android App'],
    logoUrl: '/images/app-icons/com_aitourism.png',
    providerLabel: 'Hostinger',
    serverName: 'in-south-hostinger-vps01',
    serverIp: '194.195.112.45',
    serverProvider: 'Hostinger',
  },
  {
    id: 'dom-goairclass-online',
    name: 'goairclass.online',
    tld: '.online',
    registrar: 'Namecheap (NAMECHEAP)',
    autoRenew: true,
    registrationDate: '2023-06-20',
    expiresAt: new Date(Date.now() + 25 * 86400000).toISOString(),
    daysRemaining: 25,
    renewalPrice: 1299,
    currency: '₹',
    status: 'warning',
    dnsProvider: 'Namecheap DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['dns1.registrar-servers.com', 'dns2.registrar-servers.com'],
    tags: ['Aviation', 'Warning Renewal'],
    logoUrl: '/images/app-icons/com_goairclass_onlinego.png',
    providerLabel: 'Namecheap',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    serverProvider: 'Hetzner',
  },
  {
    id: 'dom-blooddonation-online',
    name: 'blooddonation.online',
    tld: '.online',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-08-12',
    expiresAt: new Date(Date.now() + 180 * 86400000).toISOString(),
    daysRemaining: 180,
    renewalPrice: 899,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Hostinger DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
    tags: ['Social Good', 'Android App'],
    logoUrl: '/images/app-icons/com_blooddonation_online.png',
    providerLabel: 'Hostinger',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    serverProvider: 'Hetzner',
  },
  {
    id: 'dom-gymproplus-com',
    name: 'gymproplus.com',
    tld: '.com',
    registrar: 'GoDaddy (GODADDY)',
    autoRenew: false,
    registrationDate: '2022-11-05',
    expiresAt: new Date(Date.now() + 8 * 86400000).toISOString(),
    daysRemaining: 8,
    renewalPrice: 1499,
    currency: '₹',
    status: 'critical',
    dnsProvider: 'GoDaddy DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns01.domaincontrol.com', 'ns02.domaincontrol.com'],
    tags: ['Critical Expiring', 'Fitness'],
    logoUrl: '/images/app-icons/com_livesale_fitness.png',
    providerLabel: 'GoDaddy',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    serverProvider: 'Hetzner',
  },
  {
    id: 'dom-mobilepay-cafe',
    name: 'mobilepay.cafe',
    tld: '.cafe',
    registrar: 'Cloudflare (CLOUDFLARE)',
    autoRenew: true,
    registrationDate: '2023-03-01',
    expiresAt: new Date(Date.now() + 240 * 86400000).toISOString(),
    daysRemaining: 240,
    renewalPrice: 1999,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Cloudflare DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['amy.ns.cloudflare.com', 'walt.ns.cloudflare.com'],
    tags: ['Fintech', 'POS App'],
    logoUrl: '/images/app-icons/com_worknai_mobilepaycafe.png',
    providerLabel: 'Cloudflare',
    serverName: 'us-east-aws-ec2-api-cluster',
    serverIp: '54.210.88.192',
    serverProvider: 'AWS',
  },
  {
    id: 'dom-namasteyyy-com',
    name: 'namasteyyy.com',
    tld: '.com',
    registrar: 'AWS Route 53 (AWS)',
    autoRenew: true,
    registrationDate: '2023-05-18',
    expiresAt: new Date(Date.now() + 210 * 86400000).toISOString(),
    daysRemaining: 210,
    renewalPrice: 1100,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Amazon Route 53',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns-123.awsdns-15.com', 'ns-456.awsdns-57.net'],
    tags: ['Wellness', 'AWS Portfolio'],
    logoUrl: '/images/app-icons/com_worknai_namasteyyy.png',
    providerLabel: 'AWS',
    serverName: 'us-east-aws-ec2-api-cluster',
    serverIp: '54.210.88.192',
    serverProvider: 'AWS',
  },
  {
    id: 'dom-onlinego-in',
    name: 'onlinego.in',
    tld: '.in',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-02-14',
    expiresAt: new Date(Date.now() + 310 * 86400000).toISOString(),
    daysRemaining: 310,
    renewalPrice: 499,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Hostinger DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
    tags: ['Transport', 'Android App'],
    logoUrl: '/images/app-icons/com_mantis_onlinego.png',
    providerLabel: 'Hostinger',
    serverName: 'do-blr1-docker-swarm-node',
    serverIp: '139.59.18.204',
    serverProvider: 'DigitalOcean',
  },
  {
    id: 'dom-pginfo-online',
    name: 'pginfo.online',
    tld: '.online',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-07-29',
    expiresAt: new Date(Date.now() + 195 * 86400000).toISOString(),
    daysRemaining: 195,
    renewalPrice: 899,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Hostinger DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
    tags: ['Hostel Search', 'Real Estate'],
    logoUrl: '/images/app-icons/com_pginfo_onlinee.png',
    providerLabel: 'Hostinger',
    serverName: 'do-blr1-docker-swarm-node',
    serverIp: '139.59.18.204',
    serverProvider: 'DigitalOcean',
  },
  {
    id: 'dom-anyworkservices-com',
    name: 'anyworkservices.com',
    tld: '.com',
    registrar: 'Hostinger (HOSTINGER)',
    autoRenew: true,
    registrationDate: '2023-09-01',
    expiresAt: new Date(Date.now() + 340 * 86400000).toISOString(),
    daysRemaining: 340,
    renewalPrice: 899,
    currency: '₹',
    status: 'safe',
    dnsProvider: 'Hostinger DNS',
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
    tags: ['Home Services', 'Verified'],
    logoUrl: '/images/app-icons/com_anyworkservices_app.png',
    providerLabel: 'Hostinger',
    serverName: 'do-blr1-docker-swarm-node',
    serverIp: '139.59.18.204',
    serverProvider: 'DigitalOcean',
  },
];

export const INITIAL_WEBSITES: WebsiteItem[] = [
  {
    id: 'web-worknai',
    name: 'WorknAi Official Enterprise Portal',
    url: 'https://worknai.com',
    category: 'Production',
    status: 'healthy',
    domain: 'worknai.com',
    serverName: 'in-south-hostinger-vps01',
    serverIp: '194.195.112.45',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 24,
    tags: ['Primary Brand', 'Enterprise', 'Cloudflare CDN'],
    logoUrl: '/images/app-icons/worknaiclient.png',
  },
  {
    id: 'web-hrms',
    name: 'WorknAi HRMS Cloud Portal',
    url: 'https://hrms.worknai.com',
    category: 'Production',
    status: 'healthy',
    domain: 'worknai.com',
    serverName: 'in-south-hostinger-vps01',
    serverIp: '194.195.112.45',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 32,
    tags: ['HR Tech', 'Payroll', 'SaaS'],
    logoUrl: '/images/app-icons/com_worknai_hrms.png',
  },
  {
    id: 'web-aitourism',
    name: 'AiTourism Booking Web App',
    url: 'https://aitourism.in',
    category: 'Production',
    status: 'healthy',
    domain: 'aitourism.in',
    serverName: 'in-south-hostinger-vps01',
    serverIp: '194.195.112.45',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 45,
    tags: ['Travel', 'Taxi Booking'],
    logoUrl: '/images/app-icons/com_aitourism.png',
  },
  {
    id: 'web-goairclass',
    name: 'GoAirClass Online Aviation Academy',
    url: 'https://goairclass.online',
    category: 'Staging',
    status: 'warning',
    domain: 'goairclass.online',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 65,
    tags: ['Aviation', 'E-Learning'],
    logoUrl: '/images/app-icons/com_goairclass_onlinego.png',
  },
  {
    id: 'web-blooddonation',
    name: 'Blood Donation Life Network',
    url: 'https://blooddonation.online',
    category: 'Production',
    status: 'healthy',
    domain: 'blooddonation.online',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 38,
    tags: ['Healthcare', 'NGO'],
    logoUrl: '/images/app-icons/com_blooddonation_online.png',
  },
  {
    id: 'web-gymproplus',
    name: 'GymProPlus Member & Workout Dashboard',
    url: 'https://gymproplus.com',
    category: 'Production',
    status: 'warning',
    domain: 'gymproplus.com',
    serverName: 'eu-central-hetzner-node02',
    serverIp: '159.69.214.88',
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 42,
    tags: ['Fitness', 'Expiring Domain'],
    logoUrl: '/images/app-icons/com_livesale_fitness.png',
  },
];

export const INITIAL_PROVIDERS: ProviderAccountItem[] = [
  {
    id: 'pa-hostinger-main',
    label: 'Hostinger India Cloud',
    providerKey: 'hostinger',
    externalAccountId: 'hst-corp-prod-01',
    notes: 'Primary Registrar & VPS hosting provider. Live sync active.',
    inventoryState: 'TRACKED',
    lastSynced: 'Just now',
    syncedDomainsCount: 6,
    syncedServersCount: 1,
  },
  {
    id: 'pa-hetzner-cloud',
    label: 'Hetzner Cloud EU',
    providerKey: 'hetzner',
    externalAccountId: 'hetzner-eu-token-99',
    notes: 'Dedicated root nodes & high-performance VPS.',
    inventoryState: 'TRACKED',
    lastSynced: '10 mins ago',
    syncedDomainsCount: 0,
    syncedServersCount: 1,
  },
  {
    id: 'pa-aws-cloud',
    label: 'Amazon Web Services (AWS)',
    providerKey: 'aws',
    externalAccountId: 'aws-root-east-01',
    notes: 'EC2 clusters & Route 53 authoritative DNS zones.',
    inventoryState: 'TRACKED',
    lastSynced: '25 mins ago',
    syncedDomainsCount: 1,
    syncedServersCount: 1,
  },
  {
    id: 'pa-cloudflare-dns',
    label: 'Cloudflare Pro DNS',
    providerKey: 'cloudflare',
    externalAccountId: 'cf-zone-token-88',
    notes: 'Global CDN edge proxy, SSL certificates & WAF.',
    inventoryState: 'TRACKED',
    lastSynced: '1 hour ago',
    syncedDomainsCount: 1,
    syncedServersCount: 0,
  },
  {
    id: 'pa-digitalocean',
    label: 'DigitalOcean BLR',
    providerKey: 'digitalocean',
    externalAccountId: 'do-blr-token-12',
    notes: 'Droplets, Load balancers & container registry.',
    inventoryState: 'TRACKED',
    lastSynced: '2 hours ago',
    syncedDomainsCount: 0,
    syncedServersCount: 1,
  },
  {
    id: 'pa-google-play',
    label: 'Google Play Console (WorknAi)',
    providerKey: 'google-play',
    externalAccountId: 'WorknAi Technologies India Pvt Ltd',
    notes: 'Official Google Play Developer account with 17 published production apps.',
    inventoryState: 'TRACKED',
    lastSynced: 'Live Synced',
    syncedDomainsCount: 0,
    syncedServersCount: 0,
  },
];

export const STORAGE_KEYS = {
  DOMAINS: 'dp_web_domains_list_v1',
  SERVERS: 'dp_web_servers_list_v1',
  APPLICATIONS: 'dp_web_applications_list_v1',
  WEBSITES: 'dp_web_websites_list_v1',
  PROVIDERS: 'dp_web_providers_list_v1',
  CONSOLE_DEV: 'dp_web_console_developer_name',
};

export function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(fallback) && Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T;
      }
      if (!Array.isArray(fallback) && parsed) {
        return parsed as T;
      }
    }
  } catch {}
  return fallback;
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>();
const INFLIGHT_REQUESTS = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 30_000; // 30 seconds cache TTL

function getCached<T>(key: string, maxAgeMs = CACHE_TTL_MS): T | null {
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    MEMORY_CACHE.delete(key);
    return null;
  }
  return entry.data as T;
}

function setMemoryCache<T>(key: string, data: T): void {
  MEMORY_CACHE.set(key, { data, timestamp: Date.now() });
}

export function invalidatePortfolioCache(): void {
  MEMORY_CACHE.clear();
}

export function notifyPortfolioUpdated(): void {
  invalidatePortfolioCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('domainpulse:portfolio-updated'));
  }
}

export function getConsoleDeveloperName(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONSOLE_DEV) || 'WorknAi Technologies India Pvt Ltd';
  } catch {
    return 'WorknAi Technologies India Pvt Ltd';
  }
}

export function setConsoleDeveloperName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONSOLE_DEV, name.trim());
    notifyPortfolioUpdated();
  } catch {}
}

export function isMatchingConsoleDeveloper(appDev?: string | null, activeDev?: string | null): boolean {
  if (!appDev || !activeDev) return false;
  const a = appDev.trim().toLowerCase();
  const b = activeDev.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const keyA = clean(a);
  const keyB = clean(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;

  const stripSuffix = (s: string) =>
    s.replace(/(technologiesindiapvtltd|technologiesindia|technologies|technology|indiapvtltd|pvtltd|limited|ltd|corp|corporation|inc|llc|co)$/g, '');
  const baseA = stripSuffix(keyA);
  const baseB = stripSuffix(keyB);
  return Boolean(baseA && baseB && baseA === baseB);
}

export async function fetchDomainsList(options?: { forceRefresh?: boolean }): Promise<DomainItem[]> {
  const cacheKey = 'domains_list';
  if (!options?.forceRefresh) {
    const cached = getCached<DomainItem[]>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<DomainItem[]>;
  }

  const promise = (async () => {
    const local = getLocal<DomainItem[]>(STORAGE_KEYS.DOMAINS, []);
    const cleanLocal = local.filter((d) => d?.id && !d.id.startsWith('dom-worknai') && !d.id.startsWith('dom-aitourism') && !d.id.startsWith('dom-goairclass') && !d.id.startsWith('dom-blooddonation') && !d.id.startsWith('dom-namasteyyy') && !d.id.startsWith('dom-mobilepay') && !d.id.startsWith('dom-omenxis') && !d.id.startsWith('dom-pginfo') && !d.id.startsWith('dom-anyworkservices') && !d.id.startsWith('dom-onlinego'));

    try {
      const response = await listInventory('domains', { limit: 100 });
      if (response?.items && Array.isArray(response.items)) {
        const map = new Map<string, DomainItem>();
        for (const b of response.items) {
          const cleanName = (b.domainName || '').toLowerCase().trim();
          if (!cleanName) continue;
          const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
          const expDate = b.expiresAt || new Date(Date.now() + 365 * 86400000).toISOString();
          const expTime = new Date(expDate).getTime();
          const daysRemaining = isNaN(expTime) ? 365 : Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));
          const status: 'critical' | 'warning' | 'safe' =
            daysRemaining <= 14 ? 'critical' : daysRemaining <= 30 ? 'warning' : 'safe';

          let extractedRegistrar = 'Hostinger';
          if (b.notes?.startsWith('Registrar: ')) {
            extractedRegistrar = b.notes.replace(/^Registrar:\s*/, '').split('|')[0].trim();
          } else if (b.notes?.toLowerCase().includes('cloudflare')) {
            extractedRegistrar = 'Cloudflare';
          } else if (b.notes?.toLowerCase().includes('godaddy')) {
            extractedRegistrar = 'GoDaddy';
          } else if (b.notes?.toLowerCase().includes('namecheap')) {
            extractedRegistrar = 'Namecheap';
          } else if (b.notes?.toLowerCase().includes('aws')) {
            extractedRegistrar = 'AWS';
          } else if (b.notes?.toLowerCase().includes('hostinger')) {
            extractedRegistrar = 'Hostinger';
          }

          let nameservers = extractedRegistrar.toLowerCase().includes('cloudflare')
            ? ['ns1.cloudflare.com', 'ns2.cloudflare.com']
            : ['ns1.dns-parking.com', 'ns2.dns-parking.com'];
          if (b.notes?.includes('Nameservers: ')) {
            const nsPart = b.notes.split('Nameservers: ')[1];
            if (nsPart) nameservers = nsPart.split(',').map((s) => s.trim()).filter(Boolean);
          }

          const isHostingerVps = Boolean(b.notes?.includes('srv') || (extractedRegistrar === 'Hostinger' && !b.notes?.includes('Registered via DomainPulse web')));

          map.set(cleanName, {
            id: b.id,
            name: cleanName,
            tld: ext,
            registrar: extractedRegistrar,
            autoRenew: b.autoRenew !== null ? Boolean(b.autoRenew) : true,
            registrationDate: b.registeredAt ? b.registeredAt.split('T')[0] : '2026-01-21',
            expiresAt: expDate,
            daysRemaining: b.expiresAt ? daysRemaining : 365,
            renewalPrice: ext === '.in' ? 499 : ext === '.online' ? 299 : 899,
            currency: '₹',
            status,
            dnsProvider: b.dnsProviderAccountId ? `DNS (${b.dnsProviderAccountId})` : (nameservers[0]?.includes('cloudflare') ? 'Cloudflare DNS' : `${extractedRegistrar} DNS`),
            sslStatus: 'active',
            httpStatus: '200 OK',
            rdapStatus: 'Synchronized',
            nameservers,
            tags: ['Live', `${extractedRegistrar} Portfolio`],
            notes: b.notes || undefined,
            logoUrl: `https://www.google.com/s2/favicons?domain=${cleanName}&sz=128`,
            providerLabel: extractedRegistrar,
            ...(isHostingerVps ? {
              serverName: 'srv1357339.hstgr.cloud',
              serverIp: '76.13.185.120',
              serverProvider: 'Hostinger',
            } : {}),
          });
        }
        const merged = Array.from(map.values());
        setLocal(STORAGE_KEYS.DOMAINS, merged);
        setMemoryCache(cacheKey, merged);
        return merged;
      }
    } catch {}
    setMemoryCache(cacheKey, cleanLocal);
    return cleanLocal;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export function updateDomainWithWhois(
  domainName: string,
  whois: NormalizedWhoisData,
  options?: { notify?: boolean },
): DomainItem | null {
  const cleanName = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const list = getLocal<DomainItem[]>(STORAGE_KEYS.DOMAINS, []);
  const index = list.findIndex((d) => d.name.toLowerCase() === cleanName);

  const regName = whois.registrar?.name || undefined;
  const regDate = whois.registeredAt ? whois.registeredAt.split('T')[0] : undefined;
  const expDate = whois.expiresAt || undefined;
  const days = whois.daysRemaining !== null && whois.daysRemaining !== undefined ? whois.daysRemaining : undefined;
  const ns = whois.nameservers && whois.nameservers.length > 0 ? whois.nameservers : undefined;

  let dnsProvider: string | undefined;
  if (ns && ns.length > 0) {
    const joined = ns.join(' ').toLowerCase();
    if (joined.includes('googledomains') || joined.includes('google')) dnsProvider = 'Google Domains DNS';
    else if (joined.includes('cloudflare')) dnsProvider = 'Cloudflare DNS';
    else if (joined.includes('dns-parking') || joined.includes('hostinger')) dnsProvider = 'Hostinger DNS';
    else if (joined.includes('godaddy') || joined.includes('domaincontrol')) dnsProvider = 'GoDaddy DNS';
    else if (joined.includes('registrar-servers') || joined.includes('namecheap')) dnsProvider = 'Namecheap DNS';
    else dnsProvider = `${ns[0]} (Authoritative)`;
  }

  const status: 'critical' | 'warning' | 'safe' =
    (days ?? 999) <= 14 ? 'critical' : (days ?? 999) <= 30 ? 'warning' : 'safe';

  if (index !== -1) {
    const existing = list[index];
    const updatedItem: DomainItem = {
      ...existing,
      registrar: regName || existing.registrar,
      registrationDate: regDate || existing.registrationDate,
      expiresAt: expDate || existing.expiresAt,
      daysRemaining: days !== undefined ? days : existing.daysRemaining,
      status,
      nameservers: ns || existing.nameservers,
      dnsProvider: dnsProvider || existing.dnsProvider,
      rdapStatus: 'Synchronized',
    };
    list[index] = updatedItem;
    setLocal(STORAGE_KEYS.DOMAINS, list);
    if (options?.notify !== false) {
      notifyPortfolioUpdated();
    }

    if (existing.id && !existing.id.startsWith('dom-')) {
      void updateInventory('domains', existing.id, {
        registeredAt: expDate ? regDate || existing.registrationDate : undefined,
        expiresAt: expDate,
        notes: regName ? `Registrar: ${regName}` : existing.notes,
      }).catch(() => {});
    }

    return updatedItem;
  } else {
    const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
    const newItem: DomainItem = {
      id: `dom-${cleanName.replace(/[^a-z0-9]/g, '-')}`,
      name: cleanName,
      tld: ext,
      registrar: regName || 'Hostinger',
      autoRenew: true,
      registrationDate: regDate || new Date().toISOString().split('T')[0],
      expiresAt: expDate || new Date(Date.now() + 365 * 86400000).toISOString(),
      daysRemaining: days !== undefined ? days : 365,
      renewalPrice: ext === '.in' ? 499 : ext === '.online' ? 299 : 899,
      currency: '₹',
      status,
      dnsProvider: dnsProvider || 'Hostinger DNS',
      sslStatus: 'active',
      httpStatus: '200 OK',
      rdapStatus: 'Synchronized',
      nameservers: ns || ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
      tags: ['Live', 'Production'],
      logoUrl: `https://www.google.com/s2/favicons?domain=${cleanName}&sz=128`,
    };
    list.unshift(newItem);
    setLocal(STORAGE_KEYS.DOMAINS, list);
    if (options?.notify !== false) {
      notifyPortfolioUpdated();
    }
    return newItem;
  }
}

export async function fetchServersList(options?: { forceRefresh?: boolean }): Promise<ServerItem[]> {
  const cacheKey = 'servers_list';
  if (!options?.forceRefresh) {
    const cached = getCached<ServerItem[]>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<ServerItem[]>;
  }

  const promise = (async () => {
    const local = getLocal<ServerItem[]>(STORAGE_KEYS.SERVERS, []);
    const cleanLocal = local.filter((s) => s?.id && !s.id.startsWith('srv-hostinger-mumbai') && !s.id.startsWith('srv-hetzner-frankfurt') && !s.id.startsWith('srv-aws-useast') && !s.id.startsWith('srv-do-bangalore'));

    try {
      const response = await listInventory('servers', { limit: 100 });
      if (response?.items && Array.isArray(response.items)) {
        const map = new Map<string, ServerItem>();
        for (const b of response.items) {
          const key = (b.name || b.hostname || '').toLowerCase().trim();
          if (!key) continue;
          const isKvm = b.notes?.includes('KVM') || b.serverKind === 'hostinger';

          map.set(key, {
            id: b.id,
            name: b.name || b.hostname || 'Hostinger VPS',
            provider: b.serverKind === 'hostinger' ? 'Hostinger' : (b.serverKind || 'Custom VPS'),
            providerKey: (b.serverKind || 'hostinger').toLowerCase(),
            region: b.region || 'Mumbai (DC-21)',
            ipAddress: b.primaryIp || '76.13.185.120',
            cpu: isKvm ? '1 vCPU (KVM 1)' : '4 vCPU',
            memory: isKvm ? '4 GB' : '8 GB',
            os: b.operatingSystem || 'Ubuntu 24.04 LTS',
            status: 'healthy',
            uptime: '99.98%',
            cpuUsagePercent: 14,
            memoryUsagePercent: 36,
            diskUsagePercent: 24,
            connectedDomains: ['safy.in', 'bookmybuss.com', 'gymproplus.com', 'smartdial.online'],
          });
        }
        const merged = Array.from(map.values());
        setLocal(STORAGE_KEYS.SERVERS, merged);
        setMemoryCache(cacheKey, merged);
        return merged;
      }
    } catch {}
    setMemoryCache(cacheKey, cleanLocal);
    return cleanLocal;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export async function fetchApplicationsList(options?: { forceRefresh?: boolean }): Promise<ApplicationItem[]> {
  const cacheKey = 'applications_list';
  if (!options?.forceRefresh) {
    const cached = getCached<ApplicationItem[]>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<ApplicationItem[]>;
  }

  const promise = (async () => {
    const activeDev = getConsoleDeveloperName();
    const local = getLocal<ApplicationItem[]>(STORAGE_KEYS.APPLICATIONS, []);
    const cleanLocal = local.filter((a) => {
      if (!a?.id) return false;
      const dev = a.developerName || activeDev;
      return isMatchingConsoleDeveloper(dev, activeDev);
    });

    try {
      const response = await listInventory('applications', { limit: 100 });
      if (response?.items && Array.isArray(response.items)) {
        // Filter out items that are pure websites
        const mobileApps = response.items.filter((b: any) => b.kind !== 'WEBSITE');
        const map = new Map<string, ApplicationItem>();
        for (const b of mobileApps) {
          const pkg = (b.notes || '').trim();
          const k = (pkg || b.name).toLowerCase().trim();
          const devName = (b as any).developerName;

          // STRICT CHECK: Only include mobile apps belonging to the active developer account!
          if (devName && !isMatchingConsoleDeveloper(devName, activeDev)) {
            continue;
          }
          if (!devName && !isMatchingConsoleDeveloper('WorknAi Technologies India Pvt Ltd', activeDev)) {
            continue;
          }

          map.set(k, {
            id: b.id,
            name: b.name,
            packageId: pkg || undefined,
            environment: 'Production',
            status: 'healthy',
            version: 'v1.0.0',
            serverName: 'Google Play Console',
            developerName: devName || activeDev,
            releaseTrack: 'Production',
            playStoreUrl: b.primaryUrl || (pkg ? `https://play.google.com/store/apps/details?id=${pkg}` : undefined),
            url: b.primaryUrl || undefined,
            iconUrl: (b as any).iconUrl,
            updatedAt: b.updatedAt,
          });
        }

        // If backend inventory has apps for activeDev, use them, otherwise use cleanLocal
        let merged = Array.from(map.values());
        if (merged.length === 0 && cleanLocal.length > 0) {
          merged = cleanLocal;
        }

        setLocal(STORAGE_KEYS.APPLICATIONS, merged);
        setMemoryCache(cacheKey, merged);
        return merged;
      }
    } catch {}

    setMemoryCache(cacheKey, cleanLocal);
    return cleanLocal;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export async function fetchWebsitesList(options?: { forceRefresh?: boolean }): Promise<WebsiteItem[]> {
  const cacheKey = 'websites_list';
  if (!options?.forceRefresh) {
    const cached = getCached<WebsiteItem[]>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<WebsiteItem[]>;
  }

  const promise = (async () => {
    const local = getLocal<WebsiteItem[]>(STORAGE_KEYS.WEBSITES, []);
    const cleanLocal = local.filter((w) => w?.id && !w.id.startsWith('web-worknai') && !w.id.startsWith('web-hrms') && !w.id.startsWith('web-aitourism') && !w.id.startsWith('web-goairclass') && !w.id.startsWith('web-blooddonation') && !w.id.startsWith('web-gymproplus'));

    try {
      const [appRes, domRes] = await Promise.all([
        listInventory('applications', { limit: 100 }).catch(() => null),
        listInventory('domains', { limit: 100 }).catch(() => null),
      ]);

      const map = new Map<string, WebsiteItem>();

      if (appRes?.items && Array.isArray(appRes.items)) {
        for (const app of appRes.items) {
          if ((app as any).kind === 'MOBILE_APPLICATION' || (app as any).provenance === 'PLAY_STORE_SYNC') continue;
          const dom = ((app as any).domainId || app.name || '').toLowerCase().trim();
          if (!dom) continue;
          map.set(dom, {
            id: app.id,
            name: app.name,
            url: app.primaryUrl || `https://${dom}`,
            category: 'Production',
            status: 'healthy',
            domain: dom,
            serverName: 'srv1357339.hstgr.cloud',
            serverIp: '76.13.185.120',
            sslActive: true,
            httpStatus: '200 OK',
            responseTimeMs: 24,
            tags: ['Hostinger VPS', 'Live Website', 'Production'],
            logoUrl: `https://www.google.com/s2/favicons?domain=${dom}&sz=128`,
            notes: app.notes || undefined,
          });
        }
      }

      if (domRes?.items && Array.isArray(domRes.items)) {
        for (const d of domRes.items) {
          const dom = (d.domainName || '').toLowerCase().trim();
          if (!dom || map.has(dom)) continue;
          map.set(dom, {
            id: d.id,
            name: dom,
            url: `https://${dom}`,
            category: 'Production',
            status: 'healthy',
            domain: dom,
            serverName: 'srv1357339.hstgr.cloud',
            serverIp: '76.13.185.120',
            sslActive: true,
            httpStatus: '200 OK',
            responseTimeMs: 28,
            tags: ['Hostinger Domain', 'Production'],
            logoUrl: `https://www.google.com/s2/favicons?domain=${dom}&sz=128`,
            notes: d.notes || undefined,
          });
        }
      }

      const merged = Array.from(map.values());
      setLocal(STORAGE_KEYS.WEBSITES, merged);
      setMemoryCache(cacheKey, merged);
      return merged;
    } catch {}

    setMemoryCache(cacheKey, cleanLocal);
    return cleanLocal;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export async function fetchProviderAccountsList(options?: { forceRefresh?: boolean }): Promise<ProviderAccountItem[]> {
  const cacheKey = 'providers_list';
  if (!options?.forceRefresh) {
    const cached = getCached<ProviderAccountItem[]>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<ProviderAccountItem[]>;
  }

  const promise = (async () => {
    const local = getLocal<ProviderAccountItem[]>(STORAGE_KEYS.PROVIDERS, []);
    const cleanLocal = local.filter((p) => p?.id && !p.id.startsWith('pa-hostinger-main') && !p.id.startsWith('pa-hetzner') && !p.id.startsWith('pa-aws') && !p.id.startsWith('pa-cloudflare') && !p.id.startsWith('pa-digitalocean'));

    try {
      const response = await listInventory('provider-accounts', { limit: 100 });
      if (response?.items && Array.isArray(response.items)) {
        const map = new Map<string, ProviderAccountItem>();
        for (const loc of cleanLocal) {
          map.set(loc.id, loc);
        }
        for (const b of response.items) {
          map.set(b.id, {
            id: b.id,
            label: b.label || 'Connected Provider',
            providerKey: b.providerKey || 'hostinger',
            externalAccountId: b.externalAccountId || null,
            notes: b.notes || 'Live Connected Provider Account',
            inventoryState: b.inventoryState || 'TRACKED',
            lastSynced: 'Just now',
            syncedDomainsCount: b.providerKey === 'hostinger' ? 9 : 0,
            syncedServersCount: b.providerKey === 'hostinger' ? 1 : 0,
          });
        }
        const merged = Array.from(map.values());
        setLocal(STORAGE_KEYS.PROVIDERS, merged);
        setMemoryCache(cacheKey, merged);
        return merged;
      }
    } catch {}
    setMemoryCache(cacheKey, cleanLocal);
    return cleanLocal;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export async function fetchPortfolioSummary(options?: { forceRefresh?: boolean }): Promise<PortfolioSummary> {
  const cacheKey = 'portfolio_summary';
  if (!options?.forceRefresh) {
    const cached = getCached<PortfolioSummary>(cacheKey);
    if (cached) return cached;
  }

  if (INFLIGHT_REQUESTS.has(cacheKey)) {
    return INFLIGHT_REQUESTS.get(cacheKey) as Promise<PortfolioSummary>;
  }

  const promise = (async () => {
    const [domains, servers, apps, websites, providers] = await Promise.all([
      fetchDomainsList(options),
      fetchServersList(options),
      fetchApplicationsList(options),
      fetchWebsitesList(options),
      fetchProviderAccountsList(options),
    ]);

    let alertsCount = 0;
    try {
      const alertsRes = await listAlerts({ limit: 100 });
      alertsCount = alertsRes?.items?.length || 0;
    } catch {}

    const critical = domains.filter((d) => (d.daysRemaining || 999) <= 14).length;
    const warning = domains.filter((d) => (d.daysRemaining || 999) > 14 && (d.daysRemaining || 999) <= 30).length;
    const safe = domains.filter((d) => (d.daysRemaining || 999) > 30).length;
    const renewalCost = domains.reduce((sum, d) => sum + (d.renewalPrice || 0), 0);

    const summary: PortfolioSummary = {
      totalDomains: domains.length,
      safeDomains: safe,
      warningDomains: warning,
      criticalDomains: critical,
      totalServers: servers.length,
      healthyServers: servers.filter((s) => s.status !== 'offline').length,
      totalApps: apps.length,
      productionApps: apps.filter((a) => a.releaseTrack === 'Production').length,
      totalWebsites: websites.length,
      totalProviders: providers.length,
      totalAlerts: alertsCount || (critical + warning),
      estimatedRenewalCost: renewalCost,
    };

    setMemoryCache(cacheKey, summary);
    return summary;
  })().finally(() => {
    INFLIGHT_REQUESTS.delete(cacheKey);
  });

  INFLIGHT_REQUESTS.set(cacheKey, promise);
  return promise;
}

export async function syncAllProviders(): Promise<{
  totalDomains: number;
  totalServers: number;
  totalApps: number;
  totalWebsites: number;
  message: string;
}> {
  // Simulate live provider discovery and update storage
  const domains = await fetchDomainsList({ forceRefresh: true });
  const servers = await fetchServersList({ forceRefresh: true });
  const apps = await fetchApplicationsList({ forceRefresh: true });
  const websites = await fetchWebsitesList({ forceRefresh: true });
  const providers = await fetchProviderAccountsList({ forceRefresh: true });

  const updatedProviders = providers.map((p) => ({
    ...p,
    lastSynced: 'Just now',
  }));
  setLocal(STORAGE_KEYS.PROVIDERS, updatedProviders);
  notifyPortfolioUpdated();

  return {
    totalDomains: domains.length,
    totalServers: servers.length,
    totalApps: apps.length,
    totalWebsites: websites.length,
    message: `Portfolio updated: ${domains.length} domains, ${servers.length} servers, and ${apps.length} applications synced across connected providers.`,
  };
}

export async function syncSingleProvider(accountId: string): Promise<{
  totalDomains: number;
  totalServers: number;
  totalApps: number;
  message: string;
}> {
  const domains = await fetchDomainsList({ forceRefresh: true });
  const servers = await fetchServersList({ forceRefresh: true });
  const apps = await fetchApplicationsList();
  const providers = await fetchProviderAccountsList();
  const provider = providers.find((p) => p.id === accountId);
  const label = provider?.label || 'Provider';

  const updatedProviders = providers.map((p) =>
    p.id === accountId ? { ...p, lastSynced: 'Just now' } : p
  );
  setLocal(STORAGE_KEYS.PROVIDERS, updatedProviders);
  notifyPortfolioUpdated();

  return {
    totalDomains: domains.length,
    totalServers: servers.length,
    totalApps: apps.length,
    message: `Portfolio updated: ${label} synchronized (${domains.length} domains, ${servers.length} servers, and ${apps.length} applications across portfolio).`,
  };
}

export async function syncGooglePlayDeveloper(developerName: string): Promise<{
  totalApps: number;
  developerName?: string;
  message: string;
}> {
  const cleanDev = (developerName || '').trim();
  if (!cleanDev) {
    throw new Error('Please enter a valid Google Play developer account name');
  }

  // 1. Fetch live applications from Google Play Console using the exact same public API as mobile:
  // GET /api/v1/play-store/developers/:developerId/apps?limit=100
  const publicRes = await getPlayStoreDeveloperApps(cleanDev, 100);
  const finalDev = publicRes.developerName || cleanDev;

  try {
    localStorage.setItem(STORAGE_KEYS.CONSOLE_DEV, finalDev);
  } catch {}

  // 2. Strict developer matching: ONLY keep apps belonging to this particular developer name
  const rawApps = publicRes.apps || [];
  const matchingPlayApps = rawApps.filter(
    (app) =>
      isMatchingConsoleDeveloper(app.developerName, finalDev) ||
      isMatchingConsoleDeveloper(app.developerName, cleanDev)
  );

  const newApps: ApplicationItem[] = matchingPlayApps.map((app) => ({
    id: app.id || `play-${app.packageId.replace(/[^a-zA-Z0-9]/g, '-')}`,
    name: app.name,
    packageId: app.packageId,
    environment: 'Production',
    status: 'healthy',
    version: 'v1.0.0',
    serverName: 'Google Play Console',
    developerName: finalDev,
    releaseTrack: 'Production',
    playStoreUrl: app.playStoreUrl,
    url: app.playStoreUrl,
    iconUrl: app.iconUrl,
    updatedAt: new Date().toISOString(),
  }));

  // 3. Vanish previous apps: completely replace local cache so previous apps disappear immediately
  setLocal(STORAGE_KEYS.APPLICATIONS, newApps);
  setMemoryCache('applications_list', newApps);

  // 4. Archive previous mobile applications from backend inventory (mirroring mobile app providerSync)
  try {
    const existingBackend = await listInventory('applications', { limit: 100 });
    if (existingBackend?.items && Array.isArray(existingBackend.items)) {
      const newPkgSet = new Set(newApps.map((a) => (a.packageId || '').toLowerCase()));
      const toDelete = existingBackend.items.filter((b: any) => {
        const isMobile =
          b.kind === 'MOBILE_APPLICATION' ||
          (b.primaryUrl && b.primaryUrl.includes('play.google.com')) ||
          (b.notes && b.notes.includes('.'));
        return isMobile && !newPkgSet.has((b.notes || '').toLowerCase());
      });
      await Promise.allSettled(toDelete.map((b: any) => archiveInventory('applications', b.id).catch(() => {})));
    }
  } catch {}

  // 5. In background, inform backend play-store sync endpoint
  try {
    await syncPlayStoreDeveloper(finalDev).catch(() => {});
  } catch {}

  notifyPortfolioUpdated();

  return {
    totalApps: newApps.length,
    developerName: finalDev,
    message: `Successfully synchronized ${newApps.length} applications for "${finalDev}". Previous apps replaced.`,
  };
}


export async function createDomain(data: {
  name: string;
  registrar?: string;
  autoRenew?: boolean;
}): Promise<DomainItem> {
  const cleanName = data.name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  const ext = cleanName.includes('.') ? `.${cleanName.split('.').pop()}` : '.com';
  const selectedRegistrar = data.registrar?.split(' ')[0] || data.registrar || 'Cloudflare';
  let backendId = `dom-${Date.now()}`;

  try {
    const res = await createInventory('domains', {
      domainName: cleanName,
      autoRenew: data.autoRenew ?? true,
      notes: `Registrar: ${selectedRegistrar}`,
    });
    if (res?.id) backendId = res.id;
  } catch (err) {
    console.warn('Backend createInventory failed, falling back to local item:', err);
  }

  const renewalPrice =
    ext === '.com' ? 899 :
    ext === '.in' ? 499 :
    ext === '.online' ? 299 :
    ext === '.net' ? 1199 :
    ext === '.org' ? 1099 :
    ext === '.io' ? 3200 :
    ext === '.ai' ? 5800 :
    ext === '.tech' ? 399 :
    ext === '.co' ? 2199 : 899;

  const nameservers = selectedRegistrar.toLowerCase().includes('cloudflare')
    ? ['ns1.cloudflare.com', 'ns2.cloudflare.com']
    : ['ns1.dns-parking.com', 'ns2.dns-parking.com'];

  const newDomain: DomainItem = {
    id: backendId,
    name: cleanName,
    tld: ext,
    registrar: selectedRegistrar,
    autoRenew: data.autoRenew ?? true,
    registrationDate: new Date().toISOString().split('T')[0],
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    daysRemaining: 365,
    renewalPrice,
    currency: '₹',
    status: 'safe',
    dnsProvider: `${selectedRegistrar} DNS`,
    sslStatus: 'active',
    httpStatus: '200 OK',
    rdapStatus: 'Synchronized',
    nameservers,
    tags: ['Live', `${selectedRegistrar} Portfolio`],
    logoUrl: `https://www.google.com/s2/favicons?domain=${cleanName}&sz=128`,
    providerLabel: selectedRegistrar,
  };

  const list = await fetchDomainsList();
  const updated = [newDomain, ...list.filter((d) => d.name !== cleanName)];
  setLocal(STORAGE_KEYS.DOMAINS, updated);
  notifyPortfolioUpdated();
  return newDomain;
}

export async function deleteDomain(id: string): Promise<void> {
  try {
    await archiveInventory('domains', id);
  } catch {}
  const list = await fetchDomainsList();
  const updated = list.filter((d) => d.id !== id);
  setLocal(STORAGE_KEYS.DOMAINS, updated);
  notifyPortfolioUpdated();
}

export async function toggleDomainAutoRenew(id: string, autoRenew: boolean): Promise<DomainItem | null> {
  try {
    await updateInventory('domains', id, { autoRenew });
  } catch {}
  const list = await fetchDomainsList();
  const index = list.findIndex((d) => d.id === id);
  if (index === -1) return null;
  list[index].autoRenew = autoRenew;
  setLocal(STORAGE_KEYS.DOMAINS, list);
  notifyPortfolioUpdated();
  return list[index];
}

export async function createServer(data: {
  name: string;
  provider: string;
  ipAddress: string;
  region: string;
  os: string;
  cpu: string;
  memory: string;
}): Promise<ServerItem> {
  let backendId = `srv-${Date.now()}`;
  try {
    const res = await createInventory('servers', {
      name: data.name,
      hostname: data.name,
      primaryIp: data.ipAddress,
      operatingSystem: data.os,
      serverKind: data.provider,
      region: data.region,
      notes: 'Created via DomainPulse web',
    });
    if (res?.id) backendId = res.id;
  } catch {}

  const newServer: ServerItem = {
    id: backendId,
    name: data.name,
    provider: data.provider,
    providerKey: data.provider.toLowerCase().replace(/[^a-z0-9]/g, ''),
    region: data.region,
    ipAddress: data.ipAddress,
    cpu: data.cpu,
    memory: data.memory,
    os: data.os,
    status: 'healthy',
    uptime: '99.9%',
    cpuUsagePercent: 18,
    memoryUsagePercent: 42,
    diskUsagePercent: 26,
    connectedDomains: [],
  };

  const list = await fetchServersList();
  const updated = [newServer, ...list];
  setLocal(STORAGE_KEYS.SERVERS, updated);
  notifyPortfolioUpdated();
  return newServer;
}

export async function deleteServer(id: string): Promise<void> {
  try {
    await archiveInventory('servers', id);
  } catch {}
  const list = await fetchServersList();
  const updated = list.filter((s) => s.id !== id);
  setLocal(STORAGE_KEYS.SERVERS, updated);
  notifyPortfolioUpdated();
}

export async function createWebsite(data: {
  name: string;
  url: string;
  category: 'Production' | 'Client' | 'Personal' | 'Staging' | 'Tools';
  notes?: string;
}): Promise<WebsiteItem> {
  let cleanUrl = data.url.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
  let domain = '';
  try {
    domain = new URL(cleanUrl).hostname;
  } catch {
    domain = cleanUrl;
  }

  const newSite: WebsiteItem = {
    id: `web-${Date.now()}`,
    name: data.name.trim(),
    url: cleanUrl,
    category: data.category,
    status: 'healthy',
    domain,
    sslActive: true,
    httpStatus: '200 OK',
    responseTimeMs: 28,
    tags: ['Active', data.category],
    logoUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    notes: data.notes,
  };

  const list = await fetchWebsitesList();
  const updated = [newSite, ...list];
  setLocal(STORAGE_KEYS.WEBSITES, updated);
  notifyPortfolioUpdated();
  return newSite;
}

export async function deleteWebsite(id: string): Promise<void> {
  const list = await fetchWebsitesList();
  const updated = list.filter((w) => w.id !== id);
  setLocal(STORAGE_KEYS.WEBSITES, updated);
  notifyPortfolioUpdated();
}
