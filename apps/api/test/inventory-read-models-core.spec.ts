import { randomUUID } from 'node:crypto';

import {
  InventoryConnectionParamsSchema,
  InventoryDependencySourceParamsSchema,
  InventoryGraphReadQuerySchema,
} from '@domainpulse/contracts';
import {
  InventoryNodeNotFoundError,
  type AssociatedInventoryEntity,
  type InventoryGraphRelationship,
} from '@domainpulse/database';
import { describe, expect, it, vi } from 'vitest';

import {
  InventoryPersistenceError,
  InventoryRecordNotFoundError,
} from '../src/inventory/inventory.errors';
import { PostgresInventoryReadModelRepository } from '../src/inventory/read-models/inventory-read-models.repository';
import { InventoryReadModelService } from '../src/inventory/read-models/inventory-read-models.service';
import type { InventoryReadModelStore } from '../src/inventory/read-models/inventory-read-models.types';
import type { WorkspacePrincipal } from '../src/workspace-context';

const projectId = randomUUID();
const domainId = randomUUID();
const now = new Date('2041-01-02T03:04:05.000Z');

function principal(role: WorkspacePrincipal['role']): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role,
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId: randomUUID(),
  };
}

const associations: readonly AssociatedInventoryEntity[] = [
  {
    associationSources: ['PRIMARY_STRUCTURAL', 'FLEXIBLE_RELATIONSHIP'],
    entityId: domainId,
    entityKind: 'DOMAIN',
  },
];
const relationships: readonly InventoryGraphRelationship[] = [
  {
    createdAt: now,
    direction: 'OUTBOUND',
    id: randomUUID(),
    inventoryState: 'TRACKED',
    notes: null,
    oppositeEndpoint: { entityId: domainId, entityKind: 'DOMAIN' },
    provenance: 'USER_MAPPED',
    relationshipType: 'GROUPS',
    updatedAt: now,
  },
];

function createStore(): InventoryReadModelStore {
  return {
    listApplicationDomains: vi.fn(() => Promise.resolve(associations)),
    listApplicationHostingTargets: vi.fn(() =>
      Promise.resolve(relationships),
    ),
    listConnections: vi.fn(() => Promise.resolve(relationships)),
    listDependencies: vi.fn(() => Promise.resolve(relationships)),
    listDependents: vi.fn(() => Promise.resolve(relationships)),
    listHostedApplications: vi.fn(() => Promise.resolve(relationships)),
    listImmediateRelationships: vi.fn(() => Promise.resolve(relationships)),
    listProjectResources: vi.fn(() => Promise.resolve(associations)),
  };
}

function callsFor(
  store: InventoryReadModelStore,
  method: keyof InventoryReadModelStore,
): readonly unknown[][] {
  const mock = Reflect.get(store, method) as unknown as {
    readonly mock: { readonly calls: readonly unknown[][] };
  };
  return mock.mock.calls;
}

describe('inventory graph read contracts', () => {
  it('parses archived inclusion strictly and defaults to tracked reads', () => {
    expect(InventoryGraphReadQuerySchema.parse({})).toEqual({
      includeArchived: false,
    });
    expect(InventoryGraphReadQuerySchema.parse({ includeArchived: 'true' })).toEqual(
      { includeArchived: true },
    );
    expect(
      InventoryGraphReadQuerySchema.safeParse({ includeArchived: 'yes' })
        .success,
    ).toBe(false);
  });

  it('rejects invalid route-specific kinds and malformed IDs', () => {
    expect(
      InventoryDependencySourceParamsSchema.safeParse({
        entityId: domainId,
        entityKind: 'DOMAIN',
      }).success,
    ).toBe(false);
    expect(
      InventoryConnectionParamsSchema.safeParse({
        entityId: 'not-a-uuid',
        entityKind: 'SERVER',
      }).success,
    ).toBe(false);
  });
});

describe('InventoryReadModelService', () => {
  it.each(['owner', 'admin', 'member'] as const)(
    'allows %s to read through one repository operation',
    async (role) => {
      const store = createStore();
      const service = new InventoryReadModelService(store);
      const actor = principal(role);
      await expect(
        service.listProjectResources(actor, projectId, {
          includeArchived: false,
        }),
      ).resolves.toEqual(associations);
      expect(callsFor(store, 'listProjectResources')).toEqual([
        [actor.workspaceId, projectId, { includeArchived: false }],
      ]);
    },
  );

  it('delegates every one-hop read without per-item endpoint lookups', async () => {
    const store = createStore();
    const service = new InventoryReadModelService(store);
    const actor = principal('member');
    const query = { includeArchived: true };
    await service.listApplicationDomains(actor, projectId, query);
    await service.listApplicationHostingTargets(actor, projectId, query);
    await service.listHostedApplications(actor, 'SERVER', projectId, query);
    await service.listDependencies(actor, 'SERVER', projectId, query);
    await service.listDependents(actor, 'DOMAIN', domainId, query);
    await service.listConnections(actor, 'SERVER', projectId, query);
    await service.listImmediateRelationships(
      actor,
      'PROJECT',
      projectId,
      query,
    );

    for (const method of [
      'listApplicationDomains',
      'listApplicationHostingTargets',
      'listHostedApplications',
      'listDependencies',
      'listDependents',
      'listConnections',
      'listImmediateRelationships',
    ] as const) {
      expect(callsFor(store, method)).toHaveLength(1);
    }
  });
});

describe('PostgresInventoryReadModelRepository error safety', () => {
  it('maps hidden and nonexistent roots to the same not-found error', async () => {
    const repository = new PostgresInventoryReadModelRepository({
      withWorkspaceContext: () =>
        Promise.reject(new InventoryNodeNotFoundError()),
    });
    await expect(
      repository.listProjectResources(randomUUID(), projectId, {
        includeArchived: false,
      }),
    ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
  });

  it('sanitizes unexpected persistence errors', async () => {
    const repository = new PostgresInventoryReadModelRepository({
      withWorkspaceContext: () => Promise.reject(new Error('database detail')),
    });
    await expect(
      repository.listProjectResources(randomUUID(), projectId, {
        includeArchived: false,
      }),
    ).rejects.toBeInstanceOf(InventoryPersistenceError);
  });
});
