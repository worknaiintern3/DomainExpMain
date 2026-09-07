import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export function createRequestId(
  request: IncomingMessage | Http2ServerRequest,
): string {
  const header = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;

  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

export function registerRequestIdMiddleware(
  app: NestFastifyApplication,
): void {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;

  fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id);
    done();
  });
}
