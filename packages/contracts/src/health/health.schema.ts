import { z } from 'zod';

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('domainpulse-api'),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const HEALTH_RESPONSE: HealthResponse = {
  status: 'ok',
  service: 'domainpulse-api',
};
