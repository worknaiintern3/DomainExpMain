import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  cloudResources,
  domains,
  emailAccounts,
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
  InvalidInventoryReferenceError,
  InventoryConflictError,
  InventoryRecordNotFoundError,
} from '../src/inventory/inventory.errors';
import { PostgresInventoryRepository } from '../src/inventory/inventory.repository';
import { InventoryService } from '../src/inventory/inventory.service';
import type {
  InventoryRecordEnvelope,
  InventoryResourceKind,
} from '../src/inventory/inventory.types';
import type { WorkspacePrincipal } from '../src/workspace-context';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

const resourceKinds: readonly InventoryResourceKind[] = [
  'email-account',
  'provider-account',
  'project',
  'domain',
  'server',
  'cloud-resource',
  'application',
];

function principal(
  workspaceId: string,
  role: WorkspacePrincipal['role'] = 'owner',
): WorkspacePrincipal {
  return {
    membershipId: randomUUID(),
    role,
    sessionId: randomUUID(),
    userId: randomUUID(),
    workspaceId,
  };
}

describeWithPostgreSql(
  'inventory persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    const paginationWorkspaceId = randomUUID();
    const records = new Map<InventoryResourceKind, InventoryRecordEnvelope>();
    let client: DatabaseClient | undefined;
    let service: InventoryService | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Inventory integration client was not initialized');
      }
      return client;
    };

    const getService = (): InventoryService => {
      if (!service) {
        throw new Error('Inventory integration service was not initialized');
      }
      return service;
    };

    const getRecord = (resource: InventoryResourceKind): InventoryRecordEnvelope => {
      const record = records.get(resource);
      if (!record) {
        throw new Error('Inventory integration record was not initialized');
      }
      return record;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: '../../packages/database/migrations',
      });
      await client.database.insert(workspaces).values([
        {
          id: workspaceAId,
          name: 'Inventory API workspace A',
          slug: `inventory-api-a-${workspaceAId.replaceAll('-', '')}`,
        },
        {
          id: workspaceBId,
          name: 'Inventory API workspace B',
          slug: `inventory-api-b-${workspaceBId.replaceAll('-', '')}`,
        },
        {
          id: paginationWorkspaceId,
          name: 'Inventory API pagination workspace',
          slug: `inventory-api-pages-${paginationWorkspaceId.replaceAll('-', '')}`,
        },
      ]);
      service = new InventoryService(new PostgresInventoryRepository(client));
    });

    afterAll(async () => {
      if (!client) {
        return;
      }
      for (const workspaceId of [workspaceAId, workspaceBId]) {
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
          .delete(emailAccounts)
          .where(eq(emailAccounts.workspaceId, workspaceId));
      }
      await client.database
        .delete(projects)
        .where(eq(projects.workspaceId, paginationWorkspaceId));
      await client.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceAId));
      await client.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceBId));
      await client.database
        .delete(workspaces)
        .where(eq(workspaces.id, paginationWorkspaceId));
      await client.close();
    });

    it('creates, lists, and gets all seven resources with valid structural references', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);
      const email = await inventory.create(actor, {
        resource: 'email-account',
        input: {
          email: ' Portfolio@Example.Test ',
          label: 'Operations',
        },
      });
      records.set('email-account', email);
      const provider = await inventory.create(actor, {
        resource: 'provider-account',
        input: {
          label: 'Registrar',
          loginEmailAccountId: email.record.id,
          providerKey: 'registrar',
        },
      });
      records.set('provider-account', provider);
      const project = await inventory.create(actor, {
        resource: 'project',
        input: { name: 'Main Portfolio' },
      });
      records.set('project', project);
      const domain = await inventory.create(actor, {
        resource: 'domain',
        input: {
          dnsProviderAccountId: provider.record.id,
          domainName: 'B\u00fccher.Example.',
          registrarProviderAccountId: provider.record.id,
        },
      });
      records.set('domain', domain);
      const server = await inventory.create(actor, {
        resource: 'server',
        input: {
          name: 'Application Server',
          primaryIp: '192.0.2.44',
          providerAccountId: provider.record.id,
        },
      });
      records.set('server', server);
      const cloudResource = await inventory.create(actor, {
        resource: 'cloud-resource',
        input: {
          name: 'Compute Instance',
          providerAccountId: provider.record.id,
          resourceType: 'compute',
        },
      });
      records.set('cloud-resource', cloudResource);
      const application = await inventory.create(actor, {
        resource: 'application',
        input: {
          kind: 'WEB_APPLICATION',
          name: 'Main Application',
          primaryDomainId: domain.record.id,
          projectId: project.record.id,
        },
      });
      records.set('application', application);

      for (const resource of resourceKinds) {
        const expected = getRecord(resource);
        expect(expected.record).toMatchObject({
          inventoryState: 'TRACKED',
          provenance: 'USER_ADDED',
          workspaceId: workspaceAId,
        });
        const found = await inventory.get(actor, resource, expected.record.id);
        const page = await inventory.list(actor, resource, {
          includeArchived: false,
          limit: 50,
        });
        expect(found.record.id).toBe(expected.record.id);
        expect(page.items.map(({ record }) => record.id)).toContain(
          expected.record.id,
        );
      }

      expect(email.record).toMatchObject({
        email: 'Portfolio@Example.Test',
        normalizedEmail: 'portfolio@example.test',
      });
      expect(domain.record).toMatchObject({
        domainName: 'B\u00fccher.Example',
        normalizedDomainName: 'xn--bcher-kva.example',
      });
    });

    it('patches, archives idempotently, excludes archived by default, and restores every resource', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId, 'admin');
      const email = getRecord('email-account');
      const provider = getRecord('provider-account');
      const project = getRecord('project');
      const domain = getRecord('domain');
      const server = getRecord('server');
      const cloudResource = getRecord('cloud-resource');
      const application = getRecord('application');

      await inventory.update(actor, email.record.id, {
        resource: 'email-account',
        input: { label: 'Updated email' },
      });
      await inventory.update(actor, provider.record.id, {
        resource: 'provider-account',
        input: { label: 'Updated provider' },
      });
      await inventory.update(actor, project.record.id, {
        resource: 'project',
        input: { description: 'Updated project' },
      });
      await inventory.update(actor, domain.record.id, {
        resource: 'domain',
        input: { autoRenew: true },
      });
      await inventory.update(actor, server.record.id, {
        resource: 'server',
        input: { region: 'test-region' },
      });
      await inventory.update(actor, cloudResource.record.id, {
        resource: 'cloud-resource',
        input: { region: 'test-region' },
      });
      await inventory.update(actor, application.record.id, {
        resource: 'application',
        input: { notes: 'Updated application' },
      });

      for (const resource of resourceKinds) {
        const id = getRecord(resource).record.id;
        await inventory.archive(actor, resource, id);
        await expect(inventory.archive(actor, resource, id)).resolves.toBeUndefined();
        await expect(inventory.get(actor, resource, id)).resolves.toMatchObject({
          record: { inventoryState: 'ARCHIVED' },
        });
        await expect(
          inventory.list(actor, resource, {
            includeArchived: false,
            limit: 50,
          }),
        ).resolves.toMatchObject({ items: [] });
        const included = await inventory.list(actor, resource, {
          includeArchived: true,
          limit: 50,
        });
        expect(included.items.map(({ record }) => record.id)).toContain(id);
      }

      await inventory.update(actor, email.record.id, {
        resource: 'email-account',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, provider.record.id, {
        resource: 'provider-account',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, project.record.id, {
        resource: 'project',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, domain.record.id, {
        resource: 'domain',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, server.record.id, {
        resource: 'server',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, cloudResource.record.id, {
        resource: 'cloud-resource',
        input: { inventoryState: 'TRACKED' },
      });
      await inventory.update(actor, application.record.id, {
        resource: 'application',
        input: { inventoryState: 'TRACKED' },
      });
    });

    it('treats foreign-workspace records as unavailable for read, update, and archive', async () => {
      const inventory = getService();
      const foreignActor = principal(workspaceBId);
      const projectId = getRecord('project').record.id;

      await expect(
        inventory.get(foreignActor, 'project', projectId),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.update(foreignActor, projectId, {
          resource: 'project',
          input: { name: 'Foreign update' },
        }),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
      await expect(
        inventory.archive(foreignActor, 'project', projectId),
      ).rejects.toBeInstanceOf(InventoryRecordNotFoundError);
    });

    it('maps nonexistent and cross-workspace structural references identically', async () => {
      const inventory = getService();
      const actorA = principal(workspaceAId);
      const actorB = principal(workspaceBId);
      const foreignProvider = await inventory.create(actorB, {
        resource: 'provider-account',
        input: { label: 'Foreign provider', providerKey: 'foreign' },
      });

      for (const providerAccountId of [randomUUID(), foreignProvider.record.id]) {
        await expect(
          inventory.create(actorA, {
            resource: 'server',
            input: { name: 'Invalid reference', providerAccountId },
          }),
        ).rejects.toBeInstanceOf(InvalidInventoryReferenceError);
      }
    });

    it('maps canonical email, project, and IDNA domain races to safe conflicts', async () => {
      const inventory = getService();
      const actor = principal(workspaceAId);

      await expect(
        inventory.create(actor, {
          resource: 'email-account',
          input: { email: 'portfolio@example.test' },
        }),
      ).rejects.toBeInstanceOf(InventoryConflictError);
      await expect(
        inventory.create(actor, {
          resource: 'project',
          input: { name: '  MAIN PORTFOLIO ' },
        }),
      ).rejects.toBeInstanceOf(InventoryConflictError);
      await expect(
        inventory.create(actor, {
          resource: 'domain',
          input: { domainName: 'xn--bcher-kva.example' },
        }),
      ).rejects.toBeInstanceOf(InventoryConflictError);
    });

    it('returns stable keyset pages without duplicate or missing boundary rows', async () => {
      const database = getClient();
      const actor = principal(paginationWorkspaceId);
      const expectedIds: string[] = [];
      const baseTime = Date.parse('2040-01-01T00:00:00.000Z');
      const values = Array.from({ length: 105 }, (_, index) => {
        const id = randomUUID();
        expectedIds.unshift(id);
        const createdAt = new Date(baseTime + index * 1000);
        return {
          createdAt,
          id,
          inventoryState: 'TRACKED' as const,
          name: `Pagination Project ${String(index)}`,
          normalizedName: `pagination project ${String(index)}`,
          provenance: 'USER_ADDED' as const,
          updatedAt: createdAt,
          workspaceId: paginationWorkspaceId,
        };
      });
      await database.withWorkspaceContext(paginationWorkspaceId, (transaction) =>
        transaction.insert(projects).values(values),
      );

      const first = await getService().list(actor, 'project', {
        includeArchived: false,
        limit: 50,
      });
      if (!first.nextCursor) {
        throw new Error('First pagination cursor is missing');
      }
      const second = await getService().list(actor, 'project', {
        cursor: first.nextCursor,
        includeArchived: false,
        limit: 50,
      });
      if (!second.nextCursor) {
        throw new Error('Second pagination cursor is missing');
      }
      const third = await getService().list(actor, 'project', {
        cursor: second.nextCursor,
        includeArchived: false,
        limit: 50,
      });
      const actualIds = [...first.items, ...second.items, ...third.items].map(
        ({ record }) => record.id,
      );

      expect(first.items).toHaveLength(50);
      expect(second.items).toHaveLength(50);
      expect(third.items).toHaveLength(5);
      expect(third.nextCursor).toBeNull();
      expect(actualIds).toEqual(expectedIds);
      expect(new Set(actualIds).size).toBe(105);
    });
  },
);
