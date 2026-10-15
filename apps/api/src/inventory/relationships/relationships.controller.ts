import {
  CreateInventoryRelationshipRequestSchema,
  InventoryIdParamsSchema,
  InventoryRelationshipListQuerySchema,
  UpdateInventoryRelationshipRequestSchema,
  type InventoryRelationshipResponse,
} from '@domainpulse/contracts';
import type { StoredInventoryRelationship } from '@domainpulse/database';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { AccessTokenGuard } from '../../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
  type WorkspacePrincipal,
} from '../../workspace-context';
import { executeInventoryOperation } from '../http/inventory-http';
import { InventoryRelationshipService } from './relationships.service';

function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException('Invalid inventory relationship input');
  }
  return parsed.data;
}

function getPrincipal(request: WorkspaceContextRequest): WorkspacePrincipal {
  if (!request.workspacePrincipal) {
    throw new UnauthorizedException('Authentication required');
  }
  return request.workspacePrincipal;
}

export function presentInventoryRelationship(
  relationship: StoredInventoryRelationship,
): InventoryRelationshipResponse {
  return {
    createdAt: relationship.createdAt.toISOString(),
    id: relationship.id,
    inventoryState: relationship.inventoryState,
    notes: relationship.notes,
    provenance: relationship.provenance,
    relationshipType: relationship.relationshipType,
    source: relationship.source,
    target: relationship.target,
    updatedAt: relationship.updatedAt.toISOString(),
  };
}

@Controller('inventory-relationships')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class InventoryRelationshipsController {
  constructor(@Inject(InventoryRelationshipService) private readonly service: InventoryRelationshipService) {}

  @Post()
  create(@Req() request: WorkspaceContextRequest, @Body() body: unknown) {
    const input = parseRequest(CreateInventoryRelationshipRequestSchema, body);
    return executeInventoryOperation(async () =>
      presentInventoryRelationship(
        await this.service.create(getPrincipal(request), input),
      ),
    );
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest, @Query() query: unknown) {
    const input = parseRequest(InventoryRelationshipListQuerySchema, query);
    return executeInventoryOperation(async () => {
      const page = await this.service.list(getPrincipal(request), input);
      return {
        items: page.items.map(presentInventoryRelationship),
        nextCursor: page.nextCursor,
      };
    });
  }

  @Get(':id')
  get(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    return executeInventoryOperation(async () =>
      presentInventoryRelationship(
        await this.service.get(getPrincipal(request), id),
      ),
    );
  }

  @Patch(':id')
  update(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const input = parseRequest(UpdateInventoryRelationshipRequestSchema, body);
    return executeInventoryOperation(async () =>
      presentInventoryRelationship(
        await this.service.update(getPrincipal(request), id, input),
      ),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    return executeInventoryOperation(async () => {
      await this.service.archive(getPrincipal(request), id);
    });
  }
}
