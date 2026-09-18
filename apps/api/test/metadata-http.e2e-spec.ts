/* eslint-disable @typescript-eslint/require-await */
import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http';
import { ProblemDetailsFilter } from '../src/common/http/problem-details.filter';
import { InventoryRecordNotFoundError, InventoryWriteForbiddenError } from '../src/inventory/inventory.errors';
import { MetadataController } from '../src/metadata/metadata.controller';
import { MetadataService } from '../src/metadata/metadata.service';
import {
  WorkspaceAccessDeniedError,
  WorkspaceContextGuard,
  WorkspaceContextService,
  type WorkspacePrincipal,
} from '../src/workspace-context';

const userId = randomUUID();
const sessionId = randomUUID();
const ownerWorkspaceId = randomUUID();
const adminWorkspaceId = randomUUID();
const memberWorkspaceId = randomUUID();
const domainId = randomUUID();
const foreignDomainId = randomUUID();
const accessTokenService = new AccessTokenService({
  audience: 'metadata-test-clients',
  issuer: 'metadata-test-api',
  signingKey: Buffer.alloc(32, 41),
  ttlSeconds: 300,
}, () => 2_100_000_000);
const token = accessTokenService.issue({ sessionId, userId }).token;
const roles = new Map<string, WorkspacePrincipal['role']>([
  [ownerWorkspaceId, 'owner'],
  [adminWorkspaceId, 'admin'],
  [memberWorkspaceId, 'member'],
]);

const resolveWorkspace = vi.fn(async (
  principal: { readonly sessionId: string; readonly userId: string },
  selectedWorkspaceId?: string,
) => {
  const workspaceId = selectedWorkspaceId ?? ownerWorkspaceId;
  const role = roles.get(workspaceId);
  if (!role) throw new WorkspaceAccessDeniedError();
  return { ...principal, membershipId: randomUUID(), role, workspaceId };
});
const accessTokenGuard = new AccessTokenGuard(accessTokenService);
const workspaceContextGuard = new WorkspaceContextGuard({
  resolve: resolveWorkspace,
} as unknown as WorkspaceContextService);
const productionGuardMetadata = Reflect.getMetadata(
  GUARDS_METADATA,
  MetadataController,
) as unknown;

Reflect.defineMetadata(
  GUARDS_METADATA,
  [],
  MetadataController,
);

const emptyMetadata = (canRefresh: boolean) => ({
  canRefresh,
  dns: null,
  domainId,
  rdap: null,
  tls: null,
});

const getMetadata = vi.fn(async (principal: WorkspacePrincipal, requestedDomainId: string) => {
  if (requestedDomainId === foreignDomainId) throw new InventoryRecordNotFoundError();
  return emptyMetadata(principal.role !== 'member');
});
const refreshMetadata = vi.fn(async (
  principal: WorkspacePrincipal,
  requestedDomainId: string,
  sources?: readonly string[],
) => {
  if (principal.role === 'member') throw new InventoryWriteForbiddenError();
  return {
    domainId: requestedDomainId,
    metadata: emptyMetadata(true),
    results: {
      dns: { errorCode: 'DNS_PARTIAL_FAILURE', status: 'PARTIAL' },
      rdap: { errorCode: null, status: 'SUCCESS' },
      ...(sources?.includes('tls') === false ? {} : { tls: { errorCode: 'TLS_CONNECT_TIMEOUT', status: 'FAILED' } }),
    },
  };
});

@Module({
  controllers: [MetadataController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: MetadataService, useValue: { get: getMetadata, refresh: refreshMetadata } },
    { provide: WorkspaceContextService, useValue: { resolve: resolveWorkspace } },
    { provide: AccessTokenGuard, useValue: accessTokenGuard },
    { provide: WorkspaceContextGuard, useValue: workspaceContextGuard },
    {
      provide: APP_FILTER,
      inject: [HttpAdapterHost],
      useFactory: (adapterHost: HttpAdapterHost) => new ProblemDetailsFilter(adapterHost),
    },
  ],
})
class TestMetadataHttpModule {
  readonly testModule = true;
}

describe('domain metadata HTTP API', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestMetadataHttpModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );

    app.useGlobalGuards(
      accessTokenGuard,
      workspaceContextGuard,
    );

    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    Reflect.defineMetadata(
      GUARDS_METADATA,
      productionGuardMetadata,
      MetadataController,
    );

    await app.close();
  });

  it.each([
    ['GET', `/api/v1/domains/${domainId}/metadata`],
    ['POST', `/api/v1/domains/${domainId}/metadata/refresh`],
  ] as const)('requires authentication for %s metadata', async (method, url) => {
    const response = await app.inject({ method, ...(method === 'POST' ? { payload: {} } : {}), url });
    expect(response.statusCode).toBe(401);
  });

  it('enforces workspace membership selection', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': randomUUID() },
      method: 'GET',
      url: `/api/v1/domains/${domainId}/metadata`,
    });
    expect(response.statusCode).toBe(403);
  });

  it.each([
    [ownerWorkspaceId, true],
    [adminWorkspaceId, true],
    [memberWorkspaceId, false],
  ] as const)('allows workspace roles to read truthful never-checked state', async (workspaceId, canRefresh) => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId },
      method: 'GET',
      url: `/api/v1/domains/${domainId}/metadata`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(emptyMetadata(canRefresh));
  });

  it('returns generic not found for an inaccessible domain and no internal fields', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      url: `/api/v1/domains/${foreignDomainId}/metadata`,
    });
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('workspaceId');
    expect(response.body).not.toContain('nodeId');
  });

  it.each([ownerWorkspaceId, adminWorkspaceId])('allows owner/admin refresh with default all-source orchestration', async (workspaceId) => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId },
      method: 'POST',
      payload: {},
      url: `/api/v1/domains/${domainId}/metadata/refresh`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      results: {
        dns: { errorCode: 'DNS_PARTIAL_FAILURE', status: 'PARTIAL' },
        rdap: { errorCode: null, status: 'SUCCESS' },
        tls: { errorCode: 'TLS_CONNECT_TIMEOUT', status: 'FAILED' },
      },
    });
    expect(refreshMetadata).toHaveBeenLastCalledWith(expect.objectContaining({ workspaceId }), domainId, undefined);
  });

  it('denies member refresh through the existing write authorization taxonomy', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
      method: 'POST',
      payload: {},
      url: `/api/v1/domains/${domainId}/metadata/refresh`,
    });
    expect(response.statusCode).toBe(403);
  });

  it.each([
    { sources: ['unknown'] },
    { sources: [] },
    { domainName: 'client-controlled.example', sources: ['dns'] },
    { sources: ['dns'], workspaceId: ownerWorkspaceId },
  ])('strictly rejects invalid refresh bodies', async (payload) => {
    const calls = refreshMetadata.mock.calls.length;
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload,
      url: `/api/v1/domains/${domainId}/metadata/refresh`,
    });
    expect(response.statusCode).toBe(400);
    expect(refreshMetadata).toHaveBeenCalledTimes(calls);
  });

  it('deduplicates validated source selection before orchestration', async () => {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      payload: { sources: ['dns', 'dns'] },
      url: `/api/v1/domains/${domainId}/metadata/refresh`,
    });
    expect(response.statusCode).toBe(200);
    expect(refreshMetadata).toHaveBeenLastCalledWith(expect.anything(), domainId, ['dns']);
  });
});
