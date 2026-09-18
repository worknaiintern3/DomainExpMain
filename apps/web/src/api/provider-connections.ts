import { apiRequest } from './client';

export type ProviderConnectionStatus = 'CONNECTED' | 'DISCONNECTED';
export type ProviderConnectionValidationStatus = 'PENDING' | 'VALID' | 'INVALID';
export type ProviderConnectionSyncStatus = 'IDLE' | 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED';

export type ProviderConnectionAuthType =
  | 'CLOUDFLARE_API_TOKEN'
  | 'GODADDY_PAT'
  | 'NAMECHEAP_API_KEY'
  | 'HOSTINGER_API_TOKEN'
  | 'DIGITALOCEAN_API_TOKEN'
  | 'HETZNER_API_TOKEN'
  | 'VULTR_API_KEY'
  | 'LINODE_API_TOKEN'
  | 'AWS_ACCESS_KEY'
  | 'GCP_SERVICE_ACCOUNT_KEY'
  | 'AZURE_CLIENT_CREDENTIALS';

export type ProviderConnectionResponse = {
  authType: ProviderConnectionAuthType;
  connectionStatus: ProviderConnectionStatus;
  createdAt: string;
  credentialMask: string;
  disconnectedAt: string | null;
  id: string;
  lastSyncAt: string | null;
  lastValidatedAt: string | null;
  nextSyncAt: string | null;
  providerAccountId: string;
  providerAccountLabel: string;
  providerType: string;
  syncStatus: ProviderConnectionSyncStatus;
  updatedAt: string;
  validationErrorCode: string | null;
  validationStatus: ProviderConnectionValidationStatus;
};

export type ProviderConnectionCollection = { items: ProviderConnectionResponse[] };

export type ProviderSyncRunResponse = {
  attemptNo: number;
  createdAt: string;
  durationMs: number | null;
  errorCode: string | null;
  finishedAt: string | null;
  id: string;
  itemsCreated: number;
  itemsDiscovered: number;
  itemsMissing: number;
  itemsUnchanged: number;
  itemsUpdated: number;
  startedAt: string | null;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  trigger: 'INITIAL' | 'MANUAL' | 'SCHEDULED' | 'RETRY';
};

export type ProviderAccountResponse = {
  externalAccountId: string | null;
  id: string;
  label: string;
  providerKey: string;
};

export function listProviderConnections(signal?: AbortSignal): Promise<ProviderConnectionCollection> {
  return apiRequest('/provider-connections', { signal });
}

export function createProviderConnection(
  body: { authType: ProviderConnectionAuthType; credential: string; providerAccountId: string },
): Promise<ProviderConnectionResponse> {
  return apiRequest('/provider-connections', { body, method: 'POST' });
}

export function validateProviderConnection(
  id: string,
): Promise<{ lastValidatedAt: string | null; validationErrorCode: string | null; validationStatus: ProviderConnectionValidationStatus }> {
  return apiRequest(`/provider-connections/${encodeURIComponent(id)}/validate`, { method: 'POST' });
}

export function replaceProviderConnectionCredential(
  id: string,
  credential: string,
): Promise<ProviderConnectionResponse> {
  return apiRequest(`/provider-connections/${encodeURIComponent(id)}/credentials`, {
    body: { credential },
    method: 'PUT',
  });
}

export function triggerProviderConnectionSync(
  id: string,
  idempotencyKey: string,
): Promise<{ id: string; message: string; status: 'QUEUED'; trigger: 'MANUAL' }> {
  return apiRequest(`/provider-connections/${encodeURIComponent(id)}/sync`, {
    headers: { 'Idempotency-Key': idempotencyKey },
    method: 'POST',
  });
}

export function listProviderConnectionSyncRuns(
  id: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<{ items: ProviderSyncRunResponse[] }> {
  const qs = limit ? `?limit=${String(limit)}` : '';
  return apiRequest(`/provider-connections/${encodeURIComponent(id)}/sync-runs${qs}`, { signal });
}

export function disconnectProviderConnection(
  id: string,
): Promise<{ connectionStatus: 'DISCONNECTED'; disconnectedAt: string; id: string }> {
  return apiRequest(`/provider-connections/${encodeURIComponent(id)}/disconnect`, { method: 'POST' });
}

export function listProviderAccounts(signal?: AbortSignal): Promise<{ items: ProviderAccountResponse[] }> {
  return apiRequest('/provider-accounts', { signal });
}

export function createProviderAccount(
  body: { label: string; providerKey: string },
): Promise<ProviderAccountResponse> {
  return apiRequest('/provider-accounts', { body, method: 'POST' });
}
