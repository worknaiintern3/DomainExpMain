import { sessions } from '@domainpulse/database';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { SessionPersistenceError } from './session.errors';
import type {
  RefreshRotationPersistenceResult,
  RotateRefreshCredentialInput,
  SessionDatabaseHost,
  SessionStore,
} from './session.types';

export class PostgresSessionRepository implements SessionStore {
  constructor(private readonly host: SessionDatabaseHost) {}

  async rotateRefreshCredential(
    input: RotateRefreshCredentialInput,
  ): Promise<RefreshRotationPersistenceResult> {
    try {
      return await this.host.transaction(async (transaction) => {
        const [claimedSession] = await transaction
          .update(sessions)
          .set({
            lastSeenAt: input.rotatedAt,
            revokedAt: input.rotatedAt,
            updatedAt: input.rotatedAt,
          })
          .where(
            and(
              eq(sessions.refreshTokenHash, input.currentRefreshTokenHash),
              isNull(sessions.revokedAt),
              gt(sessions.expiresAt, input.rotatedAt),
            ),
          )
          .returning({ userId: sessions.userId });

        if (claimedSession) {
          const [nextSession] = await transaction
            .insert(sessions)
            .values({
              expiresAt: input.nextExpiresAt,
              refreshTokenHash: input.nextRefreshTokenHash,
              userId: claimedSession.userId,
            })
            .returning({
              expiresAt: sessions.expiresAt,
              sessionId: sessions.id,
              userId: sessions.userId,
            });

          if (!nextSession) {
            throw new SessionPersistenceError();
          }

          return {
            kind: 'rotated',
            session: nextSession,
          };
        }

        const [matchedSession] = await transaction
          .select({
            expiresAt: sessions.expiresAt,
            id: sessions.id,
            revokedAt: sessions.revokedAt,
            userId: sessions.userId,
          })
          .from(sessions)
          .where(eq(sessions.refreshTokenHash, input.currentRefreshTokenHash))
          .limit(1);

        if (!matchedSession) {
          return { kind: 'invalid' };
        }

        if (matchedSession.revokedAt) {
          await transaction
            .update(sessions)
            .set({
              revokedAt: input.rotatedAt,
              updatedAt: input.rotatedAt,
            })
            .where(
              and(
                eq(sessions.userId, matchedSession.userId),
                isNull(sessions.revokedAt),
              ),
            );

          return { kind: 'replayed' };
        }

        await transaction
          .update(sessions)
          .set({
            revokedAt: input.rotatedAt,
            updatedAt: input.rotatedAt,
          })
          .where(
            and(
              eq(sessions.id, matchedSession.id),
              isNull(sessions.revokedAt),
            ),
          );

        return { kind: 'invalid' };
      });
    } catch (error) {
      if (error instanceof SessionPersistenceError) {
        throw error;
      }

      throw new SessionPersistenceError();
    }
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    revokedAt: Date,
  ): Promise<void> {
    try {
      await this.host.database
        .update(sessions)
        .set({ revokedAt, updatedAt: revokedAt })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
          ),
        );
    } catch {
      throw new SessionPersistenceError();
    }
  }
}
