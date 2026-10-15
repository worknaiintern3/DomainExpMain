import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlatformRole } from '@domainpulse/database';

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

    const user = await this.databaseService.collections.users.findOne({
      id: principal.userId,
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const platformRole: PlatformRole = (
      user.platformRole ? (user.platformRole.toString().toUpperCase() as PlatformRole) : 'USER'
    );

    if (!requiredRoles.includes(platformRole)) {
      throw new ForbiddenException(
        `Forbidden: Requires platform role ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
