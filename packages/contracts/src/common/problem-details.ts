import { z } from 'zod';

export const ProblemDetailsSchema = z
  .object({
    type: z.string().min(1),
    title: z.string().min(1),
    status: z.number().int().min(400).max(599),
    detail: z.string().min(1),
    instance: z.string().min(1),
    requestId: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
