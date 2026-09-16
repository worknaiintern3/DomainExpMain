import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  createProviderAccount,
  createProviderConnection,
  disconnectProviderConnection,
  listProviderAccounts,
  listProviderConnections,
  listProviderConnectionSyncRuns,
  replaceProviderConnectionCredential,
  triggerProviderConnectionSync,
  validateProviderConnection,
  type ProviderConnectionResponse,
  type ProviderSyncRunResponse,
} from '@/api/provider-connections';

const CLOUDFLARE_PROVIDER_KEY = 'cloudflare';
const SYNC_POLL_INTERVAL_MS = 3_000;
const SYNC_POLL_TIMEOUT_MS = 60_000;

const VALIDATION_ERROR_LABELS: Record<string, string> = {
  AUTH_INVALID: 'Authentication failed. The token is invalid, disabled, or expired.',
  INVALID_REQUEST: 'The request to Cloudflare was rejected as invalid.',
  NETWORK_TIMEOUT: 'The request to Cloudflare timed out.',
  PERMISSION_DENIED: 'This token does not have the required permissions.',
  RATE_LIMITED: 'Cloudflare is rate-limiting requests. Try again shortly.',
  RESOURCE_NOT_FOUND: 'A required Cloudflare resource could not be found.',
  UNKNOWN_PROVIDER_ERROR: 'An unexpected error occurred while contacting Cloudflare.',
  UPSTREAM_BAD_RESPONSE: 'Cloudflare returned an unexpected response.',
  UPSTREAM_UNAVAILABLE: 'Cloudflare is temporarily unavailable.',
};

function safeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail;
  return fallback;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

interface TokenFieldProps {
  autoFocus?: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

const TokenField: React.FC<TokenFieldProps> = ({ autoFocus, onChange, placeholder, value }) => (
  <input
    autoComplete="off"
    autoFocus={autoFocus}
    className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro w-full"
    data-testid="cloudflare-token-input"
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    spellCheck={false}
    type="password"
    value={value}
  />
);

export const IntegrationsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ProviderConnectionResponse | null>(null);
  const [latestRun, setLatestRun] = useState<ProviderSyncRunResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showRotateForm, setShowRotateForm] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    'idle' | 'connecting' | 'validating' | 'rotating' | 'disconnecting'
  >('idle');

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearToken = useCallback(() => {
    setTokenValue('');
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const { items } = await listProviderConnections(signal);
    const cloudflareConnection = items.find((c) => c.providerType === CLOUDFLARE_PROVIDER_KEY) ?? null;
    if (signal?.aborted) return;
    setConnection(cloudflareConnection);
    if (cloudflareConnection) {
      const { items: runs } = await listProviderConnectionSyncRuns(cloudflareConnection.id, 1, signal);
      if (signal?.aborted) return;
      setLatestRun(runs[0] ?? null);
    } else {
      setLatestRun(null);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(safeErrorMessage(error, 'Failed to load provider connections.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
      controller.abort();
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [load]);

  const isSyncing = latestRun?.status === 'QUEUED' || latestRun?.status === 'RUNNING';

  const pollUntilSettled = useCallback((connectionId: string, deadline: number) => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { items: runs } = await listProviderConnectionSyncRuns(connectionId, 1);
          if (!mountedRef.current) return;
          const run = runs[0] ?? null;
          setLatestRun(run);
          const stillRunning = run?.status === 'QUEUED' || run?.status === 'RUNNING';
          if (stillRunning && Date.now() < deadline) {
            pollUntilSettled(connectionId, deadline);
          } else {
            const { items } = await listProviderConnections();
            if (!mountedRef.current) return;
            setConnection(items.find((c) => c.id === connectionId) ?? null);
          }
        } catch {
          // Transient polling failure: the next manual refresh (reopening
          // Settings) will pick up the true state. Never surface this as a
          // hard error for a background poll.
        }
      })();
    }, SYNC_POLL_INTERVAL_MS);
  }, []);

  async function resolveCloudflareProviderAccountId(): Promise<string> {
    const { items } = await listProviderAccounts();
    const existing = items.find((account) => account.providerKey === CLOUDFLARE_PROVIDER_KEY);
    if (existing) return existing.id;
    const created = await createProviderAccount({ label: 'Cloudflare', providerKey: CLOUDFLARE_PROVIDER_KEY });
    return created.id;
  }

  async function handleConnect(): Promise<void> {
    const credential = tokenValue;
    setActionError(null);
    setActionState('connecting');
    try {
      const providerAccountId = await resolveCloudflareProviderAccountId();
      const created = await createProviderConnection({
        authType: 'CLOUDFLARE_API_TOKEN',
        credential,
        providerAccountId,
      });
      setConnection(created);
      setShowConnectForm(false);
    } catch (error) {
      setActionError(safeErrorMessage(error, 'Could not connect to Cloudflare.'));
    } finally {
      clearToken();
      setActionState('idle');
    }
  }

  async function handleValidate(): Promise<void> {
    if (!connection) return;
    setActionError(null);
    setActionState('validating');
    try {
      await validateProviderConnection(connection.id);
      const { items } = await listProviderConnections();
      setConnection(items.find((c) => c.id === connection.id) ?? null);
    } catch (error) {
      setActionError(safeErrorMessage(error, 'Validation failed.'));
    } finally {
      setActionState('idle');
    }
  }

  async function handleRotate(): Promise<void> {
    if (!connection) return;
    const credential = tokenValue;
    setActionError(null);
    setActionState('rotating');
    try {
      const updated = await replaceProviderConnectionCredential(connection.id, credential);
      setConnection(updated);
      setShowRotateForm(false);
    } catch (error) {
      setActionError(safeErrorMessage(error, 'Could not replace the token.'));
    } finally {
      clearToken();
      setActionState('idle');
    }
  }

  async function handleSyncNow(): Promise<void> {
    if (!connection) return;
    setActionError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      await triggerProviderConnectionSync(connection.id, idempotencyKey);
      const { items: runs } = await listProviderConnectionSyncRuns(connection.id, 1);
      setLatestRun(runs[0] ?? null);
      pollUntilSettled(connection.id, Date.now() + SYNC_POLL_TIMEOUT_MS);
    } catch (error) {
      setActionError(safeErrorMessage(error, 'Could not queue a sync.'));
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (!connection) return;
    setActionError(null);
    setActionState('disconnecting');
    try {
      await disconnectProviderConnection(connection.id);
      const { items } = await listProviderConnections();
      setConnection(items.find((c) => c.id === connection.id) ?? null);
      setLatestRun(null);
    } catch (error) {
      setActionError(safeErrorMessage(error, 'Could not disconnect.'));
    } finally {
      setActionState('idle');
    }
  }

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <div className="flex flex-col pb-unit-md border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Integrations
          </h3>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Connect external providers to discover and keep domain inventory in sync.
          </p>
        </div>

        <div className="mt-unit-md">
          {loading && (
            <p className="font-body-sm text-body-sm text-secondary">Loading integrations…</p>
          )}

          {!loading && loadError && (
            <p className="font-body-sm text-body-sm text-error" role="alert">{loadError}</p>
          )}

          {!loading && !loadError && (
            <div
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-md"
              data-testid="cloudflare-integration-card"
            >
              <div className="flex items-center justify-between gap-unit-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-on-surface">cloud</span>
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold">Cloudflare</span>
                </div>
                {connection && (
                  <span
                    className={`font-caption-xs text-caption-xs px-2 py-0.5 rounded-full border ${
                      connection.connectionStatus === 'DISCONNECTED'
                        ? 'border-outline-variant/60 text-secondary'
                        : connection.validationStatus === 'VALID'
                          ? 'border-primary/40 text-primary'
                          : 'border-error/40 text-error'
                    }`}
                  >
                    {connection.connectionStatus === 'DISCONNECTED'
                      ? 'Disconnected'
                      : connection.validationStatus === 'VALID'
                        ? 'Connected'
                        : 'Attention needed'}
                  </span>
                )}
              </div>

              {/* DISCONNECTED (no connection at all, or soft-disconnected) */}
              {(!connection || connection.connectionStatus === 'DISCONNECTED') && (
                <div className="mt-unit-md">
                  {!showConnectForm ? (
                    <button
                      className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
                      onClick={() => setShowConnectForm(true)}
                      type="button"
                    >
                      Connect
                    </button>
                  ) : (
                    <form
                      className="flex flex-col gap-unit-sm max-w-md"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleConnect();
                      }}
                    >
                      <label className="font-label-md text-label-md text-on-surface font-medium">
                        Cloudflare API token
                      </label>
                      <TokenField
                        autoFocus
                        onChange={setTokenValue}
                        placeholder="Paste your Cloudflare API token"
                        value={tokenValue}
                      />
                      <div className="flex gap-unit-sm">
                        <button
                          className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
                          disabled={actionState === 'connecting' || tokenValue.length === 0}
                          type="submit"
                        >
                          {actionState === 'connecting' ? 'Connecting…' : 'Save and connect'}
                        </button>
                        <button
                          className="h-9 px-unit-lg rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                          onClick={() => {
                            setShowConnectForm(false);
                            clearToken();
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* CONNECTED (VALID or INVALID) */}
              {connection && connection.connectionStatus === 'CONNECTED' && (
                <div className="mt-unit-md flex flex-col gap-unit-sm">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-unit-md gap-y-1 font-body-sm text-body-sm">
                    <div className="flex justify-between sm:block">
                      <dt className="text-secondary">Credential</dt>
                      <dd className="text-on-surface font-mono">{connection.credentialMask}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-secondary">Last validated</dt>
                      <dd className="text-on-surface">{formatTimestamp(connection.lastValidatedAt)}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-secondary">Last sync</dt>
                      <dd className="text-on-surface">{formatTimestamp(connection.lastSyncAt)}</dd>
                    </div>
                    <div className="flex justify-between sm:block">
                      <dt className="text-secondary">Next sync</dt>
                      <dd className="text-on-surface">{formatTimestamp(connection.nextSyncAt)}</dd>
                    </div>
                  </dl>

                  {connection.validationStatus === 'INVALID' && (
                    <p className="font-body-sm text-body-sm text-error" role="alert">
                      {VALIDATION_ERROR_LABELS[connection.validationErrorCode ?? '']
                        ?? 'This connection needs attention. Replace the token to restore access.'}
                    </p>
                  )}

                  {actionState === 'validating' && (
                    <p className="font-body-sm text-body-sm text-secondary" data-testid="validating-indicator">
                      Validating…
                    </p>
                  )}
                  {isSyncing && (
                    <p className="font-body-sm text-body-sm text-secondary" data-testid="syncing-indicator">
                      Sync in progress…
                    </p>
                  )}

                  {actionError && (
                    <p className="font-body-sm text-body-sm text-error" role="alert">{actionError}</p>
                  )}

                  {!showRotateForm && (
                    <div className="flex flex-wrap gap-unit-sm mt-unit-2xs">
                      <button
                        className="h-9 px-unit-md rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer disabled:opacity-50"
                        disabled={isSyncing}
                        onClick={() => void handleSyncNow()}
                        type="button"
                      >
                        Sync Now
                      </button>
                      <button
                        className="h-9 px-unit-md rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer disabled:opacity-50"
                        disabled={actionState === 'validating'}
                        onClick={() => void handleValidate()}
                        type="button"
                      >
                        {actionState === 'validating' ? 'Validating…' : 'Validate'}
                      </button>
                      <button
                        className="h-9 px-unit-md rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                        onClick={() => setShowRotateForm(true)}
                        type="button"
                      >
                        Replace Token
                      </button>
                      <button
                        className="h-9 px-unit-md rounded-lg bg-error-container/40 text-on-error-container border border-error-container hover:bg-error hover:text-on-error shadow-micro font-label-md text-label-md cursor-pointer disabled:opacity-50"
                        disabled={actionState === 'disconnecting'}
                        onClick={() => void handleDisconnect()}
                        type="button"
                      >
                        {actionState === 'disconnecting' ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  )}

                  {showRotateForm && (
                    <form
                      className="flex flex-col gap-unit-sm max-w-md mt-unit-2xs"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleRotate();
                      }}
                    >
                      <label className="font-label-md text-label-md text-on-surface font-medium">
                        New Cloudflare API token
                      </label>
                      <TokenField
                        autoFocus
                        onChange={setTokenValue}
                        placeholder="Paste the replacement token"
                        value={tokenValue}
                      />
                      <div className="flex gap-unit-sm">
                        <button
                          className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
                          disabled={actionState === 'rotating' || tokenValue.length === 0}
                          type="submit"
                        >
                          {actionState === 'rotating' ? 'Replacing…' : 'Save replacement'}
                        </button>
                        <button
                          className="h-9 px-unit-lg rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                          onClick={() => {
                            setShowRotateForm(false);
                            clearToken();
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
