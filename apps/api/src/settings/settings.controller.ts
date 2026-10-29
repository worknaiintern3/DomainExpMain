import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  Req,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import type {
  DiscoverySettingsPayload,
  GeneralSettingsPayload,
  PortfolioSettingsPayload,
  SettingsReadResponse,
  SettingsResponse,
} from './settings.types';

@Controller('settings')
export class SettingsController {
  constructor(
    @Inject(SettingsService) private readonly service: SettingsService,
  ) {}

  @Get()
  async getSettings(@Req() req: any): Promise<SettingsReadResponse> {
    const workspaceId =
      req?.workspacePrincipal?.workspaceId ||
      req?.authPrincipal?.userId ||
      req?.user?.id ||
      'default';
    return this.service.getSettings(workspaceId);
  }

  @Put('general')
  @HttpCode(HttpStatus.OK)
  async saveGeneral(
    @Body() body: Partial<GeneralSettingsPayload>,
    @Req() req: any,
  ): Promise<SettingsResponse> {
    const workspaceId =
      req?.workspacePrincipal?.workspaceId ||
      req?.authPrincipal?.userId ||
      req?.user?.id ||
      'default';
    return this.service.saveGeneral(body, workspaceId);
  }

  @Put('portfolio')
  @HttpCode(HttpStatus.OK)
  async savePortfolio(
    @Body() body: Partial<PortfolioSettingsPayload>,
    @Req() req: any,
  ): Promise<SettingsResponse> {
    const workspaceId =
      req?.workspacePrincipal?.workspaceId ||
      req?.authPrincipal?.userId ||
      req?.user?.id ||
      'default';
    return this.service.savePortfolio(body, workspaceId);
  }

  @Put('discovery')
  @HttpCode(HttpStatus.OK)
  async saveDiscovery(
    @Body() body: Partial<DiscoverySettingsPayload>,
    @Req() req: any,
  ): Promise<SettingsResponse> {
    const workspaceId =
      req?.workspacePrincipal?.workspaceId ||
      req?.authPrincipal?.userId ||
      req?.user?.id ||
      'default';
    return this.service.saveDiscovery(body, workspaceId);
  }
}
