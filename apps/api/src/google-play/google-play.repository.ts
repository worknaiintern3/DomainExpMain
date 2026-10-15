import { randomUUID } from 'node:crypto';

import type {
  GooglePlayConnection,
  GooglePlayOAuthState,
} from '@domainpulse/database';
import { Inject, Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import type {
  GooglePlayConnectionEntity,
  GooglePlayOAuthStateEntity,
} from './google-play.types';

@Injectable()
export class GooglePlayRepository {
  constructor(
    @Inject(DatabaseService)
    private readonly dbService: DatabaseService,
  ) {}

  async findConnectionByUserId(
    userId: string,
  ): Promise<GooglePlayConnectionEntity | null> {
    const row = await this.dbService.collections?.googlePlayConnections.findOne({
      userId,
    });
    return row ? this.mapConnection(row as any) : null;
  }

  async saveConnection(params: {
    userId: string;
    googleAccountId: string;
    googleAccountEmail: string;
    developerAccountId?: string | null;
    encryptedAccessToken: string;
    encryptedRefreshToken?: string | null;
    tokenExpiresAt: Date;
  }): Promise<GooglePlayConnectionEntity> {
    const now = new Date();
    const collections = this.dbService.collections;
    if (!collections) throw new Error('MongoDB collections not available');

    const existing = await collections.googlePlayConnections.findOne({
      userId: params.userId,
    });

    const id = existing?.id || randomUUID();
    const doc = {
      id,
      userId: params.userId,
      googleAccountId: params.googleAccountId,
      googleAccountEmail: params.googleAccountEmail,
      developerAccountId:
        params.developerAccountId !== undefined
          ? params.developerAccountId
          : existing?.developerAccountId ?? null,
      encryptedAccessToken: params.encryptedAccessToken,
      encryptedRefreshToken:
        params.encryptedRefreshToken !== undefined
          ? params.encryptedRefreshToken
          : existing?.encryptedRefreshToken ?? null,
      tokenExpiresAt: params.tokenExpiresAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await collections.googlePlayConnections.updateOne(
      { userId: params.userId },
      { $set: doc },
      { upsert: true },
    );

    return this.mapConnection(doc as any);
  }

  async updateTokens(params: {
    userId: string;
    encryptedAccessToken: string;
    encryptedRefreshToken?: string | null;
    tokenExpiresAt: Date;
  }): Promise<void> {
    const now = new Date();
    const updateSet: any = {
      encryptedAccessToken: params.encryptedAccessToken,
      tokenExpiresAt: params.tokenExpiresAt,
      updatedAt: now,
    };
    if (params.encryptedRefreshToken !== undefined) {
      updateSet.encryptedRefreshToken = params.encryptedRefreshToken;
    }
    await this.dbService.collections?.googlePlayConnections.updateOne(
      { userId: params.userId },
      { $set: updateSet },
    );
  }

  async updateDeveloperAccountId(
    userId: string,
    developerAccountId: string,
  ): Promise<void> {
    const now = new Date();
    await this.dbService.collections?.googlePlayConnections.updateOne(
      { userId },
      { $set: { developerAccountId, updatedAt: now } },
    );
  }

  async deleteConnection(userId: string): Promise<boolean> {
    const res = await this.dbService.collections?.googlePlayConnections.deleteOne({
      userId,
    });
    return (res?.deletedCount ?? 0) > 0;
  }

  async createOAuthState(params: {
    userId: string;
    state: string;
    codeVerifier: string;
    developerAccountId?: string | null;
    redirectUri?: string | null;
    expiresAt: Date;
  }): Promise<GooglePlayOAuthStateEntity> {
    const now = new Date();
    const id = randomUUID();
    const doc = {
      id,
      userId: params.userId,
      state: params.state,
      codeVerifier: params.codeVerifier,
      developerAccountId: params.developerAccountId ?? null,
      redirectUri: params.redirectUri ?? null,
      expiresAt: params.expiresAt,
      createdAt: now,
    };
    await this.dbService.collections?.googlePlayOauthStates.insertOne(doc as any);
    return this.mapOAuthState(doc as any);
  }

  async consumeOAuthState(
    state: string,
  ): Promise<GooglePlayOAuthStateEntity | null> {
    const now = new Date();
    const doc = await this.dbService.collections?.googlePlayOauthStates.findOneAndDelete({
      state,
      expiresAt: { $gt: now } as any,
    });
    return doc ? this.mapOAuthState(doc as any) : null;
  }

  private mapConnection(row: GooglePlayConnection): GooglePlayConnectionEntity {
    return {
      id: row.id,
      userId: row.userId,
      googleAccountId: row.googleAccountId,
      googleAccountEmail: row.googleAccountEmail,
      developerAccountId: row.developerAccountId,
      encryptedAccessToken: row.encryptedAccessToken,
      encryptedRefreshToken: row.encryptedRefreshToken,
      tokenExpiresAt: row.tokenExpiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapOAuthState(row: GooglePlayOAuthState): GooglePlayOAuthStateEntity {
    return {
      id: row.id,
      userId: row.userId,
      state: row.state,
      codeVerifier: row.codeVerifier,
      developerAccountId: row.developerAccountId,
      redirectUri: row.redirectUri,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}
