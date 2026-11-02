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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
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
   * Proxies Google Play Store application and developer icons to bypass browser CORS / hotlink / referrer blocking.
   * Example: GET /api/v1/play-store/icon-proxy?url=https%3A%2F%2Fplay-lh.googleusercontent.com%2F...
   */
  @Get('icon-proxy')
  async proxyIcon(
    @Query('url') iconUrl: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    if (!iconUrl) {
      reply.status(400).send('Missing "url" query parameter');
      return;
    }

    try {
      const parsed = new URL(iconUrl);
      const isGoogleHost =
        parsed.hostname.endsWith('googleusercontent.com') ||
        parsed.hostname.endsWith('ggpht.com') ||
        parsed.hostname.endsWith('play.google.com');

      if (!isGoogleHost) {
        reply.status(403).send('Host not allowed');
        return;
      }

      const res = await fetch(iconUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        reply.status(res.status).send('Upstream image error');
        return;
      }

      const contentType = res.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await res.arrayBuffer());

      reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400, immutable')
        .send(buffer);
    } catch {
      reply.status(502).send('Failed to fetch icon');
    }
  }


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

