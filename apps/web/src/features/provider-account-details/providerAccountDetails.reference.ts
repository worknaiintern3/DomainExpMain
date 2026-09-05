import { ProviderAccountDetail } from './providerAccountDetails.types';

export const HOSTINGER_MAIN_REFERENCE_DETAIL: ProviderAccountDetail = {
  id: 'hostinger-main',
  accountId: 'HST-941029',
  accountName: 'WorknAi Hostinger Main',
  providerCompany: 'Hostinger',
  providerBadgeText: 'HOSTINGER CLOUD',
  accountEmail: 'infra@worknai.com',
  accountType: 'Hosting / VPS & Cloud Compute',
  accountScope: 'Infrastructure Portfolio',
  mappingStatus: 'mapped',
  mappingStatusLabel: 'Mapped • User Record',

  relationshipNodes: [
    {
      label: 'Registered Email',
      value: 'infra@worknai.com',
      icon: 'alternate_email',
      iconColor: 'text-primary',
    },
    {
      label: 'Provider',
      value: 'Hostinger',
      icon: 'cloud_circle',
      iconColor: 'text-[#673de6]',
    },
    {
      label: 'Provider Account',
      value: 'WorknAi Hostinger Main',
      icon: 'domain_verification',
      iconColor: 'text-primary',
      isActive: true,
    },
    {
      label: 'Compute Nodes',
      value: '3 Mapped Servers',
      icon: 'terminal',
      iconColor: 'text-secondary',
    },
    {
      label: 'Deployed Apps',
      value: '9 Mapped Apps',
      icon: 'language',
      iconColor: 'text-secondary',
    },
    {
      label: 'Mapped Domains',
      value: '2 Mapped Domains',
      icon: 'link',
      iconColor: 'text-emerald-600',
    },
  ],

  kpis: {
    ownedServersCount: 3,
    ownedServersSubtext: '3 mapped servers',
    hostedWebsitesCount: 9,
    hostedWebsitesSubtext: '9 mapped apps',
    linkedDomainsCount: 2,
    linkedDomainsSubtext: '2 mapped domains',
    estimatedMonthlyCostFormatted: '₹4,250',
    estimatedMonthlyCostSubtext: '/ mo • Stored estimate',
    estimatedAnnualCostFormatted: '₹51,000',
    estimatedAnnualCostSubtext: '/ yr • Stored estimate',
    nextRenewalFormatted: '18 Oct 2026',
    nextRenewalSubtext: 'Stored renewal date • User Mapped On',
  },

  ownedServers: [
    {
      id: 'prod-01',
      name: 'Production VPS 01',
      hostname: 'prod-vps-01',
      osPlatform: 'Ubuntu 22.04 LTS (Litespeed)',
      ipAddress: '103.21.58.112',
      hardwareSizing: '4 vCPU / 8 GB',
      vcpuCount: 4,
      ramGb: 8,
      storageSpecs: '160 GB NVMe',
      websitesCount: 5,
      monthlyCost: 1499,
      monthlyCostFormatted: '₹1,499',
      renewalDate: '18 Oct 2026',
      statusLabel: 'Mapped Record',
    },
    {
      id: 'staging',
      name: 'AnyWork Staging Node',
      hostname: 'anywork-stg-01',
      osPlatform: 'Debian 12 (CyberPanel)',
      ipAddress: '103.21.59.84',
      hardwareSizing: '2 vCPU / 4 GB',
      vcpuCount: 2,
      ramGb: 4,
      storageSpecs: '100 GB NVMe',
      websitesCount: 3,
      monthlyCost: 899,
      monthlyCostFormatted: '₹899',
      renewalDate: '12 Feb 2027',
      statusLabel: 'Mapped Record',
    },
    {
      id: 'dev-03',
      name: 'Dev Cluster Node 03',
      hostname: 'dev-cluster-node-03',
      osPlatform: 'Ubuntu 24.04 (Docker Swarm)',
      ipAddress: '103.21.60.19',
      hardwareSizing: '4 vCPU / 8 GB',
      vcpuCount: 4,
      ramGb: 8,
      storageSpecs: '160 GB NVMe',
      websitesCount: 1,
      monthlyCost: 1852,
      monthlyCostFormatted: '₹1,852',
      renewalDate: '29 Nov 2026',
      statusLabel: 'Mapped Record',
    },
  ],

  linkedDomains: [
    {
      id: 'd1',
      domain: 'worknai.com',
      domainType: 'Apex Root',
      dnsRoutingTarget: 'Production VPS 01 (103.21.58.112)',
      targetIp: '103.21.58.112',
      nameserver: 'ns1.dns-parking.com',
      nameserverBadge: 'DNS Retrieved',
      sslProfile: "Let's Encrypt Wildcard",
      sslBadge: 'SSL Retrieved',
      projectName: 'WorknAi',
      projectId: 'worknai',
    },
    {
      id: 'd2',
      domain: 'anywork.in',
      domainType: 'Sub-brand',
      dnsRoutingTarget: 'AnyWork Staging Node (103.21.59.84)',
      targetIp: '103.21.59.84',
      nameserver: 'ns2.dns-parking.com',
      nameserverBadge: 'DNS Retrieved',
      sslProfile: 'Hostinger Cloudflare Caching',
      sslBadge: 'DNS Retrieved',
      projectName: 'AnyWork',
      projectId: 'anywork',
    },
  ],

  associatedProjects: [
    {
      id: 'proj-worknai',
      name: 'WorknAi Enterprise',
      linkedAssetsCount: 5,
      description: 'Core customer dashboard, API gateway, enterprise tenant auth, webhooks daemon, and landing portal.',
      mappedServers: ['Production VPS 01', 'Dev Node 03'],
    },
    {
      id: 'proj-anywork',
      name: 'AnyWork Platform',
      linkedAssetsCount: 4,
      description: 'Freelancer gig marketplace client apps, testing sandbox instances, QA database replicas.',
      mappedServers: ['AnyWork Staging'],
    },
  ],

  coverageText: 'All 3 servers, 9 apps, and 2 domains for this provider account are currently mapped.',

  billing: {
    billingContact: 'infra@worknai.com',
    billingContactBadge: 'Stored Record',
    currency: 'INR (₹)',
    autoRenewStatus: 'User Mapped On',
    billingCycle: 'Annual Contract with Monthly Run-rate',
    nextRenewalFormatted: '18 Oct 2026 (Stored Record)',
    taxEntityName: 'WorknAi Technologies Pvt Ltd',
    taxStatusBadge: 'Reference Record',
    gstinNumber: 'Reference GSTIN: 27AABCW1920R1ZG',
    recentInvoices: [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-HST-88421',
        amountFormatted: '₹4,250',
        statusText: 'Archived Reference Record',
        dateFormatted: '18 Oct 2025',
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-HST-83199',
        amountFormatted: '₹4,250',
        statusText: 'Archived Reference Record',
        dateFormatted: '18 Sep 2025',
      },
    ],
  },

  notes: 'Primary Hostinger account managing core production web fleet. Accessible by Authorized Infra Team members (infra@worknai.com). For server provisioning or DNS record modifications, refer to standard infrastructure SOPs.',
  lastRecordUpdateText: 'User Mapped',
  discoveredChangesText: '0 pending',
  mappingCoverageText: 'Mapped (2/2)',
};

export const GODADDY_MAIN_REFERENCE_DETAIL: ProviderAccountDetail = {
  id: 'godaddy-main',
  accountId: 'GD-89104',
  accountName: 'WorknAi GoDaddy Main',
  providerCompany: 'GoDaddy',
  providerBadgeText: 'GODADDY REGISTRAR',
  accountEmail: 'domains@worknai.com',
  accountType: 'Domain Registrar & DNS Zone Hub',
  accountScope: 'Domains Portfolio',
  mappingStatus: 'mapped',
  mappingStatusLabel: 'Mapped • User Record',

  relationshipNodes: [
    {
      label: 'Registered Email',
      value: 'domains@worknai.com',
      icon: 'alternate_email',
      iconColor: 'text-primary',
    },
    {
      label: 'Provider',
      value: 'GoDaddy',
      icon: 'cloud_circle',
      iconColor: 'text-[#008385]',
    },
    {
      label: 'Provider Account',
      value: 'WorknAi GoDaddy Main',
      icon: 'domain_verification',
      iconColor: 'text-primary',
      isActive: true,
    },
    {
      label: 'Compute Nodes',
      value: '0 Mapped Servers',
      icon: 'terminal',
      iconColor: 'text-secondary',
    },
    {
      label: 'Deployed Apps',
      value: '6 Mapped Apps',
      icon: 'language',
      iconColor: 'text-secondary',
    },
    {
      label: 'Mapped Domains',
      value: '8 Mapped Domains',
      icon: 'link',
      iconColor: 'text-emerald-600',
    },
  ],

  kpis: {
    ownedServersCount: 0,
    ownedServersSubtext: '0 mapped servers',
    hostedWebsitesCount: 6,
    hostedWebsitesSubtext: '6 mapped apps',
    linkedDomainsCount: 8,
    linkedDomainsSubtext: '8 mapped domains',
    estimatedMonthlyCostFormatted: '₹1,200',
    estimatedMonthlyCostSubtext: '/ mo • Stored estimate',
    estimatedAnnualCostFormatted: '₹14,400',
    estimatedAnnualCostSubtext: '/ yr • Stored estimate',
    nextRenewalFormatted: '15 Nov 2026',
    nextRenewalSubtext: 'Stored renewal date • User Mapped On',
  },

  ownedServers: [],

  linkedDomains: [
    {
      id: 'gd-d1',
      domain: 'worknai.com',
      domainType: 'Apex Root',
      dnsRoutingTarget: 'Hostinger Singapore (103.21.58.112)',
      targetIp: '103.21.58.112',
      nameserver: 'ns01.domaincontrol.com',
      nameserverBadge: 'DNS Retrieved',
      sslProfile: 'Managed SSL',
      sslBadge: 'SSL Retrieved',
      projectName: 'WorknAi',
      projectId: 'worknai',
    },
    {
      id: 'gd-d2',
      domain: 'worknai.ai',
      domainType: 'Apex Root',
      dnsRoutingTarget: 'Cloudflare Proxy Node',
      targetIp: '172.67.182.11',
      nameserver: 'ns02.domaincontrol.com',
      nameserverBadge: 'DNS Retrieved',
      sslProfile: 'Cloudflare Edge',
      sslBadge: 'SSL Retrieved',
      projectName: 'WorknAi',
      projectId: 'worknai',
    },
  ],

  associatedProjects: [
    {
      id: 'proj-worknai-gd',
      name: 'WorknAi Core Domains',
      linkedAssetsCount: 8,
      description: 'Primary corporate registrar account for core WorknAi properties and brand extensions.',
      mappedServers: ['DNS Delegated'],
    },
  ],

  coverageText: 'All 8 domains and 6 associated web records for this registrar account are currently mapped.',

  billing: {
    billingContact: 'domains@worknai.com',
    billingContactBadge: 'Stored Record',
    currency: 'INR (₹)',
    autoRenewStatus: 'User Mapped On',
    billingCycle: 'Annual Registration Batches',
    nextRenewalFormatted: '15 Nov 2026 (Stored Record)',
    taxEntityName: 'WorknAi Technologies Pvt Ltd',
    taxStatusBadge: 'Reference Record',
    gstinNumber: 'Reference GSTIN: 27AABCW1920R1ZG',
    recentInvoices: [
      {
        id: 'inv-gd-1',
        invoiceNumber: 'INV-GD-77192',
        amountFormatted: '₹7,200',
        statusText: 'Archived Reference Record',
        dateFormatted: '15 Nov 2025',
      },
    ],
  },

  notes: 'Primary corporate registrar account for core WorknAi properties. Managed by Domains team.',
  lastRecordUpdateText: 'User Mapped',
  discoveredChangesText: '0 pending',
  mappingCoverageText: 'Mapped (8/8)',
};

export const DIGITALOCEAN_TEAM_REFERENCE_DETAIL: ProviderAccountDetail = {
  id: 'digitalocean-team',
  accountId: 'DO-TEAM-01',
  accountName: 'Team DO',
  providerCompany: 'DigitalOcean',
  providerBadgeText: 'DIGITALOCEAN CLOUD',
  accountEmail: 'infra@worknai.com',
  accountType: 'Compute Droplets & Ingestion Workers',
  accountScope: 'Compute Fleet',
  mappingStatus: 'mapped',
  mappingStatusLabel: 'Mapped • User Record',

  relationshipNodes: [
    {
      label: 'Registered Email',
      value: 'infra@worknai.com',
      icon: 'alternate_email',
      iconColor: 'text-primary',
    },
    {
      label: 'Provider',
      value: 'DigitalOcean',
      icon: 'cloud_circle',
      iconColor: 'text-[#0080FF]',
    },
    {
      label: 'Provider Account',
      value: 'Team DO',
      icon: 'domain_verification',
      iconColor: 'text-primary',
      isActive: true,
    },
    {
      label: 'Compute Nodes',
      value: '2 Mapped Servers',
      icon: 'terminal',
      iconColor: 'text-secondary',
    },
    {
      label: 'Deployed Apps',
      value: '6 Mapped Apps',
      icon: 'language',
      iconColor: 'text-secondary',
    },
    {
      label: 'Mapped Domains',
      value: '0 Mapped Domains',
      icon: 'link',
      iconColor: 'text-emerald-600',
    },
  ],

  kpis: {
    ownedServersCount: 2,
    ownedServersSubtext: '2 mapped servers',
    hostedWebsitesCount: 6,
    hostedWebsitesSubtext: '6 mapped apps',
    linkedDomainsCount: 0,
    linkedDomainsSubtext: '0 mapped domains',
    estimatedMonthlyCostFormatted: '₹3,550',
    estimatedMonthlyCostSubtext: '/ mo • Stored estimate',
    estimatedAnnualCostFormatted: '₹42,600',
    estimatedAnnualCostSubtext: '/ yr • Stored estimate',
    nextRenewalFormatted: '28 Nov 2026',
    nextRenewalSubtext: 'Stored renewal date • User Mapped On',
  },

  ownedServers: [
    {
      id: 'aibos',
      name: 'AI BOS Server',
      hostname: 'aibos-sgp-core',
      osPlatform: 'Ubuntu 22.04 LTS',
      ipAddress: '159.89.162.40',
      hardwareSizing: '4 vCPU / 8 GB',
      vcpuCount: 4,
      ramGb: 8,
      storageSpecs: '160 GB NVMe',
      websitesCount: 3,
      monthlyCost: 2100,
      monthlyCostFormatted: '₹2,100',
      renewalDate: '28 Nov 2026',
      statusLabel: 'Mapped Record',
    },
    {
      id: 'analytics',
      name: 'Analytics Worker',
      hostname: 'do-blr-worker',
      osPlatform: 'Ubuntu 22.04 LTS',
      ipAddress: '139.59.34.19',
      hardwareSizing: '2 vCPU / 4 GB',
      vcpuCount: 2,
      ramGb: 4,
      storageSpecs: '80 GB NVMe',
      websitesCount: 3,
      monthlyCost: 1450,
      monthlyCostFormatted: '₹1,450',
      renewalDate: '15 Nov 2026',
      statusLabel: 'Mapped Record',
    },
  ],

  linkedDomains: [],

  associatedProjects: [
    {
      id: 'proj-aibos-do',
      name: 'AI BOS Compute Hub',
      linkedAssetsCount: 6,
      description: 'FastAPI compute clusters and high throughput ingestion sinks.',
      mappedServers: ['AI BOS Server', 'Analytics Worker'],
    },
  ],

  coverageText: 'All 2 servers and 6 deployed services for this provider account are currently mapped.',

  billing: {
    billingContact: 'infra@worknai.com',
    billingContactBadge: 'Stored Record',
    currency: 'INR (₹)',
    autoRenewStatus: 'User Mapped On',
    billingCycle: 'Monthly Usage Billing',
    nextRenewalFormatted: '28 Nov 2026 (Stored Record)',
    taxEntityName: 'WorknAi Technologies Pvt Ltd',
    taxStatusBadge: 'Reference Record',
    gstinNumber: 'Reference GSTIN: 27AABCW1920R1ZG',
    recentInvoices: [
      {
        id: 'inv-do-1',
        invoiceNumber: 'INV-DO-9921',
        amountFormatted: '₹3,550',
        statusText: 'Archived Reference Record',
        dateFormatted: '28 Oct 2025',
      },
    ],
  },

  notes: 'FastAPI compute clusters and high throughput ingestion sinks.',
  lastRecordUpdateText: 'User Mapped',
  discoveredChangesText: '0 pending',
  mappingCoverageText: 'Mapped (2/2)',
};

const CANONICAL_ALIASES: Record<string, ProviderAccountDetail> = {
  'hostinger-main': HOSTINGER_MAIN_REFERENCE_DETAIL,
  'hostinger-worknai-main': HOSTINGER_MAIN_REFERENCE_DETAIL,
  'ht-92813': HOSTINGER_MAIN_REFERENCE_DETAIL,
  'hst-941029': HOSTINGER_MAIN_REFERENCE_DETAIL,
  'godaddy-main': GODADDY_MAIN_REFERENCE_DETAIL,
  'gd-89104': GODADDY_MAIN_REFERENCE_DETAIL,
  'digitalocean-team': DIGITALOCEAN_TEAM_REFERENCE_DETAIL,
  'do-team-01': DIGITALOCEAN_TEAM_REFERENCE_DETAIL,
};

export function getProviderAccountDetail(accountId?: string): ProviderAccountDetail {
  if (!accountId) {
    return HOSTINGER_MAIN_REFERENCE_DETAIL;
  }
  const normalizedKey = accountId.trim().toLowerCase();
  return CANONICAL_ALIASES[normalizedKey] || {
    ...HOSTINGER_MAIN_REFERENCE_DETAIL,
    id: accountId,
    accountName: `Account (${accountId})`,
  };
}
