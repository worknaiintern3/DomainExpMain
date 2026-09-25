import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import {
  CreateMobileAnnouncementRequestSchema,
  UpdateMobileAnnouncementRequestSchema,
  UpdateMobileAppConfigRequestSchema,
  UpdateMobileAppVersionRequestSchema,
  UpdateMobileFeatureFlagRequestSchema,
  UpdateMobileHomeConfigRequestSchema,
  UpdateMobileNavigationRequestSchema,
} from '@domainpulse/contracts';

import { AccessTokenGuard } from '../auth/http/access-token.guard';
import type { AuthenticatedRequest } from '../auth/http/auth-request';
import { PlatformRoles } from '../auth/platform-role/platform-roles.decorator';
import { PlatformRolesGuard } from '../auth/platform-role/platform-roles.guard';
import { MobileAdminService } from './mobile-admin.service';

function parseInput<T>(schema: z.ZodType<T>, input: unknown, msg: string): T {
  const res = schema.safeParse(input);
  if (!res.success) {
    throw new BadRequestException(msg);
  }
  return res.data;
}

@Controller('admin/mobile')
@UseGuards(AccessTokenGuard, PlatformRolesGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN')
export class MobileAdminController {
  constructor(
    @Inject(MobileAdminService)
    private readonly mobileAdminService: MobileAdminService,
  ) {}

  /* App Config */
  @Get('config')
  async getConfig() {
    return this.mobileAdminService.getAppConfig();
  }

  @Patch('config')
  async updateConfig(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const input = parseInput(
      UpdateMobileAppConfigRequestSchema,
      body,
      'Invalid app config update',
    );
    return this.mobileAdminService.updateAppConfig(
      input,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  /* Features */
  @Get('features')
  async getFeatures() {
    return this.mobileAdminService.getFeatureFlags();
  }

  @Patch('features/:key')
  async updateFeature(
    @Param('key') key: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = parseInput(
      UpdateMobileFeatureFlagRequestSchema,
      body,
      'Invalid feature flag update',
    );
    return this.mobileAdminService.updateFeatureFlag(
      key,
      input,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  /* Navigation */
  @Get('navigation')
  async getNavigation() {
    return this.mobileAdminService.getNavigation();
  }

  @Put('navigation')
  async updateNavigation(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = parseInput(
      UpdateMobileNavigationRequestSchema,
      body,
      'Invalid navigation update',
    );
    return this.mobileAdminService.updateNavigation(
      input.items,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  /* Home Layout */
  @Get('home')
  async getHome() {
    return this.mobileAdminService.getHomeConfig();
  }

  @Put('home')
  async updateHome(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    const input = parseInput(
      UpdateMobileHomeConfigRequestSchema,
      body,
      'Invalid home layout update',
    );
    return this.mobileAdminService.updateHomeConfig(
      input.sections,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  /* Versions */
  @Get('versions')
  async getVersions() {
    return this.mobileAdminService.getVersions();
  }

  @Put('versions/:platform')
  async updateVersion(
    @Param('platform') platform: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = parseInput(
      UpdateMobileAppVersionRequestSchema,
      body,
      'Invalid version update',
    );
    return this.mobileAdminService.updateVersion(
      platform,
      input,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  /* Announcements */
  @Get('announcements')
  async getAnnouncements() {
    return this.mobileAdminService.getAnnouncements();
  }

  @Post('announcements')
  async createAnnouncement(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = parseInput(
      CreateMobileAnnouncementRequestSchema,
      body,
      'Invalid announcement creation request',
    );
    return this.mobileAdminService.createAnnouncement(
      input,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Patch('announcements/:id')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const input = parseInput(
      UpdateMobileAnnouncementRequestSchema,
      body,
      'Invalid announcement update request',
    );
    return this.mobileAdminService.updateAnnouncement(
      id,
      input,
      req.authPrincipal?.userId,
      req.ip,
    );
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.mobileAdminService.deleteAnnouncement(
      id,
      req.authPrincipal?.userId,
      req.ip,
    );
    return { success: true };
  }

  /* Audit Logs */
  @Get('audit-logs')
  async getAuditLogs() {
    return this.mobileAdminService.getAuditLogs();
  }
}
