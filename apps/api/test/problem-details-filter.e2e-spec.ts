import 'reflect-metadata';

import {
  Controller,
  Get,
  Module,
  UnauthorizedException,
  type Provider,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { APP_FILTER } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns the REAL APP_FILTER provider definition declared by AppModule.
 * The test reuses this exact object (no copy), so it pins the production
 * registration rather than duplicating it.
 */
function readAppFilterDefinition(): unknown {
  const providers: unknown = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AppModule,
  );
  if (!Array.isArray(providers)) {
    return undefined;
  }
  return providers.find(
    (entry) => isRecord(entry) && entry['provide'] === APP_FILTER,
  );
}

@Controller('probe')
class ProbeController {
  @Get('unauthorized')
  unauthorized(): string {
    throw new UnauthorizedException('Authentication required');
  }

  @Get('boom')
  boom(): string {
    throw new Error('simulated defect');
  }
}

describe('ProblemDetailsFilter registration', () => {
  it('declares explicit HttpAdapterHost injection instead of useClass', () => {
    // Under the tsx dev runtime, decorator parameter metadata is absent, so
    // a useClass registration constructs the filter with an undefined
    // HttpAdapterHost and every handled error becomes a 500. The inject +
    // useFactory form used here works without reflected metadata.
    const definition = readAppFilterDefinition();
    expect(isRecord(definition)).toBe(true);
    if (!isRecord(definition)) {
      return;
    }
    expect(definition['useClass']).toBeUndefined();
    expect(typeof definition['useFactory']).toBe('function');
    expect(Array.isArray(definition['inject'])).toBe(true);
  });

  describe('through the real AppModule definition', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const definition = readAppFilterDefinition();
      expect(isRecord(definition)).toBe(true);
      if (!isRecord(definition)) {
        throw new Error('APP_FILTER definition missing from AppModule');
      }

      @Module({
        controllers: [ProbeController],
        providers: [definition as unknown as Provider],
      })
      class FilterRegistrationModule {}

      app = await NestFactory.create<NestFastifyApplication>(
        FilterRegistrationModule,
        new FastifyAdapter({ logger: false }),
        { logger: false },
      );
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('replies 401 Problem Details instead of crashing the filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/probe/unauthorized',
      });
      const body = response.json() as Record<string, unknown>;

      expect(response.statusCode).toBe(401);
      expect(body).toEqual(
        expect.objectContaining({
          detail: 'Authentication required',
          status: 401,
          title: 'Unauthorized',
          type: 'about:blank',
        }),
      );
      expect(typeof body['instance']).toBe('string');
      expect(typeof body['requestId']).toBe('string');
      expect(Number.isNaN(Date.parse(String(body['timestamp'])))).toBe(false);
      expect(response.body).not.toContain('httpAdapter');
    });

    it('sanitizes unexpected errors instead of leaking internals', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/probe/boom',
      });
      const body = response.json() as Record<string, unknown>;

      expect(response.statusCode).toBe(500);
      expect(body).toEqual(
        expect.objectContaining({
          detail: 'An unexpected error occurred.',
          status: 500,
        }),
      );
      expect(response.body).not.toContain('simulated defect');
    });
  });
});
