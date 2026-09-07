import { z } from 'zod';

export const ReadyResponseSchema = z
  .object({
    status: z.literal('ready'),
    service: z.literal('domainpulse-api'),
    database: z.literal('available'),
  })
  .strict();

export const NotReadyResponseSchema = z
  .object({
    status: z.literal('not_ready'),
    service: z.literal('domainpulse-api'),
    database: z.literal('unavailable'),
  })
  .strict();

export const ReadinessResponseSchema = z.discriminatedUnion('status', [
  ReadyResponseSchema,
  NotReadyResponseSchema,
]);

export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;
export type NotReadyResponse = z.infer<typeof NotReadyResponseSchema>;
export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const READY_RESPONSE: ReadyResponse = {
  status: 'ready',
  service: 'domainpulse-api',
  database: 'available',
};

export const NOT_READY_RESPONSE: NotReadyResponse = {
  status: 'not_ready',
  service: 'domainpulse-api',
  database: 'unavailable',
};
