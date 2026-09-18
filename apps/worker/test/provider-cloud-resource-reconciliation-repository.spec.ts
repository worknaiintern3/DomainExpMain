import { cloudResources } from '@domainpulse/database';
import { isNotNull } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { PostgresProviderCloudResourceReconciliationStore } from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.repository';

/**
 * Unit-level coverage for the monotonic watermark decision in
 * `upsertCloudResource` (see that file's header comment). This does not
 * (and cannot, without a real database) prove the SQL `WHERE` guard is
 * genuinely atomic under concurrent transactions -- that is what
 * provider-cloud-resource-reconciliation.integration.spec.ts proves against
 * real PostgreSQL. What this proves, deterministically and without a DB, is
 * that the repository issues the *correct categorical decision* (skip vs.
 * apply) and the *correct write values* for each case, using a scripted
 * fake transaction that mirrors the minimal Drizzle chain this class calls.
 */

interface FakeRow {
  id: string;
  name: string;
  region: string | null;
  updatedAt: Date;
}

function fakeTransaction(existingRow: FakeRow | undefined) {
  const setCalls: unknown[] = [];
  const updateCalled = { count: 0 };
  const transaction = {
    insert: vi.fn(),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(existingRow ? [existingRow] : []),
        }),
      }),
    }),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((values: unknown) => {
        setCalls.push(values);
        updateCalled.count += 1;
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };
  return { setCalls, transaction, updateCalled };
}

function fakeTransactionForInsert(insertedRow: { id: string } | undefined) {
  const onConflictConfigs: Array<{ target: unknown; where?: unknown }> = [];
  const transaction = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockImplementation((config: { target: unknown; where?: unknown }) => {
          onConflictConfigs.push(config);
          return { returning: vi.fn().mockResolvedValue(insertedRow ? [insertedRow] : []) };
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]), // no existing row -- forces the insert path
        }),
      }),
    }),
  };
  return { onConflictConfigs, transaction };
}

const workspaceId = 'workspace-1';
const connectionId = 'connection-1';
const baseInput = {
  externalResourceId: 'i-1',
  name: 'new-name',
  providerAccountId: 'provider-account-1',
  region: 'us-east-1',
  resourceType: 'ec2-instance',
};

describe('PostgresProviderCloudResourceReconciliationTransaction.upsertCloudResource watermark decision', () => {
  it('skips the write entirely for a synchronizedAt strictly older than the recorded watermark (stale sync)', async () => {
    const existingUpdatedAt = new Date('2026-01-01T11:00:00.000Z');
    const { transaction, updateCalled } = fakeTransaction({
      id: 'resource-1',
      name: 'old-name',
      region: 'old-region',
      updatedAt: existingUpdatedAt,
    });
    const store = new PostgresProviderCloudResourceReconciliationStore(
      { withWorkspaceContext: (_ws: string, op: (tx: unknown) => unknown) => op(transaction) } as never,
    );

    const result = await store.withWorkspaceTransaction(workspaceId, connectionId, (tx) =>
      tx.upsertCloudResource({
        ...baseInput,
        synchronizedAt: new Date('2026-01-01T10:00:00.000Z'), // older than existingUpdatedAt
      }));

    expect(result).toEqual({ created: false, id: 'resource-1' });
    expect(updateCalled.count).toBe(0);
  });

  it('applies the write and advances the watermark for a synchronizedAt at or after the recorded watermark', async () => {
    const existingUpdatedAt = new Date('2026-01-01T10:00:00.000Z');
    const synchronizedAt = new Date('2026-01-01T11:00:00.000Z');
    const { transaction, setCalls, updateCalled } = fakeTransaction({
      id: 'resource-1',
      name: 'old-name',
      region: 'old-region',
      updatedAt: existingUpdatedAt,
    });
    const store = new PostgresProviderCloudResourceReconciliationStore(
      { withWorkspaceContext: (_ws: string, op: (tx: unknown) => unknown) => op(transaction) } as never,
    );

    const result = await store.withWorkspaceTransaction(workspaceId, connectionId, (tx) =>
      tx.upsertCloudResource({ ...baseInput, synchronizedAt }));

    expect(result).toEqual({ created: false, id: 'resource-1' });
    expect(updateCalled.count).toBe(1);
    expect(setCalls).toEqual([{ name: 'new-name', region: 'us-east-1', updatedAt: synchronizedAt }]);
  });

  it('still issues the write (advancing the watermark) even when name/region are already identical -- the T2-unchanged case', async () => {
    const existingUpdatedAt = new Date('2026-01-01T10:00:00.000Z');
    const synchronizedAt = new Date('2026-01-01T11:00:00.000Z');
    const { transaction, setCalls, updateCalled } = fakeTransaction({
      id: 'resource-1',
      name: baseInput.name,
      region: baseInput.region,
      updatedAt: existingUpdatedAt,
    });
    const store = new PostgresProviderCloudResourceReconciliationStore(
      { withWorkspaceContext: (_ws: string, op: (tx: unknown) => unknown) => op(transaction) } as never,
    );

    await store.withWorkspaceTransaction(workspaceId, connectionId, (tx) =>
      tx.upsertCloudResource({ ...baseInput, synchronizedAt }));

    // Even though name/region already match, the watermark write must
    // still happen -- this is exactly the case the audit flagged: without
    // it, a later, actually-older sync could pass the stale check because
    // the watermark was never advanced.
    expect(updateCalled.count).toBe(1);
    expect(setCalls).toEqual([{ name: baseInput.name, region: baseInput.region, updatedAt: synchronizedAt }]);
  });

  it('applies (does not skip) when synchronizedAt exactly equals the recorded watermark -- deterministic same-timestamp behavior', async () => {
    const sameInstant = new Date('2026-01-01T10:00:00.000Z');
    const { transaction, updateCalled } = fakeTransaction({
      id: 'resource-1',
      name: 'old-name',
      region: 'old-region',
      updatedAt: sameInstant,
    });
    const store = new PostgresProviderCloudResourceReconciliationStore(
      { withWorkspaceContext: (_ws: string, op: (tx: unknown) => unknown) => op(transaction) } as never,
    );

    await store.withWorkspaceTransaction(workspaceId, connectionId, (tx) =>
      tx.upsertCloudResource({ ...baseInput, synchronizedAt: sameInstant }));

    expect(updateCalled.count).toBe(1);
  });
});

describe('PostgresProviderCloudResourceReconciliationTransaction.upsertCloudResource insert conflict target', () => {
  it(
    'restates the partial unique index\'s predicate on the ON CONFLICT target (regression guard for PostgreSQL error 42P10: ' +
    '"no unique or exclusion constraint matching the ON CONFLICT specification", which a bare column-list target raises ' +
    'against a partial index)',
    async () => {
      const { onConflictConfigs, transaction } = fakeTransactionForInsert({ id: 'new-resource-1' });
      const store = new PostgresProviderCloudResourceReconciliationStore(
        { withWorkspaceContext: (_ws: string, op: (tx: unknown) => unknown) => op(transaction) } as never,
      );

      const result = await store.withWorkspaceTransaction(workspaceId, connectionId, (tx) =>
        tx.upsertCloudResource({ ...baseInput, synchronizedAt: new Date('2026-01-01T10:00:00.000Z') }));

      expect(result).toEqual({ created: true, id: 'new-resource-1' });
      expect(onConflictConfigs).toHaveLength(1);
      const config = onConflictConfigs[0]!;
      expect(Array.isArray(config.target) ? config.target.length : undefined).toBe(4);
      // `cloud_resources_workspace_provider_external_unique` is declared
      // `WHERE external_resource_id IS NOT NULL` (see the schema and
      // 0004_core_portfolio.sql) -- the ON CONFLICT target must restate
      // exactly that predicate for PostgreSQL to recognize it as the
      // arbiter index. A missing/different `where` here is precisely the
      // bug that produced 42P10 against real PostgreSQL.
      expect(config.where).toEqual(isNotNull(cloudResources.externalResourceId));
    },
  );
});
