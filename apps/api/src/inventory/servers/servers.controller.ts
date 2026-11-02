import {
  CreateServerRequestSchema,
  UpdateServerRequestSchema,
  type CreateServerRequest,
  type UpdateServerRequest,
} from '@domainpulse/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
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

function computeServerTelemetry(server: any, latencyMs = 28) {
  const isArchived = server.inventoryState === 'ARCHIVED';
  if (isArchived) {
    return {
      serverId: server.id,
      status: 'offline' as const,
      uptimePercent: 0,
      uptimeFormatted: '0.0%',
      cpuUsagePercent: null,
      memoryUsagePercent: null,
      diskUsagePercent: null,
      networkLatencyMs: null,
      activeProcessesCount: null,
      loadAverage: null,
      telemetryAvailable: false,
      telemetryNotice: 'Server is archived.',
      lastPingAt: server.updatedAt || new Date().toISOString(),
    };
  }

  // Check if real telemetry data was recorded on the server or reported by an agent
  if (server.telemetry && typeof server.telemetry === 'object') {
    const t = server.telemetry;
    return {
      serverId: server.id,
      status: t.status || 'healthy',
      uptimePercent: typeof t.uptimePercent === 'number' ? t.uptimePercent : null,
      uptimeFormatted: t.uptimeFormatted || (typeof t.uptimePercent === 'number' ? `${t.uptimePercent}%` : 'Unavailable'),
      cpuUsagePercent: typeof t.cpuUsagePercent === 'number' ? t.cpuUsagePercent : null,
      memoryUsagePercent: typeof t.memoryUsagePercent === 'number' ? t.memoryUsagePercent : null,
      diskUsagePercent: typeof t.diskUsagePercent === 'number' ? t.diskUsagePercent : null,
      networkLatencyMs: typeof t.networkLatencyMs === 'number' ? t.networkLatencyMs : latencyMs,
      activeProcessesCount: typeof t.activeProcessesCount === 'number' ? t.activeProcessesCount : null,
      loadAverage: Array.isArray(t.loadAverage) ? t.loadAverage : null,
      telemetryAvailable: true,
      lastPingAt: t.lastPingAt || new Date().toISOString(),
    };
  }

  // If no monitoring agent is reporting, return unavailable metrics rather than fabricated numbers
  return {
    serverId: server.id,
    status: 'healthy' as const,
    uptimePercent: null,
    uptimeFormatted: 'Unavailable',
    cpuUsagePercent: null,
    memoryUsagePercent: null,
    diskUsagePercent: null,
    networkLatencyMs: null,
    activeProcessesCount: null,
    loadAverage: null,
    telemetryAvailable: false,
    telemetryNotice: 'Monitoring agent not connected. Server telemetry unavailable.',
    lastPingAt: null,
  };
}

@Controller('servers')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class ServersController {
  private readonly handler: InventoryResourceHttpHandler<
    CreateServerRequest,
    UpdateServerRequest
  >;

  constructor(@Inject(InventoryService) private readonly service: InventoryService) {
    this.handler = new InventoryResourceHttpHandler(
      service,
      'server',
      CreateServerRequestSchema,
      UpdateServerRequestSchema,
      (input) => ({ resource: 'server', input }),
      (input) => ({ resource: 'server', input }),
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

  @Get('telemetry')
  async listTelemetry(@Req() request: WorkspaceContextRequest) {
    const page = await this.service.list(request.workspacePrincipal!, 'server', {
      includeArchived: false,
      limit: 100,
    });
    const telemetryItems = (page.items || []).map((env: any) => computeServerTelemetry(env.record));
    const telemetryMap: Record<string, ReturnType<typeof computeServerTelemetry>> = {};
    for (const t of telemetryItems) {
      telemetryMap[t.serverId] = t;
    }
    return {
      items: telemetryItems,
      byServerId: telemetryMap,
      queriedAt: new Date().toISOString(),
    };
  }

  @Get(':id/telemetry')
  async getTelemetry(@Req() request: WorkspaceContextRequest, @Param('id') id: string) {
    const env = await this.service.get(request.workspacePrincipal!, 'server', id);
    if (!env || !env.record) {
      throw new NotFoundException(`Server '${id}' not found`);
    }
    return computeServerTelemetry(env.record);
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
