import type { ProviderConnectionAuthType } from './provider-connections.types';

const VISIBLE_SUFFIX_LENGTH = 4;
const MASK_PREFIX = '••••';
/**
 * Namecheap's credential is a JSON-encoded {apiUser, apiKey, userName,
 * clientIp} object (see namecheap-token-validator.ts), not a single opaque
 * secret -- its raw last-four characters would be a JSON tail like `3.4"}`,
 * not a meaningful masked secret. A fixed, generic mask is used instead so
 * no fragment of the credential shape is ever displayed. Phase 10I's three
 * cloud auth types are structured JSON bundles for the same reason (access
 * key + secret + regions; service-account project + key; tenant/client/
 * secret/subscription) and get the same fixed mask.
 */
const OPAQUE_CREDENTIAL_MASK = 'Configured';
const STRUCTURED_CREDENTIAL_AUTH_TYPES = new Set<ProviderConnectionAuthType>([
  'NAMECHEAP_API_KEY',
  'AWS_ACCESS_KEY',
  'GCP_SERVICE_ACCOUNT_KEY',
  'AZURE_CLIENT_CREDENTIALS',
]);

/**
 * Builds a display-only mask for a plaintext provider credential: a fixed
 * bullet prefix plus (at most) its last four characters. Never reversible,
 * never includes enough of the secret to reconstruct or narrow it further
 * than the API already allows through repeated attempts. Namecheap's
 * structured, non-single-string credential gets a fixed generic mask
 * instead (see OPAQUE_CREDENTIAL_MASK).
 */
export function buildCredentialMask(
  authType: ProviderConnectionAuthType,
  plaintext: string,
): string {
  if (STRUCTURED_CREDENTIAL_AUTH_TYPES.has(authType)) {
    return OPAQUE_CREDENTIAL_MASK;
  }
  const trimmed = plaintext.trim();
  if (trimmed.length <= VISIBLE_SUFFIX_LENGTH) {
    return MASK_PREFIX;
  }
  return `${MASK_PREFIX}${trimmed.slice(-VISIBLE_SUFFIX_LENGTH)}`;
}

export const DISCONNECTED_CREDENTIAL_MASK = 'Disconnected';
