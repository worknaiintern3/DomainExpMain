import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
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
}
