export type ProvenanceSource = 
  | 'RDAP Retrieved'
  | 'DNS Retrieved'
  | 'SSL Retrieved'
  | 'User Mapped'
  | 'Stored Record'
  | 'Calculated';

export interface DnsRecordItem {
  id: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'CAA' | 'SRV';
  name: string;
  content: string;
  ttl: string;
  proxied: boolean;
  priority?: number;
}

export interface NameserverItem {
  host: string;
  tier: string;
  provenance: ProvenanceSource;
}

export interface DomainRelationshipNode {
  step: number;
  label: string;
  value: string;
  icon: string;
  tag: string;
  provenance: ProvenanceSource;
  isCenterpiece?: boolean;
  linkTo?: string;
}

export interface DomainDetailData {
  id: string;
  domain: string;
  domainIdCode: string;
  isApex: boolean;
  status: 'healthy' | 'warning' | 'critical';
  statusLabel: string;
  description: string;
  dnssecActive: boolean;

  // Registrar KPI
  registrarName: string;
  registrarTenant: string;
  ianaId: string;
  referralUrl: string;
  abuseEmail: string;

  // Registrant KPI
  registrantEmail: string;
  whoisRedacted: boolean;

  // Expiry KPI
  expiresFormatted: string;
  expiresUtc: string;
  createdUtc: string;
  updatedUtc: string;
  registeredDateFormatted: string;
  daysRemaining: number;
  lifespanPercentage: number;
  autoRenew: boolean;

  // Renewal Pricing KPI
  renewalCostFormatted: string;
  fiveYearProjectionFormatted: string;

  // EPP Status Codes
  eppStatusCodes: string[];

  // DNS & Infrastructure
  dnsProvider: string;
  nameservers: NameserverItem[];
  dnssecAlgorithm: string;
  dnssecKeyTag: string;
  dnssecDigest: string;
  dnsRecords: DnsRecordItem[];
  zoneFileContent?: string;

  // Hosting & Application Mapping
  targetAppName: string;
  targetAppUrl: string;
  mappedServerName: string;
  mappedServerProvider: string;
  mappedServerIp: string;
  mappedServerRegion: string;
  infraAccountEmail: string;
  infraAccountOrg: string;

  // SSL Certificate
  sslCommonName: string;
  sslAuthority: string;
  sslStatusText: string;
  sslExpirationDate: string;
  sslDaysRemaining: number;
  sslProgressPercentage: number;

  // Notes
  userNotes?: string;

  // Relationship Map
  relationshipNodes: DomainRelationshipNode[];
}
