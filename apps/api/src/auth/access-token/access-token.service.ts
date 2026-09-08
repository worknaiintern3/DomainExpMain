import { sign, verify } from 'jsonwebtoken';
import { z } from 'zod';

import { InvalidAccessTokenError } from './access-token.errors';
import type {
  AccessTokenConfiguration,
  AccessTokenSubject,
  AuthenticatedPrincipal,
  IssuedAccessToken,
} from './access-token.types';

const ACCESS_TOKEN_ALGORITHM = 'HS256';
const MAX_ACCESS_TOKEN_LENGTH = 8_192;

const AccessTokenClaimsSchema = z
  .object({
    aud: z.string().min(1),
    exp: z.number().int().positive(),
    iat: z.number().int().nonnegative(),
    iss: z.string().min(1),
    sid: z.uuid(),
    sub: z.uuid(),
  })
  .loose();

export class AccessTokenService {
  constructor(
    private readonly configuration: AccessTokenConfiguration,
    private readonly nowSeconds: () => number = () =>
      Math.floor(Date.now() / 1_000),
  ) {}

  issue(subject: AccessTokenSubject): IssuedAccessToken {
    const now = this.nowSeconds();
    const expiresAtSeconds = now + this.configuration.ttlSeconds;
    const token = sign(
      { iat: now, sid: subject.sessionId },
      this.configuration.signingKey,
      {
        algorithm: ACCESS_TOKEN_ALGORITHM,
        audience: this.configuration.audience,
        expiresIn: this.configuration.ttlSeconds,
        issuer: this.configuration.issuer,
        subject: subject.userId,
      },
    );

    return {
      expiresAt: new Date(expiresAtSeconds * 1_000),
      token,
    };
  }

  verify(token: string): AuthenticatedPrincipal {
    if (
      typeof token !== 'string' ||
      token.length === 0 ||
      token.length > MAX_ACCESS_TOKEN_LENGTH
    ) {
      throw new InvalidAccessTokenError();
    }

    try {
      const now = this.nowSeconds();
      const payload = verify(token, this.configuration.signingKey, {
        algorithms: [ACCESS_TOKEN_ALGORITHM],
        audience: this.configuration.audience,
        clockTimestamp: now,
        issuer: this.configuration.issuer,
      });
      const claims = AccessTokenClaimsSchema.safeParse(payload);

      if (
        !claims.success ||
        claims.data.exp <= claims.data.iat ||
        claims.data.iat > now ||
        claims.data.exp - claims.data.iat > this.configuration.ttlSeconds ||
        claims.data.iss !== this.configuration.issuer ||
        claims.data.aud !== this.configuration.audience
      ) {
        throw new InvalidAccessTokenError();
      }

      return {
        sessionId: claims.data.sid,
        userId: claims.data.sub,
      };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
