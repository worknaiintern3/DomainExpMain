import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type {
  AssociatedInventoryEntity,
  InventoryGraphRelationship,
} from '@domainpulse/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http';
import { ProblemDetailsFilter } from '../src/common/http/problem-details.filter';
import { InventoryPersistenceError } from '../src/inventory/inventory.errors';
import { InventoryReadModelsController } from '../src/inventory/read-models/inventory-read-models.controller';
import { InventoryReadModelService } from '../src/inventory/read-models/inventory-read-models.service';
import type { InventoryReadModelStore } from '../src/inventory/read-models/inventory-read-models.types';
import {
  WorkspaceContextGuard,
  WorkspaceContextService,
  type WorkspacePrincipal,
} from '../src/workspace-context';

const userId = randomUUID();
const sessionId = randomUUID();
const rootId = randomUUID();
const oppositeId = randomUUID();
const memberWorkspaceId = randomUUID();
const ownerWorkspaceId = randomUUID();
const adminWorkspaceId = randomUUID();
const now = new Date('2042-02-03T04:05:06.000Z');
const accessTokenService = new AccessTokenService(
  {
    audience: 'graph-read-test-clients',
    issuer: 'graph-read-test-api',
    signingKey: Buffer.alloc(32, 37),
    ttlSeconds: 300,
  },
  () => 2_300_000_000,
);
const token = accessTokenService.issue({ sessionId, userId }).token;

const associations: readonly AssociatedInventoryEntity[] = [
  {
    associationSources: ['PRIMARY_STRUCTURAL', 'FLEXIBLE_RELATIONSHIP'],
    entityId: oppositeId,
    entityKind: 'WEBSITE_APPLICATION',
  },
];
const outbound: InventoryGraphRelationship = {
  createdAt: now,
  direction: 'OUTBOUND',
  id: randomUUID(),
  inventoryState: 'TRACKED',
  notes: null,
  oppositeEndpoint: { entityId: oppositeId, entityKind: 'SERVER' },
  provenance: 'USER_MAPPED',
  relationshipType: 'HOSTED_ON',
  updatedAt: now,
};
const inbound: InventoryGraphRelationship = {
  ...outbound,
  direction: 'INBOUND',
  id: randomUUID(),
  oppositeEndpoint: {
    entityId: oppositeId,
    entityKind: 'WEBSITE_APPLICATION',
  },
};

const listProjectResources = vi.fn<
  InventoryReadModelStore['listProjectResources']
>(() => Promise.resolve(associations));
const listApplicationDomains = vi.fn<
  InventoryReadModelStore['listApplicationDomains']
>(() => Promise.resolve(associations));
const listApplicationHostingTargets = vi.fn<
  InventoryReadModelStore['listApplicationHostingTargets']
>(() => Promise.resolve([outbound]));
const listHostedApplications = vi.fn<
  InventoryReadModelStore['listHostedApplications']
>(() => Promise.resolve([inbound]));
const listDependencies = vi.fn<InventoryReadModelStore['listDependencies']>(
  () => Promise.resolve([outbound]),
);
const listDependents = vi.fn<InventoryReadModelStore['listDependents']>(() =>
  Promise.resolve([inbound]),
);
const listConnections = vi.fn<InventoryReadModelStore['listConnections']>(() =>
  Promise.resolve([inbound]),
);
const listImmediateRelationships = vi.fn<
  InventoryReadModelStore['listImmediateRelationships']
>(() => Promise.resolve([outbound, inbound]));
const store: InventoryReadModelStore = {
  listApplicationDomains,
  listApplicationHostingTargets,
  listConnections,
  listDependencies,
  listDependents,
  listHostedApplications,
  listImmediateRelationships,
  listProjectResources,
};
const readModelService = new InventoryReadModelService(store);

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
  controllers: [InventoryReadModelsController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: InventoryReadModelService, useValue: readModelService },
    { provide: WorkspaceContextService, useValue: { resolve: resolveWorkspace } },
    AccessTokenGuard,
    WorkspaceContextGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
class TestInventoryReadModelsModule {
  readonly testModule = true;
}

const routes = [
  `/projects/${rootId}/resources`,
  `/applications/${rootId}/domains`,
  `/applications/${rootId}/hosting-targets`,
  `/servers/${rootId}/hosted-applications`,
  `/cloud-resources/${rootId}/hosted-applications`,
  `/inventory-graph/SERVER/${rootId}/dependencies`,
  `/inventory-graph/DOMAIN/${rootId}/dependents`,
  `/inventory-graph/SERVER/${rootId}/connections`,
  `/inventory-graph/PROJECT/${rootId}/relationships`,
] as const;

describe('inventory graph read HTTP endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestInventoryReadModelsModule,
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

  it.each(routes)('requires authentication for %s', async (route) => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1${route}`,
    });
    expect(response.statusCode).toBe(401);
  });

  it.each(['member', 'owner', 'admin'] as const)(
    'allows %s reads',
    async (role) => {
      const workspaceId =
        role === 'member'
          ? memberWorkspaceId
          : role === 'owner'
            ? ownerWorkspaceId
            : adminWorkspaceId;
      const response = await app.inject({
        headers: {
          authorization: `Bearer ${token}`,
          'x-workspace-id': workspaceId,
        },
        method: 'GET',
        url: `/api/v1/projects/${rootId}/resources`,
      });
      expect(response.statusCode).toBe(200);
    },
  );

  it.each(routes)('returns a public one-hop read model for %s', async (route) => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1${route}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<Record<string, unknown>>();
    expect(body).toHaveProperty('items');
    expect(response.body).not.toMatch(
      /workspaceId|sourceNodeId|targetNodeId|nodeId/u,
    );
  });

  it('returns inbound and outbound generic relationship directions', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/inventory-graph/PROJECT/${rootId}/relationships`,
    });
    expect(response.json()).toEqual({
      items: [
        expect.objectContaining({ direction: 'OUTBOUND' }),
        expect.objectContaining({ direction: 'INBOUND' }),
      ],
    });
  });

  it('passes explicit archived inclusion to one set-oriented repository call', async () => {
    const calls = listProjectResources.mock.calls.length;
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/projects/${rootId}/resources?includeArchived=true`,
    });
    expect(response.statusCode).toBe(200);
    expect(listProjectResources.mock.calls).toHaveLength(calls + 1);
    expect(listProjectResources).toHaveBeenLastCalledWith(
      memberWorkspaceId,
      rootId,
      { includeArchived: true },
    );
  });

  it('rejects malformed IDs, invalid route kinds, and malformed queries', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const malformedId = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/projects/not-a-uuid/resources',
    });
    const invalidDependencyKind = await app.inject({
      headers,
      method: 'GET',
      url: `/api/v1/inventory-graph/DOMAIN/${rootId}/dependencies`,
    });
    const invalidConnectionKind = await app.inject({
      headers,
      method: 'GET',
      url: `/api/v1/inventory-graph/PROJECT/${rootId}/connections`,
    });
    const malformedQuery = await app.inject({
      headers,
      method: 'GET',
      url: `/api/v1/projects/${rootId}/resources?includeArchived=yes`,
    });
    expect(malformedId.statusCode).toBe(400);
    expect(invalidDependencyKind.statusCode).toBe(400);
    expect(invalidConnectionKind.statusCode).toBe(400);
    expect(malformedQuery.statusCode).toBe(400);
  });

  it('keeps unexpected persistence failures sanitized', async () => {
    listProjectResources.mockRejectedValueOnce(new InventoryPersistenceError());
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/projects/${rootId}/resources`,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(
      expect.objectContaining({ detail: 'An unexpected error occurred.' }),
    );
    expect(response.body).not.toContain('database detail');
  });
});
