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
