import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient, DatabaseTransaction } from '../src/client/database-types';
import {
  cloudResources,
  domains,
  projects,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  providerSyncRuns,
  servers,
  websiteApplications,
  workspaces,
} from '../src/schema';
import { createInventoryGraphFixture } from './inventory-graph-test-data';
import { expectPostgresErrorCode } from './postgres-error';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

function envelope() {
  return {
    authTagBase64: Buffer.alloc(16, 9).toString('base64'),
    ciphertextBase64: Buffer.alloc(32, 1).toString('base64'),
    ivBase64: Buffer.alloc(12, 7).toString('base64'),
  };
}

describeWithPostgreSql(
  'provider resource links (requires disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;
    const workspaceIds: string[] = [];

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Provider resource link test client was not initialized');
      return client;
    };

    async function createFixture(transaction: DatabaseTransaction) {
      const workspaceId = randomUUID();
      workspaceIds.push(workspaceId);
      await transaction.insert(workspaces).values({
        id: workspaceId,
        name: 'Provider resource link fixture',
        slug: `provider-resource-link-${workspaceId}`,
      });
      const graph = await createInventoryGraphFixture(transaction, workspaceId, 'link');
      const connectionId = randomUUID();
      const material = envelope();
      await transaction.insert(providerConnections).values({
        authType: 'CLOUDFLARE_API_TOKEN',
        credentialMask: '••••1234',
        encryptedCiphertext: material.ciphertextBase64,
        encryptionAuthTag: material.authTagBase64,
        encryptionIv: material.ivBase64,
        id: connectionId,
        keyVersion: 1,
        providerAccountId: graph.providerAccountId,
        workspaceId,
      });
      return { connectionId, graph, workspaceId };
    }

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterEach(async () => {
      if (workspaceIds.length === 0) return;
      await getClient().database.delete(providerResourceLinks).where(
        inArray(providerResourceLinks.workspaceId, workspaceIds),
      );
      await getClient().database.delete(providerSyncRuns).where(
        inArray(providerSyncRuns.workspaceId, workspaceIds),
      );
      await getClient().database.delete(providerConnections).where(
        inArray(providerConnections.workspaceId, workspaceIds),
      );
      // Canonical inventory dependency order: graph children reference
      // providerAccounts through RESTRICT foreign keys, so they must go first.
      await getClient().database.delete(websiteApplications).where(
        inArray(websiteApplications.workspaceId, workspaceIds),
      );
      await getClient().database.delete(cloudResources).where(
        inArray(cloudResources.workspaceId, workspaceIds),
      );
      await getClient().database.delete(servers).where(
        inArray(servers.workspaceId, workspaceIds),
      );
      await getClient().database.delete(domains).where(
        inArray(domains.workspaceId, workspaceIds),
      );
      await getClient().database.delete(projects).where(
        inArray(projects.workspaceId, workspaceIds),
      );
      await getClient().database.delete(providerAccounts).where(
        inArray(providerAccounts.workspaceId, workspaceIds),
      );
      await getClient().database.delete(workspaces).where(
        inArray(workspaces.id, workspaceIds),
      );
      workspaceIds.length = 0;
    });

    afterAll(async () => await client?.close());

    it('rejects a duplicate external resource identity within the same connection', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await getClient().database.insert(providerResourceLinks).values({
        connectionId: fixture.connectionId,
        entityKind: 'DOMAIN',
        externalResourceId: 'zone-123',
        externalResourceType: 'zone',
        lastSeenAt: now,
        lastSyncedAt: now,
        nodeId: fixture.graph.domainNodeId,
        workspaceId: fixture.workspaceId,
      });
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'SERVER',
            externalResourceId: 'zone-123',
            externalResourceType: 'zone',
            lastSeenAt: now,
            lastSyncedAt: now,
            nodeId: fixture.graph.serverNodeId,
            workspaceId: fixture.workspaceId,
          }),
        '23505',
      );
    });

    it('allows the same node to hold two links from the same connection after upstream recreation', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await getClient().database.insert(providerResourceLinks).values({
        connectionId: fixture.connectionId,
        entityKind: 'DOMAIN',
        externalResourceId: 'zone-old',
        externalResourceType: 'zone',
        lastSeenAt: now,
        lastSyncedAt: now,
        missingSince: now,
        nodeId: fixture.graph.domainNodeId,
        status: 'MISSING_FROM_PROVIDER',
        workspaceId: fixture.workspaceId,
      });
      await getClient().database.insert(providerResourceLinks).values({
        connectionId: fixture.connectionId,
        entityKind: 'DOMAIN',
        externalResourceId: 'zone-new',
        externalResourceType: 'zone',
        lastSeenAt: now,
        lastSyncedAt: now,
        nodeId: fixture.graph.domainNodeId,
        workspaceId: fixture.workspaceId,
      });
      const links = await getClient().database
        .select()
        .from(providerResourceLinks)
        .where(eq(providerResourceLinks.nodeId, fixture.graph.domainNodeId));
      expect(links).toHaveLength(2);
      expect(links.map((link) => link.status).sort()).toEqual([
        'ACTIVE',
        'MISSING_FROM_PROVIDER',
      ]);
    });

    it('rejects entity kinds outside the provider-linkable set', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'PROJECT',
            externalResourceId: 'project-1',
            externalResourceType: 'project',
            lastSeenAt: now,
            lastSyncedAt: now,
            nodeId: fixture.graph.projectNodeId,
            workspaceId: fixture.workspaceId,
          }),
        '23514',
      );
    });

    it('rejects a node/entity-kind pair that does not match the referenced graph node', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'SERVER',
            externalResourceId: 'mismatch-1',
            externalResourceType: 'server',
            lastSeenAt: now,
            lastSyncedAt: now,
            nodeId: fixture.graph.domainNodeId,
            workspaceId: fixture.workspaceId,
          }),
        '23503',
      );
    });

    it('requires missing_since exactly when status is MISSING_FROM_PROVIDER', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'DOMAIN',
            externalResourceId: 'zone-bad',
            externalResourceType: 'zone',
            lastSeenAt: now,
            lastSyncedAt: now,
            nodeId: fixture.graph.domainNodeId,
            status: 'MISSING_FROM_PROVIDER',
            workspaceId: fixture.workspaceId,
          }),
        '23514',
      );
    });

    it('rejects oversized metadata and impossible missing timestamps', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const lastSeenAt = new Date('2026-01-02T00:00:00.000Z');
      const lastSyncedAt = new Date('2026-01-02T00:05:00.000Z');
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'DOMAIN',
            externalMetadata: { raw: 'x'.repeat(17_000) },
            externalResourceId: 'zone-oversized',
            externalResourceType: 'zone',
            lastSeenAt,
            lastSyncedAt,
            nodeId: fixture.graph.domainNodeId,
            workspaceId: fixture.workspaceId,
          }),
        '23514',
      );
      await expectPostgresErrorCode(
        () =>
          getClient().database.insert(providerResourceLinks).values({
            connectionId: fixture.connectionId,
            entityKind: 'DOMAIN',
            externalResourceId: 'zone-invalid-missing-time',
            externalResourceType: 'zone',
            lastSeenAt,
            lastSyncedAt,
            missingSince: new Date(lastSeenAt.getTime() - 1),
            nodeId: fixture.graph.domainNodeId,
            status: 'MISSING_FROM_PROVIDER',
            workspaceId: fixture.workspaceId,
          }),
        '23514',
      );
    });

    it('cascades link cleanup when the owning connection is deleted', async () => {
      const fixture = await getClient().transaction((transaction) => createFixture(transaction));
      const now = new Date();
      await getClient().database.insert(providerResourceLinks).values({
        connectionId: fixture.connectionId,
        entityKind: 'DOMAIN',
        externalResourceId: 'zone-cascade',
        externalResourceType: 'zone',
        lastSeenAt: now,
        lastSyncedAt: now,
        nodeId: fixture.graph.domainNodeId,
        workspaceId: fixture.workspaceId,
      });
      await getClient().database
        .delete(providerConnections)
        .where(eq(providerConnections.id, fixture.connectionId));
      const remaining = await getClient().database
        .select()
        .from(providerResourceLinks)
        .where(
          and(
            eq(providerResourceLinks.workspaceId, fixture.workspaceId),
            eq(providerResourceLinks.connectionId, fixture.connectionId),
          ),
        );
      expect(remaining).toHaveLength(0);
    });
  },
);
