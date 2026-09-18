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

export interface Domain extends InventoryMetadata {
  autoRenew: boolean | null;
  dnsProviderAccountId: string | null;
  domainName: string;
  expiresAt: string | null;
  notes: string | null;
  registeredAt: string | null;
  registrarProviderAccountId: string | null;
}

export type DomainMetadataAttemptStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface DomainMetadataAttempt {
  lastAttemptStatus: DomainMetadataAttemptStatus;
  lastAttemptedAt: string;
  lastErrorCode: string | null;
  provenance: 'RDAP_RETRIEVED' | 'DNS_RETRIEVED' | 'SSL_RETRIEVED' | null;
  retrievedAt: string | null;
}

export interface DomainRdapMetadata extends DomainMetadataAttempt {
  changedAt: string | null;
  expiresAt: string | null;
  nameservers: string[];
  registeredAt: string | null;
  registrarIanaId: string | null;
  registrarName: string | null;
  secureDnsDelegationSigned: boolean | null;
  sourceUrl: string | null;
  statuses: string[];
}

export interface DomainDnsMetadata extends DomainMetadataAttempt {
  aRecords: string[];
  aaaaRecords: string[];
  cnameRecords: string[];
  dsRecords: Array<{ algorithm: number; digest: string; digestType: number; keyTag: number }>;
  mxRecords: Array<{ exchange: string; priority: number }>;
  nsRecords: string[];
  recordErrors: Record<string, string>;
  txtRecordCount: number;
}

export interface DomainTlsMetadata extends DomainMetadataAttempt {
  fingerprint256: string | null;
  issuerCommonName: string | null;
  issuerOrganization: string | null;
  serialNumber: string | null;
  subjectAltNames: string[];
  subjectCommonName: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface DomainMetadataResponse {
  canRefresh: boolean;
  dns: DomainDnsMetadata | null;
  domainId: string;
  rdap: DomainRdapMetadata | null;
  tls: DomainTlsMetadata | null;
}

export type DomainMetadataSource = 'rdap' | 'dns' | 'tls';

export interface RefreshDomainMetadataResponse {
  domainId: string;
  metadata: DomainMetadataResponse;
  results: Partial<Record<DomainMetadataSource, {
    errorCode: string | null;
    status: DomainMetadataAttemptStatus;
  }>>;
}

export interface Server extends InventoryMetadata {
  hostname: string | null;
  name: string;
  notes: string | null;
  operatingSystem: string | null;
  primaryIp: string | null;
  providerAccountId: string | null;
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
