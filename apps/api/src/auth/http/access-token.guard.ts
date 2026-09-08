import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AccessTokenService } from '../access-token';
import type { AuthenticatedRequest } from './auth-request';

const BEARER_CREDENTIAL_PATTERN = /^Bearer ([^\s]+)$/iu;

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly accessTokenService: AccessTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? BEARER_CREDENTIAL_PATTERN.exec(authorization)
        : undefined;
    const token = match?.[1];

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      request.authPrincipal = this.accessTokenService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Authentication required');
    }
  }
}
