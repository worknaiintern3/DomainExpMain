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
  type ProviderConnectionAuthType,
  type ProviderConnectionResponse,
  type ProviderSyncRunResponse,
} from '@/api/provider-connections';

const SYNC_POLL_INTERVAL_MS = 3_000;
const SYNC_POLL_TIMEOUT_MS = 60_000;

const VALIDATION_ERROR_LABELS: Record<string, string> = {
  AUTH_INVALID: 'Authentication failed. The credential is invalid, disabled, or expired.',
  INVALID_REQUEST: 'The request to the provider was rejected as invalid.',
  NETWORK_TIMEOUT: 'The request to the provider timed out.',
  PERMISSION_DENIED: 'This credential does not have the required permissions.',
  RATE_LIMITED: 'The provider is rate-limiting requests. Try again shortly.',
  RESOURCE_NOT_FOUND: 'A required provider resource could not be found.',
  UNKNOWN_PROVIDER_ERROR: 'An unexpected error occurred while contacting the provider.',
  UPSTREAM_BAD_RESPONSE: 'The provider returned an unexpected response.',
  UPSTREAM_UNAVAILABLE: 'The provider is temporarily unavailable.',
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
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  value: string;
}

const TokenField: React.FC<TokenFieldProps> = ({ autoFocus, label, onChange, placeholder, testId, value }) => (
  <>
    <label className="font-label-md text-label-md text-on-surface font-medium">{label}</label>
    <input
      autoComplete="off"
      autoFocus={autoFocus}
      className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro w-full"
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      type="password"
      value={value}
    />
  </>
);

interface TextAreaFieldProps {
  autoFocus?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  value: string;
}

/** For structured-credential fields too long for a single-line password input (e.g. a PEM private key). Not natively masked -- there is no multi-line masked HTML input -- but, like TokenField, it is plain React state and is never written to browser storage. */
const TextAreaField: React.FC<TextAreaFieldProps> = ({ autoFocus, label, onChange, placeholder, testId, value }) => (
  <>
    <label className="font-label-md text-label-md text-on-surface font-medium">{label}</label>
    <textarea
      autoComplete="off"
      autoFocus={autoFocus}
      className="px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro w-full font-mono"
      data-testid={testId}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={5}
      spellCheck={false}
      value={value}
    />
  </>
);

/** A provider's connection credential is always sent to the backend as a single opaque string; see ProviderConfig.credentialShape. */
type NamecheapFields = { apiKey: string; apiUser: string; clientIp: string; userName: string };
const EMPTY_NAMECHEAP_FIELDS: NamecheapFields = { apiKey: '', apiUser: '', clientIp: '', userName: '' };

/**
 * Phase 10I's three cloud auth types (AWS/GCP/Azure) are, like Namecheap,
 * structured multi-field bundles rather than one opaque token -- but unlike
 * Namecheap's bespoke fixed-shape state, they share one generic
 * `structured` mechanism driven entirely by `ProviderConfig
 * .structuredFields`/`serializeStructured` so a new structured provider
 * never needs its own dedicated field-state type.
 */
interface StructuredFieldConfig {
  readonly key: string;
  readonly label: string;
  /** Fields the backend's credential shape allows to be blank (e.g. AWS's optional STS session token) never block the submit button and are omitted from the serialized JSON when empty. */
  readonly optional?: boolean;
  readonly placeholder: string;
  readonly rows?: 'single' | 'multi';
}

interface ProviderConfig {
  readonly authType: ProviderConnectionAuthType;
  readonly credentialShape: 'token' | 'namecheap' | 'structured';
  readonly displayName: string;
  readonly providerKey: string;
  readonly serializeStructured?: (values: Readonly<Record<string, string>>) => string;
  readonly structuredFields?: readonly StructuredFieldConfig[];
  readonly tokenLabel: string;
  readonly tokenPlaceholder: string;
}

function emptyStructuredValues(fields: readonly StructuredFieldConfig[] | undefined): Record<string, string> {
  return Object.fromEntries((fields ?? []).map((field) => [field.key, '']));
}

function structuredFieldsFilled(
  fields: readonly StructuredFieldConfig[] | undefined,
  values: Readonly<Record<string, string>>,
): boolean {
  return (fields ?? []).every((field) => field.optional || (values[field.key] ?? '').trim().length > 0);
}

function serializeAwsCredential(values: Readonly<Record<string, string>>): string {
  const sessionToken = (values.sessionToken ?? '').trim();
  return JSON.stringify({
    accessKeyId: values.accessKeyId,
    regions: (values.regions ?? '')
      .split(',')
      .map((region) => region.trim())
      .filter((region) => region.length > 0),
    secretAccessKey: values.secretAccessKey,
    ...(sessionToken.length > 0 ? { sessionToken } : {}),
  });
}

function serializeGcpCredential(values: Readonly<Record<string, string>>): string {
  return JSON.stringify({
    clientEmail: values.clientEmail,
    privateKey: values.privateKey,
    projectId: values.projectId,
  });
}

function serializeAzureCredential(values: Readonly<Record<string, string>>): string {
  return JSON.stringify({
    clientId: values.clientId,
    clientSecret: values.clientSecret,
    subscriptionId: values.subscriptionId,
    tenantId: values.tenantId,
  });
}

const PROVIDER_CONFIGS: readonly ProviderConfig[] = [
  {
    authType: 'CLOUDFLARE_API_TOKEN',
    credentialShape: 'token',
    displayName: 'Cloudflare',
    providerKey: 'cloudflare',
    tokenLabel: 'Cloudflare API token',
    tokenPlaceholder: 'Paste your Cloudflare API token',
  },
  {
    authType: 'GODADDY_PAT',
    credentialShape: 'token',
    displayName: 'GoDaddy',
    providerKey: 'godaddy',
    tokenLabel: 'GoDaddy Personal Access Token',
    tokenPlaceholder: 'Paste your GoDaddy PAT',
  },
  {
    authType: 'NAMECHEAP_API_KEY',
    credentialShape: 'namecheap',
    displayName: 'Namecheap',
    providerKey: 'namecheap',
    tokenLabel: 'Namecheap API credentials',
    tokenPlaceholder: '',
  },
  {
    authType: 'HOSTINGER_API_TOKEN',
    credentialShape: 'token',
    displayName: 'Hostinger',
    providerKey: 'hostinger',
    tokenLabel: 'Hostinger API token',
    tokenPlaceholder: 'Paste your Hostinger API token',
  },
  {
    authType: 'DIGITALOCEAN_API_TOKEN',
    credentialShape: 'token',
    displayName: 'DigitalOcean',
    providerKey: 'digitalocean',
    tokenLabel: 'DigitalOcean API token',
    tokenPlaceholder: 'Paste your DigitalOcean personal access token',
  },
  {
    authType: 'HETZNER_API_TOKEN',
    credentialShape: 'token',
    displayName: 'Hetzner',
    providerKey: 'hetzner',
    tokenLabel: 'Hetzner Cloud API token',
    tokenPlaceholder: 'Paste your Hetzner Cloud project API token',
  },
  {
    authType: 'VULTR_API_KEY',
    credentialShape: 'token',
    displayName: 'Vultr',
    providerKey: 'vultr',
    tokenLabel: 'Vultr API key',
    tokenPlaceholder: 'Paste your Vultr personal access token',
  },
  {
    authType: 'LINODE_API_TOKEN',
    credentialShape: 'token',
    displayName: 'Linode (Akamai)',
    providerKey: 'linode',
    tokenLabel: 'Linode API token',
    tokenPlaceholder: 'Paste your Linode personal access token',
  },
  {
    authType: 'AWS_ACCESS_KEY',
    credentialShape: 'structured',
    displayName: 'AWS',
    providerKey: 'aws',
    serializeStructured: serializeAwsCredential,
    structuredFields: [
      { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
      { key: 'secretAccessKey', label: 'Secret Access Key', placeholder: 'Paste your AWS secret access key' },
      { key: 'sessionToken', label: 'Session Token (optional)', optional: true, placeholder: 'Optional STS session token' },
      { key: 'regions', label: 'Regions to inventory (comma-separated)', placeholder: 'e.g. us-east-1, eu-west-1' },
    ],
    tokenLabel: '',
    tokenPlaceholder: '',
  },
  {
    authType: 'GCP_SERVICE_ACCOUNT_KEY',
    credentialShape: 'structured',
    displayName: 'Google Cloud',
    providerKey: 'gcp',
    serializeStructured: serializeGcpCredential,
    structuredFields: [
      { key: 'projectId', label: 'Project ID', placeholder: 'my-project-id' },
      { key: 'clientEmail', label: 'Service Account Email', placeholder: 'name@project.iam.gserviceaccount.com' },
      { key: 'privateKey', label: 'Service Account Private Key', placeholder: '-----BEGIN PRIVATE KEY-----', rows: 'multi' },
    ],
    tokenLabel: '',
    tokenPlaceholder: '',
  },
  {
    authType: 'AZURE_CLIENT_CREDENTIALS',
    credentialShape: 'structured',
    displayName: 'Azure',
    providerKey: 'azure',
    serializeStructured: serializeAzureCredential,
    structuredFields: [
      { key: 'tenantId', label: 'Tenant ID', placeholder: 'GUID' },
      { key: 'clientId', label: 'Client (Application) ID', placeholder: 'GUID' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'Paste your client secret' },
      { key: 'subscriptionId', label: 'Subscription ID', placeholder: 'GUID' },
    ],
    tokenLabel: '',
    tokenPlaceholder: '',
  },
];

/** Serializes the four Namecheap fields into the exact JSON credential shape the backend NamecheapTokenValidator/NamecheapAdapter expect. Never persisted; built only at submit time from in-memory React state. */
function serializeNamecheapCredential(fields: NamecheapFields): string {
  return JSON.stringify({
    apiKey: fields.apiKey,
    apiUser: fields.apiUser,
    clientIp: fields.clientIp,
    userName: fields.userName,
  });
}

function namecheapFieldsFilled(fields: NamecheapFields): boolean {
  return Object.values(fields).every((value) => value.trim().length > 0);
}

const ProviderConnectionCard: React.FC<{ config: ProviderConfig }> = ({ config }) => {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ProviderConnectionResponse | null>(null);
  const [latestRun, setLatestRun] = useState<ProviderSyncRunResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showRotateForm, setShowRotateForm] = useState(false);
  const [tokenValue, setTokenValue] = useState('');
  const [namecheapFields, setNamecheapFields] = useState<NamecheapFields>(EMPTY_NAMECHEAP_FIELDS);
  const [structuredValues, setStructuredValues] = useState<Record<string, string>>(() =>
    emptyStructuredValues(config.structuredFields),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    'idle' | 'connecting' | 'validating' | 'rotating' | 'disconnecting'
  >('idle');

  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [extraConnections, setExtraConnections] = useState<ProviderConnectionResponse[]>([]);
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [addAccountLabel, setAddAccountLabel] = useState('');
  const [rotatingExtraId, setRotatingExtraId] = useState<string | null>(null);
  const [extraActionError, setExtraActionError] = useState<Record<string, string | null>>({});
  const [extraSyncing, setExtraSyncing] = useState<Record<string, boolean>>({});
  const [extraValidating, setExtraValidating] = useState<Record<string, boolean>>({});
  const [extraDisconnecting, setExtraDisconnecting] = useState<Record<string, boolean>>({});
  const [addAccountError, setAddAccountError] = useState<string | null>(null);

  const clearCredentialInputs = useCallback(() => {
    setTokenValue('');
    setNamecheapFields(EMPTY_NAMECHEAP_FIELDS);
    setStructuredValues(emptyStructuredValues(config.structuredFields));
  }, [config.structuredFields]);

  const buildCredential = useCallback(() => {
    if (config.credentialShape === 'namecheap') return serializeNamecheapCredential(namecheapFields);
    if (config.credentialShape === 'structured') return config.serializeStructured?.(structuredValues) ?? '';
    return tokenValue;
  }, [config, namecheapFields, structuredValues, tokenValue]);
  const credentialReady =
    config.credentialShape === 'namecheap'
      ? namecheapFieldsFilled(namecheapFields)
      : config.credentialShape === 'structured'
        ? structuredFieldsFilled(config.structuredFields, structuredValues)
        : tokenValue.length > 0;

  const load = useCallback(async (signal?: AbortSignal) => {
    const { items } = await listProviderConnections(signal);
    const matches = items.filter((c) => c.providerType === config.providerKey);
    const active = matches.filter((c) => c.connectionStatus === 'CONNECTED');
    if (signal?.aborted) return;
    if (active.length > 0) {
      setConnection(active[0] ?? null);
      setExtraConnections(active.slice(1));
      const { items: runs } = await listProviderConnectionSyncRuns(active[0].id, 1, signal);
      if (signal?.aborted) return;
      setLatestRun(runs[0] ?? null);
    } else {
      setConnection(matches[0] ?? null);
      setExtraConnections([]);
      setLatestRun(null);
    }
  }, [config.providerKey]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(safeErrorMessage(error, 'Failed to load this integration.'));
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

  async function resolveProviderAccountId(): Promise<string> {
    const { items } = await listProviderAccounts();
    const existing = items.find((account) => account.providerKey === config.providerKey);
    if (existing) return existing.id;
    const created = await createProviderAccount({ label: config.displayName, providerKey: config.providerKey });
    return created.id;
  }

  async function handleConnect(customLabel?: string): Promise<void> {
    const credential = buildCredential();
    const isAdditional = showAddAccountForm;
    if (isAdditional) {
      setAddAccountError(null);
    } else {
      setActionError(null);
    }
    setActionState('connecting');
    try {
      let providerAccountId: string;
      if (customLabel && customLabel.trim().length > 0) {
        const created = await createProviderAccount({ label: customLabel.trim(), providerKey: config.providerKey });
        providerAccountId = created.id;
      } else {
        providerAccountId = await resolveProviderAccountId();
      }
      const created = await createProviderConnection({ authType: config.authType, credential, providerAccountId });
      if (!connection || connection.connectionStatus === 'DISCONNECTED') {
        setConnection(created);
      } else {
        setExtraConnections((prev) => [...prev, created]);
      }
      setShowConnectForm(false);
      setShowAddAccountForm(false);
      setAddAccountLabel('');
      setAddAccountError(null);
      clearCredentialInputs();
    } catch (error) {
      const errorMsg = safeErrorMessage(error, `Could not connect to ${config.displayName}.`);
      if (isAdditional) {
        setAddAccountError(errorMsg);
      } else {
        setActionError(errorMsg);
      }
    } finally {
      setActionState('idle');
    }
  }

  async function handleValidate(targetId?: string): Promise<void> {
    const id = targetId ?? connection?.id;
    if (!id) return;
    const isPrimary = !targetId || targetId === connection?.id;
    if (isPrimary) {
      setActionError(null);
      setActionState('validating');
    } else {
      setExtraActionError((prev) => ({ ...prev, [id]: null }));
      setExtraValidating((prev) => ({ ...prev, [id]: true }));
    }
    try {
      await validateProviderConnection(id);
      const { items } = await listProviderConnections();
      if (isPrimary) {
        setConnection(items.find((c) => c.id === id) ?? null);
      } else {
        setExtraConnections((prev) => prev.map((c) => (c.id === id ? items.find((item) => item.id === id) ?? c : c)));
      }
    } catch (error) {
      const errorMsg = safeErrorMessage(error, 'Validation failed.');
      if (isPrimary) setActionError(errorMsg);
      else setExtraActionError((prev) => ({ ...prev, [id]: errorMsg }));
    } finally {
      if (isPrimary) setActionState('idle');
      else setExtraValidating((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleRotate(targetId?: string): Promise<void> {
    const id = targetId ?? connection?.id;
    if (!id) return;
    const isPrimary = !targetId || targetId === connection?.id;
    const credential = buildCredential();
    if (isPrimary) {
      setActionError(null);
      setActionState('rotating');
    } else {
      setExtraActionError((prev) => ({ ...prev, [id]: null }));
    }
    try {
      const updated = await replaceProviderConnectionCredential(id, credential);
      if (isPrimary) {
        setConnection(updated);
        setShowRotateForm(false);
      } else {
        setExtraConnections((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setRotatingExtraId(null);
      }
    } catch (error) {
      const errorMsg = safeErrorMessage(error, 'Could not replace the credential.');
      if (isPrimary) setActionError(errorMsg);
      else setExtraActionError((prev) => ({ ...prev, [id]: errorMsg }));
    } finally {
      clearCredentialInputs();
      if (isPrimary) setActionState('idle');
    }
  }

  async function handleSyncNow(targetId?: string): Promise<void> {
    const id = targetId ?? connection?.id;
    if (!id) return;
    const isPrimary = !targetId || targetId === connection?.id;
    if (isPrimary) {
      setActionError(null);
    } else {
      setExtraActionError((prev) => ({ ...prev, [id]: null }));
      setExtraSyncing((prev) => ({ ...prev, [id]: true }));
    }
    try {
      const idempotencyKey = crypto.randomUUID();
      await triggerProviderConnectionSync(id, idempotencyKey);
      const { items: runs } = await listProviderConnectionSyncRuns(id, 1);
      if (isPrimary) {
        setLatestRun(runs[0] ?? null);
        pollUntilSettled(id, Date.now() + SYNC_POLL_TIMEOUT_MS);
      } else {
        const deadline = Date.now() + SYNC_POLL_TIMEOUT_MS;
        const pollExtra = (attemptDeadline: number) => {
          setTimeout(() => {
            void (async () => {
              try {
                const { items: latestRuns } = await listProviderConnectionSyncRuns(id, 1);
                const run = latestRuns[0] ?? null;
                const stillRunning = run?.status === 'QUEUED' || run?.status === 'RUNNING';
                if (stillRunning && Date.now() < attemptDeadline) {
                  pollExtra(attemptDeadline);
                } else {
                  setExtraSyncing((prev) => ({ ...prev, [id]: false }));
                  const { items: allConns } = await listProviderConnections();
                  const updatedExtra = allConns.find((c) => c.id === id);
                  if (updatedExtra) {
                    setExtraConnections((prev) => prev.map((c) => (c.id === id ? updatedExtra : c)));
                  }
                }
              } catch {
                setExtraSyncing((prev) => ({ ...prev, [id]: false }));
              }
            })();
          }, SYNC_POLL_INTERVAL_MS);
        };
        pollExtra(deadline);
      }
    } catch (error) {
      const errorMsg = safeErrorMessage(error, 'Could not queue a sync.');
      if (isPrimary) {
        setActionError(errorMsg);
      } else {
        setExtraActionError((prev) => ({ ...prev, [id]: errorMsg }));
        setExtraSyncing((prev) => ({ ...prev, [id]: false }));
      }
    }
  }

  async function handleDisconnect(targetId?: string): Promise<void> {
    const id = targetId ?? connection?.id;
    if (!id) return;
    const isPrimary = !targetId || targetId === connection?.id;
    if (isPrimary) {
      setActionError(null);
      setActionState('disconnecting');
    } else {
      setExtraActionError((prev) => ({ ...prev, [id]: null }));
      setExtraDisconnecting((prev) => ({ ...prev, [id]: true }));
    }
    try {
      await disconnectProviderConnection(id);
      if (isPrimary) {
        const { items } = await listProviderConnections();
        setConnection(items.find((c) => c.id === id) ?? null);
        setLatestRun(null);
      } else {
        setExtraConnections((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      const errorMsg = safeErrorMessage(error, 'Could not disconnect.');
      if (isPrimary) setActionError(errorMsg);
      else setExtraActionError((prev) => ({ ...prev, [id]: errorMsg }));
    } finally {
      if (isPrimary) setActionState('idle');
      else setExtraDisconnecting((prev) => ({ ...prev, [id]: false }));
    }
  }

  const credentialFields = (autoFocus: boolean) =>
    config.credentialShape === 'namecheap' ? (
      <>
        <TokenField
          autoFocus={autoFocus}
          label="API User"
          onChange={(value) => setNamecheapFields((prev) => ({ ...prev, apiUser: value }))}
          placeholder="Namecheap account username"
          testId={`${config.providerKey}-namecheap-api-user`}
          value={namecheapFields.apiUser}
        />
        <TokenField
          label="API Key"
          onChange={(value) => setNamecheapFields((prev) => ({ ...prev, apiKey: value }))}
          placeholder="Namecheap API key"
          testId={`${config.providerKey}-namecheap-api-key`}
          value={namecheapFields.apiKey}
        />
        <TokenField
          label="Username"
          onChange={(value) => setNamecheapFields((prev) => ({ ...prev, userName: value }))}
          placeholder="Namecheap account username"
          testId={`${config.providerKey}-namecheap-username`}
          value={namecheapFields.userName}
        />
        <TokenField
          label="Whitelisted Client IP"
          onChange={(value) => setNamecheapFields((prev) => ({ ...prev, clientIp: value }))}
          placeholder="e.g. 203.0.113.10"
          testId={`${config.providerKey}-namecheap-client-ip`}
          value={namecheapFields.clientIp}
        />
      </>
    ) : config.credentialShape === 'structured' ? (
      <>
        {(config.structuredFields ?? []).map((field, index) =>
          field.rows === 'multi' ? (
            <TextAreaField
              autoFocus={autoFocus && index === 0}
              key={field.key}
              label={field.label}
              onChange={(value) => setStructuredValues((prev) => ({ ...prev, [field.key]: value }))}
              placeholder={field.placeholder}
              testId={`${config.providerKey}-${field.key}-input`}
              value={structuredValues[field.key] ?? ''}
            />
          ) : (
            <TokenField
              autoFocus={autoFocus && index === 0}
              key={field.key}
              label={field.label}
              onChange={(value) => setStructuredValues((prev) => ({ ...prev, [field.key]: value }))}
              placeholder={field.placeholder}
              testId={`${config.providerKey}-${field.key}-input`}
              value={structuredValues[field.key] ?? ''}
            />
          ),
        )}
      </>
    ) : (
      <TokenField
        autoFocus={autoFocus}
        label={config.tokenLabel}
        onChange={setTokenValue}
        placeholder={config.tokenPlaceholder}
        testId={`${config.providerKey}-token-input`}
        value={tokenValue}
      />
    );

  return (
    <div
      className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-md"
      data-testid={`${config.providerKey}-integration-card`}
    >
      <div className="flex items-center justify-between gap-unit-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-on-surface">cloud</span>
          <span className="font-label-lg text-label-lg text-on-surface font-semibold">{config.displayName}</span>
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

      {loading && <p className="font-body-sm text-body-sm text-secondary mt-unit-md">Loading…</p>}
      {!loading && loadError && (
        <p className="font-body-sm text-body-sm text-error mt-unit-md" role="alert">{loadError}</p>
      )}

      {!loading && !loadError && (!connection || connection.connectionStatus === 'DISCONNECTED') && (
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
              {credentialFields(true)}
              <div className="flex gap-unit-sm">
                <button
                  className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
                  disabled={actionState === 'connecting' || !credentialReady}
                  type="submit"
                >
                  {actionState === 'connecting' ? 'Connecting…' : 'Save and connect'}
                </button>
                <button
                  className="h-9 px-unit-lg rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                  onClick={() => {
                    setShowConnectForm(false);
                    clearCredentialInputs();
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

      {!loading && !loadError && connection && connection.connectionStatus === 'CONNECTED' && (
        <div className="mt-unit-md flex flex-col gap-unit-sm">
          {extraConnections.length > 0 && (
            <div className="text-caption-xs font-semibold text-primary uppercase tracking-wider">
              {connection.providerAccountLabel || `${config.displayName} (Primary)`}
            </div>
          )}
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
                ?? 'This connection needs attention. Replace the credential to restore access.'}
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
                Replace Credential
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
              {credentialFields(true)}
              <div className="flex gap-unit-sm">
                <button
                  className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
                  disabled={actionState === 'rotating' || !credentialReady}
                  type="submit"
                >
                  {actionState === 'rotating' ? 'Replacing…' : 'Save replacement'}
                </button>
                <button
                  className="h-9 px-unit-lg rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                  onClick={() => {
                    setShowRotateForm(false);
                    clearCredentialInputs();
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Secondary / additional accounts for this provider */}
          {extraConnections.map((extra) => (
            <div
              key={extra.id}
              className="mt-4 pt-4 border-t border-outline-variant/30 flex flex-col gap-unit-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  {extra.providerAccountLabel || `${config.displayName} (Additional)`}
                </span>
                <span
                  className={`font-caption-xs text-caption-xs px-2 py-0.5 rounded-full border ${
                    extra.validationStatus === 'VALID'
                      ? 'border-primary/40 text-primary'
                      : 'border-error/40 text-error'
                  }`}
                >
                  {extra.validationStatus === 'VALID' ? 'Connected' : 'Attention needed'}
                </span>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-unit-md gap-y-1 font-body-sm text-body-sm">
                <div className="flex justify-between sm:block">
                  <dt className="text-secondary">Credential</dt>
                  <dd className="text-on-surface font-mono">{extra.credentialMask}</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-secondary">Last validated</dt>
                  <dd className="text-on-surface">{formatTimestamp(extra.lastValidatedAt)}</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-secondary">Last sync</dt>
                  <dd className="text-on-surface">{formatTimestamp(extra.lastSyncAt)}</dd>
                </div>
                <div className="flex justify-between sm:block">
                  <dt className="text-secondary">Next sync</dt>
                  <dd className="text-on-surface">{formatTimestamp(extra.nextSyncAt)}</dd>
                </div>
              </dl>

              {extraSyncing[extra.id] && (
                <p className="font-body-sm text-body-sm text-secondary">
                  Sync in progress…
                </p>
              )}

              {extraActionError[extra.id] && (
                <p className="font-body-sm text-body-sm text-error" role="alert">
                  {extraActionError[extra.id]}
                </p>
              )}

              {rotatingExtraId !== extra.id ? (
                <div className="flex flex-wrap gap-unit-sm mt-unit-2xs">
                  <button
                    className="h-8 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro text-[12px] font-medium cursor-pointer disabled:opacity-50"
                    disabled={extraSyncing[extra.id]}
                    onClick={() => void handleSyncNow(extra.id)}
                    type="button"
                  >
                    Sync Now
                  </button>
                  <button
                    className="h-8 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro text-[12px] font-medium cursor-pointer disabled:opacity-50"
                    disabled={extraValidating[extra.id]}
                    onClick={() => void handleValidate(extra.id)}
                    type="button"
                  >
                    {extraValidating[extra.id] ? 'Validating…' : 'Validate'}
                  </button>
                  <button
                    className="h-8 px-unit-sm rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro text-[12px] font-medium cursor-pointer"
                    onClick={() => setRotatingExtraId(extra.id)}
                    type="button"
                  >
                    Replace Credential
                  </button>
                  <button
                    className="h-8 px-unit-sm rounded-lg bg-error-container/40 text-on-error-container border border-error-container hover:bg-error hover:text-on-error shadow-micro text-[12px] font-medium cursor-pointer disabled:opacity-50"
                    disabled={extraDisconnecting[extra.id]}
                    onClick={() => void handleDisconnect(extra.id)}
                    type="button"
                  >
                    {extraDisconnecting[extra.id] ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <form
                  className="flex flex-col gap-unit-sm max-w-md mt-unit-2xs"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleRotate(extra.id);
                  }}
                >
                  {credentialFields(true)}
                  <div className="flex gap-unit-sm">
                    <button
                      className="h-8 px-unit-md rounded-lg bg-primary text-on-primary text-[12px] font-medium hover:bg-tertiary transition-colors shadow-micro cursor-pointer disabled:opacity-50"
                      disabled={actionState === 'rotating' || !credentialReady}
                      type="submit"
                    >
                      Save replacement
                    </button>
                    <button
                      className="h-8 px-unit-md rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro text-[12px] cursor-pointer"
                      onClick={() => {
                        setRotatingExtraId(null);
                        clearCredentialInputs();
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}

          {/* Add Another Account button & form */}
          {!showAddAccountForm ? (
            <div className="mt-3 pt-3 border-t border-outline-variant/20">
              <button
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-tertiary transition-colors cursor-pointer"
                onClick={() => setShowAddAccountForm(true)}
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add another {config.displayName} account
              </button>
            </div>
          ) : (
            <form
              className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col gap-unit-sm max-w-md"
              onSubmit={(event) => {
                event.preventDefault();
                void handleConnect(addAccountLabel);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  Connect additional {config.displayName} account
                </span>
              </div>
              <label className="font-label-md text-label-md text-on-surface font-medium">
                Account Label (optional)
              </label>
              <input
                className="h-9 px-3 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm border border-outline-variant/40 focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary shadow-micro w-full"
                onChange={(e) => setAddAccountLabel(e.target.value)}
                placeholder={`e.g. ${config.displayName} - Account ${extraConnections.length + 2}`}
                type="text"
                value={addAccountLabel}
              />
              {credentialFields(false)}
              {addAccountError && (
                <p className="font-body-sm text-body-sm text-error" role="alert">
                  {addAccountError}
                </p>
              )}
              <div className="flex gap-unit-sm mt-1">
                <button
                  className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium disabled:opacity-50"
                  disabled={actionState === 'connecting' || !credentialReady}
                  type="submit"
                >
                  {actionState === 'connecting' ? 'Connecting…' : 'Save and connect'}
                </button>
                <button
                  className="h-9 px-unit-lg rounded-lg bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container-low shadow-micro font-label-md text-label-md cursor-pointer"
                  onClick={() => {
                    setShowAddAccountForm(false);
                    setAddAccountLabel('');
                    setAddAccountError(null);
                    clearCredentialInputs();
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
  );
};

export const IntegrationsTab: React.FC = () => (
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

      <div className="mt-unit-md flex flex-col gap-unit-md">
        {PROVIDER_CONFIGS.map((config) => (
          <ProviderConnectionCard config={config} key={config.providerKey} />
        ))}
      </div>
    </div>
  </section>
);
