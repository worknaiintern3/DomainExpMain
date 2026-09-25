import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { users, type PlatformRole } from '@domainpulse/database';

import { DatabaseService } from '../../database/database.service';
import type { AuthenticatedRequest } from '../http/auth-request';
import { PLATFORM_ROLES_KEY } from './platform-roles.decorator';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.authPrincipal;

    if (!principal?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const rows = await this.databaseService.database
      .select({
        id: users.id,
        platformRole: users.platformRole,
      })
      .from(users)
      .where(eq(users.id, principal.userId))
      .limit(1);

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!requiredRoles.includes(user.platformRole)) {
      throw new ForbiddenException(
        `Forbidden: Requires platform role ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
