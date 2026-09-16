import { randomUUID } from 'node:crypto';

import { encryptProviderCredential, type ProviderCredentialKeyStore } from '@domainpulse/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareTokenValidationError } from '../src/provider-connections/cloudflare-token-validator';
import {
  InvalidProviderAccountError,
  ProviderConnectionAlreadyExistsError,
  ProviderConnectionDisconnectedError,
  ProviderConnectionNotFoundError,
  ProviderConnectionSyncInProgressError,
  ProviderConnectionWriteForbiddenError,
  ProviderCredentialValidationFailedError,
  ProviderValidationAttemptFailedError,
} from '../src/provider-connections/provider-connections.errors';
import { ProviderConnectionsService } from '../src/provider-connections/provider-connections.service';
import type {
  ProviderConnectionEnvelope,
  ProviderConnectionSummary,
  ProviderConnectionsStore,
} from '../src/provider-connections/provider-connections.types';

const workspaceId = randomUUID();
const providerAccountId = randomUUID();
const connectionId = randomUUID();
const now = new Date('2036-02-03T04:05:06.000Z');

const keyStore: ProviderCredentialKeyStore = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

function summaryRecord(overrides: Partial<ProviderConnectionSummary> = {}): ProviderConnectionSummary {
  return {
    authType: 'CLOUDFLARE_API_TOKEN',
    connectionStatus: 'CONNECTED',
    createdAt: now,
    credentialMask: '••••1234',
    disconnectedAt: null,
    id: connectionId,
    lastSyncAt: null,
    lastValidatedAt: now,
    nextSyncAt: new Date(now.getTime() + 1_440 * 60_000),
    providerAccountId,
    providerAccountLabel: 'Cloudflare - primary',
    providerType: 'cloudflare',
    syncStatus: 'IDLE',
    updatedAt: now,
    validationErrorCode: null,
    validationStatus: 'VALID',
    ...overrides,
  };
}

function envelopeRecord(overrides: Partial<ProviderConnectionEnvelope> = {}): ProviderConnectionEnvelope {
  const encrypted = encryptProviderCredential(
    'cf-existing-token',
    { connectionId, workspaceId },
    keyStore,
  );
  return {
    connectionStatus: 'CONNECTED',
    encryptedCiphertext: encrypted.ciphertextBase64,
    encryptionAuthTag: encrypted.authTagBase64,
    encryptionIv: encrypted.ivBase64,
    id: connectionId,
    keyVersion: encrypted.keyVersion,
    providerAccountId,
    workspaceId,
    ...overrides,
  };
}

function createMockStore(): { [K in keyof ProviderConnectionsStore]: ReturnType<typeof vi.fn> } {
  return {
    createConnection: vi.fn(),
    createManualSyncRun: vi.fn(),
    disconnect: vi.fn(),
    findActiveRun: vi.fn(),
    findEnvelopeById: vi.fn(),
    findRunByIdempotencyKey: vi.fn(),
    findSummaryById: vi.fn(),
    listSummaries: vi.fn(),
    listSyncRuns: vi.fn(),
    replaceCredential: vi.fn(),
    updateValidationResult: vi.fn(),
  };
}

function ownerPrincipal(): { role: string; workspaceId: string } {
  return { role: 'owner', workspaceId };
}

function memberPrincipal(): { role: string; workspaceId: string } {
  return { role: 'member', workspaceId };
}

function principalWithRole(role: string): { role: string; workspaceId: string } {
  return { role, workspaceId };
}

/** Simulates a wrapped 23505 as real driver/ORM errors nest it, at a chosen depth. */
function wrapped23505(depth: number): unknown {
  let error: unknown = { code: '23505' };
  for (let i = 0; i < depth; i += 1) {
    error = { cause: error };
  }
  return error;
}

describe('ProviderConnectionsService', () => {
  let store: ReturnType<typeof createMockStore>;
  let validator: { isTokenActive: ReturnType<typeof vi.fn> };
  let service: ProviderConnectionsService;

  beforeEach(() => {
    store = createMockStore();
    validator = { isTokenActive: vi.fn() };
    service = new ProviderConnectionsService(
      store as unknown as ProviderConnectionsStore,
      keyStore,
      validator as never,
      () => now,
    );
  });

  describe('createConnection', () => {
    it('validates the token before ever calling the store (create validates before persistence)', async () => {
      validator.isTokenActive.mockResolvedValue(false);

      await expect(
        service.createConnection(ownerPrincipal(), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'bad-token',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(ProviderCredentialValidationFailedError);

      expect(store.createConnection).not.toHaveBeenCalled();
    });

    it('member is denied before any validation call', async () => {
      await expect(
        service.createConnection(memberPrincipal(), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'irrelevant',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(ProviderConnectionWriteForbiddenError);
      expect(validator.isTokenActive).not.toHaveBeenCalled();
      expect(store.createConnection).not.toHaveBeenCalled();
    });

    it('owner/admin can create once the token validates, and the store never receives plaintext', async () => {
      validator.isTokenActive.mockResolvedValue(true);
      store.createConnection.mockResolvedValue(summaryRecord());

      const result = await service.createConnection(ownerPrincipal(), {
        authType: 'CLOUDFLARE_API_TOKEN',
        credential: 'cf-good-token-1234',
        providerAccountId,
      });

      expect(result.id).toBe(connectionId);
      expect(store.createConnection).toHaveBeenCalledTimes(1);
      const call = store.createConnection.mock.calls[0] as [string, Record<string, unknown>, Date];
      expect(call[1]).not.toHaveProperty('credential');
      expect(JSON.stringify(call[1])).not.toContain('cf-good-token-1234');
      expect(call[1].credentialMask).toBe('••••1234');
    });

    it('maps a unique-violation race to a conflict error', async () => {
      validator.isTokenActive.mockResolvedValue(true);
      store.createConnection.mockRejectedValue(
        Object.assign(new Error('duplicate key value'), { code: '23505' }),
      );

      await expect(
        service.createConnection(ownerPrincipal(), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'cf-good-token-1234',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(ProviderConnectionAlreadyExistsError);
    });

    it.each([
      ['top-level code', wrapped23505(0)],
      ['single-wrapped cause', wrapped23505(1)],
      ['nested double-wrapped cause', wrapped23505(2)],
    ])('maps a Drizzle-wrapped 23505 (%s) to a conflict error', async (_label, wrapped) => {
      validator.isTokenActive.mockResolvedValue(true);
      store.createConnection.mockRejectedValue(wrapped);

      await expect(
        service.createConnection(ownerPrincipal(), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'cf-good-token-1234',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(ProviderConnectionAlreadyExistsError);
    });

    it('propagates a non-existent/non-Cloudflare provider account error unmapped', async () => {
      validator.isTokenActive.mockResolvedValue(true);
      store.createConnection.mockRejectedValue(new InvalidProviderAccountError());

      await expect(
        service.createConnection(ownerPrincipal(), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'cf-good-token-1234',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(InvalidProviderAccountError);
    });
  });

  describe('replaceCredential (rotation)', () => {
    it('leaves the stored credential untouched when the replacement fails validation', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord());
      validator.isTokenActive.mockResolvedValue(false);

      await expect(
        service.replaceCredential(ownerPrincipal(), connectionId, 'bad-replacement'),
      ).rejects.toBeInstanceOf(ProviderCredentialValidationFailedError);

      expect(store.replaceCredential).not.toHaveBeenCalled();
    });

    it('updates the credential once the replacement validates', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord());
      validator.isTokenActive.mockResolvedValue(true);
      store.replaceCredential.mockResolvedValue(summaryRecord({ credentialMask: '••••9999' }));

      const result = await service.replaceCredential(ownerPrincipal(), connectionId, 'cf-new-token-9999');

      expect(store.replaceCredential).toHaveBeenCalledTimes(1);
      expect(result.credentialMask).toBe('••••9999');
      const call = store.replaceCredential.mock.calls[0] as [string, string, Record<string, unknown>];
      expect(JSON.stringify(call[2])).not.toContain('cf-new-token-9999');
    });

    it('refuses to rotate a disconnected connection', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord({ connectionStatus: 'DISCONNECTED', encryptedCiphertext: null, encryptionAuthTag: null, encryptionIv: null, keyVersion: null }));

      await expect(
        service.replaceCredential(ownerPrincipal(), connectionId, 'cf-new-token'),
      ).rejects.toBeInstanceOf(ProviderConnectionDisconnectedError);
      expect(validator.isTokenActive).not.toHaveBeenCalled();
    });

    it('member cannot rotate credentials', async () => {
      await expect(
        service.replaceCredential(memberPrincipal(), connectionId, 'cf-new-token'),
      ).rejects.toBeInstanceOf(ProviderConnectionWriteForbiddenError);
      expect(store.findEnvelopeById).not.toHaveBeenCalled();
    });
  });

  describe('enqueueManualSync', () => {
    it('requires a bounded idempotency key', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      await expect(
        service.enqueueManualSync(ownerPrincipal(), connectionId, undefined),
      ).rejects.toThrow(/Idempotency-Key/u);
      await expect(
        service.enqueueManualSync(ownerPrincipal(), connectionId, ''),
      ).rejects.toThrow(/Idempotency-Key/u);
    });

    it('returns 202-shaped QUEUED/MANUAL result and is idempotent for the same key', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      store.findRunByIdempotencyKey.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'run-1' });
      store.createManualSyncRun.mockResolvedValue({ id: 'run-1' });

      const first = await service.enqueueManualSync(ownerPrincipal(), connectionId, 'user-key');
      expect(first).toMatchObject({ id: 'run-1', status: 'QUEUED', trigger: 'MANUAL' });

      const second = await service.enqueueManualSync(ownerPrincipal(), connectionId, 'user-key');
      expect(second.id).toBe('run-1');
      expect(store.createManualSyncRun).toHaveBeenCalledTimes(1);
    });

    it('refuses to sync a disconnected connection', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord({ connectionStatus: 'DISCONNECTED' }));
      await expect(
        service.enqueueManualSync(ownerPrincipal(), connectionId, 'user-key'),
      ).rejects.toBeInstanceOf(ProviderConnectionDisconnectedError);
    });

    it('never leaks the raw idempotency key to the store', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      store.findRunByIdempotencyKey.mockResolvedValue(undefined);
      store.createManualSyncRun.mockResolvedValue({ id: 'run-2' });

      await service.enqueueManualSync(ownerPrincipal(), connectionId, 'raw-secret-key-value');

      const call = store.createManualSyncRun.mock.calls[0] as [string, string, string, Date];
      expect(call[2]).not.toBe('raw-secret-key-value');
      expect(call[2]).toMatch(/^[0-9a-f]{64}$/u);
    });

    it.each([
      ['top-level code', wrapped23505(0)],
      ['nested double-wrapped cause', wrapped23505(2)],
    ])('a concurrent duplicate manual sync (Drizzle-wrapped 23505, %s) resolves to the concurrent run', async (_label, wrapped) => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      store.findRunByIdempotencyKey
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ id: 'concurrent-run' });
      store.createManualSyncRun.mockRejectedValue(wrapped);

      const result = await service.enqueueManualSync(ownerPrincipal(), connectionId, 'race-key');
      expect(result).toMatchObject({ id: 'concurrent-run', status: 'QUEUED', trigger: 'MANUAL' });
    });

    describe('a different idempotency key while another sync is already active', () => {
      it.each([
        ['INITIAL', { id: 'other-run' }],
        ['SCHEDULED', { id: 'other-run' }],
        ['RETRY', { id: 'other-run' }],
        ['another MANUAL run', { id: 'other-run' }],
      ])('rejects with a 409-mapped conflict for an active %s run, never fabricating success', async (_label, activeRun) => {
        store.findSummaryById.mockResolvedValue(summaryRecord());
        store.findRunByIdempotencyKey.mockResolvedValue(undefined);
        store.findActiveRun.mockResolvedValue(activeRun);

        await expect(
          service.enqueueManualSync(ownerPrincipal(), connectionId, 'a-fresh-key-never-queued'),
        ).rejects.toBeInstanceOf(ProviderConnectionSyncInProgressError);

        // The unaccepted request must never insert a run or persist its key.
        expect(store.createManualSyncRun).not.toHaveBeenCalled();
      });

      it('rejects for an active RUNNING run and never claims a fake QUEUED status', async () => {
        store.findSummaryById.mockResolvedValue(summaryRecord());
        store.findRunByIdempotencyKey.mockResolvedValue(undefined);
        store.findActiveRun.mockResolvedValue({ id: 'running-run' });

        const rejection = service.enqueueManualSync(ownerPrincipal(), connectionId, 'a-fresh-key');
        await expect(rejection).rejects.toBeInstanceOf(ProviderConnectionSyncInProgressError);
        // The rejection error itself carries no fabricated status/trigger payload.
        await expect(rejection).rejects.not.toHaveProperty('status');
        await expect(rejection).rejects.not.toHaveProperty('trigger');
        expect(store.createManualSyncRun).not.toHaveBeenCalled();
      });

      it('an exact idempotency-key match is still honored even while a run is active (same-key path never reaches findActiveRun)', async () => {
        store.findSummaryById.mockResolvedValue(summaryRecord());
        store.findRunByIdempotencyKey.mockResolvedValue({ id: 'same-key-run' });
        store.findActiveRun.mockResolvedValue({ id: 'should-not-be-used' });

        const result = await service.enqueueManualSync(ownerPrincipal(), connectionId, 'repeated-key');

        expect(result).toMatchObject({ id: 'same-key-run', status: 'QUEUED', trigger: 'MANUAL' });
        expect(store.findActiveRun).not.toHaveBeenCalled();
        expect(store.createManualSyncRun).not.toHaveBeenCalled();
      });
    });

    it('scopes the active-run check to the caller principal workspace, never a foreign one', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      store.findRunByIdempotencyKey.mockResolvedValue(undefined);
      store.findActiveRun.mockResolvedValue(undefined);
      store.createManualSyncRun.mockResolvedValue({ id: 'new-run' });

      await service.enqueueManualSync(ownerPrincipal(), connectionId, 'fresh-key');

      expect(store.findActiveRun).toHaveBeenCalledWith(workspaceId, connectionId);
    });

    it('a disconnected connection is rejected before any active-run check, never turned into success', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord({ connectionStatus: 'DISCONNECTED' }));
      store.findActiveRun.mockResolvedValue({ id: 'irrelevant' });

      await expect(
        service.enqueueManualSync(ownerPrincipal(), connectionId, 'fresh-key'),
      ).rejects.toBeInstanceOf(ProviderConnectionDisconnectedError);
      expect(store.findActiveRun).not.toHaveBeenCalled();
      expect(store.createManualSyncRun).not.toHaveBeenCalled();
    });

    it('inserts a new MANUAL run and persists the supplied key when no run is active', async () => {
      store.findSummaryById.mockResolvedValue(summaryRecord());
      store.findRunByIdempotencyKey.mockResolvedValue(undefined);
      store.findActiveRun.mockResolvedValue(undefined);
      store.createManualSyncRun.mockResolvedValue({ id: 'fresh-run' });

      const result = await service.enqueueManualSync(ownerPrincipal(), connectionId, 'genuinely-fresh-key');

      expect(result).toMatchObject({ id: 'fresh-run', status: 'QUEUED', trigger: 'MANUAL' });
      expect(store.createManualSyncRun).toHaveBeenCalledTimes(1);
      const call = store.createManualSyncRun.mock.calls[0] as [string, string, string, Date];
      expect(call[0]).toBe(workspaceId);
      expect(call[1]).toBe(connectionId);
    });
  });

  describe('write RBAC is fail-closed', () => {
    it.each([
      ['member'],
      ['guest'],
      ['viewer'],
      [''],
      ['unknown-role'],
    ])('denies writes for role %j (only owner/admin are allowed)', async (role) => {
      await expect(
        service.createConnection(principalWithRole(role), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'irrelevant',
          providerAccountId,
        }),
      ).rejects.toBeInstanceOf(ProviderConnectionWriteForbiddenError);
      expect(validator.isTokenActive).not.toHaveBeenCalled();
      expect(store.createConnection).not.toHaveBeenCalled();
    });

    it.each([['owner'], ['admin']])('allows writes for role %j', async (role) => {
      validator.isTokenActive.mockResolvedValue(true);
      store.createConnection.mockResolvedValue(summaryRecord());

      await expect(
        service.createConnection(principalWithRole(role), {
          authType: 'CLOUDFLARE_API_TOKEN',
          credential: 'cf-good-token-1234',
          providerAccountId,
        }),
      ).resolves.toMatchObject({ id: connectionId });
    });

    it('does not weaken reads: an unrecognized role can still list and read connections', async () => {
      store.listSummaries.mockResolvedValue([summaryRecord()]);
      store.findSummaryById.mockResolvedValue(summaryRecord());

      await expect(service.listConnections(principalWithRole('guest'))).resolves.toHaveLength(1);
      await expect(
        service.getConnection(principalWithRole('guest'), connectionId),
      ).resolves.toMatchObject({ id: connectionId });
    });
  });

  describe('disconnect', () => {
    it('clears the credential and reports DISCONNECTED', async () => {
      store.disconnect.mockResolvedValue({
        connectionStatus: 'DISCONNECTED',
        disconnectedAt: now,
        id: connectionId,
      });

      const result = await service.disconnect(ownerPrincipal(), connectionId);
      expect(result).toEqual({
        connectionStatus: 'DISCONNECTED',
        disconnectedAt: now.toISOString(),
        id: connectionId,
      });
    });

    it('member cannot disconnect', async () => {
      await expect(service.disconnect(memberPrincipal(), connectionId)).rejects.toBeInstanceOf(
        ProviderConnectionWriteForbiddenError,
      );
      expect(store.disconnect).not.toHaveBeenCalled();
    });

    it('404s for a connection that never existed in this workspace', async () => {
      store.disconnect.mockResolvedValue(undefined);
      await expect(service.disconnect(ownerPrincipal(), connectionId)).rejects.toBeInstanceOf(
        ProviderConnectionNotFoundError,
      );
    });
  });

  describe('validateConnection', () => {
    it('decrypts, calls the validator, and persists a truthful VALID/INVALID result', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord());
      validator.isTokenActive.mockResolvedValue(true);
      store.updateValidationResult.mockResolvedValue(summaryRecord());

      const result = await service.validateConnection(ownerPrincipal(), connectionId);
      expect(result.validationStatus).toBe('VALID');
      expect(result.validationErrorCode).toBeNull();
    });

    it('persists a truthful INVALID/PERMISSION_DENIED when the credential is rejected for lacking permission', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord());
      validator.isTokenActive.mockRejectedValue(new CloudflareTokenValidationError('PERMISSION_DENIED'));
      store.updateValidationResult.mockResolvedValue(summaryRecord({ validationStatus: 'INVALID' }));

      const result = await service.validateConnection(ownerPrincipal(), connectionId);
      expect(result.validationStatus).toBe('INVALID');
      expect(result.validationErrorCode).toBe('PERMISSION_DENIED');
      expect(store.updateValidationResult).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['RATE_LIMITED'],
      ['NETWORK_TIMEOUT'],
      ['UPSTREAM_UNAVAILABLE'],
      ['UPSTREAM_BAD_RESPONSE'],
      ['UNKNOWN_PROVIDER_ERROR'],
    ] as const)(
      'a transient validation-attempt failure (%s) never mutates the persisted validation state',
      async (code) => {
        store.findEnvelopeById.mockResolvedValue(envelopeRecord());
        validator.isTokenActive.mockRejectedValue(new CloudflareTokenValidationError(code));

        await expect(
          service.validateConnection(ownerPrincipal(), connectionId),
        ).rejects.toBeInstanceOf(ProviderValidationAttemptFailedError);
        await expect(
          service.validateConnection(ownerPrincipal(), connectionId),
        ).rejects.toMatchObject({ providerErrorCode: code });

        expect(store.updateValidationResult).not.toHaveBeenCalled();
      },
    );

    it('treats a raw (non-CloudflareTokenValidationError) thrown error as UNKNOWN_PROVIDER_ERROR and still does not persist', async () => {
      store.findEnvelopeById.mockResolvedValue(envelopeRecord());
      validator.isTokenActive.mockRejectedValue(new Error('some unexpected internal failure'));

      await expect(
        service.validateConnection(ownerPrincipal(), connectionId),
      ).rejects.toMatchObject({ providerErrorCode: 'UNKNOWN_PROVIDER_ERROR' });
      expect(store.updateValidationResult).not.toHaveBeenCalled();
    });

    it('refuses to validate a disconnected connection', async () => {
      store.findEnvelopeById.mockResolvedValue(
        envelopeRecord({
          connectionStatus: 'DISCONNECTED',
          encryptedCiphertext: null,
          encryptionAuthTag: null,
          encryptionIv: null,
          keyVersion: null,
        }),
      );
      await expect(
        service.validateConnection(ownerPrincipal(), connectionId),
      ).rejects.toBeInstanceOf(ProviderConnectionDisconnectedError);
    });
  });
});
