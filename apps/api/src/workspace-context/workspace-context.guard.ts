import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';

import { WorkspaceAccessDeniedError } from './workspace-context.errors';
import type { WorkspaceContextRequest } from './workspace-context.request';
import { WorkspaceContextService } from './workspace-context.service';

const WorkspaceIdSchema = z.uuid();

function parseWorkspaceHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Invalid workspace selection');
  }

  const result = WorkspaceIdSchema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException('Invalid workspace selection');
  }

  return result.data;
}

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(private readonly contextService: WorkspaceContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<WorkspaceContextRequest>();
    const principal = request.authPrincipal;

    if (!principal) {
      throw new UnauthorizedException('Authentication required');
    }

    const explicitWorkspaceId = parseWorkspaceHeader(
      request.headers['x-workspace-id'],
    );

    try {
      request.workspacePrincipal = await this.contextService.resolve(
        principal,
        explicitWorkspaceId,
      );
      return true;
    } catch (error) {
      if (error instanceof WorkspaceAccessDeniedError) {
        throw new ForbiddenException('Workspace access denied');
      }

      throw error;
    }
  }
}
