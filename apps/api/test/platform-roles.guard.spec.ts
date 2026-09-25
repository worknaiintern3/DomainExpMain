import { randomUUID } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedRequest } from '../src/auth/http';
import { PlatformRolesGuard } from '../src/auth/platform-role/platform-roles.guard';
import { PLATFORM_ROLES_KEY } from '../src/auth/platform-role/platform-roles.decorator';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getNext: () => undefined,
      getRequest: () => request,
      getResponse: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformRolesGuard', () => {
  it('allows access when no platform roles are required', async () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;

    const mockDbService = {
      database: {},
    } as any;

    const guard = new PlatformRolesGuard(reflector, mockDbService);
    const request = {} as AuthenticatedRequest;

    const result = await guard.canActivate(buildContext(request));
    expect(result).toBe(true);
  });

  it('rejects unauthenticated request when platform roles are required', async () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PLATFORM_ROLES_KEY ? ['ADMIN', 'SUPER_ADMIN'] : undefined,
    } as unknown as Reflector;

    const mockDbService = {
      database: {},
    } as any;

    const guard = new PlatformRolesGuard(reflector, mockDbService);
    const request = { headers: {} } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects regular USER role with ForbiddenException', async () => {
    const userId = randomUUID();
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PLATFORM_ROLES_KEY ? ['ADMIN', 'SUPER_ADMIN'] : undefined,
    } as unknown as Reflector;

    const mockDbService = {
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: userId, platformRole: 'USER' }],
            }),
          }),
        }),
      },
    } as any;

    const guard = new PlatformRolesGuard(reflector, mockDbService);
    const request = {
      authPrincipal: { sessionId: randomUUID(), userId },
    } as AuthenticatedRequest;

    await expect(guard.canActivate(buildContext(request))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows ADMIN role access', async () => {
    const userId = randomUUID();
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PLATFORM_ROLES_KEY ? ['ADMIN', 'SUPER_ADMIN'] : undefined,
    } as unknown as Reflector;

    const mockDbService = {
      database: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: userId, platformRole: 'ADMIN' }],
            }),
          }),
        }),
      },
    } as any;

    const guard = new PlatformRolesGuard(reflector, mockDbService);
    const request = {
      authPrincipal: { sessionId: randomUUID(), userId },
    } as AuthenticatedRequest;

    const result = await guard.canActivate(buildContext(request));
    expect(result).toBe(true);
  });
});
