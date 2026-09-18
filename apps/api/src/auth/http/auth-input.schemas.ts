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

/** No body fields are accepted -- the authorization request is built entirely from server-held static configuration (see GoogleOAuthService.startLogin), never from caller input. */
export const GoogleOAuthStartRequestSchema = z.object({}).strict();

export const GoogleOAuthCallbackRequestSchema = z
  .object({
    code: z.string().trim().min(1).max(2_048),
    state: z.string().trim().min(1).max(512),
  })
  .strict();

/** No body fields are accepted -- Connect Google's authorization request is built entirely from server-held configuration plus the authenticated caller's principal (see GoogleOAuthService.startLink), never from caller input. */
export const GoogleLinkStartRequestSchema = z.object({}).strict();

/** Reuses the exact same password policy as registration (`RegisterRequestSchema`) -- Add Password is not a second, weaker policy. */
export const AddPasswordRequestSchema = z
  .object({
    password: BoundedPasswordSchema.min(12),
  })
  .strict();
