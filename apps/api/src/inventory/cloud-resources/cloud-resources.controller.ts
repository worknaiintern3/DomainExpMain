import {
  CreateCloudResourceRequestSchema,
  UpdateCloudResourceRequestSchema,
  type CreateCloudResourceRequest,
  type UpdateCloudResourceRequest,
} from '@domainpulse/contracts';
import {
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
  UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../../workspace-context';
import { InventoryResourceHttpHandler } from '../http/inventory-http';
import { InventoryService } from '../inventory.service';

@Controller('cloud-resources')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class CloudResourcesController {
  private readonly handler: InventoryResourceHttpHandler<
    CreateCloudResourceRequest,
    UpdateCloudResourceRequest
  >;
  private readonly service: InventoryService;

  constructor(@Inject(InventoryService) service: InventoryService) {
    this.service = service;
    this.handler = new InventoryResourceHttpHandler(
      service,
      'cloud-resource',
      CreateCloudResourceRequestSchema,
      UpdateCloudResourceRequestSchema,
      (input) => ({ resource: 'cloud-resource', input }),
      (input) => ({ resource: 'cloud-resource', input }),
    );
  }

  @Post()
  async create(@Req() request: WorkspaceContextRequest, @Body() body: unknown) {
    if (typeof body === 'object' && body !== null) {
      const raw = { ...(body as Record<string, unknown>) };

      // Normalize resourceType to canonical key format
      if (typeof raw.resourceType === 'string') {
        const canonical = raw.resourceType
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        raw.resourceType = canonical || 'cloud-resource';
      }

      // Check if providerAccountId is a valid UUID
      const isUuid =
        typeof raw.providerAccountId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          raw.providerAccountId,
        );

      if (!isUuid && request.workspacePrincipal) {
        const principal = request.workspacePrincipal;
        const existing = await this.service.list(principal, 'provider-account', {
          includeArchived: false,
          limit: 100,
        });

        let targetId: string | undefined;
        if (typeof raw.providerAccountId === 'string' && raw.providerAccountId.trim()) {
          const search = raw.providerAccountId.trim().toLowerCase();
          const match = existing.items.find((p: any) => {
            const rec = p.record ?? p;
            const labelMatch =
              rec.label && typeof rec.label === 'string' && rec.label.toLowerCase() === search;
            const keyMatch =
              rec.providerKey &&
              typeof rec.providerKey === 'string' &&
              rec.providerKey.toLowerCase() === search;
            return labelMatch || keyMatch;
          });
          if (match) {
            const rec = (match as any).record ?? match;
            targetId = rec.id;
          }
        }

        if (!targetId && existing.items.length > 0 && existing.items[0]) {
          const first = existing.items[0] as any;
          targetId = (first.record ?? first).id;
        }

        if (!targetId) {
          const rawLabel =
            typeof raw.providerAccountId === 'string' && raw.providerAccountId.trim()
              ? raw.providerAccountId.trim()
              : 'Cloud Infrastructure Provider';
          const providerKey =
            rawLabel.toLowerCase().replace(/[^a-z0-9._-]+/g, '-') || 'cloud-provider';
          const created = await this.service.create(principal, {
            resource: 'provider-account',
            input: {
              label: rawLabel,
              providerKey,
              notes: 'Default provider account for cloud resources',
            },
          });
          targetId = created.record.id;
        }

        raw.providerAccountId = targetId;
      }

      body = raw;
    }

    return this.handler.create(request, body);
  }

  @Get()
  list(@Req() request: WorkspaceContextRequest, @Query() query: unknown) {
    return this.handler.list(request, query);
  }

  @Get(':id')
  get(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    return this.handler.get(request, params);
  }

  @Patch(':id')
  update(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ) {
    return this.handler.update(request, params, body);
  }

  @Delete(':id')
  @HttpCode(204)
  archive(@Req() request: WorkspaceContextRequest, @Param() params: unknown) {
    return this.handler.archive(request, params);
  }
}
