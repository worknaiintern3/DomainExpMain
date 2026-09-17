export type ProviderConnectionAuthType =
  | 'CLOUDFLARE_API_TOKEN'
  | 'GODADDY_PAT'
  | 'NAMECHEAP_API_KEY'
  | 'HOSTINGER_API_TOKEN'
  | 'DIGITALOCEAN_API_TOKEN'
  | 'HETZNER_API_TOKEN'
  | 'VULTR_API_KEY'
  | 'LINODE_API_TOKEN';

/**
 * Which `provider_accounts.provider_key` a given auth type must reference.
 * A connection can only be created against a provider account whose
 * providerKey matches -- prevents e.g. a CLOUDFLARE_API_TOKEN connection
 * from being attached to a non-Cloudflare provider account (and, per Phase
 * 10G, blocks any cross-provider mismatch symmetrically for GoDaddy,
 * Namecheap, and Hostinger).
 */
export const AUTH_TYPE_PROVIDER_KEY: Record<ProviderConnectionAuthType, string> = {
  CLOUDFLARE_API_TOKEN: 'cloudflare',
  DIGITALOCEAN_API_TOKEN: 'digitalocean',
  GODADDY_PAT: 'godaddy',
  HETZNER_API_TOKEN: 'hetzner',
  HOSTINGER_API_TOKEN: 'hostinger',
  LINODE_API_TOKEN: 'linode',
  NAMECHEAP_API_KEY: 'namecheap',
  VULTR_API_KEY: 'vultr',
};
export type ProviderConnectionValidationStatus = 'PENDING' | 'VALID' | 'INVALID';
export type ProviderConnectionSyncStatus = 'IDLE' | 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';
export type ProviderConnectionStatus = 'CONNECTED' | 'DISCONNECTED';
export type ProviderSyncRunTrigger = 'INITIAL' | 'MANUAL' | 'SCHEDULED' | 'RETRY';
export type ProviderSyncRunStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';

/**
 * Mirrors the canonical error vocabulary in
 * apps/worker/src/providers/provider-adapter.types.ts. Duplicated rather
 * than imported: apps/api's tsconfig rootDir is scoped to apps/api and
 * cannot reference apps/worker sources, and the Phase 10D adapter there
 * must not be modified. apps/worker remains the single implementation of
 * provider discovery; this list only lets the API map its own token
 * validation calls onto the same safe, bounded codes.
 */
export const PROVIDER_ERROR_CODES = [
  'AUTH_INVALID',
  'PERMISSION_DENIED',
  'RATE_LIMITED',
  'NETWORK_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_RESPONSE',
  'INVALID_REQUEST',
  'RESOURCE_NOT_FOUND',
  'UNKNOWN_PROVIDER_ERROR',
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export interface ProviderConnectionSummary {
  readonly authType: ProviderConnectionAuthType;
  readonly connectionStatus: ProviderConnectionStatus;
  readonly createdAt: Date;
  readonly credentialMask: string;
  readonly disconnectedAt: Date | null;
  readonly id: string;
  readonly lastSyncAt: Date | null;
  readonly lastValidatedAt: Date | null;
  readonly nextSyncAt: Date | null;
  readonly providerAccountId: string;
  readonly providerAccountLabel: string;
  readonly providerType: string;
  readonly syncStatus: ProviderConnectionSyncStatus;
  readonly updatedAt: Date;
  readonly validationErrorCode: string | null;
  readonly validationStatus: ProviderConnectionValidationStatus;
}

/** Internal-only projection: carries the encrypted envelope for decrypt/rotate/disconnect. Never leaves the service layer. */
export interface ProviderConnectionEnvelope {
  readonly authType: ProviderConnectionAuthType;
  readonly connectionStatus: ProviderConnectionStatus;
  readonly encryptedCiphertext: string | null;
  readonly encryptionAuthTag: string | null;
  readonly encryptionIv: string | null;
  readonly id: string;
  readonly keyVersion: number | null;
  readonly providerAccountId: string;
  readonly workspaceId: string;
}

export interface CreateProviderConnectionRecordInput {
  readonly authType: ProviderConnectionAuthType;
  readonly credentialMask: string;
  readonly encryptedCiphertext: string;
  readonly encryptionAuthTag: string;
  readonly encryptionIv: string;
  readonly id: string;
  readonly keyVersion: number;
  readonly providerAccountId: string;
  readonly validatedAt: Date;
}

export interface ReplaceCredentialInput {
  readonly credentialMask: string;
  readonly encryptedCiphertext: string;
  readonly encryptionAuthTag: string;
  readonly encryptionIv: string;
  readonly keyVersion: number;
  readonly validatedAt: Date;
}

export interface ValidationResultInput {
  readonly validatedAt: Date;
  readonly validationErrorCode: string | null;
  readonly validationStatus: ProviderConnectionValidationStatus;
}

export interface ProviderSyncRunSummary {
  readonly attemptNo: number;
  readonly createdAt: Date;
  readonly durationMs: number | null;
  readonly errorCode: string | null;
  readonly finishedAt: Date | null;
  readonly id: string;
  readonly itemsCreated: number;
  readonly itemsDiscovered: number;
  readonly itemsMissing: number;
  readonly itemsUnchanged: number;
  readonly itemsUpdated: number;
  readonly startedAt: Date | null;
  readonly status: ProviderSyncRunStatus;
  readonly trigger: ProviderSyncRunTrigger;
}

export interface ProviderConnectionsStore {
  createConnection(
    workspaceId: string,
    input: CreateProviderConnectionRecordInput,
    now: Date,
  ): Promise<ProviderConnectionSummary>;
  createManualSyncRun(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
    now: Date,
  ): Promise<{ id: string }>;
  disconnect(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<{ connectionStatus: ProviderConnectionStatus; disconnectedAt: Date; id: string } | undefined>;
  findActiveRun(
    workspaceId: string,
    connectionId: string,
  ): Promise<{ id: string } | undefined>;
  findEnvelopeById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionEnvelope | undefined>;
  findRunByIdempotencyKey(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
  ): Promise<{ id: string } | undefined>;
  findSummaryById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionSummary | undefined>;
  listSummaries(workspaceId: string): Promise<readonly ProviderConnectionSummary[]>;
  listSyncRuns(
    workspaceId: string,
    connectionId: string,
    limit: number,
  ): Promise<readonly ProviderSyncRunSummary[]>;
  replaceCredential(
    workspaceId: string,
    id: string,
    input: ReplaceCredentialInput,
  ): Promise<ProviderConnectionSummary | undefined>;
  updateValidationResult(
    workspaceId: string,
    id: string,
    input: ValidationResultInput,
  ): Promise<ProviderConnectionSummary | undefined>;
}
