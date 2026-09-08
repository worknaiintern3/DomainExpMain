import { randomUUID } from 'node:crypto';

import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  WorkspaceAccessDeniedError,
  WorkspaceContextGuard,
  WorkspaceContextService,
  type ResolvedWorkspaceMembership,
  type WorkspaceContextRequest,
  type WorkspaceContextStore,
  type WorkspaceRole,
} from '../src/workspace-context';

function buildContext(request: Partial<WorkspaceContextRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => request,
      getResponse: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function buildMembership(
  role: WorkspaceRole = 'owner',
): ResolvedWorkspaceMembership {
  return {
    membershipId: randomUUID(),
    role,
    workspaceId: randomUUID(),
  };
}

function buildStore(
  membership: ResolvedWorkspaceMembership | undefined,
): WorkspaceContextStore {
  return {
    findExplicitMembership: vi.fn(() => Promise.resolve(membership)),
    findPersonalMembership: vi.fn(() => Promise.resolve(membership)),
  };
}

describe('WorkspaceContextService', () => {
  it('defaults to the structurally designated personal workspace', async () => {
    const membership = buildMembership();
    const store = buildStore(membership);
    const principal = { sessionId: randomUUID(), userId: randomUUID() };

    await expect(
      new WorkspaceContextService(store).resolve(principal),
    ).resolves.toEqual({ ...principal, ...membership });
    expect(store.findPersonalMembership).toHaveBeenCalledWith(principal.userId);
    expect(store.findExplicitMembership).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin', 'member'] as const)(
    'uses the trusted database membership role %s for an explicit workspace',
    async (role) => {
      const membership = buildMembership(role);
      const store = buildStore(membership);
      const principal = { sessionId: randomUUID(), userId: randomUUID() };

      await expect(
        new WorkspaceContextService(store).resolve(
          principal,
          membership.workspaceId,
        ),
      ).resolves.toEqual({ ...principal, ...membership });
      expect(store.findExplicitMembership).toHaveBeenCalledWith(
        principal.userId,
        membership.workspaceId,
      );
      expect(store.findPersonalMembership).not.toHaveBeenCalled();
    },
  );

  it('returns one safe denial for missing and non-member workspaces', async () => {
    const service = new WorkspaceContextService(buildStore(undefined));
    const principal = { sessionId: randomUUID(), userId: randomUUID() };

    const absentDefault = await service
      .resolve(principal)
      .catch((error: unknown) => error);
    const absentExplicit = await service
      .resolve(principal, randomUUID())
      .catch((error: unknown) => error);

    for (const error of [absentDefault, absentExplicit]) {
      expect(error).toBeInstanceOf(WorkspaceAccessDeniedError);
      expect(error).toEqual(
        expect.objectContaining({
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'Workspace access denied',
        }),
      );
    }
  });
});

describe('WorkspaceContextGuard', () => {
  it('requires the existing authenticated request principal', async () => {
    const guard = new WorkspaceContextGuard(
      new WorkspaceContextService(buildStore(buildMembership())),
    );

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([['not-a-uuid'], [[randomUUID(), randomUUID()]]])(
    'rejects malformed or ambiguous workspace selection',
    async (headerValue) => {
      const store = buildStore(buildMembership());
      const guard = new WorkspaceContextGuard(
        new WorkspaceContextService(store),
      );
      const request = {
        authPrincipal: { sessionId: randomUUID(), userId: randomUUID() },
        headers: { 'x-workspace-id': headerValue },
      } as unknown as WorkspaceContextRequest;

      await expect(
        guard.canActivate(buildContext(request)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(store.findExplicitMembership).not.toHaveBeenCalled();
      expect(store.findPersonalMembership).not.toHaveBeenCalled();
    },
  );

  it('resolves an absent header and attaches the workspace principal', async () => {
    const membership = buildMembership('member');
    const request = {
      authPrincipal: { sessionId: randomUUID(), userId: randomUUID() },
      headers: {},
    } as unknown as WorkspaceContextRequest;
    const guard = new WorkspaceContextGuard(
      new WorkspaceContextService(buildStore(membership)),
    );

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.workspacePrincipal).toEqual({
      ...request.authPrincipal,
      ...membership,
    });
  });

  it('maps membership denial to a generic forbidden response', async () => {
    const request = {
      authPrincipal: { sessionId: randomUUID(), userId: randomUUID() },
      headers: { 'x-workspace-id': randomUUID() },
    } as unknown as WorkspaceContextRequest;
    const guard = new WorkspaceContextGuard(
      new WorkspaceContextService(buildStore(undefined)),
    );

    const error = await guard
      .canActivate(buildContext(request))
      .catch((guardError: unknown) => guardError);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as Error).message).toBe('Workspace access denied');
  });
});
