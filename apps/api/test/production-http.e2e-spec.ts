import { randomBytes } from 'node:crypto';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApplication } from '../src/bootstrap';
import { parseEnvironment } from '../src/config/env.schema';
import { MobileClientService } from '../src/mobile-client/mobile-client.service';

describe('production HTTP deployment', () => {
  let app: NestFastifyApplication | undefined;

  beforeAll(async () => {
    const environment = {
      NODE_ENV: 'production',
      LOG_LEVEL: 'silent',
      API_TRUST_PROXY_HOPS: '1',
      CORS_ORIGINS: 'https://app.domainexp.info',
      RATE_LIMIT_MAX: '2',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/domainpulse_test',
      DATABASE_CONNECTION_TIMEOUT_MS: '100',
      JWT_ACCESS_TOKEN_AUDIENCE: 'production-test-clients',
      JWT_ACCESS_TOKEN_ISSUER: 'production-test-api',
      JWT_ACCESS_TOKEN_SECRET: randomBytes(32).toString('base64url'),
      PROVIDER_CREDENTIAL_ENCRYPTION_KEY_V1: randomBytes(32).toString('base64'),
      GOOGLE_OAUTH_CLIENT_ID: 'test-client',
      GOOGLE_OAUTH_CLIENT_SECRET: 'test-secret',
      GOOGLE_OAUTH_REDIRECT_URI: 'https://app.domainexp.info/auth/google/callback',
    };
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value);
    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('allows the configured browser origin and refuses an unrelated origin', async () => {
    const allowed = await app!.inject({
      method: 'OPTIONS', url: '/api/v1/auth/login',
      headers: {
        origin: 'https://app.domainexp.info',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type,x-workspace-id',
      },
    });
    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.domainexp.info');
    const denied = await app!.inject({
      method: 'GET', url: '/health', headers: { origin: 'https://untrusted.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const native = await app!.inject({ method: 'GET', url: '/health' });
    expect(native.statusCode).toBe(200);
  });

  it('keeps rate-limit buckets separate for clients behind Nginx', async () => {
    const request = (ip: string) => app!.inject({
      method: 'GET', url: '/missing', headers: { 'x-forwarded-for': ip },
    });
    expect((await request('203.0.113.10')).statusCode).toBe(404);
    expect((await request('203.0.113.10')).statusCode).toBe(404);
    expect((await request('203.0.113.10')).statusCode).toBe(429);
    expect((await request('203.0.113.11')).statusCode).toBe(404);
  });

  it('blocks both development session endpoints before accessing accounts', async () => {
    const issueSession = vi.spyOn(app!.get(MobileClientService), 'getOrCreateMobileSession');
    for (const method of ['GET', 'POST'] as const) {
      const response = await app!.inject({
        method, url: '/api/v1/mobile/session',
        headers: { 'x-forwarded-for': '203.0.113.20' },
        ...(method === 'POST' ? { payload: { email: 'victim@example.com' } } : {}),
      });
      expect(response.statusCode).toBe(404);
    }
    expect(issueSession).not.toHaveBeenCalled();
  });

  it('does not trust forwarded headers by default and rejects multiple proxy hops', () => {
    expect(parseEnvironment({}).API_TRUST_PROXY_HOPS).toBe(0);
    expect(() => parseEnvironment({ API_TRUST_PROXY_HOPS: '2' })).toThrow();
  });
});
