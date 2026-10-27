import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AccessTokenGuard } from '../auth/http';
import { DatabaseService } from '../database/database.service';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../workspace-context';
import { PlayStoreService } from './play-store.service';
import type {
  DeveloperAppsResponse,
  DeveloperSearchResponse,
} from './play-store.types';

@Controller('play-store')
export class PlayStoreController {
  constructor(
    @Inject(PlayStoreService)
    private readonly playStoreService: PlayStoreService,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}


  /**
   * Search for any public Google Play developer account by name or developer ID.
   * Example: GET /api/v1/play-store/developers/search?q=Student%20Factory
   * Example: GET /api/v1/play-store/developers/search?q=Google%20LLC
   */
  @Get('developers/search')
  async searchDevelopers(
    @Query('q') query?: string,
    @Query('limit') limitStr?: string,
  ): Promise<DeveloperSearchResponse> {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 25;
    return await this.playStoreService.searchDevelopers(cleanQuery, isNaN(limit) ? 25 : limit);
  }

  /**
   * Retrieve publicly available applications published by a specific developer.
   * Example: GET /api/v1/play-store/developers/Student%20Factory/apps
   * Example: GET /api/v1/play-store/developers/Google%20LLC/apps
   * Example: GET /api/v1/play-store/developers/5700313618786177705/apps
   */
  @Get('developers/:developerId/apps')
  async getDeveloperApps(
    @Param('developerId') developerId: string,
    @Query('limit') limitStr?: string,
  ): Promise<DeveloperAppsResponse> {
    const cleanId = decodeURIComponent(developerId || '').trim();
    if (!cleanId) {
      throw new BadRequestException('developerId parameter is required');
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return await this.playStoreService.getDeveloperApps(cleanId, isNaN(limit) ? 100 : limit);
  }

  /**
   * Query-based developer apps endpoint.
   * Example: GET /api/v1/play-store/developer-apps?developerId=Cars24
   */
  @Get('developer-apps')
  async getDeveloperAppsQuery(
    @Query('developerId') developerId?: string,
    @Query('limit') limitStr?: string,
  ): Promise<DeveloperAppsResponse> {
    const cleanId = (developerId || '').trim();
    if (!cleanId) {
      throw new BadRequestException('developerId query parameter is required');
    }

    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return await this.playStoreService.getDeveloperApps(cleanId, isNaN(limit) ? 100 : limit);
  }

  /**
   * Synchronize Google Play developer applications into workspace inventory.
   * Completely removes previous apps of previous accounts and replaces them with the new account's apps.
   * POST /api/v1/play-store/sync
   */
  @Post('sync')
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async syncDeveloperAccount(
    @Req() request: WorkspaceContextRequest,
    @Body() body: { developerName?: string; developerId?: string },
  ) {
    const rawDev = (body?.developerName || body?.developerId || '').trim();
    if (!rawDev) {
      throw new BadRequestException('developerName or developerId is required');
    }

    const principal = request.workspacePrincipal;
    if (!principal?.workspaceId) {
      throw new BadRequestException('Workspace principal not resolved');
    }
    const workspaceId = principal.workspaceId;

    // Fetch the real apps from PlayStoreService
    let devAppsRes = await this.playStoreService.getDeveloperApps(rawDev, 100);

    // If no apps found directly, try searching developers first
    if (!devAppsRes.apps || devAppsRes.apps.length === 0) {
      const searchRes = await this.playStoreService.searchDevelopers(rawDev, 5);
      const topDev = searchRes.developers[0];
      if (topDev) {
        devAppsRes = await this.playStoreService.getDeveloperApps(topDev.id || topDev.name, 100);
      }
    }

    const detectedDevName = devAppsRes.developerName || rawDev;
    const cols = this.databaseService.collections;

    if (cols?.websiteApplications) {
      // 1. VANISH previous apps of previous account for this workspace
      await (cols.websiteApplications as any).deleteMany({
        workspaceId,
        $or: [
          { kind: 'MOBILE_APPLICATION' },
          { provenance: 'PLAY_STORE_SYNC' },
          { primaryUrl: { $regex: /play\.google\.com/i } },
        ],
      });

      // 2. Insert newly fetched apps of the new account
      const now = new Date();
      if (devAppsRes.apps && devAppsRes.apps.length > 0) {
        const newRecords = devAppsRes.apps.map((app) => ({
          id: randomUUID(),
          workspaceId,
          inventoryState: 'TRACKED',
          provenance: 'PLAY_STORE_SYNC',
          kind: 'MOBILE_APPLICATION',
          name: app.name,
          notes: app.packageId,
          primaryDomainId: null,
          primaryUrl: app.playStoreUrl,
          projectId: null,
          iconUrl: app.iconUrl,
          developerName: detectedDevName,
          score: app.score,
          scoreText: app.scoreText,
          price: app.price,
          free: app.free,
          createdAt: now,
          updatedAt: now,
        }));

        await (cols.websiteApplications as any).insertMany(newRecords);
      }

      // Update developer name in workspace settings if collection is present
      try {
        if (cols.workspaces) {
          await (cols.workspaces as any).updateOne(
            { id: workspaceId },
            { $set: { 'settings.googlePlayDeveloperName': detectedDevName, updatedAt: now } },
          );
        }
      } catch {}
    }

    return {
      success: true,
      developerName: detectedDevName,
      total: devAppsRes.apps.length,
      apps: devAppsRes.apps,
      message: `Successfully synchronized Google Play Console for "${detectedDevName}"! ${devAppsRes.apps.length} applications loaded. Previous developer apps removed.`,
    };
  }

  /**
   * Retrieve active Google Play developer account name for current workspace.
   * GET /api/v1/play-store/connected-account
   */
  @Get('connected-account')
  @UseGuards(AccessTokenGuard, WorkspaceContextGuard)
  async getConnectedAccount(@Req() request: WorkspaceContextRequest) {
    const workspaceId = request.workspacePrincipal?.workspaceId;
    if (!workspaceId) {
      return { developerName: null };
    }
    const cols = this.databaseService.collections;
    if (cols?.websiteApplications) {
      const sample = await (cols.websiteApplications as any).findOne({
        workspaceId,
        kind: 'MOBILE_APPLICATION',
        developerName: { $exists: true, $ne: null },
      });
      if (sample?.developerName) {
        return { developerName: sample.developerName };
      }
    }
    return { developerName: null };
  }
}

