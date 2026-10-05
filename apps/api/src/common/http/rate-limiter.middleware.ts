import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function registerRateLimiterMiddleware(
  app: NestFastifyApplication,
  options: {
    max: number;
    windowMs: number;
  } = {
    max: 5000,
    windowMs: 15 * 60 * 1000, // 15 minutes = 900,000 ms
  },
): void {
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  const ipBuckets = new Map<string, RateLimitBucket>();

  // Periodically clean up expired buckets every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of ipBuckets.entries()) {
      if (bucket.resetAt <= now) {
        ipBuckets.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  fastify.addHook('onRequest', (request, reply, done) => {
    // Skip healthcheck/readiness probes
    const url = request.url || '';
    if (url === '/health' || url === '/ready') {
      return done();
    }

    const now = Date.now();
    const clientKey = request.ip || 'global';

    let bucket = ipBuckets.get(clientKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + options.windowMs,
      };
      ipBuckets.set(clientKey, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, options.max - bucket.count);
    const resetSec = Math.ceil((bucket.resetAt - now) / 1000);

    reply.header('X-RateLimit-Limit', options.max.toString());
    reply.header('X-RateLimit-Remaining', remaining.toString());
    reply.header('X-RateLimit-Reset', resetSec.toString());

    if (bucket.count > options.max) {
      reply.header('Retry-After', resetSec.toString());
      return reply.status(429).send({
        status: 429,
        title: 'Too Many Requests',
        detail: `Rate limit of ${options.max} requests per ${Math.round(options.windowMs / 60000)} minutes exceeded. Please retry in ${resetSec} seconds.`,
      });
    }

    done();
  });
}
