import { DomainDetailData } from './domainDetails.types';

export const WORKNAI_COM_DETAIL_REFERENCE: DomainDetailData = {
  id: 'worknai-com',
  domain: 'worknai.com',
  domainIdCode: 'DOM-8942-WN',
  isApex: true,
  status: 'healthy',
  statusLabel: 'Calculated • Healthy',
  description:
    'Apex domain managing WorknAi web platform and client API services with mapped registrar, DNS, and SSL record attributes.',
  dnssecActive: true,

  // Registrar KPI
  registrarName: 'GoDaddy Inc.',
  registrarTenant: 'WorknAi GoDaddy Main (User Mapped)',
  ianaId: '146',
  referralUrl: 'https://godaddy.com',
  abuseEmail: 'abuse@godaddy.com',

  // Registrant KPI
  registrantEmail: 'domains@worknai.com',
  whoisRedacted: true,

  // Expiry KPI
  expiresFormatted: '24 Oct 2027',
  expiresUtc: '2027-10-24 14:02:18 UTC',
  createdUtc: '2021-10-24 14:02:18 UTC',
  updatedUtc: '2023-11-12 08:34:05 UTC',
  registeredDateFormatted: '24 Oct 2021 (RDAP Record)',
  daysRemaining: 414,
  lifespanPercentage: 81,
  autoRenew: true,

  // Pricing KPI
  renewalCostFormatted: '₹1,299',
  fiveYearProjectionFormatted: '₹6,495 Total',

  // EPP Status Codes
  eppStatusCodes: [
    'clientTransferProhibited',
    'clientUpdateProhibited',
    'clientDeleteProhibited',
  ],

  // DNS & Infrastructure
  dnsProvider: 'Cloudflare DNS',
  nameservers: [
    {
      host: 'ns1.cloudflare.com',
      tier: 'Anycast',
      provenance: 'DNS Retrieved',
    },
    {
      host: 'ns2.cloudflare.com',
      tier: 'Anycast',
      provenance: 'DNS Retrieved',
    },
  ],
  dnssecAlgorithm: 'Algorithm: 13 (ECDSAP256SHA256)',
  dnssecKeyTag: 'Key Tag: 2371',
  dnssecDigest: 'Digest: 4A8B991F...D8912E3100A (SHA-256)',
  dnsRecords: [
    {
      id: 'rec-1',
      type: 'A',
      name: '@',
      content: '103.21.58.112',
      ttl: 'Auto',
      proxied: true,
    },
    {
      id: 'rec-2',
      type: 'CNAME',
      name: 'www',
      content: 'worknai.com',
      ttl: 'Auto',
      proxied: true,
    },
    {
      id: 'rec-3',
      type: 'MX',
      name: '@',
      content: 'mail.google.com (Priority 1)',
      ttl: '3600',
      proxied: false,
    },
    {
      id: 'rec-4',
      type: 'TXT',
      name: '@',
      content: 'v=spf1 include:_spf.google.com ~all',
      ttl: 'Auto',
      proxied: false,
    },
  ],
  zoneFileContent: `; Zone file export for worknai.com
; Generated from stored DNS records
$ORIGIN worknai.com.
$TTL 3600
@       IN  SOA ns1.cloudflare.com. admin.worknai.com. (
            2026090501 ; Serial
            7200       ; Refresh
            3600       ; Retry
            1209600    ; Expire
            3600 )     ; Minimum TTL

@       IN  NS      ns1.cloudflare.com.
@       IN  NS      ns2.cloudflare.com.
@       IN  A       103.21.58.112
www     IN  CNAME   worknai.com.
@       IN  MX  1   mail.google.com.
@       IN  TXT     "v=spf1 include:_spf.google.com ~all"
`,

  // Hosting & Application Mapping
  targetAppName: 'WorknAi Website',
  targetAppUrl: 'https://worknai.com',
  mappedServerName: 'Production VPS 01',
  mappedServerProvider: 'Hostinger Cloud VPS',
  mappedServerIp: '103.21.58.112',
  mappedServerRegion: 'Mumbai, IN (ap-south-1)',
  infraAccountEmail: 'infra@worknai.com',
  infraAccountOrg: 'Hostinger Portfolio Org',

  // SSL Certificate
  sslCommonName: 'worknai.com',
  sslAuthority: "Let's Encrypt Authority",
  sslStatusText: 'Valid • Expiring in 68 Days',
  sslExpirationDate: '12 Nov 2026',
  sslDaysRemaining: 68,
  sslProgressPercentage: 76,

  userNotes: 'Primary enterprise production apex domain. Manages edge DNS and CDN routing for all customer-facing platform applications.',

  // Relationship Map Nodes
  relationshipNodes: [
    {
      step: 1,
      label: 'Registration Account',
      value: 'domains@worknai.com',
      icon: 'manage_accounts',
      tag: 'User Mapped',
      provenance: 'User Mapped',
      linkTo: '/accounts',
    },
    {
      step: 2,
      label: 'Registrar',
      value: 'GoDaddy Inc.',
      icon: 'verified',
      tag: 'RDAP Retrieved',
      provenance: 'RDAP Retrieved',
      linkTo: '/accounts',
    },
    {
      step: 3,
      label: 'Apex Domain',
      value: 'worknai.com',
      icon: 'language',
      tag: 'Domain Record',
      provenance: 'Stored Record',
      isCenterpiece: true,
      linkTo: '/domains/worknai.com',
    },
    {
      step: 4,
      label: 'DNS Provider',
      value: 'Cloudflare',
      icon: 'dns',
      tag: 'DNS Retrieved',
      provenance: 'DNS Retrieved',
    },
    {
      step: 5,
      label: 'Website / App',
      value: 'WorknAi Web',
      icon: 'devices',
      tag: 'Mapped',
      provenance: 'User Mapped',
      linkTo: '/websites',
    },
    {
      step: 6,
      label: 'Server',
      value: 'Production VPS 01',
      icon: 'storage',
      tag: 'Inventory Record',
      provenance: 'Stored Record',
      linkTo: '/servers',
    },
    {
      step: 7,
      label: 'Project',
      value: 'WorknAi',
      icon: 'folder_special',
      tag: 'Workspace Project',
      provenance: 'Stored Record',
    },
  ],
};

const DOMAIN_DETAILS_MAP: Record<string, DomainDetailData> = {
  'worknai.com': WORKNAI_COM_DETAIL_REFERENCE,
  'worknai-com': WORKNAI_COM_DETAIL_REFERENCE,
  'worknai.in': {
    ...WORKNAI_COM_DETAIL_REFERENCE,
    id: 'worknai-in',
    domain: 'worknai.in',
    domainIdCode: 'DOM-8943-WIN',
    status: 'critical',
    statusLabel: 'Calculated • Critical (≤7d)',
    expiresFormatted: '10 Sep 2026',
    daysRemaining: 6,
    autoRenew: false,
    renewalCostFormatted: '₹899',
    fiveYearProjectionFormatted: '₹4,495 Total',
    targetAppName: 'WorknAi Regional India Portal',
    relationshipNodes: WORKNAI_COM_DETAIL_REFERENCE.relationshipNodes.map((n) =>
      n.step === 3 ? { ...n, value: 'worknai.in' } : n
    ),
  },
  'anywork.ai': {
    ...WORKNAI_COM_DETAIL_REFERENCE,
    id: 'anywork-ai',
    domain: 'anywork.ai',
    domainIdCode: 'DOM-7412-AW',
    status: 'warning',
    statusLabel: 'Calculated • Warning (≤30d)',
    registrarName: 'Cloudflare Inc.',
    expiresFormatted: '16 Sep 2026',
    daysRemaining: 12,
    autoRenew: true,
    renewalCostFormatted: '₹6,850',
    fiveYearProjectionFormatted: '₹34,250 Total',
    targetAppName: 'AnyWork AI Engine',
    relationshipNodes: WORKNAI_COM_DETAIL_REFERENCE.relationshipNodes.map((n) =>
      n.step === 3 ? { ...n, value: 'anywork.ai' } : n
    ),
  },
};

/**
 * Retrieve domain details reference data by domain or domainId string.
 * Gracefully falls back to worknai.com template with the requested domain name.
 */
export function getDomainDetail(domainParam?: string): DomainDetailData {
  if (!domainParam) return WORKNAI_COM_DETAIL_REFERENCE;
  const cleanKey = domainParam.toLowerCase().trim();
  if (DOMAIN_DETAILS_MAP[cleanKey]) {
    return DOMAIN_DETAILS_MAP[cleanKey];
  }
  // Dynamic fallback for any arbitrary domain route param
  return {
    ...WORKNAI_COM_DETAIL_REFERENCE,
    id: `domain-${cleanKey.replace(/\./g, '-')}`,
    domain: cleanKey,
    domainIdCode: `DOM-${Math.floor(1000 + Math.random() * 9000)}-${cleanKey.slice(0, 2).toUpperCase()}`,
    relationshipNodes: WORKNAI_COM_DETAIL_REFERENCE.relationshipNodes.map((n) =>
      n.step === 3 ? { ...n, value: cleanKey } : n
    ),
  };
}
