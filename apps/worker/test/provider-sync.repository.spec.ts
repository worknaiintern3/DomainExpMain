import { randomUUID } from 'node:crypto';

import { providerConnections, providerSyncRuns, type DatabaseClient } from '@domainpulse/database';
import { describe, expect, it, vi } from 'vitest';

import { PostgresProviderSyncRepository } from '../src/providers/sync/provider-sync.repository';
import type { ClaimedProviderSyncRun, ProviderSyncExecutionResult } from '../src/providers/sync/provider-sync.types';

const workspaceId = randomUUID();
const connectionId = randomUUID();
const runId = randomUUID();

const run: ClaimedProviderSyncRun = {
  attemptNo: 1,
  connectionId,
  idempotencyKey: 'a'.repeat(64),
  leaseExpiresAt: new Date('2026-01-01T00:05:00.000Z'),
  runId,
  workspaceId,
};

const successResult: ProviderSyncExecutionResult = {
  durationMs: 10,
  errorCode: null,
  finishedAt: new Date('2026-01-01T00:00:10.000Z'),
  itemsCreated: 1,
  itemsDiscovered: 1,
  itemsMissing: 0,
  itemsUnchanged: 0,
  itemsUpdated: 0,
  status: 'SUCCESS',
};

/** Fake transaction supporting exactly the two chained updates `finalize` issues. */
function fakeTransaction(options: { runCasSucceeds: boolean }) {
  const runsReturning = vi.fn().mockResolvedValue(options.runCasSucceeds ? [{ id: runId }] : []);
  const runsWhere = vi.fn().mockReturnValue({ returning: runsReturning });
  const runsSet = vi.fn().mockReturnValue({ where: runsWhere });

  const connectionsWhere = vi.fn().mockResolvedValue(undefined);
  const connectionsSet = vi.fn().mockReturnValue({ where: connectionsWhere });

  const update = vi.fn().mockImplementation((table: unknown) =>
    table === providerSyncRuns ? { set: runsSet } : { set: connectionsSet },
  );

  return { connectionsSet, runsSet, update };
}

function fakeClient(transaction: ReturnType<typeof fakeTransaction>): DatabaseClient {
  return {
    withWorkspaceContext: vi.fn(async (_workspaceId: string, operation: (tx: unknown) => Promise<unknown>) =>
      operation(transaction)),
  } as unknown as DatabaseClient;
}

describe('PostgresProviderSyncRepository.finalize', () => {
  it('finalizes a still-leased RUNNING run and updates the connection status', async () => {
    const transaction = fakeTransaction({ runCasSucceeds: true });
    const repository = new PostgresProviderSyncRepository(fakeClient(transaction));

    const finalized = await repository.finalize(run, successResult);

    expect(finalized).toBe(true);
    expect(transaction.connectionsSet).toHaveBeenCalledTimes(1);
  });

  it('returns false once the run has already been reclaimed/is no longer RUNNING with a live lease, and never touches the connection', async () => {
    // Simulates the CAS predicate (status='RUNNING' AND lease_expires_at > now)
    // matching zero rows: the run was already reclaimed as expired, or
    // already finalized by another worker.
    const transaction = fakeTransaction({ runCasSucceeds: false });
    const repository = new PostgresProviderSyncRepository(fakeClient(transaction));

    const finalized = await repository.finalize(run, successResult);

    expect(finalized).toBe(false);
    // A stale finalize must not mutate provider_connections either.
    expect(transaction.connectionsSet).not.toHaveBeenCalled();
  });

  it('scopes the CAS update to the correct workspace and run id', async () => {
    const transaction = fakeTransaction({ runCasSucceeds: true });
    const repository = new PostgresProviderSyncRepository(fakeClient(transaction));

    await repository.finalize(run, successResult);

    expect(transaction.update).toHaveBeenCalledWith(providerSyncRuns);
    expect(transaction.update).toHaveBeenCalledWith(providerConnections);
  });
});
