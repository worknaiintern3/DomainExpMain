import { randomBytes, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  decryptProviderCredential,
  encryptProviderCredential,
  parseProviderCredentialEncryptionEnvironment,
  PROVIDER_CREDENTIAL_AUTH_TAG_BYTES,
  PROVIDER_CREDENTIAL_IV_BYTES,
  ProviderCredentialCryptoError,
  type EncryptedProviderCredential,
  type ProviderCredentialIdentity,
  type ProviderCredentialKeyStore,
} from '@domainpulse/database';

const TEST_CREDENTIAL = 'cf-test-token-unit-only-not-a-real-secret';

function generateKeyBase64(): string {
  return randomBytes(32).toString('base64');
}

function createIdentity(): ProviderCredentialIdentity {
  return { connectionId: randomUUID(), workspaceId: randomUUID() };
}

function createKeyStore(versionCount = 1): {
  readonly environment: Record<string, string>;
  readonly keys: readonly string[];
  readonly store: ProviderCredentialKeyStore;
} {
  const keys = Array.from({ length: versionCount }, () => generateKeyBase64());
  const environment: Record<string, string> = {};
  keys.forEach((key, index) => {
    environment[`PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V${String(index + 1)}`] = key;
  });
  if (versionCount > 1) {
    environment.PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION = String(versionCount);
  }
  return {
    environment,
    keys,
    store: parseProviderCredentialEncryptionEnvironment(environment),
  };
}

function requiredEnvValue(value: string | undefined): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Test setup is missing a generated key');
  }
  return value;
}

describe('provider credential AES-256-GCM envelope', () => {
  it('round-trips a credential under the active version', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();
    const envelope = encryptProviderCredential(TEST_CREDENTIAL, identity, store);

    expect(envelope.keyVersion).toBe(1);
    expect(Buffer.from(envelope.ivBase64, 'base64')).toHaveLength(
      PROVIDER_CREDENTIAL_IV_BYTES,
    );
    expect(Buffer.from(envelope.authTagBase64, 'base64')).toHaveLength(
      PROVIDER_CREDENTIAL_AUTH_TAG_BYTES,
    );
    expect(envelope.ciphertextBase64).not.toContain(TEST_CREDENTIAL);
    expect(decryptProviderCredential(envelope, identity, store)).toBe(
      TEST_CREDENTIAL,
    );
  });

  it('accepts short plaintext down to a single byte', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();

    for (const plaintext of ['x', 'short-token', '123456789012345']) {
      const envelope = encryptProviderCredential(plaintext, identity, store);
      // Mirrors the provider_connections ciphertext CHECK: base64 alphabet with
      // length 4..8192. One plaintext byte yields one ciphertext byte (4 chars),
      // so the previous minimum of 24 wrongly rejected credentials under 16 bytes.
      expect(envelope.ciphertextBase64).toMatch(/^[A-Za-z0-9+/]+={0,2}$/u);
      expect(envelope.ciphertextBase64.length).toBeGreaterThanOrEqual(4);
      expect(envelope.ciphertextBase64.length).toBeLessThanOrEqual(8_192);
      expect(decryptProviderCredential(envelope, identity, store)).toBe(
        plaintext,
      );
    }
  });

  it('generates a fresh IV for every encryption', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();
    const first = encryptProviderCredential(TEST_CREDENTIAL, identity, store);
    const second = encryptProviderCredential(TEST_CREDENTIAL, identity, store);

    expect(first.ivBase64).not.toBe(second.ivBase64);
    expect(first.ciphertextBase64).not.toBe(second.ciphertextBase64);
  });

  it('binds the envelope to workspace, connection, and key version', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();
    const envelope = encryptProviderCredential(TEST_CREDENTIAL, identity, store);

    const wrongWorkspace: ProviderCredentialIdentity = {
      ...identity,
      workspaceId: randomUUID(),
    };
    const wrongConnection: ProviderCredentialIdentity = {
      ...identity,
      connectionId: randomUUID(),
    };
    const wrongVersion: EncryptedProviderCredential = {
      ...envelope,
      keyVersion: 2,
    };

    for (const attempt of [
      () => decryptProviderCredential(envelope, wrongWorkspace, store),
      () => decryptProviderCredential(envelope, wrongConnection, store),
      () => decryptProviderCredential(wrongVersion, identity, store),
    ]) {
      let message = '';
      try {
        attempt();
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderCredentialCryptoError);
        message = (error as Error).message;
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(TEST_CREDENTIAL);
      expect(message).not.toContain(envelope.ciphertextBase64);
    }
  });

  it('rejects tampered ciphertext, IV, and auth tag material', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();
    const envelope = encryptProviderCredential(TEST_CREDENTIAL, identity, store);

    const flipFirstChar = (value: string): string =>
      value.startsWith('A') ? `B${value.slice(1)}` : `A${value.slice(1)}`;

    const tampered: EncryptedProviderCredential[] = [
      { ...envelope, ciphertextBase64: flipFirstChar(envelope.ciphertextBase64) },
      { ...envelope, ivBase64: flipFirstChar(envelope.ivBase64) },
      { ...envelope, authTagBase64: flipFirstChar(envelope.authTagBase64) },
    ];
    for (const candidate of tampered) {
      expect(() => decryptProviderCredential(candidate, identity, store)).toThrow(
        ProviderCredentialCryptoError,
      );
    }
  });

  it('rejects decryption under the wrong key', () => {
    const first = createKeyStore();
    const second = createKeyStore();
    const identity = createIdentity();
    const envelope = encryptProviderCredential(
      TEST_CREDENTIAL,
      identity,
      first.store,
    );

    expect(() =>
      decryptProviderCredential(envelope, identity, second.store),
    ).toThrow(ProviderCredentialCryptoError);
  });

  it('keeps version-one rows readable after rotation to version two', () => {
    const before = createKeyStore(1);
    const identity = createIdentity();
    const legacy = encryptProviderCredential(
      TEST_CREDENTIAL,
      identity,
      before.store,
    );
    expect(legacy.keyVersion).toBe(1);

    const rotatedEnvironment: Record<string, string> = {
      PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION: '2',
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: requiredEnvValue(
        before.environment.PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1,
      ),
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V2: generateKeyBase64(),
    };
    const rotated = parseProviderCredentialEncryptionEnvironment(
      rotatedEnvironment,
    );
    expect(rotated.activeVersion).toBe(2);
    expect(decryptProviderCredential(legacy, identity, rotated)).toBe(
      TEST_CREDENTIAL,
    );

    const fresh = encryptProviderCredential(TEST_CREDENTIAL, identity, rotated);
    expect(fresh.keyVersion).toBe(2);
  });

  it('rejects empty and oversized credentials without echoing them', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();

    for (const plaintext of ['', 'x'.repeat(4_097)]) {
      let message = '';
      try {
        encryptProviderCredential(plaintext, identity, store);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderCredentialCryptoError);
        message = (error as Error).message;
      }
      expect(message).toBe('Invalid provider credential input');
    }
  });

  it('rejects malformed identities and unknown key versions', () => {
    const { store } = createKeyStore();
    const identity = createIdentity();

    expect(() =>
      encryptProviderCredential(TEST_CREDENTIAL, {
        ...identity,
        workspaceId: 'not-a-uuid',
      }, store),
    ).toThrow('Invalid provider credential identity');
    expect(() =>
      decryptProviderCredential(
        { ...encryptProviderCredential(TEST_CREDENTIAL, identity, store), keyVersion: 99 },
        identity,
        store,
      ),
    ).toThrow('Unknown provider credential key version');
  });

  it.each([
    [{}, 'missing key'],
    [
      { PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: 'not-base64!!' },
      'malformed base64',
    ],
    [
      {
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: Buffer.alloc(16).toString(
          'base64',
        ),
      },
      'wrong decoded length',
    ],
    [
      {
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1:
          randomBytes(32).toString('base64url'),
      },
      'non-canonical alphabet',
    ],
    [
      {
        PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION: '0',
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: generateKeyBase64(),
      },
      'inactive version zero',
    ],
    [
      {
        PROVIDER_CREDENTIAL_ENCRYPTION_ACTIVE_VERSION: '2',
        PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: generateKeyBase64(),
      },
      'missing older key after rotation',
    ],
  ])('rejects an unsafe key environment (%s)', (environment, label) => {
    expect(label).toMatch(/.+/u);
    let message = '';
    try {
      parseProviderCredentialEncryptionEnvironment(environment);
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderCredentialCryptoError);
      message = (error as Error).message;
    }
    expect(message).toBe(
      'Invalid provider credential encryption configuration',
    );
  });
});
