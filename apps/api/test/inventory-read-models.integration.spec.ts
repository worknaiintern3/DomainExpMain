import { randomUUID } from 'node:crypto';

import {
  cloudResources,
  createDatabaseClient,
  domains,
  inventoryNodes,
  inventoryRelationships,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  workspaces,
  type DatabaseClient,
  type InventoryNode,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { InventoryRecordNotFoundError } from '../src/inventory/inventory.errors';
import { PostgresInventoryReadModelRepository } from '../src/inventory/read-models/inventory-read-models.repository';
import { InventoryReadModelService } from '../src/inventory/read-models/inventory-read-models.service';
import type { WorkspacePrincipal } from '../src/workspace-context';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

function principal(workspaceId: string): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role: 'member',
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId,
  };
}

describeWithPostgreSql(
  'inventory graph read models (requires a disposable TEST_DATABASE_URL)',
  () => {
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    const projectAId = randomUUID();
    const projectBId = randomUUID();
    const primaryDomainId = randomUUID();
    const additionalDomainId = randomUUID();
    const serverAId = randomUUID();
    const archivedServerId = randomUUID();
    const cloudAId = randomUUID();
    const applicationAId = randomUUID();
    const providerAId = randomUUID();
    let client: DatabaseClient | undefined;
    let service: InventoryReadModelService | undefined;

    const getService = () => {
      if (!service) {
        throw new Error('Read-model integration service was not initialized');
      }
      return service;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: '../../packages/database/migrations',
      });
      await client.database.insert(workspaces).values([
        {
          id: workspaceAId,
          name: 'Graph read workspace A',
          slug: `graph-read-a-${workspaceAId.replaceAll('-', '')}`,
        },
        {
          id: workspaceBId,
          name: 'Graph read workspace B',
          slug: `graph-read-b-${workspaceBId.replaceAll('-', '')}`,
        },
      ]);
      await client.database.insert(providerAccounts).values({
        id: providerAId,
        label: 'Graph read provider',
        provenance: 'USER_ADDED',
        providerKey: 'graph_read_provider',
        workspaceId: workspaceAId,
      });
      await client.database.insert(projects).values([
        {
          id: projectAId,
          name: 'Graph read project A',
          normalizedName: 'graph read project a',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: projectBId,
          name: 'Graph read project B',
          normalizedName: 'graph read project b',
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(domains).values([
        {
          domainName: 'primary.graph-read.test',
          id: primaryDomainId,
          normalizedDomainName: 'primary.graph-read.test',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          domainName: 'additional.graph-read.test',
          id: additionalDomainId,
          normalizedDomainName: 'additional.graph-read.test',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
      ]);
      await client.database.insert(servers).values([
        {
          id: serverAId,
          name: 'Graph read server',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: archivedServerId,
          name: 'Archived graph read server',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
      ]);
      await client.database.insert(cloudResources).values({
        id: cloudAId,
        name: 'Graph read cloud',
        provenance: 'USER_ADDED',
        providerAccountId: providerAId,
        resourceType: 'compute',
        workspaceId: workspaceAId,
      });
      await client.database.insert(websiteApplications).values({
        id: applicationAId,
        kind: 'WEB_APPLICATION',
        name: 'Graph read application',
        primaryDomainId,
        projectId: projectAId,
        provenance: 'USER_ADDED',
        workspaceId: workspaceAId,
      });

      const nodes = await client.withWorkspaceContext(
        workspaceAId,
        (transaction) => transaction.select().from(inventoryNodes),
      );
      const node = (
        entityKind: InventoryNode['entityKind'],
        entityId: string,
      ) => {
        const found = nodes.find(
          (candidate) =>
            candidate.entityKind === entityKind &&
            candidate.entityId === entityId,
        );
        if (!found) {
          throw new Error('Graph read fixture node was not created');
        }
        return found;
      };
      const project = node('PROJECT', projectAId);
      const primaryDomain = node('DOMAIN', primaryDomainId);
      const additionalDomain = node('DOMAIN', additionalDomainId);
      const server = node('SERVER', serverAId);
      const archivedServer = node('SERVER', archivedServerId);
      const cloud = node('CLOUD_RESOURCE', cloudAId);
      const application = node('WEBSITE_APPLICATION', applicationAId);
      const [connectedSource, connectedTarget] =
        server.nodeId < cloud.nodeId ? [server, cloud] : [cloud, server];

      await client.withWorkspaceContext(workspaceAId, (transaction) =>
        transaction.insert(inventoryRelationships).values([
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: project.entityKind,
            sourceNodeId: project.nodeId,
            targetKind: application.entityKind,
            targetNodeId: application.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: project.entityKind,
            sourceNodeId: project.nodeId,
            targetKind: additionalDomain.entityKind,
            targetNodeId: additionalDomain.nodeId,
            workspaceId: workspaceAId,
          },
          {
            inventoryState: 'ARCHIVED',
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: project.entityKind,
            sourceNodeId: project.nodeId,
            targetKind: archivedServer.entityKind,
            targetNodeId: archivedServer.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'USES_DOMAIN',
            sourceKind: application.entityKind,
            sourceNodeId: application.nodeId,
            targetKind: primaryDomain.entityKind,
            targetNodeId: primaryDomain.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'USES_DOMAIN',
            sourceKind: application.entityKind,
            sourceNodeId: application.nodeId,
            targetKind: additionalDomain.entityKind,
            targetNodeId: additionalDomain.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'HOSTED_ON',
            sourceKind: application.entityKind,
            sourceNodeId: application.nodeId,
            targetKind: server.entityKind,
            targetNodeId: server.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'HOSTED_ON',
            sourceKind: application.entityKind,
            sourceNodeId: application.nodeId,
            targetKind: cloud.entityKind,
            targetNodeId: cloud.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'DEPENDS_ON',
            sourceKind: application.entityKind,
            sourceNodeId: application.nodeId,
            targetKind: additionalDomain.entityKind,
            targetNodeId: additionalDomain.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'ROUTES_TO',
            sourceKind: additionalDomain.entityKind,
            sourceNodeId: additionalDomain.nodeId,
            targetKind: server.entityKind,
            targetNodeId: server.nodeId,
            workspaceId: workspaceAId,
          },
          {
            provenance: 'USER_MAPPED',
            relationshipType: 'CONNECTED_TO',
            sourceKind: connectedSource.entityKind,
            sourceNodeId: connectedSource.nodeId,
            targetKind: connectedTarget.entityKind,
            targetNodeId: connectedTarget.nodeId,
            workspaceId: workspaceAId,
          },
        ]),
      );
      service = new InventoryReadModelService(
        new PostgresInventoryReadModelRepository(client),
      );
    });

    afterAll(async () => {
      if (!client) {
        return;
      }
      for (const workspaceId of [workspaceAId, workspaceBId]) {
        await client.database
          .delete(inventoryRelationships)
          .where(eq(inventoryRelationships.workspaceId, workspaceId));
        await client.database
          .delete(websiteApplications)
          .where(eq(websiteApplications.workspaceId, workspaceId));
        await client.database
          .delete(cloudResources)
          .where(eq(cloudResources.workspaceId, workspaceId));
        await client.database
          .delete(servers)
          .where(eq(servers.workspaceId, workspaceId));
        await client.database
          .delete(domains)
          .where(eq(domains.workspaceId, workspaceId));
        await client.database
          .delete(projects)
          .where(eq(projects.workspaceId, workspaceId));
        await client.database
          .delete(providerAccounts)
          .where(eq(providerAccounts.workspaceId, workspaceId));
        await client.database
          .delete(workspaces)
          .where(eq(workspaces.id, workspaceId));
      }
      await client.close();
    });

    it('merges structural and flexible project/application associations', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      const resources = await inventory.listProjectResources(actor, projectAId, {
        includeArchived: false,
      });
      expect(resources).toContainEqual({
        associationSources: [
          'PRIMARY_STRUCTURAL',
          'FLEXIBLE_RELATIONSHIP',
        ],
        entityId: applicationAId,
        entityKind: 'WEBSITE_APPLICATION',
      });
      expect(resources).toContainEqual({
        associationSources: ['FLEXIBLE_RELATIONSHIP'],
        entityId: additionalDomainId,
        entityKind: 'DOMAIN',
      });
      expect(resources).not.toContainEqual(
        expect.objectContaining({ entityId: archivedServerId }),
      );
      await expect(
        inventory.listProjectResources(actor, projectAId, {
          includeArchived: true,
        }),
      ).resolves.toContainEqual(
        expect.objectContaining({ entityId: archivedServerId }),
      );
    });

    it('merges primary and additional application domains', async () => {
      const domainsForApplication = await getService().listApplicationDomains(
        principal(workspaceAId),
        applicationAId,
        { includeArchived: false },
      );
      expect(domainsForApplication).toContainEqual({
        associationSources: [
          'PRIMARY_STRUCTURAL',
          'FLEXIBLE_RELATIONSHIP',
        ],
        entityId: primaryDomainId,
        entityKind: 'DOMAIN',
      });
      expect(domainsForApplication).toContainEqual({
        associationSources: ['FLEXIBLE_RELATIONSHIP'],
        entityId: additionalDomainId,
        entityKind: 'DOMAIN',
      });
    });

    it('reads hosting targets and inverse hosted applications', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      const targets = await inventory.listApplicationHostingTargets(
        actor,
        applicationAId,
        { includeArchived: false },
      );
      expect(targets.map(({ oppositeEndpoint }) => oppositeEndpoint)).toEqual(
        expect.arrayContaining([
          { entityId: serverAId, entityKind: 'SERVER' },
          { entityId: cloudAId, entityKind: 'CLOUD_RESOURCE' },
        ]),
      );
      await expect(
        inventory.listHostedApplications(actor, 'SERVER', serverAId, {
          includeArchived: false,
        }),
      ).resolves.toContainEqual(
        expect.objectContaining({
          oppositeEndpoint: {
            entityId: applicationAId,
            entityKind: 'WEBSITE_APPLICATION',
          },
        }),
      );
      await expect(
        inventory.listHostedApplications(actor, 'CLOUD_RESOURCE', cloudAId, {
          includeArchived: false,
        }),
      ).resolves.toContainEqual(
        expect.objectContaining({
          oppositeEndpoint: {
            entityId: applicationAId,
            entityKind: 'WEBSITE_APPLICATION',
          },
        }),
      );
    });

    it('reads dependencies, dependents, canonical connections, and both directions', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      await expect(
        inventory.listDependencies(actor, 'WEBSITE_APPLICATION', applicationAId, {
          includeArchived: false,
        }),
      ).resolves.toContainEqual(
        expect.objectContaining({
          oppositeEndpoint: {
            entityId: additionalDomainId,
            entityKind: 'DOMAIN',
          },
        }),
      );
      await expect(
        inventory.listDependents(actor, 'DOMAIN', additionalDomainId, {
          includeArchived: false,
        }),
      ).resolves.toContainEqual(
        expect.objectContaining({
          oppositeEndpoint: {
            entityId: applicationAId,
            entityKind: 'WEBSITE_APPLICATION',
          },
        }),
      );
      const serverConnections = await inventory.listConnections(
        actor,
        'SERVER',
        serverAId,
        { includeArchived: false },
      );
      const cloudConnections = await inventory.listConnections(
        actor,
        'CLOUD_RESOURCE',
        cloudAId,
        { includeArchived: false },
      );
      expect(serverConnections[0]?.oppositeEndpoint).toEqual({
        entityId: cloudAId,
        entityKind: 'CLOUD_RESOURCE',
      });
      expect(cloudConnections[0]?.oppositeEndpoint).toEqual({
        entityId: serverAId,
        entityKind: 'SERVER',
      });
      const immediate = await inventory.listImmediateRelationships(
        actor,
        'DOMAIN',
        additionalDomainId,
        { includeArchived: false },
      );
      expect(immediate.map(({ direction }) => direction)).toEqual(
        expect.arrayContaining(['INBOUND', 'OUTBOUND']),
      );
    });

    it('returns the same generic not-found result for hidden and nonexistent roots', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      await expect(
        inventory.listProjectResources(actor, projectBId, {
          includeArchived: false,
        }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.listProjectResources(actor, randomUUID(), {
          includeArchived: false,
        }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
    });
  },
);
