import { randomUUID } from 'node:crypto';

import { CanActivate, ExecutionContext, Injectable, Module, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { APP_FILTER, HttpAdapterHost, NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessTokenService } from '../src/auth/access-token';
import { ProblemDetailsFilter } from '../src/common/http/problem-details.filter';
import { ProviderConnectionsController } from '../src/provider-connections/provider-connections.controller';
import {
  InvalidIdempotencyKeyError,
  ProviderConnectionDisconnectedError,
  ProviderConnectionNotFoundError,
  ProviderConnectionSyncInProgressError,
  ProviderConnectionWriteForbiddenError,
  ProviderCredentialValidationFailedError,
  ProviderValidationAttemptFailedError,
} from '../src/provider-connections/provider-connections.errors';
import { ProviderConnectionsService } from '../src/provider-connections/provider-connections.service';
import type { ProviderConnectionSummary } from '../src/provider-connections/provider-connections.types';
import {
  WorkspaceContextGuard,
  WorkspaceContextService,
  type WorkspacePrincipal,
} from '../src/workspace-context';

interface ConnectionResponseBody {
  readonly connectionStatus: string;
  readonly credentialMask: string;
  readonly id: string;
}

interface ConnectionListResponseBody {
  readonly items: ConnectionResponseBody[];
}

interface ManualSyncResponseBody {
  readonly id: string;
  readonly status: string;
  readonly trigger: string;
}

interface DisconnectResponseBody {
  readonly connectionStatus: string;
  readonly id: string;
}

const userId = randomUUID();
const sessionId = randomUUID();
const memberWorkspaceId = randomUUID();
const ownerWorkspaceId = randomUUID();
const adminWorkspaceId = randomUUID();
const providerAccountId = randomUUID();
const now = new Date('2036-02-03T04:05:06.000Z');

const accessTokenService = new AccessTokenService(
  {
    audience: 'provider-connections-test-clients',
    issuer: 'provider-connections-test-api',
    signingKey: Buffer.alloc(32, 41),
    ttlSeconds: 300,
  },
  () => 2_100_000_000,
);
const token = accessTokenService.issue({ sessionId, userId }).token;

@Injectable()
class FakeAccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; authPrincipal?: unknown }>();
    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }
    request.authPrincipal = { sessionId, userId };
    return true;
  }
}

function connectionRecord(overrides: Partial<ProviderConnectionSummary> = {}): ProviderConnectionSummary {
  return {
    authType: 'CLOUDFLARE_API_TOKEN',
    connectionStatus: 'CONNECTED',
    createdAt: now,
    credentialMask: '••••1234',
    disconnectedAt: null,
    id: randomUUID(),
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

// In-memory state, keyed by workspaceId -> connection list.
const connectionsByWorkspace = new Map<string, ProviderConnectionSummary[]>([
  [ownerWorkspaceId, [connectionRecord({ id: randomUUID() })]],
]);
const idempotencyRuns = new Map<string, { id: string }>();
// Connection ids for which the validate mock simulates a transient/upstream
// validation-attempt failure instead of a credential-rejection outcome.
const transientValidationFailureIds = new Set<string>();
// Connection ids for which the manual-sync mock simulates a different
// already-active run (INITIAL/SCHEDULED/RETRY/other MANUAL), rather than an
// exact idempotency-key match.
const activeSyncConflictIds = new Set<string>();

function findConnection(workspaceId: string, id: string): ProviderConnectionSummary | undefined {
  return connectionsByWorkspace.get(workspaceId)?.find((c) => c.id === id);
}

function replaceConnection(workspaceId: string, updated: ProviderConnectionSummary): void {
  const list = connectionsByWorkspace.get(workspaceId) ?? [];
  const index = list.findIndex((c) => c.id === updated.id);
  if (index === -1) return;
  list[index] = updated;
  connectionsByWorkspace.set(workspaceId, list);
}

const mockService = {
  createConnection: vi.fn(
    (
      principal: WorkspacePrincipal,
      input: { authType: string; credential: string; providerAccountId: string },
    ): Promise<ProviderConnectionSummary> => {
      if (principal.role === 'member') throw new ProviderConnectionWriteForbiddenError();
      if (input.credential === 'invalid-token') {
        throw new ProviderCredentialValidationFailedError('AUTH_INVALID');
      }
      const created = connectionRecord({ id: randomUUID(), providerAccountId: input.providerAccountId });
      const list = connectionsByWorkspace.get(principal.workspaceId) ?? [];
      list.push(created);
      connectionsByWorkspace.set(principal.workspaceId, list);
      return Promise.resolve(created);
    },
  ),
  disconnect: vi.fn(
    (
      principal: WorkspacePrincipal,
      id: string,
    ): Promise<{ connectionStatus: 'DISCONNECTED'; disconnectedAt: string; id: string }> => {
      if (principal.role === 'member') throw new ProviderConnectionWriteForbiddenError();
      const connection = findConnection(principal.workspaceId, id);
      if (!connection) throw new ProviderConnectionNotFoundError();
      replaceConnection(principal.workspaceId, {
        ...connection,
        connectionStatus: 'DISCONNECTED',
        credentialMask: 'Disconnected',
        disconnectedAt: now,
        nextSyncAt: null,
      });
      return Promise.resolve({ connectionStatus: 'DISCONNECTED', disconnectedAt: now.toISOString(), id });
    },
  ),
  enqueueManualSync: vi.fn(
    (
      principal: WorkspacePrincipal,
      id: string,
      rawKey: string | undefined,
    ): Promise<{ id: string; message: string; status: 'QUEUED'; trigger: 'MANUAL' }> => {
      if (principal.role === 'member') throw new ProviderConnectionWriteForbiddenError();
      if (!rawKey) throw new InvalidIdempotencyKeyError();
      const connection = findConnection(principal.workspaceId, id);
      if (!connection) throw new ProviderConnectionNotFoundError();
      if (connection.connectionStatus === 'DISCONNECTED') throw new ProviderConnectionDisconnectedError();
      const internalKey = `${id}:${rawKey}`;
      const existing = idempotencyRuns.get(internalKey);
      if (existing) {
        return Promise.resolve({ id: existing.id, message: 'already queued', status: 'QUEUED', trigger: 'MANUAL' });
      }
      // A different key must not be attached to an unrelated active run: the
      // request was never accepted/queued, so it fails closed instead of
      // fabricating a QUEUED/MANUAL success.
      if (activeSyncConflictIds.has(id)) {
        throw new ProviderConnectionSyncInProgressError();
      }
      const run = { id: randomUUID() };
      idempotencyRuns.set(internalKey, run);
      return Promise.resolve({ id: run.id, message: 'queued successfully', status: 'QUEUED', trigger: 'MANUAL' });
    },
  ),
  getConnection: vi.fn(
    (principal: WorkspacePrincipal, id: string): Promise<ProviderConnectionSummary> => {
      const connection = findConnection(principal.workspaceId, id);
      if (!connection) throw new ProviderConnectionNotFoundError();
      return Promise.resolve(connection);
    },
  ),
  listConnections: vi.fn(
    (principal: WorkspacePrincipal): Promise<ProviderConnectionSummary[]> =>
      Promise.resolve(connectionsByWorkspace.get(principal.workspaceId) ?? []),
  ),
  listSyncRuns: vi.fn((principal: WorkspacePrincipal, id: string): Promise<never[]> => {
    const connection = findConnection(principal.workspaceId, id);
    if (!connection) throw new ProviderConnectionNotFoundError();
    return Promise.resolve([]);
  }),
  replaceCredential: vi.fn(
    (principal: WorkspacePrincipal, id: string, credential: string): Promise<ProviderConnectionSummary> => {
      if (principal.role === 'member') throw new ProviderConnectionWriteForbiddenError();
      const connection = findConnection(principal.workspaceId, id);
      if (!connection) throw new ProviderConnectionNotFoundError();
      if (connection.connectionStatus === 'DISCONNECTED') throw new ProviderConnectionDisconnectedError();
      if (credential === 'invalid-replacement') {
        throw new ProviderCredentialValidationFailedError('AUTH_INVALID');
      }
      const updated = { ...connection, credentialMask: '••••9999' };
      replaceConnection(principal.workspaceId, updated);
      return Promise.resolve(updated);
    },
  ),
  validateConnection: vi.fn(
    (
      principal: WorkspacePrincipal,
      id: string,
    ): Promise<{ lastValidatedAt: string; validationErrorCode: null; validationStatus: 'VALID' }> => {
      if (principal.role === 'member') throw new ProviderConnectionWriteForbiddenError();
      const connection = findConnection(principal.workspaceId, id);
      if (!connection) throw new ProviderConnectionNotFoundError();
      if (transientValidationFailureIds.has(id)) {
        throw new ProviderValidationAttemptFailedError('RATE_LIMITED');
      }
      return Promise.resolve({ lastValidatedAt: now.toISOString(), validationErrorCode: null, validationStatus: 'VALID' });
    },
  ),
};

const fakeAccessTokenGuard = new FakeAccessTokenGuard();
const fakeWorkspaceGuard = new WorkspaceContextGuard({ resolve: resolveWorkspace } as unknown as WorkspaceContextService);

const productionGuards = Reflect.getMetadata(GUARDS_METADATA, ProviderConnectionsController) as unknown;
Reflect.defineMetadata(GUARDS_METADATA, [], ProviderConnectionsController);

@Module({
  controllers: [ProviderConnectionsController],
  providers: [
    { provide: AccessTokenService, useValue: accessTokenService },
    { provide: ProviderConnectionsService, useValue: mockService },
    { provide: WorkspaceContextService, useValue: { resolve: resolveWorkspace } },
    {
      provide: APP_FILTER,
      inject: [HttpAdapterHost],
      useFactory: (adapterHost: HttpAdapterHost) => new ProblemDetailsFilter(adapterHost),
    },
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Nest modules are decorator-only classes.
class TestProviderConnectionsModule {}

describe('Phase 10E provider connections REST API', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      TestProviderConnectionsModule,
      new FastifyAdapter({ logger: false }),
      { logger: false },
    );
    app.useGlobalGuards(fakeAccessTokenGuard, fakeWorkspaceGuard);
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    Reflect.defineMetadata(GUARDS_METADATA, productionGuards, ProviderConnectionsController);
    await app.close();
  });

  beforeEach(() => {
    idempotencyRuns.clear();
  });

  describe('RBAC', () => {
    it('owner can connect', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        payload: { authType: 'CLOUDFLARE_API_TOKEN', credential: 'cf-good-1234', providerAccountId },
        url: '/api/v1/provider-connections',
      });
      expect(response.statusCode).toBe(201);
    });

    it('admin can connect', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': adminWorkspaceId },
        method: 'POST',
        payload: { authType: 'CLOUDFLARE_API_TOKEN', credential: 'cf-good-1234', providerAccountId },
        url: '/api/v1/provider-connections',
      });
      expect(response.statusCode).toBeLessThan(300);
    });

    it('member is denied connect', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
        method: 'POST',
        payload: { authType: 'CLOUDFLARE_API_TOKEN', credential: 'cf-good-1234', providerAccountId },
        url: '/api/v1/provider-connections',
      });
      expect(response.statusCode).toBe(403);
    });

    it('member can read the list and a single connection', async () => {
      connectionsByWorkspace.set(memberWorkspaceId, [connectionRecord({ id: randomUUID() })]);
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      expect(list.statusCode).toBe(200);
      const body = list.json<ConnectionListResponseBody>();
      expect(body.items.length).toBeGreaterThan(0);

      const detail = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
        method: 'GET',
        url: `/api/v1/provider-connections/${body.items[0]?.id ?? ''}`,
      });
      expect(detail.statusCode).toBe(200);
    });
  });

  describe('cross-workspace isolation', () => {
    it('a connection from another workspace is not found', async () => {
      const ownerList = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      const foreignId = ownerList.json<ConnectionListResponseBody>().items[0]?.id ?? '';

      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
        method: 'GET',
        url: `/api/v1/provider-connections/${foreignId}`,
      });
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('workspaceId');
    });
  });

  describe('safe output', () => {
    it('never returns ciphertext, iv, auth tag, key version, or credential', async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      expect(list.statusCode).toBe(200);
      for (const forbidden of [
        'encryptedCiphertext',
        'encryptionIv',
        'encryptionAuthTag',
        'keyVersion',
        'credential"',
        'authorization',
        'Bearer',
      ]) {
        expect(list.body).not.toContain(forbidden);
      }
    });
  });

  describe('create validates before persistence', () => {
    it('an invalid token never creates a connection', async () => {
      const before = (
        await app.inject({
          headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
          method: 'GET',
          url: '/api/v1/provider-connections',
        })
      ).json<ConnectionListResponseBody>();

      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        payload: { authType: 'CLOUDFLARE_API_TOKEN', credential: 'invalid-token', providerAccountId },
        url: '/api/v1/provider-connections',
      });
      expect(response.statusCode).toBe(400);
      // The safe canonical code is retained in the response so the UI can
      // distinguish AUTH_INVALID from other outcomes, without exposing any
      // raw Cloudflare body/message/token.
      expect(response.json<{ detail: string }>().detail).toContain('AUTH_INVALID');

      const after = (
        await app.inject({
          headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
          method: 'GET',
          url: '/api/v1/provider-connections',
        })
      ).json<ConnectionListResponseBody>();
      expect(after.items.length).toBe(before.items.length);
    });
  });

  describe('credential rotation', () => {
    it('failed replacement preserves the old credential mask', async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      const target = list.json<ConnectionListResponseBody>().items[0];
      expect(target).toBeDefined();
      const targetId = target?.id ?? '';

      const failed = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'PUT',
        payload: { credential: 'invalid-replacement' },
        url: `/api/v1/provider-connections/${targetId}/credentials`,
      });
      expect(failed.statusCode).toBe(400);

      const after = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: `/api/v1/provider-connections/${targetId}`,
      });
      expect(after.json<ConnectionResponseBody>().credentialMask).toBe(target?.credentialMask);
    });

    it('successful replacement updates the credential mask', async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      const target = list.json<ConnectionListResponseBody>().items[0];
      expect(target).toBeDefined();
      const targetId = target?.id ?? '';

      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'PUT',
        payload: { credential: 'cf-new-token-9999' },
        url: `/api/v1/provider-connections/${targetId}/credentials`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json<ConnectionResponseBody>().credentialMask).toBe('••••9999');
    });
  });

  describe('transient validation attempt', () => {
    it('a transient/upstream validation failure returns a 409 with the safe code, not a persisted rejection', async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      const target = list.json<ConnectionListResponseBody>().items[0];
      expect(target).toBeDefined();
      const targetId = target?.id ?? '';
      transientValidationFailureIds.add(targetId);

      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${targetId}/validate`,
      });

      expect(response.statusCode).toBe(409);
      expect(response.json<{ detail: string }>().detail).toContain('RATE_LIMITED');
    });
  });

  describe('manual sync', () => {
    let connectionId = '';

    beforeAll(async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      connectionId = list.json<ConnectionListResponseBody>().items[0]?.id ?? '';
    });

    it('requires an Idempotency-Key header', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${connectionId}/sync`,
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 202 QUEUED/MANUAL and is idempotent for the same key', async () => {
      const key = `sync-key-${randomUUID()}`;
      const first = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${connectionId}/sync`,
      });
      expect(first.statusCode).toBe(202);
      const firstBody = first.json<ManualSyncResponseBody>();
      expect(firstBody).toMatchObject({ status: 'QUEUED', trigger: 'MANUAL' });

      const second = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${connectionId}/sync`,
      });
      expect(second.statusCode).toBe(202);
      expect(second.json<ManualSyncResponseBody>().id).toBe(firstBody.id);
      expect(second.body).not.toContain(key);
    });

    it('member is denied manual sync', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': 'member-key', 'x-workspace-id': memberWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${connectionId}/sync`,
      });
      expect(response.statusCode).toBe(403);
    });

    it('a different key while another sync is already active returns 409, never a fabricated QUEUED/MANUAL success', async () => {
      activeSyncConflictIds.add(connectionId);
      try {
        const response = await app.inject({
          headers: {
            authorization: `Bearer ${token}`,
            'idempotency-key': `unrelated-key-${randomUUID()}`,
            'x-workspace-id': ownerWorkspaceId,
          },
          method: 'POST',
          url: `/api/v1/provider-connections/${connectionId}/sync`,
        });
        expect(response.statusCode).toBe(409);
        expect(response.json<{ detail: string }>().detail).toContain('already in progress');
        // No fabricated success payload: no id/status/trigger claiming acceptance.
        expect(response.body).not.toMatch(/"trigger"/u);
        expect(response.body).not.toMatch(/"status"\s*:\s*"QUEUED"/u);
      } finally {
        activeSyncConflictIds.delete(connectionId);
      }
    });
  });

  describe('disconnect', () => {
    it('clears the credential and preserves the row (visible via GET)', async () => {
      const list = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: '/api/v1/provider-connections',
      });
      const target = list.json<ConnectionListResponseBody>().items[0];
      expect(target).toBeDefined();
      const targetId = target?.id ?? '';

      const disconnect = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${targetId}/disconnect`,
      });
      expect(disconnect.statusCode).toBe(200);
      expect(disconnect.json<DisconnectResponseBody>().connectionStatus).toBe('DISCONNECTED');

      const after = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': ownerWorkspaceId },
        method: 'GET',
        url: `/api/v1/provider-connections/${targetId}`,
      });
      expect(after.statusCode).toBe(200);
      const body = after.json<ConnectionResponseBody>();
      expect(body.connectionStatus).toBe('DISCONNECTED');
      expect(body.credentialMask).not.toContain('••••');
    });

    it('member is denied disconnect', async () => {
      const response = await app.inject({
        headers: { authorization: `Bearer ${token}`, 'x-workspace-id': memberWorkspaceId },
        method: 'POST',
        url: `/api/v1/provider-connections/${randomUUID()}/disconnect`,
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
