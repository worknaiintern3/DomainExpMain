export const AZURE_PROVIDER_KEY = 'azure';
export const AZURE_VIRTUAL_MACHINE_RESOURCE_TYPE = 'virtual-machine';

export const AZURE_LOGIN_ORIGIN = 'https://login.microsoftonline.com';
export const AZURE_MANAGEMENT_ORIGIN = 'https://management.azure.com';
export const AZURE_MANAGEMENT_SCOPE = 'https://management.azure.com/.default';
/** A real, current Compute Resource Provider API version (Microsoft.Compute virtualMachines list-all). */
export const AZURE_COMPUTE_API_VERSION = '2024-07-01';

export const AZURE_DEFAULT_TIMEOUT_MS = 10_000;
export const AZURE_MAX_RESPONSE_BYTES = 5_000_000;
export const AZURE_DEFAULT_MAX_PAGES = 1_000;
export const AZURE_MAX_CREDENTIAL_LENGTH = 4_096;

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export interface AzureCredential {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly subscriptionId: string;
  readonly tenantId: string;
}

export class InvalidAzureCredentialError extends Error {
  constructor() {
    super(
      'Azure credential must be JSON with tenantId, clientId, clientSecret, and ' +
      'subscriptionId (all four are required for the app-only client-credentials flow)',
    );
    this.name = 'InvalidAzureCredentialError';
  }
}

/**
 * Azure credentials are a structured bundle: the four values a service
 * principal's app-only "client credentials" OAuth2 grant requires
 * (tenantId, clientId, clientSecret) plus the subscription to inventory.
 * Stored as one JSON-encoded string, matching every other structured
 * provider credential (see AwsCredential, GcpCredential, NamecheapCredential).
 */
export function parseAzureCredential(raw: string): AzureCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > AZURE_MAX_CREDENTIAL_LENGTH) {
    throw new InvalidAzureCredentialError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidAzureCredentialError();
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidAzureCredentialError();
  }
  const { tenantId, clientId, clientSecret, subscriptionId } = parsed as Record<string, unknown>;
  if (typeof tenantId !== 'string' || !GUID_PATTERN.test(tenantId)) {
    throw new InvalidAzureCredentialError();
  }
  if (typeof clientId !== 'string' || !GUID_PATTERN.test(clientId)) {
    throw new InvalidAzureCredentialError();
  }
  if (typeof subscriptionId !== 'string' || !GUID_PATTERN.test(subscriptionId)) {
    throw new InvalidAzureCredentialError();
  }
  if (typeof clientSecret !== 'string' || clientSecret.trim().length === 0 || clientSecret.length > 512) {
    throw new InvalidAzureCredentialError();
  }
  return { clientId, clientSecret, subscriptionId, tenantId };
}
