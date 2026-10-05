import { RequestMethod, type NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import {
  createRequestId,
  registerRequestIdMiddleware,
} from './common/http/request-id.middleware';
import { registerRateLimiterMiddleware } from './common/http/rate-limiter.middleware';
import { AppConfigService } from './config/config.module';
import { parseEnvironment } from './config/env.schema';

export const API_CORS_ALLOWED_HEADERS = [
  'Accept',
  'Authorization',
  'Content-Type',
  'Idempotency-Key',
  'If-Match',
  'X-Request-Id',
  'X-Workspace-Id',
] as const;

export async function createApplication(): Promise<NestFastifyApplication> {
  const environment = parseEnvironment(process.env);
  const nestOptions: NestApplicationOptions =
    environment.NODE_ENV === 'test' ? { logger: false } : {};
  const fastifyLogger =
    environment.NODE_ENV === 'test' || environment.LOG_LEVEL === 'silent'
      ? false
      : { level: environment.LOG_LEVEL };
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      genReqId: createRequestId,
      logger: fastifyLogger,
      trustProxy: false,
    }),
    nestOptions,
  );
  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...API_CORS_ALLOWED_HEADERS],
    exposedHeaders: ['ETag', 'Location', 'X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86_400,
  });
  registerRequestIdMiddleware(app);
  registerRateLimiterMiddleware(app, {
    max: config.rateLimitMax,
    windowMs: config.rateLimitWindowMs,
  });
  app.enableShutdownHooks();

  return app;
}
