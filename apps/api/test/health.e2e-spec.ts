import {
  HealthResponseSchema,
  ProblemDetailsSchema,
} from '@domainpulse/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { InternalServerErrorException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/bootstrap';
import { toProblemDetails } from '../src/common/http/problem-details.filter';
import { parseEnvironment } from '../src/config/env.schema';

describe('DomainPulse API foundation', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots successfully', () => {
    expect(app).toBeDefined();
  });

  it('returns the shared health contract from GET /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      service: 'domainpulse-api',
    });
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('returns the centralized problem format for an unknown route', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/missing-route',
      headers: { 'x-request-id': 'phase1-test-request' },
    });
    const problem = ProblemDetailsSchema.parse(response.json());

    expect(response.statusCode).toBe(404);
    expect(problem.status).toBe(404);
    expect(problem.requestId).toBe('phase1-test-request');
    expect(problem.instance).toBe('/missing-route');
    expect(problem).not.toHaveProperty('stack');
  });

  it('masks unexpected production-style errors and omits stack traces', () => {
    const problem = toProblemDetails(
      new InternalServerErrorException('sensitive internal detail'),
      {
        id: 'phase1-error-request',
        url: '/api/v1/example',
      },
    );
    const serialized = JSON.stringify(problem);

    expect(ProblemDetailsSchema.parse(problem).status).toBe(500);
    expect(problem.detail).toBe('An unexpected error occurred.');
    expect(serialized).not.toContain('sensitive internal detail');
    expect(serialized.toLowerCase()).not.toContain('stack');
  });

  it('validates and normalizes explicit environment configuration', () => {
    const environment = parseEnvironment({
      NODE_ENV: 'test',
      API_HOST: '127.0.0.1',
      API_PORT: '4001',
      CORS_ORIGINS: 'http://localhost:5173,https://app.domainpulse.example',
      LOG_LEVEL: 'silent',
    });

    expect(environment.API_PORT).toBe(4001);
    expect(environment.CORS_ORIGINS).toEqual([
      'http://localhost:5173',
      'https://app.domainpulse.example',
    ]);
  });

  it('rejects invalid ports and wildcard CORS origins', () => {
    expect(() => parseEnvironment({ API_PORT: '70000' })).toThrow(
      'Invalid API environment configuration',
    );
    expect(() => parseEnvironment({ CORS_ORIGINS: '*' })).toThrow(
      'Invalid API environment configuration',
    );
  });
});
