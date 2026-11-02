import { z } from 'zod';

import { MAX_REFRESH_TOKEN_INPUT_LENGTH } from '../session';

export function isValidEmailFormat(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.includes('..')) return false;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) return false;
  }
  const tld = labels[labels.length - 1];
  if (!tld || !/^[a-zA-Z]{2,}$/.test(tld)) return false;
  return true;
}

const EmailSchema = z
  .string()
  .trim()
  .max(320)
  .pipe(z.email())
  .refine(isValidEmailFormat, { message: 'Invalid email address format' })
  .transform((val) => val.toLowerCase());
const BoundedPasswordSchema = z.string().min(1).max(256);

export const RegisterRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    email: EmailSchema,
    password: BoundedPasswordSchema.min(8),
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
    password: BoundedPasswordSchema.min(8),
  })
  .strict();
