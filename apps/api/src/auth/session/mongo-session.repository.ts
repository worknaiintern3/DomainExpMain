import { randomUUID } from 'node:crypto';

import { SessionPersistenceError } from './session.errors';
import type {
  RefreshRotationPersistenceResult,
  RotateRefreshCredentialInput,
  SessionStore,
} from './session.types';
import type { DatabaseService } from '../../database/database.service';

export class MongoSessionRepository implements SessionStore {
  constructor(private readonly database: DatabaseService) {}

  async rotateRefreshCredential(
    input: RotateRefreshCredentialInput,
  ): Promise<RefreshRotationPersistenceResult> {
    const collections = this.database.collections;
    if (!collections) {
      throw new SessionPersistenceError();
    }

    try {
      // Find and update session atomically
      const claimedSession = await collections.sessions.findOneAndUpdate(
        {
          refreshTokenHash: input.currentRefreshTokenHash,
          revokedAt: null,
          expiresAt: { $gt: input.rotatedAt } as any,
        },
        {
          $set: {
            lastSeenAt: input.rotatedAt,
            revokedAt: input.rotatedAt,
            updatedAt: input.rotatedAt,
          } as any,
        },
        { returnDocument: 'after' },
      );

      if (claimedSession) {
        const nextSessionId = randomUUID();
        const nextSession = {
          id: nextSessionId,
          userId: claimedSession.userId,
          refreshTokenHash: input.nextRefreshTokenHash,
          expiresAt: input.nextExpiresAt,
          revokedAt: null,
          createdAt: input.rotatedAt,
          updatedAt: input.rotatedAt,
        };

        await collections.sessions.insertOne(nextSession as any);

        return {
          kind: 'rotated',
          session: {
            expiresAt: input.nextExpiresAt,
            sessionId: nextSessionId,
            userId: claimedSession.userId,
          },
        };
      }

      // Check if session exists (expired or replayed)
      const matchedSession = await collections.sessions.findOne({
        refreshTokenHash: input.currentRefreshTokenHash,
      });

      if (!matchedSession) {
        return { kind: 'invalid' };
      }

      if (matchedSession.revokedAt) {
        // Replay attack: revoke all user sessions
        await collections.sessions.updateMany(
          {
            userId: matchedSession.userId,
            revokedAt: null,
          },
          {
            $set: {
              revokedAt: input.rotatedAt,
              updatedAt: input.rotatedAt,
            } as any,
          },
        );

        return { kind: 'replayed' };
      }

      // Expired: mark revoked
      await collections.sessions.updateOne(
        {
          id: matchedSession.id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: input.rotatedAt,
            updatedAt: input.rotatedAt,
          } as any,
        },
      );

      return { kind: 'invalid' };
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
    const collections = this.database.collections;
    if (!collections) {
      throw new SessionPersistenceError();
    }

    try {
      await collections.sessions.updateOne(
        {
          id: sessionId,
          userId,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt,
            updatedAt: revokedAt,
          } as any,
        },
      );
    } catch {
      throw new SessionPersistenceError();
    }
  }
}
