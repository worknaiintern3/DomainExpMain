import {
  CreateProviderAccountRequestSchema,
  UpdateProviderAccountRequestSchema,
  type CreateProviderAccountRequest,
  type UpdateProviderAccountRequest,
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
import { DatabaseService } from '../../database/database.service';

@Controller('provider-accounts')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class ProviderAccountsController {
  private readonly handler: InventoryResourceHttpHandler<
    CreateProviderAccountRequest,
    UpdateProviderAccountRequest
  >;

  constructor(
    @Inject(InventoryService) service: InventoryService,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {
    this.handler = new InventoryResourceHttpHandler(
      service,
      'provider-account',
      CreateProviderAccountRequestSchema,
      UpdateProviderAccountRequestSchema,
      (input) => ({ resource: 'provider-account', input }),
      (input) => ({ resource: 'provider-account', input }),
    );
  }

  @Post()
  create(@Req() request: WorkspaceContextRequest, @Body() body: unknown) {
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
  async delete(
    @Req() request: WorkspaceContextRequest,
    @Param('id') id: string,
    @Query('hard') hard?: string,
    @Query('permanent') permanent?: string,
  ) {
    // If hard/permanent delete requested, permanently purge account & cascade
    if (hard === 'true' || permanent === 'true') {
      await this.hardDeleteAccount(request.workspacePrincipal?.workspaceId ?? "", id);
      return;
    }
    return this.handler.archive(request, { id });
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  async deletePermanent(
    @Req() request: WorkspaceContextRequest,
    @Param('id') id: string,
  ) {
    await this.hardDeleteAccount(request.workspacePrincipal?.workspaceId ?? "", id);
  }

  private async hardDeleteAccount(workspaceId: string, accountId: string): Promise<void> {
    const cols = this.databaseService.collections;
    if (!cols || !accountId) return;

    try {
      // 1. Find the provider account to get any labels or externalAccountId
      const accountDoc = await (cols.providerAccounts as any).findOne({
        workspaceId,
        $or: [{ id: accountId }, { externalAccountId: accountId }],
      });
      const targetId = accountDoc?.id || accountId;

      // 2. Find all domains associated with this provider account
      const domainDocs = await (cols.domains as any)
        .find({
          workspaceId,
          $or: [
            { registrarProviderAccountId: targetId },
            { dnsProviderAccountId: targetId },
          ],
        })
        .toArray();
      const domainNames = domainDocs
        .map((d: any) => (d.domainName || '').toLowerCase().trim())
        .filter(Boolean);

      // 3. Find all servers associated with this provider account
      const serverDocs = await (cols.servers as any)
        .find({
          workspaceId,
          providerAccountId: targetId,
        })
        .toArray();
      const serverNames = serverDocs
        .map((s: any) => (s.hostname || s.name || '').toLowerCase().trim())
        .filter(Boolean);

      // 4. Delete domains
      await (cols.domains as any).deleteMany({
        workspaceId,
        $or: [
          { registrarProviderAccountId: targetId },
          { dnsProviderAccountId: targetId },
          ...(domainNames.length > 0 ? [{ domainName: { $in: domainNames } }] : []),
        ],
      });

      // 5. Delete corresponding websites
      if (domainNames.length > 0) {
        await (cols.websiteApplications as any).deleteMany({
          workspaceId,
          $or: [
            { domainId: { $in: domainNames } },
            { name: { $in: domainNames } },
          ],
        });
      }

      // 6. Delete servers
      await (cols.servers as any).deleteMany({
        workspaceId,
        $or: [
          { providerAccountId: targetId },
          ...(serverNames.length > 0
            ? [{ hostname: { $in: serverNames } }, { name: { $in: serverNames } }]
            : []),
        ],
      });

      // 7. Delete cloud resources
      await (cols.cloudResources as any).deleteMany({
        workspaceId,
        $or: [
          { providerAccountId: targetId },
          ...(domainNames.length > 0 ? [{ externalResourceId: { $in: domainNames } }] : []),
          ...(serverNames.length > 0 ? [{ externalResourceId: { $in: serverNames } }] : []),
        ],
      });

      // 8. Find and delete provider connections and their sync runs
      const conns = await (cols.providerConnections as any)
        .find({ workspaceId, providerAccountId: targetId })
        .toArray();
      const connIds = conns.map((c: any) => c.id).filter(Boolean);

      if (connIds.length > 0) {
        await (cols.providerSyncRuns as any).deleteMany({
          workspaceId,
          providerConnectionId: { $in: connIds },
        });
        await (cols.providerConnections as any).deleteMany({
          workspaceId,
          id: { $in: connIds },
        });
      }

      // Also delete any connections directly matching targetId
      await (cols.providerConnections as any).deleteMany({
        workspaceId,
        providerAccountId: targetId,
      });

      // 9. Delete from providerAccounts
      await (cols.providerAccounts as any).deleteMany({
        workspaceId,
        $or: [{ id: targetId }, { id: accountId }],
      });
    } catch (err: any) {
      console.error('[HardDeleteAccount Error]', err?.message || err);
    }
  }
}
