import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  RegisterNotificationDeviceRequestSchema,
  UpdateNotificationPreferencesRequestSchema,
  UpsertAssetExpiryRequestSchema,
  TriggerExpiryCheckRequestSchema,
} from '@domainpulse/contracts';

import { AccessTokenGuard } from '../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../workspace-context';
import { NotificationsRepository } from './notifications.repository';
import { ExpiryMonitorService } from './expiry-monitor.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly expiryMonitor: ExpiryMonitorService,
  ) {}

  @Post('devices')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async registerDevice(
    @Req() request: WorkspaceContextRequest,
    @Body() rawBody: unknown,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User identification missing');
    }

    const parseResult = RegisterNotificationDeviceRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.message);
    }

    const device = await this.repository.upsertDeviceToken({
      userId,
      token: parseResult.data.expoPushToken,
      platform: parseResult.data.platform,
      deviceName: parseResult.data.deviceName ?? null,
      appVersion: parseResult.data.appVersion ?? null,
    });

    return {
      ok: true,
      deviceId: device.id,
      token: device.token,
      isActive: device.isActive,
    };
  }

  @Delete('devices/:token')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async unregisterDevice(
    @Req() request: WorkspaceContextRequest,
    @Param('token') token: string,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!token) {
      throw new BadRequestException('Token parameter is required');
    }

    const success = await this.repository.deactivateDeviceToken(token, userId);
    return { ok: true, deactivated: success };
  }

  @Get('preferences')
  @UseGuards(AccessTokenGuard)
  async getPreferences(@Req() request: WorkspaceContextRequest) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User identification missing');
    }

    const pref = await this.repository.getPreferences(userId);
    return {
      id: pref.id,
      userId: pref.userId,
      workspaceId: request.workspacePrincipal?.workspaceId ?? '',
      pushEnabled: pref.enabled,
      reminderThresholds: pref.reminderThresholds ?? [15, 7, 3, 1, 0],
      notifyDomains: pref.domainsEnabled,
      notifyServers: pref.serversEnabled,
      notifyHosting: pref.hostingEnabled,
      notifySsl: pref.sslEnabled,
      timeZone: 'Asia/Kolkata',
      preferredHour: 9,
      createdAt: pref.createdAt.toISOString(),
      updatedAt: pref.updatedAt.toISOString(),
    };
  }

  @Patch('preferences')
  @UseGuards(AccessTokenGuard)
  async updatePreferences(
    @Req() request: WorkspaceContextRequest,
    @Body() rawBody: unknown,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User identification missing');
    }

    const parseResult = UpdateNotificationPreferencesRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.message);
    }

    const data = parseResult.data;
    const updatePayload: Record<string, any> = {};
    if (data.pushEnabled !== undefined) updatePayload.enabled = data.pushEnabled;
    if (data.reminderThresholds !== undefined) updatePayload.reminderThresholds = data.reminderThresholds;
    if (data.notifyDomains !== undefined) updatePayload.domainsEnabled = data.notifyDomains;
    if (data.notifyServers !== undefined) updatePayload.serversEnabled = data.notifyServers;
    if (data.notifyHosting !== undefined) updatePayload.hostingEnabled = data.notifyHosting;
    if (data.notifySsl !== undefined) updatePayload.sslEnabled = data.notifySsl;

    const updated = await this.repository.upsertPreferences(userId, updatePayload);
    return {
      id: updated.id,
      userId: updated.userId,
      workspaceId: request.workspacePrincipal?.workspaceId ?? '',
      pushEnabled: updated.enabled,
      reminderThresholds: updated.reminderThresholds ?? [15, 7, 3, 1, 0],
      notifyDomains: updated.domainsEnabled,
      notifyServers: updated.serversEnabled,
      notifyHosting: updated.hostingEnabled,
      notifySsl: updated.sslEnabled,
      timeZone: 'Asia/Kolkata',
      preferredHour: 9,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  @Get('history')
  @UseGuards(AccessTokenGuard)
  async getHistory(
    @Req() request: WorkspaceContextRequest,
    @Query('limit') limitStr?: string,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User identification missing');
    }

    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 100) : 50;
    const history = await this.repository.getNotificationHistory(userId, limit);

    return history.map((item) => ({
      id: item.id,
      assetId: item.assetId,
      assetType: item.assetType,
      assetName: item.assetName,
      expiryDate: item.expiryDate.toISOString(),
      reminderThreshold: item.reminderThreshold,
      title: item.title,
      body: item.body,
      status: item.status,
      ticketId: item.ticketId ?? null,
      isRead: item.isRead ?? false,
      readAt: item.readAt ? item.readAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  @Patch('history/:id/read')
  @UseGuards(AccessTokenGuard)
  async markAsRead(
    @Req() request: WorkspaceContextRequest,
    @Param('id') id: string,
  ) {
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new BadRequestException('User identification missing');
    }

    const success = await this.repository.markNotificationAsRead(id, userId);
    return { ok: true, markedRead: success };
  }

  @Get('expiries')
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async getMonitoredExpiries(@Req() request: WorkspaceContextRequest) {
    const workspaceId = request.workspacePrincipal?.workspaceId;
    const userId = request.authPrincipal?.userId;

    const expiries = await this.repository.getAssetExpiries(workspaceId, userId);
    return expiries.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      assetType: item.assetType,
      assetName: item.assetName,
      hostname: item.hostname ?? null,
      provider: item.provider ?? null,
      expiresAt: item.expiresAt.toISOString(),
      status: item.status,
      timeZone: item.timeZone,
      reminderThresholds: item.notificationPreferences?.reminderThresholds ?? [15, 7, 3, 1, 0],
      createdAt: item.createdAt.toISOString(),
    }));
  }

  @Post('expiries')
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async upsertAssetExpiry(
    @Req() request: WorkspaceContextRequest,
    @Body() rawBody: unknown,
  ) {
    const workspaceId = request.workspacePrincipal?.workspaceId;
    const userId = request.authPrincipal?.userId;
    if (!workspaceId || !userId) {
      throw new BadRequestException('Workspace context and user required');
    }

    const parseResult = UpsertAssetExpiryRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.message);
    }

    const saved = await this.repository.upsertAssetExpiry({
      id: parseResult.data.assetId,
      assetType: parseResult.data.assetType,
      assetName: parseResult.data.assetName,
      hostname: parseResult.data.hostname ?? null,
      provider: parseResult.data.providerKey ?? null,
      workspaceId,
      ownerUserId: userId,
      expiresAt: new Date(parseResult.data.expiryDate),
    });

    return {
      id: saved.id,
      assetType: saved.assetType,
      assetName: saved.assetName,
      hostname: saved.hostname ?? null,
      expiresAt: saved.expiresAt.toISOString(),
      status: saved.status,
    };
  }

  @Post('trigger-check')
  @UseGuards(AccessTokenGuard)
  async triggerExpiryCheck(
    @Req() request: WorkspaceContextRequest,
    @Body() rawBody: unknown,
  ) {
    const userId = request.authPrincipal?.userId;
    const parseResult = TriggerExpiryCheckRequestSchema.safeParse(rawBody || {});
    if (!parseResult.success) {
      throw new BadRequestException(parseResult.error.message);
    }

    const simulatedThresholds =
      parseResult.data.simulatedDaysRemaining !== undefined
        ? [parseResult.data.simulatedDaysRemaining]
        : undefined;

    const result = await this.expiryMonitor.runExpiryCheck({
      dryRun: parseResult.data.dryRun ?? false,
      simulatedThresholds,
      targetUserId: userId ?? undefined,
    });

    return result;
  }
}
