export interface ProblemDetails {
  detail: string;
  instance: string;
  requestId: string;
  status: number;
  timestamp: string;
  title: string;
  type: string;
}

export interface PublicUser {
  createdAt: string;
  displayName: string | null;
  email: string;
  id: string;
  updatedAt: string;
}

export interface AuthSession {
  expiresAt: string;
  id: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  session: AuthSession;
}

export interface LoginResponse extends TokenPair {
  user: PublicUser;
}

export interface GoogleOAuthStartResponse {
  authorizationUrl: string;
}

export interface LoginMethodsStatus {
  canUnlinkGoogle: boolean;
  google: {
    connected: boolean;
    email: string | null;
  };
  password: {
    enabled: boolean;
  };
}

export interface GoogleLinkResult {
  alreadyLinked: boolean;
  providerEmail: string;
}

export interface InventoryMetadata {
  createdAt: string;
  id: string;
  inventoryState: 'TRACKED' | 'ARCHIVED';
  provenance:
    | 'USER_ADDED'
    | 'USER_MAPPED'
    | 'IMPORTED'
    | 'PROVIDER_API'
    | 'RDAP_RETRIEVED'
    | 'DNS_RETRIEVED'
    | 'SSL_RETRIEVED'
    | 'HTTP_RETRIEVED'
    | 'INFRA_RETRIEVED'
    | 'CALCULATED';
  updatedAt: string;
}

export interface EmailAccount extends InventoryMetadata {
  email: string;
  label: string | null;
  notes: string | null;
}

export interface ProviderAccount extends InventoryMetadata {
  externalAccountId: string | null;
  label: string;
  loginEmailAccountId: string | null;
  notes: string | null;
  providerKey: string;
}

export interface Project extends InventoryMetadata {
  description: string | null;
  name: string;
}

export interface DomainRdapSummary {
  expiresAt: string | null;
  lastAttemptStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  registeredAt: string | null;
  registrarName: string | null;
}

export interface Domain extends InventoryMetadata {
  autoRenew: boolean | null;
  dnsProviderAccountId: string | null;
  domainName: string;
  expiresAt: string | null;
  notes: string | null;
  rdap: DomainRdapSummary | null;
  registeredAt: string | null;
  registrarProviderAccountId: string | null;
}

export type DomainMetadataAttemptStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface DomainMetadataAttempt {
  lastAttemptStatus: DomainMetadataAttemptStatus;
  lastAttemptedAt: string;
  lastErrorCode: string | null;
  provenance: 'RDAP_RETRIEVED' | 'DNS_RETRIEVED' | 'SSL_RETRIEVED' | 'HTTP_RETRIEVED' | 'INFRA_RETRIEVED' | null;
  retrievedAt: string | null;
}

export interface DomainRdapMetadata extends DomainMetadataAttempt {
  abuseEmails: string[];
  abusePhones: string[];
  changedAt: string | null;
  events: Array<{ action: string; date: string }>;
  expiresAt: string | null;
  nameservers: string[];
  registeredAt: string | null;
  registrarIanaId: string | null;
  registrarName: string | null;
  registryDomainId: string | null;
  secureDnsDelegationSigned: boolean | null;
  sourceUrl: string | null;
  statuses: string[];
}

export interface DomainDnsMetadata extends DomainMetadataAttempt {
  aRecords: string[];
  aaaaRecords: string[];
  caaRecords: string[];
  cnameRecords: string[];
  dnskeyRecords: Array<{ algorithm: number; flags: number; protocol: number; publicKey: string }>;
  dsRecords: Array<{ algorithm: number; digest: string; digestType: number; keyTag: number }>;
  mxRecords: Array<{ exchange: string; priority: number }>;
  nsRecords: string[];
  recordErrors: Record<string, string>;
  rrsigRecords: Array<{ algorithm: number; expiration: string; inception: string; keyTag: number; labels: number; originalTtl: number; signerName: string; typeCovered: string }>;
  soaRecord: { expire: number; minimum: number; mname: string; refresh: number; retry: number; rname: string; serial: number } | null;
  srvRecords: Array<{ name: string; port: number; priority: number; target: string; weight: number }>;
  txtRecordCount: number;
}

export interface DomainTlsMetadata extends DomainMetadataAttempt {
  certificateStatus: string | null;
  chain: Array<{ issuer: string | null; subject: string | null; validFrom: string | null; validTo: string | null }>;
  fingerprint256: string | null;
  issuerCommonName: string | null;
  issuerOrganization: string | null;
  keyAlgorithm: string | null;
  serialNumber: string | null;
  signatureAlgorithm: string | null;
  subjectAltNames: string[];
  subjectCommonName: string | null;
  tlsVersion: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface DomainHttpMetadata extends DomainMetadataAttempt {
  contentType: string | null;
  finalUrl: string | null;
  httpStatus: number | null;
  hstsEnabled: boolean | null;
  pageTitle: string | null;
  reachable: boolean | null;
  redirectChain: Array<{ status: number | null; url: string }>;
  responseTimeMs: number | null;
  securityHeaders: Record<string, string>;
  serverHeader: string | null;
}

export interface DomainInfraMetadata extends DomainMetadataAttempt {
  asn: number | null;
  cdnProxy: string | null;
  country: string | null;
  ipAddresses: string[];
  network: string | null;
  organization: string | null;
  region: string | null;
  reverseDns: string[];
}

export interface DomainMetadataResponse {
  canRefresh: boolean;
  dns: DomainDnsMetadata | null;
  domainId: string;
  http: DomainHttpMetadata | null;
  infra: DomainInfraMetadata | null;
  rdap: DomainRdapMetadata | null;
  tls: DomainTlsMetadata | null;
}

export type DomainMetadataSource = 'rdap' | 'dns' | 'tls' | 'http' | 'infra';

export interface RefreshDomainMetadataQueuedRun {
  id: string;
  message: string;
  status: 'QUEUED';
  trigger: 'MANUAL';
}

export interface RefreshDomainMetadataResponse {
  domainId: string;
  metadata: DomainMetadataResponse;
  requestedSources?: DomainMetadataSource[];
  results?: {
    dns?: { errorCode: string | null; status: string };
    rdap?: { errorCode: string | null; status: string };
    tls?: { errorCode: string | null; status: string };
  };
  run?: RefreshDomainMetadataQueuedRun;
}

export interface ServerProviderSpecs {
  cpuCount: number | null;
  diskGb: number | null;
  memoryMb: number | null;
}

export interface ServerProviderMetadata {
  operatingSystemDetail: Record<string, string> | null;
  providerCreatedAt: string | null;
  providerStatus: string | null;
  specs: ServerProviderSpecs;
}

export interface Server extends InventoryMetadata {
  hostname: string | null;
  name: string;
  notes: string | null;
  operatingSystem: string | null;
  primaryIp: string | null;
  providerAccountId: string | null;
  providerMetadata: ServerProviderMetadata | null;
  region: string | null;
  serverKind: string | null;
}

export interface CloudResource extends InventoryMetadata {
  externalResourceId: string | null;
  name: string;
  notes: string | null;
  providerAccountId: string;
  region: string | null;
  resourceType: string;
}

export type ApplicationKind =
  | 'WEBSITE'
  | 'WEB_APPLICATION'
  | 'API'
  | 'BACKEND_SERVICE'
  | 'MOBILE_APPLICATION'
  | 'OTHER';

export interface Application extends InventoryMetadata {
  kind: ApplicationKind;
  name: string;
  notes: string | null;
  primaryDomainId: string | null;
  primaryUrl: string | null;
  projectId: string | null;
}

export interface InventoryResourceMap {
  applications: Application;
  'cloud-resources': CloudResource;
  domains: Domain;
  'email-accounts': EmailAccount;
  projects: Project;
  'provider-accounts': ProviderAccount;
  servers: Server;
}

export type InventoryResource = keyof InventoryResourceMap;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export type GraphEntityKind =
  | 'PROJECT'
  | 'DOMAIN'
  | 'SERVER'
  | 'CLOUD_RESOURCE'
  | 'WEBSITE_APPLICATION';

export type RelationshipType =
  | 'GROUPS'
  | 'HOSTED_ON'
  | 'USES_DOMAIN'
  | 'DEPENDS_ON'
  | 'ROUTES_TO'
  | 'CONNECTED_TO';

export interface EntityReference {
  entityId: string;
  entityKind: GraphEntityKind;
}

export interface InventoryRelationship extends InventoryMetadata {
  notes: string | null;
  relationshipType: RelationshipType;
  source: EntityReference;
  target: EntityReference;
}

export interface AssociatedEntity extends EntityReference {
  associationSources: Array<'PRIMARY_STRUCTURAL' | 'FLEXIBLE_RELATIONSHIP'>;
}

export interface ImmediateRelationship {
  direction: 'OUTBOUND' | 'INBOUND';
  entity: EntityReference;
  id: string;
  inventoryState: InventoryMetadata['inventoryState'];
  provenance: InventoryMetadata['provenance'];
  relationshipType: RelationshipType;
}

export interface ItemCollection<T> {
  items: T[];
}
