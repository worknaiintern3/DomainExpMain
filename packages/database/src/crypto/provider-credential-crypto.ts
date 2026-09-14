import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

import {
  PROVIDER_CREDENTIAL_AAD_PREFIX,
  PROVIDER_CREDENTIAL_AUTH_TAG_BYTES,
  PROVIDER_CREDENTIAL_IV_BYTES,
  PROVIDER_CREDENTIAL_KEY_BYTES,
  PROVIDER_CREDENTIAL_MAX_KEY_VERSION,
  PROVIDER_CREDENTIAL_MAX_PLAINTEXT_BYTES,
} from './provider-credential-crypto.constants';

export class ProviderCredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderCredentialCryptoError';
  }
}

export interface ProviderCredentialKeyStore {
  readonly activeVersion: number;
  readonly keys: ReadonlyMap<number, Buffer>;
}

export interface EncryptedProviderCredential {
  readonly authTagBase64: string;
  readonly ciphertextBase64: string;
  readonly ivBase64: string;
  readonly keyVersion: number;
}

export interface ProviderCredentialIdentity {
  readonly connectionId: string;
  readonly workspaceId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** 32 bytes encode to exactly 44 standard-base64 characters ending in '='. */
const KEY_BASE64_PATTERN = /^[A-Za-z0-9+/]{43}=$/u;

function keyVariableName(version: number): string {
  return `PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V${String(version)}`;
}

function decodeKeyVariable(value: string): Buffer {
  if (!KEY_BASE64_PATTERN.test(value)) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential encryption configuration',
    );
  }

  const decoded = Buffer.from(value, 'base64');
  if (
    decoded.length !== PROVIDER_CREDENTIAL_KEY_BYTES ||
    decoded.toString('base64') !== value
  ) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential encryption configuration',
    );
  }

  return decoded;
}

/**
 * Parses versioned AES keys from the environment.
 *
 * Requires `PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION` (defaults to 1)
 * and every `PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V<n>` for 1..active so rows
 * encrypted under older keys remain decryptable after rotation. Key material
 * is held in process memory only and must never be logged or persisted.
 */
export function parseProviderCredentialEncryptionEnvironment(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ProviderCredentialKeyStore {
  const rawActive = environment.PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION;
  const activeVersion =
    rawActive === undefined || rawActive === '' ? 1 : Number(rawActive);

  if (
    !Number.isInteger(activeVersion) ||
    activeVersion < 1 ||
    activeVersion > PROVIDER_CREDENTIAL_MAX_KEY_VERSION
  ) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential encryption configuration',
    );
  }

  const keys = new Map<number, Buffer>();
  for (let version = 1; version <= activeVersion; version += 1) {
    const variableName = keyVariableName(version);
    const value = environment[variableName];
    if (typeof value !== 'string' || value.length === 0) {
      throw new ProviderCredentialCryptoError(
        'Invalid provider credential encryption configuration',
      );
    }
    keys.set(version, decodeKeyVariable(value));
  }

  return { activeVersion, keys };
}

/**
 * Binds the envelope to exactly one workspace connection and key version so a
 * row copied across workspaces, connections, or rotations fails authentication.
 */
export function buildProviderCredentialAad(
  identity: ProviderCredentialIdentity,
  keyVersion: number,
): Buffer {
  if (
    !UUID_PATTERN.test(identity.workspaceId) ||
    !UUID_PATTERN.test(identity.connectionId) ||
    !Number.isInteger(keyVersion) ||
    keyVersion < 1
  ) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential identity',
    );
  }

  return Buffer.from(
    `${PROVIDER_CREDENTIAL_AAD_PREFIX}:${identity.workspaceId}:${identity.connectionId}:${String(keyVersion)}`,
    'utf8',
  );
}

function getKey(
  keys: ProviderCredentialKeyStore,
  keyVersion: number,
): Buffer {
  const key = keys.keys.get(keyVersion);
  if (!key) {
    throw new ProviderCredentialCryptoError(
      'Unknown provider credential key version',
    );
  }
  return key;
}

function assertPlaintext(plaintext: string): void {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential input',
    );
  }
  if (
    Buffer.byteLength(plaintext, 'utf8') >
    PROVIDER_CREDENTIAL_MAX_PLAINTEXT_BYTES
  ) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential input',
    );
  }
}

/**
 * Encrypts a provider credential under the active key version.
 *
 * Returns only base64 envelope fields for storage. The plaintext must never be
 * logged or persisted; callers keep decrypted values in memory only during
 * validation/sync.
 */
export function encryptProviderCredential(
  plaintext: string,
  identity: ProviderCredentialIdentity,
  keys: ProviderCredentialKeyStore,
): EncryptedProviderCredential {
  assertPlaintext(plaintext);
  const key = getKey(keys, keys.activeVersion);
  const aad = buildProviderCredentialAad(identity, keys.activeVersion);
  const iv = randomBytes(PROVIDER_CREDENTIAL_IV_BYTES);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  if (
    iv.length !== PROVIDER_CREDENTIAL_IV_BYTES ||
    authTag.length !== PROVIDER_CREDENTIAL_AUTH_TAG_BYTES
  ) {
    throw new ProviderCredentialCryptoError(
      'Provider credential encryption failed',
    );
  }

  return {
    authTagBase64: authTag.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    ivBase64: iv.toString('base64'),
    keyVersion: keys.activeVersion,
  };
}

function decodeEnvelopeField(value: string, field: string): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential envelope',
    );
  }
  let decoded: Buffer;
  try {
    decoded = Buffer.from(value, 'base64');
  } catch {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential envelope',
    );
  }
  if (decoded.length === 0 || decoded.toString('base64') !== value) {
    throw new ProviderCredentialCryptoError(
      `Invalid provider credential envelope: ${field}`,
    );
  }
  return decoded;
}

/**
 * Decrypts an envelope selected by its own recorded key version, so rows
 * encrypted before rotation remain readable while the active version moves on.
 * All failures surface as a single sanitized error without secret material.
 */
export function decryptProviderCredential(
  envelope: EncryptedProviderCredential,
  identity: ProviderCredentialIdentity,
  keys: ProviderCredentialKeyStore,
): string {
  if (!Number.isInteger(envelope.keyVersion)) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential envelope',
    );
  }
  const key = getKey(keys, envelope.keyVersion);
  const aad = buildProviderCredentialAad(identity, envelope.keyVersion);
  const iv = decodeEnvelopeField(envelope.ivBase64, 'iv');
  const authTag = decodeEnvelopeField(envelope.authTagBase64, 'authTag');
  const ciphertext = decodeEnvelopeField(
    envelope.ciphertextBase64,
    'ciphertext',
  );

  if (
    iv.length !== PROVIDER_CREDENTIAL_IV_BYTES ||
    authTag.length !== PROVIDER_CREDENTIAL_AUTH_TAG_BYTES ||
    ciphertext.length === 0
  ) {
    throw new ProviderCredentialCryptoError(
      'Invalid provider credential envelope',
    );
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new ProviderCredentialCryptoError(
      'Provider credential decryption failed',
    );
  }
}
