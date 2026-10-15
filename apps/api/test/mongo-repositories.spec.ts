import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { MongoRegistrationRepository, RegistrationEmailConflictError } from '../src/auth/registration';
import { MongoLoginRepository } from '../src/auth/login';
import { MongoIdentityRepository } from '../src/auth/identity';
import { MongoSessionRepository } from '../src/auth/session';
import { MongoInventoryRepository } from '../src/inventory/mongo-inventory.repository';
import { InventoryConflictError } from '../src/inventory/inventory.errors';
import type { DatabaseService } from '../src/database/database.service';

// In-Memory Mongo Collection Mock
class InMemoryCollection {
  private docs = new Map<string, any>();

  async insertOne(doc: any) {
    if (doc.domainName) {
      for (const d of this.docs.values()) {
        if (d.workspaceId === doc.workspaceId && d.domainName === doc.domainName) {
          const err: any = new Error('Duplicate key');
          err.code = 11000;
          throw err;
        }
      }
    }
    const key = doc.id || doc._id || randomUUID();
    const stored = { ...doc, _id: key };
    this.docs.set(key, stored);
    return { insertedId: key };
  }

  private matchesQuery(doc: any, query: any): boolean {
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && typeof v === 'object' && '$gt' in (v as any)) {
        const docVal = doc[k] instanceof Date ? doc[k].getTime() : doc[k];
        const gtVal = (v as any).$gt instanceof Date ? (v as any).$gt.getTime() : (v as any).$gt;
        if (!(docVal > gtVal)) {
          return false;
        }
      } else if (doc[k] !== v) {
        return false;
      }
    }
    return true;
  }

  async findOne(query: any) {
    for (const doc of this.docs.values()) {
      if (this.matchesQuery(doc, query)) {
        return { ...doc };
      }
    }
    return null;
  }

  find(query: any = {}) {
    const results: any[] = [];
    for (const doc of this.docs.values()) {
      if (this.matchesQuery(doc, query)) {
        results.push({ ...doc });
      }
    }
    return {
      toArray: async () => results,
      sort: () => ({
        limit: (n: number) => ({
          toArray: async () => results.slice(0, n),
        }),
        toArray: async () => results,
      }),
    };
  }

  async updateOne(filter: any, update: any, options?: any) {
    let existing = await this.findOne(filter);
    if (!existing && options?.upsert) {
      const newDoc = { ...(update.$setOnInsert || {}), ...(update.$set || {}) };
      await this.insertOne(newDoc);
      return { matchedCount: 0, upsertedCount: 1 };
    }
    if (existing) {
      if (update.$set) {
        Object.assign(existing, update.$set);
        this.docs.set(existing.id || existing._id, existing);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0 };
  }

  async updateMany(filter: any, update: any) {
    let modified = 0;
    for (const doc of this.docs.values()) {
      if (this.matchesQuery(doc, filter) && update.$set) {
        Object.assign(doc, update.$set);
        this.docs.set(doc.id || doc._id, doc);
        modified++;
      }
    }
    return { modifiedCount: modified };
  }

  async findOneAndUpdate(filter: any, update: any, _options?: any) {
    for (const doc of this.docs.values()) {
      if (this.matchesQuery(doc, filter)) {
        if (update.$set) {
          Object.assign(doc, update.$set);
          this.docs.set(doc.id || doc._id, doc);
        }
        return { ...doc };
      }
    }
    return null;
  }

  async deleteOne(filter: any) {
    const existing = await this.findOne(filter);
    if (existing) {
      this.docs.delete(existing.id || existing._id);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }
}

function createMockDatabaseService(): DatabaseService {
  const collections = {
    users: new InMemoryCollection(),
    workspaces: new InMemoryCollection(),
    workspaceMembers: new InMemoryCollection(),
    passwordCredentials: new InMemoryCollection(),
    sessions: new InMemoryCollection(),
    oauthIdentities: new InMemoryCollection(),
    oauthTransactions: new InMemoryCollection(),
    domains: new InMemoryCollection(),
    servers: new InMemoryCollection(),
    providerAccounts: new InMemoryCollection(),
    emailAccounts: new InMemoryCollection(),
    cloudResources: new InMemoryCollection(),
    projects: new InMemoryCollection(),
    websiteApplications: new InMemoryCollection(),
    inventoryNodes: new InMemoryCollection(),
    inventoryRelationships: new InMemoryCollection(),
    whoisRecords: new InMemoryCollection(),
    domainDnsMetadata: new InMemoryCollection(),
    domainRdapMetadata: new InMemoryCollection(),
    domainTlsMetadata: new InMemoryCollection(),
    providerConnections: new InMemoryCollection(),
    providerSyncRuns: new InMemoryCollection(),
    providerResourceLinks: new InMemoryCollection(),
    monitoringTargets: new InMemoryCollection(),
    monitoringRuns: new InMemoryCollection(),
    alertRules: new InMemoryCollection(),
    alertEvents: new InMemoryCollection(),
    mobileAppConfig: new InMemoryCollection(),
    mobileAppVersions: new InMemoryCollection(),
    mobileHomeConfig: new InMemoryCollection(),
    mobileNavigationConfig: new InMemoryCollection(),
    mobileFeatureFlags: new InMemoryCollection(),
    mobileAnnouncements: new InMemoryCollection(),
    mobileAuditLogs: new InMemoryCollection(),
    googlePlayConnections: new InMemoryCollection(),
    googlePlayOauthStates: new InMemoryCollection(),
  };

  return {
    isMongo: true,
    collections,
    mongoClient: null,
    mongoDb: null,
    database: null as any,
    withTransaction: async <T>(cb: any): Promise<T> => cb({}),
    withWorkspaceContext: async <T>(_ws: string, cb: any): Promise<T> => cb({}),
    ping: async () => true,
  } as unknown as DatabaseService;
}

describe('MongoDB Repositories Integration', () => {
  const dbService = createMockDatabaseService();

  describe('MongoRegistrationRepository & MongoLoginRepository', () => {
    const regRepo = new MongoRegistrationRepository(dbService);
    const loginRepo = new MongoLoginRepository(dbService);
    const email = 'user@example.com';
    const normalizedEmail = 'user@example.com';

    it('creates a user registration and sets up workspace & credentials in Mongo', async () => {
      const user = await regRepo.createRegistration({
        displayName: 'Test User',
        email,
        normalizedEmail,
        passwordHash: 'argon2_hashed_secret',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeTypeOf('string');
      expect(user.email).toBe(email);
      expect(user.normalizedEmail).toBe(normalizedEmail);

      // Verify login can look up this user
      const candidate = await loginRepo.findCredentialByNormalizedEmail(normalizedEmail);
      expect(candidate).toBeDefined();
      expect(candidate?.user.id).toBe(user.id);
      expect(candidate?.user.email).toBe(email);
      expect(candidate?.passwordHash).toBe('argon2_hashed_secret');
    });

    it('rejects duplicate email registration with RegistrationEmailConflictError', async () => {
      await expect(
        regRepo.createRegistration({
          displayName: 'Duplicate User',
          email: 'USER@example.com',
          normalizedEmail: 'user@example.com',
          passwordHash: 'another_hash',
        })
      ).rejects.toThrow(RegistrationEmailConflictError);
    });
  });

  describe('MongoIdentityRepository', () => {
    const identityRepo = new MongoIdentityRepository(dbService);

    it('retrieves user identity by ID', async () => {
      const usersCol = (dbService as any).collections.users;
      const user = await usersCol.findOne({ normalizedEmail: 'user@example.com' });
      expect(user).toBeDefined();

      const retrieved = await identityRepo.findUserById(user.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.displayName).toBe('Test User');
      expect(retrieved?.email).toBe('user@example.com');
    });
  });

  describe('MongoSessionRepository', () => {
    const sessionRepo = new MongoSessionRepository(dbService);
    let userId: string;
    const initialTokenHash = 'hash_initial_session';

    it('rotates and revokes refresh tokens', async () => {
      const usersCol = (dbService as any).collections.users;
      const user = await usersCol.findOne({ normalizedEmail: 'user@example.com' });
      userId = user.id;

      // Seed initial session in Mongo
      const sessionsCol = (dbService as any).collections.sessions;
      const now = new Date();
      await sessionsCol.insertOne({
        id: randomUUID(),
        userId,
        refreshTokenHash: initialTokenHash,
        expiresAt: new Date(now.getTime() + 3600_000),
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Rotate session
      const nextTokenHash = 'hash_next_session';
      const result = await sessionRepo.rotateRefreshCredential({
        currentRefreshTokenHash: initialTokenHash,
        nextRefreshTokenHash: nextTokenHash,
        nextExpiresAt: new Date(now.getTime() + 7200_000),
        rotatedAt: new Date(),
      });

      expect(result.kind).toBe('rotated');
      if (result.kind === 'rotated') {
        expect(result.session.userId).toBe(userId);
      }

      // Replaying the old token must return 'replayed'
      const replayed = await sessionRepo.rotateRefreshCredential({
        currentRefreshTokenHash: initialTokenHash,
        nextRefreshTokenHash: 'another_hash',
        nextExpiresAt: new Date(now.getTime() + 7200_000),
        rotatedAt: new Date(),
      });
      expect(replayed.kind).toBe('replayed');
    });
  });

  describe('MongoInventoryRepository', () => {
    const invRepo = new MongoInventoryRepository(dbService);
    const workspaceId = randomUUID();
    const otherWorkspaceId = randomUUID();
    let domainId: string;

    it('creates a domain and enforces multi-tenant workspace isolation', async () => {
      const envelope = await invRepo.create(workspaceId, {
        resource: 'domain',
        values: {
          domainName: 'testdomain.example',
          normalizedDomainName: 'testdomain.example',
          notes: 'Initial test domain',
          autoRenew: false,
          dnsProviderAccountId: null,
          expiresAt: null,
          registeredAt: null,
          registrarProviderAccountId: null,
        },
      });

      expect(envelope.record.id).toBeTypeOf('string');
      expect((envelope.record as any).domainName).toBe('testdomain.example');
      expect(envelope.record.workspaceId).toBe(workspaceId);
      domainId = envelope.record.id;

      // Find within correct workspace
      const found = await invRepo.findById(workspaceId, 'domain', domainId);
      expect(found).toBeDefined();
      expect((found?.record as any).domainName).toBe('testdomain.example');

      // Attempt to access with different workspace ID must return undefined
      const crossWorkspace = await invRepo.findById(otherWorkspaceId, 'domain', domainId);
      expect(crossWorkspace).toBeUndefined();
    });

    it('rejects duplicate domain within the same workspace', async () => {
      await expect(
        invRepo.create(workspaceId, {
          resource: 'domain',
          values: {
            domainName: 'testdomain.example',
            normalizedDomainName: 'testdomain.example',
            notes: null,
            autoRenew: false,
            dnsProviderAccountId: null,
            expiresAt: null,
            registeredAt: null,
            registrarProviderAccountId: null,
          },
        })
      ).rejects.toThrow(InventoryConflictError);
    });
  });
});
