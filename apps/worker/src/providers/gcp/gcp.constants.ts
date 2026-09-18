export const GCP_PROVIDER_KEY = 'gcp';
export const GCP_COMPUTE_INSTANCE_RESOURCE_TYPE = 'compute-instance';

export const GCP_OAUTH_TOKEN_ORIGIN = 'https://oauth2.googleapis.com';
export const GCP_OAUTH_TOKEN_PATH = '/token';
export const GCP_COMPUTE_API_ORIGIN = 'https://compute.googleapis.com';
export const GCP_COMPUTE_READONLY_SCOPE = 'https://www.googleapis.com/auth/compute.readonly';
export const GCP_JWT_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
export const GCP_JWT_LIFETIME_SECONDS = 3_600;

export const GCP_DEFAULT_TIMEOUT_MS = 10_000;
export const GCP_MAX_RESPONSE_BYTES = 5_000_000;
export const GCP_DEFAULT_PAGE_SIZE = 200;
export const GCP_DEFAULT_MAX_PAGES = 1_000;
export const GCP_MAX_CREDENTIAL_LENGTH = 32_768;

export const GCP_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u;

export interface GcpCredential {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly projectId: string;
}

export class InvalidGcpCredentialError extends Error {
  constructor() {
    super(
      'GCP credential must be JSON with projectId, clientEmail, and privateKey ' +
      '(the client_email/private_key fields of a downloaded service-account key)',
    );
    this.name = 'InvalidGcpCredentialError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/u;

/**
 * GCP credentials are a structured bundle: the project to inventory plus the
 * two fields of a downloaded service-account JSON key actually needed to
 * mint an OAuth access token (`client_email`, `private_key`). Every other
 * field in a real key file (private_key_id, client_id, token_uri, ...) is
 * deliberately not accepted -- in particular `token_uri` is never taken from
 * the credential: the token endpoint is always Google's fixed official
 * `https://oauth2.googleapis.com/token`, never a caller-supplied URL, so a
 * malicious/malformed key file can never redirect the token exchange
 * elsewhere (no SSRF surface). Stored as one JSON-encoded string, matching
 * every other structured provider credential (see AwsCredential,
 * NamecheapCredential).
 */
export function parseGcpCredential(raw: string): GcpCredential {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > GCP_MAX_CREDENTIAL_LENGTH) {
    throw new InvalidGcpCredentialError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidGcpCredentialError();
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new InvalidGcpCredentialError();
  }
  const { projectId, clientEmail, privateKey } = parsed as Record<string, unknown>;
  if (typeof projectId !== 'string' || !GCP_PROJECT_ID_PATTERN.test(projectId)) {
    throw new InvalidGcpCredentialError();
  }
  if (typeof clientEmail !== 'string' || !EMAIL_PATTERN.test(clientEmail)) {
    throw new InvalidGcpCredentialError();
  }
  if (
    typeof privateKey !== 'string' ||
    !privateKey.includes('BEGIN PRIVATE KEY') ||
    privateKey.length > 8_192
  ) {
    throw new InvalidGcpCredentialError();
  }
  return { clientEmail, privateKey, projectId };
}
