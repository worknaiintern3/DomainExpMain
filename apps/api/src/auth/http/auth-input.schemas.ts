import { z } from 'zod';

import { MAX_REFRESH_TOKEN_INPUT_LENGTH } from '../session';

const EmailSchema = z.string().trim().max(320).pipe(z.email());
const BoundedPasswordSchema = z.string().min(1).max(256);

export const RegisterRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    email: EmailSchema,
    password: BoundedPasswordSchema.min(12),
  })
  .strict();

export const LoginRequestSchema = z
  .object({
    email: EmailSchema,
    password: BoundedPasswordSchema,
  })
  .strict();

export const RefreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1).max(MAX_REFRESH_TOKEN_INPUT_LENGTH),
  })
  .strict();
