import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CreateProviderConnectionApiRequestSchema,
  ManualProviderSyncResponseSchema,
  ProviderConnectionCollectionResponseSchema,
  ProviderConnectionDisconnectResponseSchema,
  ProviderConnectionSummaryResponseSchema,
  ProviderConnectionValidateResponseSchema,
  ProviderSyncRunCollectionResponseSchema,
  ProviderSyncRunResponseSchema,
  ReplaceProviderConnectionCredentialRequestSchema,
} from '../src';

const now = '2026-09-14T08:30:00.000Z';
const providerAccountId = randomUUID();
const connectionId = randomUUID();
const runId = randomUUID();

const summary = {
  authType: 'CLOUDFLARE_API_TOKEN',
  connectionStatus: 'CONNECTED',
  createdAt: now,
  credentialMask: '••••5678',
  disconnectedAt: null,
  id: connectionId,
  lastSyncAt: null,
  lastValidatedAt: now,
  nextSyncAt: now,
  providerAccountId,
  providerAccountLabel: 'Cloudflare - primary',
  providerType: 'cloudflare',
  syncStatus: 'IDLE',
  updatedAt: now,
  validationErrorCode: null,
  validationStatus: 'VALID',
};

describe('provider connections API contracts', () => {
  it('accepts a bounded create-connection request', () => {
    expect(
      CreateProviderConnectionApiRequestSchema.parse({
        authType: 'CLOUDFLARE_API_TOKEN',
        credential: 'cf-test-token-unit-only',
        providerAccountId,
      }),
    ).toMatchObject({ providerAccountId });
  });

  it.each([
    'CLOUDFLARE_API_TOKEN',
    'GODADDY_PAT',
    'NAMECHEAP_API_KEY',
    'HOSTINGER_API_TOKEN',
  ] as const)('accepts %s as a create-connection auth type', (authType) => {
    expect(
      CreateProviderConnectionApiRequestSchema.parse({
        authType,
        credential: 'provider-test-credential',
        providerAccountId,
      }),
    ).toMatchObject({ authType });
  });

  it('rejects an auth type outside the known provider set', () => {
    expect(
      CreateProviderConnectionApiRequestSchema.safeParse({
        authType: 'UNSUPPORTED_PROVIDER_TOKEN',
        credential: 'provider-test-credential',
        providerAccountId,
      }).success,
    ).toBe(false);
  });

  it.each([
    'CLOUDFLARE_API_TOKEN',
    'GODADDY_PAT',
    'NAMECHEAP_API_KEY',
    'HOSTINGER_API_TOKEN',
  ] as const)('accepts %s in the connection summary response', (authType) => {
    expect(
      ProviderConnectionSummaryResponseSchema.parse({ ...summary, authType }),
    ).toMatchObject({ authType });
  });

  it('accepts a bounded credential-replacement request', () => {
    expect(
      ReplaceProviderConnectionCredentialRequestSchema.parse({
        credential: 'cf-replacement-token',
      }),
    ).toMatchObject({ credential: 'cf-replacement-token' });
    expect(() =>
      ReplaceProviderConnectionCredentialRequestSchema.parse({ credential: '' }),
    ).toThrow();
  });

  it('accepts the safe connection summary and rejects secret fields', () => {
    expect(ProviderConnectionSummaryResponseSchema.parse(summary)).toEqual(summary);
    expect(
      ProviderConnectionCollectionResponseSchema.parse({ items: [summary] }),
    ).toEqual({ items: [summary] });
  });

  it.each([
    'credential',
    'encryptedCiphertext',
    'encrypted_ciphertext',
    'encryptionIv',
    'encryptionAuthTag',
    'keyVersion',
    'authorization',
    'plaintext',
  ])('never exposes secret material field %s in the connection summary', (field) => {
    expect(() =>
      ProviderConnectionSummaryResponseSchema.parse({ ...summary, [field]: 'secret' }),
    ).toThrow();
  });

  it('accepts the validate response with a bounded canonical error code', () => {
    expect(
      ProviderConnectionValidateResponseSchema.parse({
        lastValidatedAt: now,
        validationErrorCode: null,
        validationStatus: 'VALID',
      }),
    ).toMatchObject({ validationStatus: 'VALID' });
    expect(() =>
      ProviderConnectionValidateResponseSchema.parse({
        lastValidatedAt: now,
        validationErrorCode: 'not a canonical code!',
        validationStatus: 'INVALID',
      }),
    ).toThrow();
  });

  it('accepts the manual sync 202 response as QUEUED/MANUAL only', () => {
    expect(
      ManualProviderSyncResponseSchema.parse({
        id: runId,
        message: 'Provider sync queued successfully',
        status: 'QUEUED',
        trigger: 'MANUAL',
      }),
    ).toMatchObject({ status: 'QUEUED', trigger: 'MANUAL' });
    expect(() =>
      ManualProviderSyncResponseSchema.parse({
        id: runId,
        message: 'ok',
        status: 'RUNNING',
        trigger: 'MANUAL',
      }),
    ).toThrow();
  });

  it('accepts safe sync-run history without error detail or raw payloads', () => {
    const run = {
      attemptNo: 1,
      createdAt: now,
      durationMs: 1_200,
      errorCode: null,
      finishedAt: now,
      id: runId,
      itemsCreated: 2,
      itemsDiscovered: 5,
      itemsMissing: 0,
      itemsUnchanged: 3,
      itemsUpdated: 0,
      startedAt: now,
      status: 'SUCCESS',
      trigger: 'MANUAL',
    };
    expect(ProviderSyncRunResponseSchema.parse(run)).toEqual(run);
    expect(
      ProviderSyncRunCollectionResponseSchema.parse({ items: [run] }),
    ).toEqual({ items: [run] });
    expect(() =>
      ProviderSyncRunResponseSchema.parse({ ...run, errorDetail: 'raw provider body' }),
    ).toThrow();
    expect(() =>
      ProviderSyncRunResponseSchema.parse({ ...run, rawResponse: '{}' }),
    ).toThrow();
  });

  it('accepts the disconnect response as a truthful terminal state', () => {
    expect(
      ProviderConnectionDisconnectResponseSchema.parse({
        connectionStatus: 'DISCONNECTED',
        disconnectedAt: now,
        id: connectionId,
      }),
    ).toMatchObject({ connectionStatus: 'DISCONNECTED' });
    expect(() =>
      ProviderConnectionDisconnectResponseSchema.parse({
        connectionStatus: 'CONNECTED',
        disconnectedAt: now,
        id: connectionId,
      }),
    ).toThrow();
  });
});
