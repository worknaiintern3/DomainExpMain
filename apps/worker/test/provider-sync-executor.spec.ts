import { encryptProviderCredential, type ProviderCredentialKeyStore } from '@domainpulse/database';
import { describe, expect, it, vi } from 'vitest';

import type { ProviderDomainSyncService } from '../src/providers/reconciliation/provider-domain-reconciliation.service';
import { ProviderReconciliationError } from '../src/providers/provider.errors';
import { ProviderSyncExecutor } from '../src/providers/sync/provider-sync.executor';
import type {
  ClaimedProviderSyncRun,
  ProviderConnectionForSync,
} from '../src/providers/sync/provider-sync.types';

const workspaceId = '40000000-0000-4000-8000-000000000001';
const connectionId = '50000000-0000-4000-8000-000000000001';
const plaintextToken = 'cf-real-plaintext-token-value';

const keyStore: ProviderCredentialKeyStore = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 5)]]),
};

const run: ClaimedProviderSyncRun = {
  attemptNo: 1,
  connectionId,
  idempotencyKey: 'a'.repeat(64),
  leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
  runId: '60000000-0000-4000-8000-000000000001',
  workspaceId,
};

function connectedConnection(overrides: Partial<ProviderConnectionForSync> = {}): ProviderConnectionForSync {
  const encrypted = encryptProviderCredential(
    plaintextToken,
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
    providerKey: 'cloudflare',
    workspaceId,
    ...overrides,
  };
}

function fakeSyncService(
  implementation: (input: { token: string }) => unknown,
): ProviderDomainSyncService {
  return { synchronize: vi.fn(implementation) } as unknown as ProviderDomainSyncService;
}

function successDiscovery() {
  return {
    completion: 'COMPLETE' as const,
    error: null,
    itemsCreated: 1,
    itemsDiscovered: 1,
    itemsMissing: 0,
    itemsUnchanged: 0,
    itemsUpdated: 0,
  };
}

describe('ProviderSyncExecutor', () => {
  it('decrypts the credential and calls the resolved provider sync service with the plaintext token', async () => {
    const synchronize = vi.fn((input: { token: string }) => {
      expect(input.token).toBe(plaintextToken);
      return {
        completion: 'COMPLETE' as const,
        error: null,
        itemsCreated: 2,
        itemsDiscovered: 5,
        itemsMissing: 0,
        itemsUnchanged: 3,
        itemsUpdated: 0,
      };
    });
    const syncService = { synchronize } as unknown as ProviderDomainSyncService;
    const executor = new ProviderSyncExecutor(
      new Map([['cloudflare', syncService]]),
      keyStore,
      () => new Date('2026-01-01T00:00:00.000Z'),
    );

    const result = await executor.execute(run, connectedConnection());

    expect(synchronize).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('SUCCESS');
    expect(result.errorCode).toBeNull();
    expect(result).toMatchObject({
      itemsCreated: 2,
      itemsDiscovered: 5,
      itemsMissing: 0,
      itemsUnchanged: 3,
      itemsUpdated: 0,
    });
    // adapter/discovery counters are the only thing surfaced: no token anywhere in the result.
    expect(JSON.stringify(result)).not.toContain(plaintextToken);
  });

  it('never decrypts or calls the adapter for a disconnected connection', async () => {
    const synchronize = vi.fn();
    const executor = new ProviderSyncExecutor(
      new Map([['cloudflare', { synchronize } as unknown as ProviderDomainSyncService]]),
      keyStore,
    );

    const result = await executor.execute(
      run,
      connectedConnection({
        connectionStatus: 'DISCONNECTED',
        encryptedCiphertext: null,
        encryptionAuthTag: null,
        encryptionIv: null,
        keyVersion: null,
      }),
    );

    expect(synchronize).not.toHaveBeenCalled();
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('CONNECTION_UNAVAILABLE');
    expect(result.itemsDiscovered).toBe(0);
  });

  it('fails safely for an unresolved provider adapter without ever decrypting', async () => {
    const synchronize = vi.fn();
    const executor = new ProviderSyncExecutor(
      new Map([['other-provider', { synchronize } as unknown as ProviderDomainSyncService]]),
      keyStore,
    );

    const result = await executor.execute(run, connectedConnection());

    expect(synchronize).not.toHaveBeenCalled();
    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('UNKNOWN_PROVIDER_ERROR');
  });

  it.each(['cloudflare', 'godaddy', 'namecheap', 'hostinger', 'aws', 'gcp', 'azure'])(
    'a %s connection dispatches only to its own registered service, never a sibling provider\'s',
    async (providerKey) => {
      // Phase 10I: aws/gcp/azure register a ProviderCloudResourceSyncService
      // in the exact same provider-key-keyed map as the domain-sync
      // providers -- this confirms the executor's generalized
      // `ProviderSyncService` interface (see provider-sync.types.ts)
      // dispatches to either kind identically, with no special-casing.
      const synchronizeCalls: Record<string, ReturnType<typeof vi.fn>> = {
        aws: vi.fn(async () => successDiscovery()),
        azure: vi.fn(async () => successDiscovery()),
        cloudflare: vi.fn(async () => successDiscovery()),
        gcp: vi.fn(async () => successDiscovery()),
        godaddy: vi.fn(async () => successDiscovery()),
        hostinger: vi.fn(async () => successDiscovery()),
        namecheap: vi.fn(async () => successDiscovery()),
      };
      const executor = new ProviderSyncExecutor(
        new Map(
          Object.entries(synchronizeCalls).map(([key, synchronize]) => [
            key,
            { synchronize } as unknown as ProviderDomainSyncService,
          ]),
        ),
        keyStore,
      );

      const result = await executor.execute(run, connectedConnection({ providerKey }));

      expect(result.status).toBe('SUCCESS');
      for (const [key, synchronize] of Object.entries(synchronizeCalls)) {
        if (key === providerKey) {
          expect(synchronize).toHaveBeenCalledTimes(1);
        } else {
          expect(synchronize).not.toHaveBeenCalled();
        }
      }
    },
  );

  it('maps a PARTIAL discovery to a PARTIAL run with the safe provider error code', async () => {
    const syncService = fakeSyncService(() => ({
      completion: 'PARTIAL' as const,
      error: { code: 'RATE_LIMITED' as const, retryAfterSeconds: 30 },
      itemsCreated: 1,
      itemsDiscovered: 2,
      itemsMissing: 0,
      itemsUnchanged: 1,
      itemsUpdated: 0,
    }));
    const executor = new ProviderSyncExecutor(new Map([['cloudflare', syncService]]), keyStore);

    const result = await executor.execute(run, connectedConnection());

    expect(result.status).toBe('PARTIAL');
    expect(result.errorCode).toBe('RATE_LIMITED');
    expect(result.itemsCreated).toBe(1);
    expect(result.itemsDiscovered).toBe(2);
  });

  it('maps a thrown adapter error to FAILED with zeroed, safe counters', async () => {
    const syncService = fakeSyncService(() => {
      throw new ProviderReconciliationError('CONNECTION_UNAVAILABLE');
    });
    const executor = new ProviderSyncExecutor(new Map([['cloudflare', syncService]]), keyStore);

    const result = await executor.execute(run, connectedConnection());

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('CONNECTION_UNAVAILABLE');
    expect(result).toMatchObject({
      itemsCreated: 0,
      itemsDiscovered: 0,
      itemsMissing: 0,
      itemsUnchanged: 0,
      itemsUpdated: 0,
    });
  });

  it('maps an unexpected thrown error to the sanitized UNKNOWN_PROVIDER_ERROR code', async () => {
    const syncService = fakeSyncService(() => {
      throw new Error('some raw network detail that must never leak');
    });
    const executor = new ProviderSyncExecutor(new Map([['cloudflare', syncService]]), keyStore);

    const result = await executor.execute(run, connectedConnection());

    expect(result.status).toBe('FAILED');
    expect(result.errorCode).toBe('UNKNOWN_PROVIDER_ERROR');
    expect(JSON.stringify(result)).not.toContain('raw network detail');
  });
});
