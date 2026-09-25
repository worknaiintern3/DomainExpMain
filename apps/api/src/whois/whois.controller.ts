import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../workspace-context';
import { WhoisService } from './whois.service';
import type { NormalizedWhoisData } from './whois.types';

@Controller('whois')
export class WhoisController {
  constructor(@Inject(WhoisService) private readonly service: WhoisService) {}

  @Get('live')
  async lookup(
    @Req() request: WorkspaceContextRequest,
    @Query('domain') domain?: string,
    @Query('domainId') domainId?: string,
  ): Promise<NormalizedWhoisData> {
    if (!domain || !domain.trim()) {
      throw new BadRequestException('Query parameter "domain" is required');
    }
    const workspaceId = request.workspacePrincipal?.workspaceId;
    return this.service.lookupLive(domain, workspaceId, domainId);
  }

  @Get('history')
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async history(
    @Req() request: WorkspaceContextRequest,
    @Query('limit') limit?: string,
  ): Promise<NormalizedWhoisData[]> {
    const workspaceId = request.workspacePrincipal?.workspaceId;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.service.getHistory(workspaceId, isNaN(parsedLimit) ? 20 : parsedLimit);
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async refresh(
    @Req() request: WorkspaceContextRequest,
    @Param('id') domainId: string,
  ): Promise<NormalizedWhoisData> {
    if (!domainId) {
      throw new BadRequestException('Domain identifier is required');
    }
    const workspaceId = request.workspacePrincipal?.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context is required');
    }
    return this.service.refreshDomainWhois(workspaceId, domainId);
  }
}
