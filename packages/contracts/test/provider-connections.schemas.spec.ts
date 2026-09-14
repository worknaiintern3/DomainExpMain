import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CreateProviderConnectionRequestSchema,
  ProviderConnectionResponseSchema,
  UpdateProviderConnectionCredentialRequestSchema,
} from '../src';

const now = '2026-09-14T08:30:00.000Z';
const providerAccountId = randomUUID();
const connectionId = randomUUID();

const response = {
  authType: 'CLOUDFLARE_API_TOKEN',
  createdAt: now,
  credentialMask: '••••5678',
  id: connectionId,
  keyVersion: 1,
  lastSyncAt: null,
  lastValidatedAt: null,
  nextSyncAt: null,
  providerAccountId,
  syncStatus: 'IDLE',
  updatedAt: now,
  validationStatus: 'PENDING',
};

describe('provider connection contracts', () => {
  it('accepts a bounded credential-create request', () => {
    expect(
      CreateProviderConnectionRequestSchema.parse({
        authType: 'CLOUDFLARE_API_TOKEN',
        credential: 'cf-test-token-unit-only',
        providerAccountId,
      }),
    ).toMatchObject({ providerAccountId });
  });

  it.each([[''], ['x'.repeat(4_097)]])(
    'rejects an unsafe credential-create secret (%s)',
    (credential) => {
      expect(() =>
        CreateProviderConnectionRequestSchema.parse({
          authType: 'CLOUDFLARE_API_TOKEN',
          credential,
          providerAccountId,
        }),
      ).toThrow();
    },
  );

  it('rejects unknown auth types and rotation secrets outside bounds', () => {
    expect(() =>
      CreateProviderConnectionRequestSchema.parse({
        authType: 'UNKNOWN_PROVIDER',
        credential: 'cf-test-token-unit-only',
        providerAccountId,
      }),
    ).toThrow();
    expect(() =>
      UpdateProviderConnectionCredentialRequestSchema.parse({ credential: '' }),
    ).toThrow();
  });

  it('accepts the status-only connection response', () => {
    expect(ProviderConnectionResponseSchema.parse(response)).toEqual(response);
  });

  it.each([
    'credential',
    'encryptedCiphertext',
    'encrypted_ciphertext',
    'encryptionIv',
    'encryptionAuthTag',
    'plaintext',
  ])('never exposes secret material field %s in responses', (field) => {
    expect(() =>
      ProviderConnectionResponseSchema.parse({ ...response, [field]: 'secret' }),
    ).toThrow();
  });
});
