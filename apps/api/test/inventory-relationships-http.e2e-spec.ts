import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  InvalidInventoryRelationshipError,
  validateInventoryRelationshipDefinition,
  type StoredInventoryRelationship,
} from '@domainpulse/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http';
import { ProblemDetailsFilter } from '../src/common/http/problem-details.filter';
import {
  InvalidInventoryInputError,
  InventoryConflictError,
  InventoryPersistenceError,
} from '../src/inventory/inventory.errors';
import { InventoryRelationshipsController } from '../src/inventory/relationships/relationships.controller';
import { InventoryRelationshipService } from '../src/inventory/relationships/relationships.service';
import type { InventoryRelationshipStore } from '../src/inventory/relationships/relationships.types';
import {
  WorkspaceContextGuard,
  WorkspaceContextService,
  type WorkspacePrincipal,
} from '../src/workspace-context';

const userId = randomUUID();
const sessionId = randomUUID();
const relationshipId = randomUUID();
const sourceId = randomUUID();
const targetId = randomUUID();
const memberWorkspaceId = randomUUID();
const ownerWorkspaceId = randomUUID();
const adminWorkspaceId = randomUUID();
const now = new Date('2039-04-05T06:07:08.000Z');
const accessTokenService = new AccessTokenService(
  {
    audience: 'relationship-test-clients',
    issuer: 'relationship-test-api',
    signingKey: Buffer.alloc(32, 31),
    ttlSeconds: 300,
  },
  () => 2_200_000_000,
);
const token = accessTokenService.issue({ sessionId, userId }).token;

function relationship(
  overrides: Partial<StoredInventoryRelationship> = {},
): StoredInventoryRelationship {
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
    ...overrides,
  };
}

const archive = vi.fn<InventoryRelationshipStore['archive']>(() =>
  Promise.resolve(true),
);
const create = vi.fn<InventoryRelationshipStore['create']>((_workspaceId, input) => {
  try {
    validateInventoryRelationshipDefinition(input);
  } catch (error) {
    if (error instanceof InvalidInventoryRelationshipError) {
      return Promise.reject(new InvalidInventoryInputError());
    }
    throw error;
  }
  return Promise.resolve(
    relationship({
      notes: input.notes ?? null,
      relationshipType: input.relationshipType,
      source: input.source,
      target: input.target,
    }),
  );
});
const findById = vi.fn<InventoryRelationshipStore['findById']>(() =>
  Promise.resolve(relationship()),
);
const list = vi.fn<InventoryRelationshipStore['list']>(() =>
  Promise.resolve({ items: [relationship()], nextCursor: null }),
);
const update = vi.fn<InventoryRelationshipStore['update']>((_workspaceId, _id, input) =>
  Promise.resolve(
    relationship({
      inventoryState: input.inventoryState ?? 'TRACKED',
      notes: input.notes ?? null,
    }),
  ),
);
const store: InventoryRelationshipStore = {
  archive,
  create,
  findById,
  list,
  update,
};
const relationshipService = new InventoryRelationshipService(store);

const workspaceRoles = new Map<string, WorkspacePrincipal['role']>([
  [memberWorkspaceId, 'member'],
  [ownerWorkspaceId, 'owner'],
  [adminWorkspaceId, 'admin'],
]);
const resolveWorkspace = vi.fn(
  (
    principal: { readonly sessionId: string; readonly userId: string },
    workspaceId?: string,
  ) => {
    const selectedWorkspaceId = workspaceId ?? memberWorkspaceId;
    const role = workspaceRoles.get(selectedWorkspaceId);
    if (!role) {
      return Promise.reject(new Error('Unexpected workspace selection'));
    }
    return Promise.resolve({
      ...principal,
      membershipId: randomUUID(),
      role,
      workspaceId: selectedWorkspaceId,
    });
  },
);

@Module({
  controllers: [InventoryRelationshipsController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: InventoryRelationshipService, useValue: relationshipService },
    { provide: WorkspaceContextService, useValue: { resolve: resolveWorkspace } },
    AccessTokenGuard,
    WorkspaceContextGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
class TestRelationshipHttpModule {
  readonly testModule = true;
}

describe('inventory relationship HTTP endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestRelationshipHttpModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/inventory-relationships',
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows member reads without exposing internal graph identity', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/inventory-relationships/${relationshipId}`,
    });
    const body = response.json<Record<string, unknown>>();
    expect(response.statusCode).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        relationshipType: 'GROUPS',
        source: { entityId: sourceId, entityKind: 'PROJECT' },
        target: { entityId: targetId, entityKind: 'DOMAIN' },
      }),
    );
    for (const field of [
      'workspaceId',
      'nodeId',
      'sourceNodeId',
      'targetNodeId',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it.each([
    ['POST', '/api/v1/inventory-relationships', {
      relationshipType: 'GROUPS',
      source: { entityId: sourceId, entityKind: 'PROJECT' },
      target: { entityId: targetId, entityKind: 'DOMAIN' },
    }],
    ['PATCH', `/api/v1/inventory-relationships/${relationshipId}`, { notes: 'denied' }],
    ['DELETE', `/api/v1/inventory-relationships/${relationshipId}`, undefined],
  ] as const)('denies member %s writes', async (method, url, payload) => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method,
      ...(payload === undefined ? {} : { payload }),
      url,
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows owner create and admin restore/archive writes', async () => {
    const ownerCreate = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'POST',
      payload: {
        relationshipType: 'GROUPS',
        source: { entityId: sourceId, entityKind: 'PROJECT' },
        target: { entityId: targetId, entityKind: 'DOMAIN' },
      },
      url: '/api/v1/inventory-relationships',
    });
    const adminRestore = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': adminWorkspaceId,
      },
      method: 'PATCH',
      payload: { inventoryState: 'TRACKED' },
      url: `/api/v1/inventory-relationships/${relationshipId}`,
    });
    const ownerDelete = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'DELETE',
      url: `/api/v1/inventory-relationships/${relationshipId}`,
    });
    expect(ownerCreate.statusCode).toBe(201);
    expect(adminRestore.statusCode).toBe(200);
    expect(ownerDelete.statusCode).toBe(204);
  });

  it('rejects invalid topology, self-edges, internal fields, immutable fields, and malformed queries', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'x-workspace-id': ownerWorkspaceId,
    };
    const invalidTopology = await app.inject({
      headers,
      method: 'POST',
      payload: {
        relationshipType: 'HOSTED_ON',
        source: { entityId: sourceId, entityKind: 'DOMAIN' },
        target: { entityId: targetId, entityKind: 'SERVER' },
      },
      url: '/api/v1/inventory-relationships',
    });
    const selfEdge = await app.inject({
      headers,
      method: 'POST',
      payload: {
        relationshipType: 'DEPENDS_ON',
        source: { entityId: sourceId, entityKind: 'SERVER' },
        target: { entityId: sourceId, entityKind: 'SERVER' },
      },
      url: '/api/v1/inventory-relationships',
    });
    const immutablePatch = await app.inject({
      headers,
      method: 'PATCH',
      payload: { relationshipType: 'USES_DOMAIN' },
      url: `/api/v1/inventory-relationships/${relationshipId}`,
    });
    const internalField = await app.inject({
      headers,
      method: 'POST',
      payload: {
        relationshipType: 'GROUPS',
        source: { entityId: sourceId, entityKind: 'PROJECT' },
        target: { entityId: targetId, entityKind: 'DOMAIN' },
        workspaceId: ownerWorkspaceId,
      },
      url: '/api/v1/inventory-relationships',
    });
    const partialFilter = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/inventory-relationships?sourceEntityKind=PROJECT',
    });
    const malformedCursor = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/inventory-relationships?cursor=malformed',
    });
    expect(invalidTopology.statusCode).toBe(400);
    expect(selfEdge.statusCode).toBe(400);
    expect(internalField.statusCode).toBe(400);
    expect(immutablePatch.statusCode).toBe(400);
    expect(partialFilter.statusCode).toBe(400);
    expect(malformedCursor.statusCode).toBe(400);
  });

  it('maps duplicates safely and keeps unexpected failures sanitized', async () => {
    create.mockRejectedValueOnce(new InventoryConflictError());
    const headers = {
      authorization: `Bearer ${token}`,
      'x-workspace-id': ownerWorkspaceId,
    };
    const payload = {
      relationshipType: 'GROUPS',
      source: { entityId: sourceId, entityKind: 'PROJECT' },
      target: { entityId: targetId, entityKind: 'DOMAIN' },
    };
    const conflict = await app.inject({
      headers,
      method: 'POST',
      payload,
      url: '/api/v1/inventory-relationships',
    });
    list.mockRejectedValueOnce(new InventoryPersistenceError());
    const failure = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/inventory-relationships',
    });
    expect(conflict.statusCode).toBe(409);
    expect(failure.statusCode).toBe(500);
    expect(failure.json()).toEqual(
      expect.objectContaining({ detail: 'An unexpected error occurred.' }),
    );
    expect(failure.body).not.toContain('INVENTORY_PERSISTENCE_ERROR');
  });

  it('rejects malformed relationship cursors', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/api/v1/inventory-relationships?cursor=malformed',
    });
    expect(response.statusCode).toBe(400);
  });
});
