import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
import {
  InventoryNodeNotFoundError,
  listApplicationDomains,
  listApplicationsHostedOn,
  listConnectedInventoryEntities,
  listHostingTargetsForApplication,
  listImmediateDependencies,
  listImmediateDependents,
  listImmediateInventoryRelationships,
  listInboundInventoryRelationships,
  listOutboundInventoryRelationships,
  listProjectResources,
  resolveInventoryNode,
} from '../src/queries/inventory-graph';
import {
  domains,
  inventoryRelationships,
  websiteApplications,
} from '../src/schema';
import { setWorkspaceContext } from '../src/transactions/workspace-context';
import {
  createInventoryGraphFixture,
  createInventoryGraphWorkspace,
  type InventoryGraphFixture,
} from './inventory-graph-test-data';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

async function runRollbackTest(
  client: DatabaseClient,
  operation: (transaction: DatabaseTransaction) => Promise<void>,
): Promise<void> {
  const rollbackProbe = new Error('rollback inventory graph query probe');
  await expect(
    client.transaction(async (transaction) => {
      await operation(transaction);
      throw rollbackProbe;
    }),
  ).rejects.toBe(rollbackProbe);
}

async function createContextFixture(
  transaction: DatabaseTransaction,
  label: string,
): Promise<InventoryGraphFixture> {
  const workspaceId = await createInventoryGraphWorkspace(transaction, label);
  const fixture = await createInventoryGraphFixture(
    transaction,
    workspaceId,
    label,
  );
  await setWorkspaceContext(transaction, workspaceId);
  return fixture;
}

describeWithPostgreSql(
  'inventory graph queries (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Inventory graph query client was not initialized');
      }
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: './migrations' });
    });

    afterAll(async () => {
      await client?.close();
    });

    it('resolves public entity identity without exposing another workspace', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const workspaceAId = await createInventoryGraphWorkspace(
          transaction,
          'query-resolution-a',
        );
        const workspaceBId = await createInventoryGraphWorkspace(
          transaction,
          'query-resolution-b',
        );
        const fixtureA = await createInventoryGraphFixture(
          transaction,
          workspaceAId,
          'query-resolution-a',
        );
        const fixtureB = await createInventoryGraphFixture(
          transaction,
          workspaceBId,
          'query-resolution-b',
        );
        await setWorkspaceContext(transaction, workspaceAId);

        await expect(
          resolveInventoryNode(transaction, 'PROJECT', fixtureA.projectId),
        ).resolves.toEqual({
          entityId: fixtureA.projectId,
          entityKind: 'PROJECT',
          nodeId: fixtureA.projectNodeId,
        });
        await expect(
          resolveInventoryNode(transaction, 'PROJECT', fixtureB.projectId),
        ).rejects.toBeInstanceOf(InventoryNodeNotFoundError);
        await expect(
          resolveInventoryNode(transaction, 'PROJECT', randomUUID()),
        ).rejects.toMatchObject({ code: 'INVENTORY_NODE_NOT_FOUND' });
        await expect(
          resolveInventoryNode(transaction, 'PROJECT', 'not-a-uuid'),
        ).rejects.toBeInstanceOf(InventoryNodeNotFoundError);
      });
    });

    it('queries outbound, inbound, and one-hop tracked relationships', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(
          transaction,
          'query-directions',
        );
        await transaction.insert(inventoryRelationships).values([
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            provenance: 'DNS_RETRIEVED',
            relationshipType: 'ROUTES_TO',
            sourceKind: 'DOMAIN',
            sourceNodeId: fixture.domainNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.serverNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            inventoryState: 'ARCHIVED',
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.serverNodeId,
            workspaceId: fixture.workspaceId,
          },
        ]);

        const outbound = await listOutboundInventoryRelationships(
          transaction,
          'PROJECT',
          fixture.projectId,
        );
        const inbound = await listInboundInventoryRelationships(
          transaction,
          'DOMAIN',
          fixture.domainId,
        );
        const oneHop = await listImmediateInventoryRelationships(
          transaction,
          'DOMAIN',
          fixture.domainId,
        );
        const withArchived = await listOutboundInventoryRelationships(
          transaction,
          'PROJECT',
          fixture.projectId,
          { includeArchived: true },
        );

        expect(outbound).toHaveLength(1);
        expect(outbound[0]).toMatchObject({
          direction: 'OUTBOUND',
          inventoryState: 'TRACKED',
          oppositeEndpoint: {
            entityId: fixture.domainId,
            entityKind: 'DOMAIN',
          },
          relationshipType: 'GROUPS',
        });
        expect(inbound).toHaveLength(1);
        expect(inbound[0]).toMatchObject({
          direction: 'INBOUND',
          oppositeEndpoint: {
            entityId: fixture.projectId,
            entityKind: 'PROJECT',
          },
          relationshipType: 'GROUPS',
        });
        expect(oneHop).toHaveLength(2);
        expect(oneHop.map(({ direction }) => direction).sort()).toEqual([
          'INBOUND',
          'OUTBOUND',
        ]);
        expect(withArchived).toHaveLength(2);
        expect(withArchived.map(({ inventoryState }) => inventoryState).sort()).toEqual(
          ['ARCHIVED', 'TRACKED'],
        );
      });
    });

    it('returns a canonical CONNECTED_TO edge from either endpoint', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(
          transaction,
          'query-connected',
        );
        const sourceIsServer =
          fixture.serverNodeId < fixture.cloudResourceNodeId;
        await transaction.insert(inventoryRelationships).values({
          provenance: 'USER_MAPPED',
          relationshipType: 'CONNECTED_TO',
          sourceKind: sourceIsServer ? 'SERVER' : 'CLOUD_RESOURCE',
          sourceNodeId: sourceIsServer
            ? fixture.serverNodeId
            : fixture.cloudResourceNodeId,
          targetKind: sourceIsServer ? 'CLOUD_RESOURCE' : 'SERVER',
          targetNodeId: sourceIsServer
            ? fixture.cloudResourceNodeId
            : fixture.serverNodeId,
          workspaceId: fixture.workspaceId,
        });

        const fromServer = await listConnectedInventoryEntities(
          transaction,
          'SERVER',
          fixture.serverId,
        );
        const fromCloud = await listConnectedInventoryEntities(
          transaction,
          'CLOUD_RESOURCE',
          fixture.cloudResourceId,
        );
        expect(fromServer).toHaveLength(1);
        expect(fromServer[0]?.oppositeEndpoint).toEqual({
          entityId: fixture.cloudResourceId,
          entityKind: 'CLOUD_RESOURCE',
        });
        expect(fromCloud).toHaveLength(1);
        expect(fromCloud[0]?.oppositeEndpoint).toEqual({
          entityId: fixture.serverId,
          entityKind: 'SERVER',
        });
      });
    });

    it('unions and deduplicates structural and flexible project resources', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(
          transaction,
          'query-project-resources',
        );
        await transaction
          .update(websiteApplications)
          .set({ projectId: fixture.projectId })
          .where(eq(websiteApplications.id, fixture.websiteApplicationId));
        await transaction.insert(inventoryRelationships).values([
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'WEBSITE_APPLICATION',
            targetNodeId: fixture.websiteApplicationNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId: fixture.workspaceId,
          },
        ]);

        const resources = await listProjectResources(
          transaction,
          fixture.projectId,
        );
        expect(resources).toHaveLength(2);
        expect(resources).toContainEqual({
          associationSources: [
            'PRIMARY_STRUCTURAL',
            'FLEXIBLE_RELATIONSHIP',
          ],
          entityId: fixture.websiteApplicationId,
          entityKind: 'WEBSITE_APPLICATION',
        });
        expect(resources).toContainEqual({
          associationSources: ['FLEXIBLE_RELATIONSHIP'],
          entityId: fixture.domainId,
          entityKind: 'DOMAIN',
        });
      });
    });

    it('unions and deduplicates structural and flexible application domains', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(
          transaction,
          'query-application-domains',
        );
        const additionalDomainId = randomUUID();
        await transaction.insert(domains).values({
          domainName: `${additionalDomainId}.example`,
          id: additionalDomainId,
          normalizedDomainName: `${additionalDomainId}.example`,
          provenance: 'USER_ADDED',
          workspaceId: fixture.workspaceId,
        });
        const additionalDomainNode = await resolveInventoryNode(
          transaction,
          'DOMAIN',
          additionalDomainId,
        );
        await transaction
          .update(websiteApplications)
          .set({ primaryDomainId: fixture.domainId })
          .where(eq(websiteApplications.id, fixture.websiteApplicationId));
        await transaction.insert(inventoryRelationships).values([
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'USES_DOMAIN',
            sourceKind: 'WEBSITE_APPLICATION',
            sourceNodeId: fixture.websiteApplicationNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'USES_DOMAIN',
            sourceKind: 'WEBSITE_APPLICATION',
            sourceNodeId: fixture.websiteApplicationNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: additionalDomainNode.nodeId,
            workspaceId: fixture.workspaceId,
          },
        ]);

        const associatedDomains = await listApplicationDomains(
          transaction,
          fixture.websiteApplicationId,
        );
        expect(associatedDomains).toHaveLength(2);
        expect(associatedDomains).toContainEqual({
          associationSources: [
            'PRIMARY_STRUCTURAL',
            'FLEXIBLE_RELATIONSHIP',
          ],
          entityId: fixture.domainId,
          entityKind: 'DOMAIN',
        });
        expect(associatedDomains).toContainEqual({
          associationSources: ['FLEXIBLE_RELATIONSHIP'],
          entityId: additionalDomainId,
          entityKind: 'DOMAIN',
        });
      });
    });

    it('queries hosting targets and their inverse without inverse rows', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(transaction, 'query-hosting');
        await transaction.insert(inventoryRelationships).values([
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'HOSTED_ON',
            sourceKind: 'WEBSITE_APPLICATION',
            sourceNodeId: fixture.websiteApplicationNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.serverNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            provenance: 'PROVIDER_API',
            relationshipType: 'HOSTED_ON',
            sourceKind: 'WEBSITE_APPLICATION',
            sourceNodeId: fixture.websiteApplicationNodeId,
            targetKind: 'CLOUD_RESOURCE',
            targetNodeId: fixture.cloudResourceNodeId,
            workspaceId: fixture.workspaceId,
          },
        ]);

        const targets = await listHostingTargetsForApplication(
          transaction,
          fixture.websiteApplicationId,
        );
        const serverApplications = await listApplicationsHostedOn(
          transaction,
          'SERVER',
          fixture.serverId,
        );
        expect(targets.map(({ oppositeEndpoint }) => oppositeEndpoint)).toEqual(
          expect.arrayContaining([
            { entityId: fixture.serverId, entityKind: 'SERVER' },
            {
              entityId: fixture.cloudResourceId,
              entityKind: 'CLOUD_RESOURCE',
            },
          ]),
        );
        expect(serverApplications).toHaveLength(1);
        expect(serverApplications[0]).toMatchObject({
          direction: 'INBOUND',
          oppositeEndpoint: {
            entityId: fixture.websiteApplicationId,
            entityKind: 'WEBSITE_APPLICATION',
          },
        });
      });
    });

    it('queries immediate dependencies and inverse dependents only', async () => {
      await runRollbackTest(getClient(), async (transaction) => {
        const fixture = await createContextFixture(
          transaction,
          'query-dependencies',
        );
        await transaction.insert(inventoryRelationships).values([
          {
            provenance: 'CALCULATED',
            relationshipType: 'DEPENDS_ON',
            sourceKind: 'WEBSITE_APPLICATION',
            sourceNodeId: fixture.websiteApplicationNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId: fixture.workspaceId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'DEPENDS_ON',
            sourceKind: 'SERVER',
            sourceNodeId: fixture.serverNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId: fixture.workspaceId,
          },
        ]);

        const dependencies = await listImmediateDependencies(
          transaction,
          'WEBSITE_APPLICATION',
          fixture.websiteApplicationId,
        );
        const dependents = await listImmediateDependents(
          transaction,
          'DOMAIN',
          fixture.domainId,
        );
        expect(dependencies).toHaveLength(1);
        expect(dependencies[0]?.oppositeEndpoint).toEqual({
          entityId: fixture.domainId,
          entityKind: 'DOMAIN',
        });
        expect(dependents.map(({ oppositeEndpoint }) => oppositeEndpoint)).toEqual(
          expect.arrayContaining([
            {
              entityId: fixture.websiteApplicationId,
              entityKind: 'WEBSITE_APPLICATION',
            },
            { entityId: fixture.serverId, entityKind: 'SERVER' },
          ]),
        );
      });
    });
  },
);
