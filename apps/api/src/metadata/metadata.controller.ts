import {
  InventoryIdParamsSchema,
  RefreshDomainMetadataRequestSchema,
} from '@domainpulse/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../auth/http';
import { executeInventoryOperation } from '../inventory/http/inventory-http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
  type WorkspacePrincipal,
} from '../workspace-context';
import { MetadataService } from './metadata.service';

function principal(request: WorkspaceContextRequest): WorkspacePrincipal {
  if (!request.workspacePrincipal) throw new UnauthorizedException('Authentication required');
  return request.workspacePrincipal;
}

function domainId(params: unknown): string {
  const parsed = InventoryIdParamsSchema.safeParse(params);
  if (!parsed.success) throw new BadRequestException('Invalid domain identifier');
  return parsed.data.id;
}

@Controller('domains')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class MetadataController {
  constructor(@Inject(MetadataService) private readonly service: MetadataService) {}

  @Get(':id/metadata')
  get(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    return executeInventoryOperation(() =>
      this.service.get(principal(request), domainId(params)),
    );
  }

  @Post(':id/metadata/refresh')
  @HttpCode(200)
  refresh(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const parsed = RefreshDomainMetadataRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid metadata refresh request');
    return executeInventoryOperation(() =>
      this.service.refresh(principal(request), domainId(params), parsed.data.sources),
    );
  }
}
