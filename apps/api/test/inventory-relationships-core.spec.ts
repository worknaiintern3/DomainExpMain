import { randomUUID } from 'node:crypto';

import {
  CreateInventoryRelationshipRequestSchema,
  InventoryRelationshipListQuerySchema,
  UpdateInventoryRelationshipRequestSchema,
  type CreateInventoryRelationshipRequest,
} from '@domainpulse/contracts';
import {
  InvalidInventoryRelationshipError,
  InventoryNodeNotFoundError,
  validateInventoryRelationshipDefinition,
  type StoredInventoryRelationship,
} from '@domainpulse/database';
import { describe, expect, it, vi } from 'vitest';

import {
  InventoryRecordNotFoundError,
  InventoryWriteForbiddenError,
} from '../src/inventory/inventory.errors';
import { InventoryRelationshipService } from '../src/inventory/relationships/relationships.service';
import { PostgresInventoryRelationshipRepository } from '../src/inventory/relationships/relationships.repository';
import type { InventoryRelationshipStore } from '../src/inventory/relationships/relationships.types';
import type { WorkspacePrincipal } from '../src/workspace-context';

const sourceId = randomUUID();
const targetId = randomUUID();
const relationshipId = randomUUID();
const now = new Date('2038-03-04T05:06:07.000Z');

function principal(role: WorkspacePrincipal['role']): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role,
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId: randomUUID(),
  };
}

function relationship(): StoredInventoryRelationship {
  return {
    createdAt: now,
    id: relationshipId,
    inventoryState: 'TRACKED',
    notes: null,
    provenance: 'USER_MAPPED',
    relationshipType: 'GROUPS',
    source: { entityId: sourceId, entityKind: 'PROJECT' },
    target: { entityId: targetId, entityKind: 'DOMAIN' },
    updatedAt: now,
  };
}

function createInput(
  relationshipType: CreateInventoryRelationshipRequest['relationshipType'],
  sourceKind: CreateInventoryRelationshipRequest['source']['entityKind'],
  targetKind: CreateInventoryRelationshipRequest['target']['entityKind'],
): CreateInventoryRelationshipRequest {
  return {
    relationshipType,
    source: { entityId: sourceId, entityKind: sourceKind },
    target: { entityId: targetId, entityKind: targetKind },
  };
}

describe('inventory relationship contracts and rules', () => {
  it.each([
    ['GROUPS', 'PROJECT', 'DOMAIN'],
    ['HOSTED_ON', 'WEBSITE_APPLICATION', 'SERVER'],
    ['USES_DOMAIN', 'WEBSITE_APPLICATION', 'DOMAIN'],
    ['DEPENDS_ON', 'SERVER', 'CLOUD_RESOURCE'],
    ['ROUTES_TO', 'DOMAIN', 'WEBSITE_APPLICATION'],
    ['CONNECTED_TO', 'CLOUD_RESOURCE', 'SERVER'],
  ] as const)('accepts valid %s topology', (type, sourceKind, targetKind) => {
    expect(() => {
      validateInventoryRelationshipDefinition(
        createInput(type, sourceKind, targetKind),
      );
    }).not.toThrow();
  });

  it('rejects an invalid relationship matrix and every self-edge', () => {
    expect(() => {
      validateInventoryRelationshipDefinition(
        createInput('HOSTED_ON', 'DOMAIN', 'SERVER'),
      );
    }).toThrow(InvalidInventoryRelationshipError);
    expect(() => {
      validateInventoryRelationshipDefinition({
        relationshipType: 'DEPENDS_ON',
        source: { entityId: sourceId, entityKind: 'SERVER' },
        target: { entityId: sourceId, entityKind: 'SERVER' },
      });
    }).toThrow(InvalidInventoryRelationshipError);
  });

  it('rejects client-owned and immutable relationship fields', () => {
    expect(
      CreateInventoryRelationshipRequestSchema.safeParse({
        ...createInput('GROUPS', 'PROJECT', 'DOMAIN'),
        sourceNodeId: randomUUID(),
        workspaceId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      UpdateInventoryRelationshipRequestSchema.safeParse({
        relationshipType: 'USES_DOMAIN',
        source: { entityId: sourceId, entityKind: 'PROJECT' },
      }).success,
    ).toBe(false);
  });

  it('requires source and target filter identities as complete pairs', () => {
    expect(
      InventoryRelationshipListQuerySchema.safeParse({
        sourceEntityKind: 'PROJECT',
      }).success,
    ).toBe(false);
    expect(
      InventoryRelationshipListQuerySchema.safeParse({
        targetEntityId: targetId,
      }).success,
    ).toBe(false);
    expect(
      InventoryRelationshipListQuerySchema.parse({
        relationshipType: 'GROUPS',
        sourceEntityId: sourceId,
        sourceEntityKind: 'PROJECT',
      }),
    ).toEqual(
      expect.objectContaining({ includeArchived: false, limit: 50 }),
    );
    expect(
      InventoryRelationshipListQuerySchema.safeParse({ limit: 101 }).success,
    ).toBe(false);
  });
});

describe('InventoryRelationshipService authorization', () => {
  const record = relationship();
  const store: InventoryRelationshipStore = {
    archive: vi.fn(() => Promise.resolve(true)),
    create: vi.fn(() => Promise.resolve(record)),
    findById: vi.fn(() => Promise.resolve(record)),
    list: vi.fn(() => Promise.resolve({ items: [record], nextCursor: null })),
    update: vi.fn(() => Promise.resolve(record)),
  };
  const service = new InventoryRelationshipService(store);

  it('allows members to read but denies create, patch, and archive', async () => {
    const member = principal('member');
    await expect(service.get(member, relationshipId)).resolves.toEqual(record);
    await expect(
      service.list(member, { includeArchived: false, limit: 50 }),
    ).resolves.toEqual({ items: [record], nextCursor: null });
    await expect(
      service.create(member, createInput('GROUPS', 'PROJECT', 'DOMAIN')),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    await expect(
      service.update(member, relationshipId, { notes: 'denied' }),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
    await expect(
      service.archive(member, relationshipId),
    ).rejects.toBeInstanceOf(InventoryWriteForbiddenError);
  });

  it.each(['owner', 'admin'] as const)('allows %s relationship writes', async (role) => {
    const actor = principal(role);
    await expect(
      service.create(actor, createInput('GROUPS', 'PROJECT', 'DOMAIN')),
    ).resolves.toEqual(record);
    await expect(
      service.update(actor, relationshipId, { inventoryState: 'TRACKED' }),
    ).resolves.toEqual(record);
    await expect(service.archive(actor, relationshipId)).resolves.toBeUndefined();
  });
});

describe('PostgresInventoryRelationshipRepository error mapping', () => {
  it('maps an RLS-hidden or missing endpoint to one generic not-found error', async () => {
    const repository = new PostgresInventoryRelationshipRepository({
      withWorkspaceContext: () =>
        Promise.reject(new InventoryNodeNotFoundError()),
    });

    await expect(
      repository.create(
        randomUUID(),
        createInput('GROUPS', 'PROJECT', 'DOMAIN'),
      ),
    ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
  });
});
