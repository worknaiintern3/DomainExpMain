import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  DEFAULT_DISCOVERY_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_PORTFOLIO_SETTINGS,
  type DiscoverySettingsPayload,
  type GeneralSettingsPayload,
  type PortfolioSettingsPayload,
  type SettingsReadResponse,
  type SettingsResponse,
} from './settings.types';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly inMemoryCache = new Map<string, SettingsResponse>();

  constructor(private readonly dbService: DatabaseService) {}

  private getCollection() {
    try {
      const db = this.dbService.connection.db;
      if (db) {
        return db.collection('workspace_settings');
      }
    } catch {
      // Fallback to cache if database connection is not ready
    }
    return null;
  }

  async getSettings(workspaceId?: string): Promise<SettingsReadResponse> {
    const key = workspaceId || 'default';
    const collection = this.getCollection();

    if (collection) {
      try {
        const doc = await collection.findOne({ workspaceId: key });
        if (doc) {
          const settings: SettingsResponse = {
            discovery: { ...DEFAULT_DISCOVERY_SETTINGS, ...doc.discovery },
            general: { ...DEFAULT_GENERAL_SETTINGS, ...doc.general },
            portfolio: {
              ...DEFAULT_PORTFOLIO_SETTINGS,
              ...doc.portfolio,
              metadataSources: {
                ...DEFAULT_PORTFOLIO_SETTINGS.metadataSources,
                ...doc.portfolio?.metadataSources,
              },
            },
          };
          this.inMemoryCache.set(key, settings);
          return { ...settings, role: 'owner' };
        }
      } catch (err) {
        this.logger.warn(`Could not fetch settings from MongoDB: ${err}`);
      }
    }

    const cached = this.inMemoryCache.get(key);
    if (cached) {
      return { ...cached, role: 'owner' };
    }

    const initial: SettingsResponse = {
      discovery: { ...DEFAULT_DISCOVERY_SETTINGS },
      general: { ...DEFAULT_GENERAL_SETTINGS },
      portfolio: {
        ...DEFAULT_PORTFOLIO_SETTINGS,
        metadataSources: { ...DEFAULT_PORTFOLIO_SETTINGS.metadataSources },
      },
    };
    this.inMemoryCache.set(key, initial);
    return { ...initial, role: 'owner' };
  }

  async saveGeneral(
    input: Partial<GeneralSettingsPayload>,
    workspaceId?: string,
  ): Promise<SettingsResponse> {
    const current = await this.getSettings(workspaceId);
    const updatedGeneral: GeneralSettingsPayload = {
      ...current.general,
      ...input,
    };
    const response: SettingsResponse = {
      discovery: current.discovery,
      general: updatedGeneral,
      portfolio: current.portfolio,
    };
    await this.persistSettings(workspaceId || 'default', response);
    return response;
  }

  async savePortfolio(
    input: Partial<PortfolioSettingsPayload>,
    workspaceId?: string,
  ): Promise<SettingsResponse> {
    const current = await this.getSettings(workspaceId);
    const updatedPortfolio: PortfolioSettingsPayload = {
      ...current.portfolio,
      ...input,
      metadataSources: {
        ...current.portfolio.metadataSources,
        ...input.metadataSources,
      },
    };
    const response: SettingsResponse = {
      discovery: current.discovery,
      general: current.general,
      portfolio: updatedPortfolio,
    };
    await this.persistSettings(workspaceId || 'default', response);
    return response;
  }

  async saveDiscovery(
    input: Partial<DiscoverySettingsPayload>,
    workspaceId?: string,
  ): Promise<SettingsResponse> {
    const current = await this.getSettings(workspaceId);
    const updatedDiscovery: DiscoverySettingsPayload = {
      ...current.discovery,
      ...input,
    };
    const response: SettingsResponse = {
      discovery: updatedDiscovery,
      general: current.general,
      portfolio: current.portfolio,
    };
    await this.persistSettings(workspaceId || 'default', response);
    return response;
  }

  private async persistSettings(key: string, response: SettingsResponse): Promise<void> {
    this.inMemoryCache.set(key, response);
    const collection = this.getCollection();
    if (collection) {
      try {
        await collection.updateOne(
          { workspaceId: key },
          {
            $set: {
              workspaceId: key,
              discovery: response.discovery,
              general: response.general,
              portfolio: response.portfolio,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (err) {
        this.logger.warn(`Could not save settings to MongoDB: ${err}`);
      }
    }
  }
}
