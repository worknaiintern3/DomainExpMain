import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccessTokenService } from '../src/auth/access-token';
import { AccessTokenGuard } from '../src/auth/http/access-token.guard';
import { PlatformRolesGuard } from '../src/auth/platform-role/platform-roles.guard';
import { DatabaseService } from '../src/database/database.service';
import { AdminPlatformController } from '../src/mobile-admin/admin-platform.controller';
import { MobileAdminService } from '../src/mobile-admin/mobile-admin.service';

const adminId = randomUUID();
const userId = randomUUID();
const tokens = new AccessTokenService({
  audience: 'admin-test', issuer: 'admin-test', signingKey: Buffer.alloc(32, 42), ttlSeconds: 300,
});
const stats = vi.fn(async () => ({ users: 7 }));
const findUser = vi.fn(async ({ id }: { id: string }) => ({
  id, platformRole: id === adminId ? 'ADMIN' : 'USER',
}));

@Module({
  controllers: [AdminPlatformController],
  providers: [
    AccessTokenGuard, PlatformRolesGuard,
    { provide: AccessTokenService, useValue: tokens },
    { provide: DatabaseService, useValue: { collections: { users: { findOne: findUser } } } },
    { provide: MobileAdminService, useValue: { getPlatformStats: stats } },
  ],
})
class TestModule {}

describe('public admin access', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app?.close(); });

  it('does not expose an endpoint that creates privileged sessions', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/admin/platform/session', payload: {} });
    expect(response.statusCode).toBe(404);
    expect(response.json()).not.toHaveProperty('accessToken');
  });
  it('rejects anonymous admin data access', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/platform/stats' });
    expect(response.statusCode).toBe(401);
    expect(stats).not.toHaveBeenCalled();
  });
  it('rejects a valid session belonging to a regular user', async () => {
    const token = tokens.issue({ sessionId: randomUUID(), userId }).token;
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/platform/stats', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(403);
    expect(stats).not.toHaveBeenCalled();
  });
  it('allows a signed-in administrator', async () => {
    const token = tokens.issue({ sessionId: randomUUID(), userId: adminId }).token;
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/platform/stats', headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ users: 7 });
  });
});
