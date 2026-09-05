import { WebsiteDetailData } from './websiteDetails.types';

export const WORKNAI_WEBSITE_DETAIL: WebsiteDetailData = {
  id: 'worknai-website',
  internalRecordId: 'WNK-0418',
  name: 'WorknAi Website',
  environment: 'Production',
  project: 'WorknAi',
  primaryDomain: 'worknai.com',
  primaryUrl: 'https://worknai.com',
  domainRole: 'Apex Root',
  altHostnames: ['www.worknai.com'],
  altHostnamesRole: 'Canonical alias',
  techStack: 'Next.js 14 / TS',
  techStackSummary: 'Next.js 14 • Node.js • Port 3000',
  port: 3000,
  reverseProxy: 'Nginx',
  sourceRepoUrl: 'https://github.com/worknai/worknai-portal',
  sourceRepoName: 'worknai-portal',

  relationshipNodes: [
    {
      type: 'account',
      title: 'Registration Account',
      value: 'domains@worknai.com',
      badge: 'User Mapped',
      icon: 'shield_person',
      link: '/accounts/godaddy-main',
    },
    {
      type: 'registrar',
      title: 'Registrar',
      value: 'GoDaddy',
      badge: 'Configured Provider',
      icon: 'domain_verification',
      link: '/accounts/godaddy-main',
    },
    {
      type: 'domain',
      title: 'Apex Domain',
      value: 'worknai.com',
      badge: 'Cloudflare Proxied',
      icon: 'language',
      link: '/domains/worknai.com',
    },
    {
      type: 'app',
      title: 'Web Application',
      value: 'WorknAi Website',
      badge: ':3000 Next.js 14',
      icon: 'web',
      isActive: true,
    },
    {
      type: 'server',
      title: 'Compute Node',
      value: 'Production VPS 01',
      badge: '103.21.58.112',
      icon: 'dns',
      link: '/servers/prod-01',
    },
  ],

  dns: {
    provider: 'Cloudflare',
    status: 'Auto-Renew: User Mapped On',
    registrar: 'GoDaddy',
    registrationEmail: 'domains@worknai.com',
    nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
    records: [
      {
        type: 'A',
        name: '@',
        target: '103.21.58.112',
        badge: 'Proxied',
        badgeType: 'proxied',
      },
      {
        type: 'CNAME',
        name: 'www',
        target: 'worknai.com',
        badge: 'Auto TTL',
        badgeType: 'ttl',
      },
    ],
    provenance: 'DNS Retrieved',
  },

  hosting: {
    serverName: 'Production VPS 01',
    serverId: 'prod-01',
    provider: 'Hostinger',
    providerAccount: 'WorknAi Hostinger Main',
    accountEmail: 'infra@worknai.com',
    os: 'Ubuntu 24.04 LTS',
    datacenter: 'Singapore DC-02',
    locationTag: 'Singapore Node',
    ipAddress: '103.21.58.112',
    costAllocation: {
      amountMonthly: 300,
      currency: '₹',
      percentage: 20,
      totalServerCost: 1499,
    },
    nextRenewalDate: '18 Oct 2026',
    monitoringStatus: 'Not Connected',
  },

  ssl: {
    status: 'healthy',
    statusLabel: 'Recorded • Valid',
    daysRemaining: 68,
    issuer: "Let's Encrypt",
    commonName: 'worknai.com',
    expirationDate: '12 Nov 2026',
    san: ['*.worknai.com', 'worknai.com'],
    provenance: 'SSL Retrieved',
    signatureAlgorithm: 'SHA-256 with RSA',
    keySize: '2048-bit',
  },

  deployment: {
    method: 'Manual / Git Pull',
    methodProvenance: 'User Added',
    notes:
      'Application codebase deployed onto production node via Git repository pull to Port 3000 under PM2 process orchestration.',
    internalTarget: '127.0.0.1:3000',
    reverseProxyConfigPath: 'Nginx /etc/nginx/sites-enabled',
    processRunner: 'PM2',
    lastUpdated: 'User Record',
  },

  environmentConfig: {
    variableCount: 14,
    variableCountLabel: '14 Configured (User Managed)',
    secretStorage: 'External / User Managed',
    configFilePath: '.env.production',
    disclosureNote: 'Secret values and credentials are never displayed in DomainPulse.',
  },
};

const ADDITIONAL_WEBSITE_DETAILS: Record<string, Partial<WebsiteDetailData>> = {
  'web-1': WORKNAI_WEBSITE_DETAIL,
  'worknai.com': WORKNAI_WEBSITE_DETAIL,
  'web-2': {
    id: 'web-2',
    internalRecordId: 'WNK-0419',
    name: 'WorknAi API',
    environment: 'Production',
    project: 'WorknAi',
    primaryDomain: 'api.worknai.com',
    primaryUrl: 'https://api.worknai.com',
    domainRole: 'Subdomain Gateway',
    altHostnames: ['api-v1.worknai.com'],
    altHostnamesRole: 'Versioned alias',
    techStack: 'Node.js / Express',
    techStackSummary: 'Node.js • Express • Port 8080',
    port: 8080,
    reverseProxy: 'Nginx',
    sourceRepoUrl: 'https://github.com/worknai/worknai-api',
    sourceRepoName: 'worknai-api',
    deployment: {
      method: 'Docker Compose / Git Pull',
      methodProvenance: 'User Added',
      notes: 'REST gateway deployed under Docker Compose routing upstream to Port 8080.',
      internalTarget: '127.0.0.1:8080',
      reverseProxyConfigPath: 'Nginx /etc/nginx/sites-enabled/api.conf',
      processRunner: 'Docker Compose',
      lastUpdated: 'User Record',
    },
  },
  'web-3': {
    id: 'web-3',
    internalRecordId: 'AIB-0102',
    name: 'AI BOS Admin',
    environment: 'Production',
    project: 'AI BOS',
    primaryDomain: 'admin.worknai.com',
    primaryUrl: 'https://admin.worknai.com',
    domainRole: 'Admin Subdomain',
    altHostnames: ['admin-direct.worknai.com'],
    altHostnamesRole: 'Direct fallback',
    techStack: 'React / Vite',
    techStackSummary: 'React • Caddy • Port 4000',
    port: 4000,
    reverseProxy: 'Caddy',
    sourceRepoUrl: 'https://github.com/worknai/aibos-admin',
    sourceRepoName: 'aibos-admin',
    hosting: {
      serverName: 'AI BOS Server',
      serverId: 'aibos',
      provider: 'DigitalOcean',
      providerAccount: 'WorknAi DigitalOcean Primary',
      accountEmail: 'servers@worknai.com',
      os: 'Debian 12 Bookworm',
      datacenter: 'Bangalore BLR-01',
      locationTag: 'India Node',
      ipAddress: '159.89.162.40',
      costAllocation: {
        amountMonthly: 450,
        currency: '₹',
        percentage: 30,
        totalServerCost: 1500,
      },
      nextRenewalDate: '22 Oct 2026',
      monitoringStatus: 'Not Connected',
    },
  },
};

export function getWebsiteDetail(websiteId?: string): WebsiteDetailData {
  if (!websiteId) return WORKNAI_WEBSITE_DETAIL;
  const match = ADDITIONAL_WEBSITE_DETAILS[websiteId];
  if (match) {
    return {
      ...WORKNAI_WEBSITE_DETAIL,
      ...match,
      id: websiteId,
    };
  }
  return {
    ...WORKNAI_WEBSITE_DETAIL,
    id: websiteId,
    name: websiteId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}
