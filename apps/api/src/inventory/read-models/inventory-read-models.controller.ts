import {
  InventoryConnectionParamsSchema,
  InventoryDependencySourceParamsSchema,
  InventoryDependencyTargetParamsSchema,
  InventoryGraphEntityParamsSchema,
  InventoryGraphReadQuerySchema,
  InventoryIdParamsSchema,
  type InventoryAssociatedEntityResponse,
  type InventoryEntityReference,
  type InventoryGraphReadQuery,
  type InventoryImmediateRelationshipResponse,
} from '@domainpulse/contracts';
import type {
  AssociatedInventoryEntity,
  InventoryGraphRelationship,
} from '@domainpulse/database';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
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
import { InventoryReadModelService } from './inventory-read-models.service';

function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException('Invalid inventory graph request');
  }
  return parsed.data;
}

function getPrincipal(request: WorkspaceContextRequest): WorkspacePrincipal {
  if (!request.workspacePrincipal) {
    throw new UnauthorizedException('Authentication required');
  }
  return request.workspacePrincipal;
}

function parseQuery(query: unknown): InventoryGraphReadQuery {
  return parseRequest(InventoryGraphReadQuerySchema, query);
}

function presentAssociations(
  items: readonly AssociatedInventoryEntity[],
): { readonly items: readonly InventoryAssociatedEntityResponse[] } {
  return {
    items: items.map(({ associationSources, entityId, entityKind }) => ({
      associationSources: [...associationSources],
      entityId,
      entityKind,
    })),
  };
}

function presentEntities(
  relationships: readonly InventoryGraphRelationship[],
): { readonly items: readonly InventoryEntityReference[] } {
  return {
    items: relationships.map(({ oppositeEndpoint }) => oppositeEndpoint),
  };
}

function presentRelationships(
  relationships: readonly InventoryGraphRelationship[],
): { readonly items: readonly InventoryImmediateRelationshipResponse[] } {
  return {
    items: relationships.map((relationship) => ({
      direction: relationship.direction,
      entity: relationship.oppositeEndpoint,
      id: relationship.id,
      inventoryState: relationship.inventoryState,
      provenance: relationship.provenance,
      relationshipType: relationship.relationshipType,
    })),
  };
}

@Controller()
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class InventoryReadModelsController {
  constructor(private readonly service: InventoryReadModelService) {}

  @Get('projects/:id/resources')
  projectResources(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentAssociations(
        await this.service.listProjectResources(
          getPrincipal(request),
          id,
          options,
        ),
      ),
    );
  }

  @Get('applications/:id/domains')
  applicationDomains(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentAssociations(
        await this.service.listApplicationDomains(
          getPrincipal(request),
          id,
          options,
        ),
      ),
    );
  }

  @Get('applications/:id/hosting-targets')
  applicationHostingTargets(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listApplicationHostingTargets(
          getPrincipal(request),
          id,
          options,
        ),
      ),
    );
  }

  @Get('servers/:id/hosted-applications')
  serverHostedApplications(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listHostedApplications(
          getPrincipal(request),
          'SERVER',
          id,
          options,
        ),
      ),
    );
  }

  @Get('cloud-resources/:id/hosted-applications')
  cloudHostedApplications(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { id } = parseRequest(InventoryIdParamsSchema, params);
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listHostedApplications(
          getPrincipal(request),
          'CLOUD_RESOURCE',
          id,
          options,
        ),
      ),
    );
  }

  @Get('inventory-graph/:entityKind/:entityId/dependencies')
  dependencies(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { entityId, entityKind } = parseRequest(
      InventoryDependencySourceParamsSchema,
      params,
    );
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listDependencies(
          getPrincipal(request),
          entityKind,
          entityId,
          options,
        ),
      ),
    );
  }

  @Get('inventory-graph/:entityKind/:entityId/dependents')
  dependents(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { entityId, entityKind } = parseRequest(
      InventoryDependencyTargetParamsSchema,
      params,
    );
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listDependents(
          getPrincipal(request),
          entityKind,
          entityId,
          options,
        ),
      ),
    );
  }

  @Get('inventory-graph/:entityKind/:entityId/connections')
  connections(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { entityId, entityKind } = parseRequest(
      InventoryConnectionParamsSchema,
      params,
    );
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentEntities(
        await this.service.listConnections(
          getPrincipal(request),
          entityKind,
          entityId,
          options,
        ),
      ),
    );
  }

  @Get('inventory-graph/:entityKind/:entityId/relationships')
  relationships(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ) {
    const { entityId, entityKind } = parseRequest(
      InventoryGraphEntityParamsSchema,
      params,
    );
    const options = parseQuery(query);
    return executeInventoryOperation(async () =>
      presentRelationships(
        await this.service.listImmediateRelationships(
          getPrincipal(request),
          entityKind,
          entityId,
          options,
        ),
      ),
    );
  }
}
