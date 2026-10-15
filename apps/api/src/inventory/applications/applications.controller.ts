import {
  CreateApplicationRequestSchema,
  UpdateApplicationRequestSchema,
  type CreateApplicationRequest,
  type UpdateApplicationRequest,
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

@Controller('applications')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class ApplicationsController {
  private readonly handler: InventoryResourceHttpHandler<
    CreateApplicationRequest,
    UpdateApplicationRequest
  >;

  constructor(@Inject(InventoryService) service: InventoryService) {
    this.handler = new InventoryResourceHttpHandler(
      service,
      'application',
      CreateApplicationRequestSchema,
      UpdateApplicationRequestSchema,
      (input) => ({ resource: 'application', input }),
      (input) => ({ resource: 'application', input }),
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

  @Get('probe')
  async probe(@Query('url') targetUrl?: string) {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return {
        online: false,
        statusCode: null,
        latencyMs: null,
        title: null,
        ssl: false,
        error: 'Missing url parameter',
      };
    }
    const cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return {
        online: false,
        statusCode: null,
        latencyMs: null,
        title: null,
        ssl: false,
        error: 'URL must begin with http:// or https://',
      };
    }
    const ssl = cleanUrl.startsWith('https://');
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(cleanUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'DomainPulse-Probe/1.0',
        },
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - started;
      let title: string | null = null;
      try {
        const text = await response.text();
        const match = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (match && match[1]) {
          title = match[1].trim().slice(0, 100);
        }
      } catch {
        // body parsing optional
      }
      return {
        online: response.status < 500,
        statusCode: response.status,
        latencyMs,
        title,
        ssl,
        error: null,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      return {
        online: false,
        statusCode: null,
        latencyMs,
        title: null,
        ssl,
        error: message,
      };
    }
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
