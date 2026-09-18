/**
 * Versioned AES-256-GCM envelope parameters for provider credentials.
 *
 * Keys are supplied through the environment (never generated at startup and
 * never stored in PostgreSQL). Each stored row records the key version that
 * encrypted it so rotated keys remain decryptable.
 */
export const PROVIDER_CREDENTIAL_KEY_BYTES = 32;
export const PROVIDER_CREDENTIAL_IV_BYTES = 12;
export const PROVIDER_CREDENTIAL_AUTH_TAG_BYTES = 16;
/** Maximum UTF-8 bytes accepted for a plaintext credential. */
export const PROVIDER_CREDENTIAL_MAX_PLAINTEXT_BYTES = 4_096;
/** Highest key version accepted while scanning versioned key variables. */
export const PROVIDER_CREDENTIAL_MAX_KEY_VERSION = 10;
/** Prefix that versions the additional authenticated data format. */
export const PROVIDER_CREDENTIAL_AAD_PREFIX = 'provider-connection/v1';
