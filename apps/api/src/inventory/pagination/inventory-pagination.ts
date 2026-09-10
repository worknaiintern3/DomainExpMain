import { z } from 'zod';

import { InvalidInventoryCursorError } from '../inventory.errors';
import type { InventoryCursorPosition } from '../inventory.types';

const CursorPayloadSchema = z
  .object({
    createdAt: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => Number.isFinite(Date.parse(value))),
    id: z.uuid(),
    version: z.literal(1),
  })
  .strict();

export function encodeInventoryCursor(
  position: InventoryCursorPosition,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: position.createdAt,
      id: position.id,
      version: 1,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeInventoryCursor(
  cursor: string | undefined,
): InventoryCursorPosition | undefined {
  if (cursor === undefined) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = CursorPayloadSchema.parse(JSON.parse(decoded) as unknown);
    const canonicalCursor = Buffer.from(decoded, 'utf8').toString('base64url');
    if (canonicalCursor !== cursor) {
      throw new InvalidInventoryCursorError();
    }
    return { createdAt: payload.createdAt, id: payload.id };
  } catch (error) {
    if (error instanceof InvalidInventoryCursorError) {
      throw error;
    }
    throw new InvalidInventoryCursorError();
  }
}
