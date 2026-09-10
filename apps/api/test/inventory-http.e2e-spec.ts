import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http';
import { ProblemDetailsFilter } from '../src/common/http/problem-details.filter';
import { ApplicationsController } from '../src/inventory/applications/applications.controller';
import { CloudResourcesController } from '../src/inventory/cloud-resources/cloud-resources.controller';
import { DomainsController } from '../src/inventory/domains/domains.controller';
import { EmailAccountsController } from '../src/inventory/email-accounts/email-accounts.controller';
import {
  InventoryConflictError,
  InventoryPersistenceError,
} from '../src/inventory/inventory.errors';
import { InventoryService } from '../src/inventory/inventory.service';
import type { InventoryStore } from '../src/inventory/inventory.types';
import { ProjectsController } from '../src/inventory/projects/projects.controller';
import { ProviderAccountsController } from '../src/inventory/provider-accounts/provider-accounts.controller';
import { ServersController } from '../src/inventory/servers/servers.controller';
import {
  WorkspaceContextGuard,
  WorkspaceContextService,
  type WorkspacePrincipal,
} from '../src/workspace-context';

const userId = randomUUID();
const sessionId = randomUUID();
const memberWorkspaceId = randomUUID();
const ownerWorkspaceId = randomUUID();
const adminWorkspaceId = randomUUID();
const projectId = randomUUID();
const now = new Date('2036-02-03T04:05:06.000Z');
const accessTokenService = new AccessTokenService(
  {
    audience: 'inventory-test-clients',
    issuer: 'inventory-test-api',
    signingKey: Buffer.alloc(32, 23),
    ttlSeconds: 300,
  },
  () => 2_100_000_000,
);
const token = accessTokenService.issue({ sessionId, userId }).token;

function projectRecord(workspaceId: string, name = 'Inventory Project') {
  return {
    createdAt: now,
    description: null,
    id: projectId,
    inventoryState: 'TRACKED' as const,
    name,
    normalizedName: name.toLowerCase(),
    provenance: 'USER_ADDED' as const,
    updatedAt: now,
    workspaceId,
  };
}

const archive = vi.fn<InventoryStore['archive']>(() => Promise.resolve(true));
const create = vi.fn<InventoryStore['create']>((workspaceId, command) => {
  if (command.resource !== 'project') {
    return Promise.reject(new Error('Unexpected HTTP test resource'));
  }
  return Promise.resolve({
    resource: 'project',
    record: projectRecord(workspaceId, command.values.name),
  });
});
const findById = vi.fn<InventoryStore['findById']>((workspaceId) =>
  Promise.resolve({ resource: 'project', record: projectRecord(workspaceId) }),
);
const list = vi.fn<InventoryStore['list']>((workspaceId) =>
  Promise.resolve({
    items: [{ resource: 'project', record: projectRecord(workspaceId) }],
    nextCursor: null,
  }),
);
const update = vi.fn<InventoryStore['update']>((workspaceId, _id, command) => {
  if (command.resource !== 'project') {
    return Promise.reject(new Error('Unexpected HTTP test resource'));
  }
  return Promise.resolve({
    resource: 'project',
    record: projectRecord(workspaceId, command.values.name ?? 'Inventory Project'),
  });
});
const store: InventoryStore = { archive, create, findById, list, update };
const inventoryService = new InventoryService(store, () => now);

const workspaceRoles = new Map<string, WorkspacePrincipal['role']>([
  [memberWorkspaceId, 'member'],
  [ownerWorkspaceId, 'owner'],
  [adminWorkspaceId, 'admin'],
]);
const resolveWorkspace = vi.fn(
  (principal: { readonly sessionId: string; readonly userId: string }, workspaceId?: string) => {
    const selectedWorkspaceId = workspaceId ?? memberWorkspaceId;
    const role = workspaceRoles.get(selectedWorkspaceId);
    if (!role) {
      return Promise.reject(new Error('Unexpected workspace test selection'));
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
  controllers: [
    EmailAccountsController,
    ProviderAccountsController,
    ProjectsController,
    DomainsController,
    ServersController,
    CloudResourcesController,
    ApplicationsController,
  ],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: InventoryService, useValue: inventoryService },
    { provide: WorkspaceContextService, useValue: { resolve: resolveWorkspace } },
    AccessTokenGuard,
    WorkspaceContextGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
class TestInventoryHttpModule {
  readonly testModule = true;
}

describe('inventory HTTP endpoints', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestInventoryHttpModule,
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

  it.each([
    '/email-accounts',
    '/provider-accounts',
    '/projects',
    '/domains',
    '/servers',
    '/cloud-resources',
    '/applications',
  ])('requires authentication for %s', async (route) => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1${route}`,
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows a member to read safe public records', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
    });
    const body = response.json<Record<string, unknown>>();

    expect(response.statusCode).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({ id: projectId, name: 'Inventory Project' }),
    );
    expect(body).not.toHaveProperty('workspaceId');
    expect(body).not.toHaveProperty('normalizedName');
    expect(body).not.toHaveProperty('nodeId');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('refreshTokenHash');
  });

  it.each([
    ['POST', '/api/v1/projects', { name: 'Denied' }],
    ['PATCH', `/api/v1/projects/${projectId}`, { name: 'Denied' }],
    ['DELETE', `/api/v1/projects/${projectId}`, undefined],
  ] as const)('denies member %s writes', async (method, url, payload) => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method,
      ...(payload === undefined ? {} : { payload }),
      url,
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows owner and admin writes', async () => {
    const ownerCreate = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'POST',
      payload: { name: 'Owner Project' },
      url: '/api/v1/projects',
    });
    const adminPatch = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': adminWorkspaceId,
      },
      method: 'PATCH',
      payload: { name: 'Admin Project' },
      url: `/api/v1/projects/${projectId}`,
    });
    const ownerDelete = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'DELETE',
      url: `/api/v1/projects/${projectId}`,
    });

    expect(ownerCreate.statusCode).toBe(201);
    expect(adminPatch.statusCode).toBe(200);
    expect(ownerDelete.statusCode).toBe(204);
  });

  it('rejects client-owned workspace and lifecycle fields', async () => {
    const createCallCount = create.mock.calls.length;
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'POST',
      payload: {
        inventoryState: 'TRACKED',
        name: 'Invalid Project',
        provenance: 'USER_ADDED',
        workspaceId: ownerWorkspaceId,
      },
      url: '/api/v1/projects',
    });
    expect(response.statusCode).toBe(400);
    expect(create.mock.calls).toHaveLength(createCallCount);
  });

  it('rejects malformed record identifiers and cursors safely', async () => {
    const headers = { authorization: `Bearer ${token}` };
    const invalidId = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/projects/not-a-uuid',
    });
    const invalidCursor = await app.inject({
      headers,
      method: 'GET',
      url: '/api/v1/projects?cursor=malformed',
    });
    expect(invalidId.statusCode).toBe(400);
    expect(invalidCursor.statusCode).toBe(400);
  });

  it('maps a canonical uniqueness race to a safe conflict response', async () => {
    create.mockRejectedValueOnce(new InventoryConflictError());
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${token}`,
        'x-workspace-id': ownerWorkspaceId,
      },
      method: 'POST',
      payload: { domainName: 'xn--bcher-kva.example' },
      url: '/api/v1/domains',
    });
    expect(response.statusCode).toBe(409);
    expect(response.body).not.toContain('23505');
  });

  it('keeps unexpected persistence failures sanitized', async () => {
    list.mockRejectedValueOnce(new InventoryPersistenceError());
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: '/api/v1/projects',
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual(
      expect.objectContaining({ detail: 'An unexpected error occurred.' }),
    );
    expect(response.body).not.toContain('INVENTORY_PERSISTENCE_ERROR');
  });
});
