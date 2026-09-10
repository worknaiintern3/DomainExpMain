import { randomUUID } from 'node:crypto';

import {
  cloudResources,
  createDatabaseClient,
  domains,
  inventoryRelationships,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  InvalidInventoryInputError,
  InventoryConflictError,
  InventoryRecordNotFoundError,
} from '../src/inventory/inventory.errors';
import { PostgresInventoryRelationshipRepository } from '../src/inventory/relationships/relationships.repository';
import { InventoryRelationshipService } from '../src/inventory/relationships/relationships.service';
import type { WorkspacePrincipal } from '../src/workspace-context';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

function principal(workspaceId: string): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role: 'owner',
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId,
  };
}

describeWithPostgreSql(
  'inventory relationship persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    const projectPrimaryId = randomUUID();
    const projectAdditionalId = randomUUID();
    const projectBId = randomUUID();
    const primaryDomainId = randomUUID();
    const additionalDomainId = randomUUID();
    const domainBId = randomUUID();
    const serverAId = randomUUID();
    const secondServerAId = randomUUID();
    const serverBId = randomUUID();
    const providerAId = randomUUID();
    const providerBId = randomUUID();
    const cloudAId = randomUUID();
    const cloudBId = randomUUID();
    const applicationAId = randomUUID();
    const applicationBId = randomUUID();
    let client: DatabaseClient | undefined;
    let service: InventoryRelationshipService | undefined;

    const getClient = () => {
      if (!client) {
        throw new Error('Relationship integration client was not initialized');
      }
      return client;
    };
    const getService = () => {
      if (!service) {
        throw new Error('Relationship integration service was not initialized');
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
          name: 'Relationship API workspace A',
          slug: `relationship-api-a-${workspaceAId.replaceAll('-', '')}`,
        },
        {
          id: workspaceBId,
          name: 'Relationship API workspace B',
          slug: `relationship-api-b-${workspaceBId.replaceAll('-', '')}`,
        },
      ]);
      await client.database.insert(providerAccounts).values([
        {
          id: providerAId,
          label: 'Relationship provider A',
          provenance: 'USER_ADDED',
          providerKey: 'relationship_provider_a',
          workspaceId: workspaceAId,
        },
        {
          id: providerBId,
          label: 'Relationship provider B',
          provenance: 'USER_ADDED',
          providerKey: 'relationship_provider_b',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(projects).values([
        {
          id: projectPrimaryId,
          name: 'Primary project',
          normalizedName: 'primary project',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: projectAdditionalId,
          name: 'Additional project',
          normalizedName: 'additional project',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: projectBId,
          name: 'Foreign project',
          normalizedName: 'foreign project',
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(domains).values([
        {
          domainName: 'primary.relationship.test',
          id: primaryDomainId,
          normalizedDomainName: 'primary.relationship.test',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          domainName: 'additional.relationship.test',
          id: additionalDomainId,
          normalizedDomainName: 'additional.relationship.test',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          domainName: 'foreign.relationship.test',
          id: domainBId,
          normalizedDomainName: 'foreign.relationship.test',
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(servers).values([
        {
          id: serverAId,
          name: 'Relationship server A',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: secondServerAId,
          name: 'Relationship server A2',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: serverBId,
          name: 'Relationship server B',
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(cloudResources).values([
        {
          id: cloudAId,
          name: 'Relationship cloud A',
          provenance: 'USER_ADDED',
          providerAccountId: providerAId,
          resourceType: 'compute',
          workspaceId: workspaceAId,
        },
        {
          id: cloudBId,
          name: 'Relationship cloud B',
          provenance: 'USER_ADDED',
          providerAccountId: providerBId,
          resourceType: 'compute',
          workspaceId: workspaceBId,
        },
      ]);
      await client.database.insert(websiteApplications).values([
        {
          id: applicationAId,
          kind: 'WEB_APPLICATION',
          name: 'Relationship application A',
          primaryDomainId,
          projectId: projectPrimaryId,
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        },
        {
          id: applicationBId,
          kind: 'WEB_APPLICATION',
          name: 'Relationship application B',
          projectId: projectBId,
          provenance: 'USER_ADDED',
          workspaceId: workspaceBId,
        },
      ]);
      service = new InventoryRelationshipService(
        new PostgresInventoryRelationshipRepository(client),
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

    it('creates every relationship type and canonicalizes CONNECTED_TO', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      const inputs = [
        {
          relationshipType: 'GROUPS',
          source: { entityId: projectAdditionalId, entityKind: 'PROJECT' },
          target: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
        },
        {
          relationshipType: 'HOSTED_ON',
          source: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
          target: { entityId: serverAId, entityKind: 'SERVER' },
        },
        {
          relationshipType: 'USES_DOMAIN',
          source: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
          target: { entityId: additionalDomainId, entityKind: 'DOMAIN' },
        },
        {
          relationshipType: 'DEPENDS_ON',
          source: { entityId: serverAId, entityKind: 'SERVER' },
          target: { entityId: cloudAId, entityKind: 'CLOUD_RESOURCE' },
        },
        {
          relationshipType: 'ROUTES_TO',
          source: { entityId: additionalDomainId, entityKind: 'DOMAIN' },
          target: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
        },
        {
          relationshipType: 'CONNECTED_TO',
          source: { entityId: cloudAId, entityKind: 'CLOUD_RESOURCE' },
          target: { entityId: secondServerAId, entityKind: 'SERVER' },
        },
      ] as const;

      const created = [];
      for (const input of inputs) {
        created.push(await inventory.create(actor, input));
      }
      expect(created.map(({ relationshipType }) => relationshipType)).toEqual([
        'GROUPS',
        'HOSTED_ON',
        'USES_DOMAIN',
        'DEPENDS_ON',
        'ROUTES_TO',
        'CONNECTED_TO',
      ]);
      expect(created.every(({ provenance }) => provenance === 'USER_MAPPED')).toBe(true);

      await expect(
        inventory.create(actor, {
          relationshipType: 'CONNECTED_TO',
          source: { entityId: secondServerAId, entityKind: 'SERVER' },
          target: { entityId: cloudAId, entityKind: 'CLOUD_RESOURCE' },
        }),
      ).rejects.toBeInstanceOf(InventoryConflictError);
      const connected = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        relationshipType: 'CONNECTED_TO',
      });
      expect(connected.items).toHaveLength(1);
      expect(connected.items[0]).toEqual(
        expect.objectContaining({
          id: created[5]?.id,
          source: created[5]?.source,
          target: created[5]?.target,
        }),
      );
    });

    it('enforces primary structural semantic locks', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      await expect(
        inventory.create(actor, {
          relationshipType: 'GROUPS',
          source: { entityId: projectPrimaryId, entityKind: 'PROJECT' },
          target: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
        }),
      ).rejects.toBeInstanceOf(InvalidInventoryInputError);
      await expect(
        inventory.create(actor, {
          relationshipType: 'USES_DOMAIN',
          source: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
          target: { entityId: primaryDomainId, entityKind: 'DOMAIN' },
        }),
      ).rejects.toBeInstanceOf(InvalidInventoryInputError);
    });

    it('archives idempotently, requires explicit restore, and applies filters', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      const grouped = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        relationshipType: 'GROUPS',
        sourceEntityId: projectAdditionalId,
        sourceEntityKind: 'PROJECT',
        targetEntityId: applicationAId,
        targetEntityKind: 'WEBSITE_APPLICATION',
      });
      const sourceFiltered = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        sourceEntityId: projectAdditionalId,
        sourceEntityKind: 'PROJECT',
      });
      const targetFiltered = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        targetEntityId: applicationAId,
        targetEntityKind: 'WEBSITE_APPLICATION',
      });
      const typeFiltered = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        relationshipType: 'GROUPS',
      });
      expect(sourceFiltered.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ relationshipType: 'GROUPS' })]),
      );
      expect(targetFiltered.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ relationshipType: 'GROUPS' })]),
      );
      expect(typeFiltered.items.every(({ relationshipType }) => relationshipType === 'GROUPS')).toBe(true);
      const relationship = grouped.items[0];
      expect(relationship).toBeDefined();
      if (!relationship) {
        throw new Error('Expected grouped relationship was not found');
      }
      await inventory.archive(actor, relationship.id);
      await inventory.archive(actor, relationship.id);
      await expect(inventory.get(actor, relationship.id)).resolves.toEqual(
        expect.objectContaining({ inventoryState: 'ARCHIVED' }),
      );
      expect(
        (await inventory.list(actor, { includeArchived: false, limit: 50 })).items,
      ).not.toContainEqual(expect.objectContaining({ id: relationship.id }));
      expect(
        (await inventory.list(actor, { includeArchived: true, limit: 50 })).items,
      ).toContainEqual(expect.objectContaining({ id: relationship.id }));
      await expect(
        inventory.create(actor, {
          relationshipType: 'GROUPS',
          source: { entityId: projectAdditionalId, entityKind: 'PROJECT' },
          target: { entityId: applicationAId, entityKind: 'WEBSITE_APPLICATION' },
        }),
      ).rejects.toBeInstanceOf(InventoryConflictError);
      await expect(
        inventory.update(actor, relationship.id, { inventoryState: 'TRACKED' }),
      ).resolves.toEqual(expect.objectContaining({ inventoryState: 'TRACKED' }));
    });

    it('keeps foreign relationships and endpoint entities unavailable', async () => {
      const inventory = getService();
      const actorA = principal(workspaceAId);
      const actorB = principal(workspaceBId);
      const foreignRelationship = await inventory.create(actorB, {
        relationshipType: 'GROUPS',
        source: { entityId: projectBId, entityKind: 'PROJECT' },
        target: { entityId: domainBId, entityKind: 'DOMAIN' },
      });
      await expect(
        inventory.get(actorA, foreignRelationship.id),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.update(actorA, foreignRelationship.id, { notes: 'hidden' }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.archive(actorA, foreignRelationship.id),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.create(actorA, {
          relationshipType: 'GROUPS',
          source: { entityId: projectBId, entityKind: 'PROJECT' },
          target: { entityId: additionalDomainId, entityKind: 'DOMAIN' },
        }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.create(actorA, {
          relationshipType: 'GROUPS',
          source: { entityId: projectAdditionalId, entityKind: 'PROJECT' },
          target: { entityId: domainBId, entityKind: 'DOMAIN' },
        }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
    });

    it('returns stable keyset pages without duplicate or missing rows', async () => {
      const database = getClient();
      const inventory = getService();
      const actor = principal(workspaceAId);
      const domainIds = Array.from({ length: 55 }, () => randomUUID());
      await database.database.insert(domains).values(
        domainIds.map((id, index) => ({
          domainName: `page-${String(index)}.relationship.test`,
          id,
          normalizedDomainName: `page-${String(index)}.relationship.test`,
          provenance: 'USER_ADDED' as const,
          workspaceId: workspaceAId,
        })),
      );
      for (const entityId of domainIds) {
        await inventory.create(actor, {
          relationshipType: 'GROUPS',
          source: { entityId: projectAdditionalId, entityKind: 'PROJECT' },
          target: { entityId, entityKind: 'DOMAIN' },
        });
      }

      const first = await inventory.list(actor, {
        includeArchived: false,
        limit: 50,
        relationshipType: 'GROUPS',
        sourceEntityId: projectAdditionalId,
        sourceEntityKind: 'PROJECT',
      });
      expect(first.nextCursor).toBeTypeOf('string');
      const second = await inventory.list(actor, {
        cursor: first.nextCursor ?? undefined,
        includeArchived: false,
        limit: 50,
        relationshipType: 'GROUPS',
        sourceEntityId: projectAdditionalId,
        sourceEntityKind: 'PROJECT',
      });
      const ids = [...first.items, ...second.items].map(({ id }) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(56);
    });
  },
);
