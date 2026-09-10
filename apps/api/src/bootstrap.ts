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
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [...API_CORS_ALLOWED_HEADERS],
    exposedHeaders: ['ETag', 'Location', 'X-Request-Id'],
    maxAge: 86_400,
  });
  registerRequestIdMiddleware(app);
  app.enableShutdownHooks();

  return app;
}
