import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { Database, DatabaseClient } from '../src/client/database-types';
import * as schema from '../src/schema';
import {
  cloudResources,
  domains,
  inventoryNodes,
  inventoryRelationships,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  workspaces,
} from '../src/schema';
import { withWorkspaceContext } from '../src/transactions/workspace-context';
import {
  createInventoryGraphFixture,
  createInventoryGraphWorkspace,
  type InventoryGraphFixture,
} from './inventory-graph-test-data';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;

interface PostgreSqlErrorShape {
  readonly cause?: unknown;
  readonly code?: unknown;
}

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const errorShape = error as PostgreSqlErrorShape;
  if (typeof errorShape.code === 'string') {
    return errorShape.code;
  }

  return getPostgreSqlErrorCode(errorShape.cause);
}

async function expectPostgreSqlError(
  operation: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  const error = await operation().catch((operationError: unknown) => operationError);
  expect(getPostgreSqlErrorCode(error)).toBe(expectedCode);
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]+$/u.test(identifier)) {
    throw new Error('Unsafe PostgreSQL test identifier');
  }
  return `"${identifier}"`;
}

describeWithPrivilegedPostgreSql(
  'inventory graph row-level security (requires RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_graph_rls_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    let adminClient: DatabaseClient | undefined;
    let fixtureA: InventoryGraphFixture | undefined;
    let fixtureB: InventoryGraphFixture | undefined;
    let relationshipAId: string | undefined;
    let relationshipBId: string | undefined;
    let runtimeConnection: PoolClient | undefined;
    let runtimeDatabase: Database | undefined;
    let runtimeRoleCreated = false;

    const getAdminClient = (): DatabaseClient => {
      if (!adminClient) {
        throw new Error('Inventory graph RLS admin client was not initialized');
      }
      return adminClient;
    };

    const getFixtureA = (): InventoryGraphFixture => {
      if (!fixtureA) {
        throw new Error('Inventory graph RLS fixture A was not initialized');
      }
      return fixtureA;
    };

    const getFixtureB = (): InventoryGraphFixture => {
      if (!fixtureB) {
        throw new Error('Inventory graph RLS fixture B was not initialized');
      }
      return fixtureB;
    };

    const getRuntimeDatabase = (): Database => {
      if (!runtimeDatabase) {
        throw new Error('Inventory graph RLS runtime database was not initialized');
      }
      return runtimeDatabase;
    };

    beforeAll(async () => {
      adminClient = createDatabaseClient(getPrivilegedRlsTestConfiguration());
      await migrate(adminClient.database, { migrationsFolder: './migrations' });
      await adminClient.pool.query(
        `create role ${runtimeRoleIdentifier} nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls`,
      );
      runtimeRoleCreated = true;
      await adminClient.pool.query(
        `grant ${runtimeRoleIdentifier} to current_user`,
      );
      await adminClient.pool.query(
        `grant usage on schema public, domainpulse to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant execute on function domainpulse.current_workspace_id() to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select on table inventory_nodes to ${runtimeRoleIdentifier}`,
      );
      await adminClient.pool.query(
        `grant select, insert, update, delete on table inventory_relationships to ${runtimeRoleIdentifier}`,
      );

      await adminClient.transaction(async (transaction) => {
        const workspaceAId = await createInventoryGraphWorkspace(
          transaction,
          'graph-rls-a',
        );
        const workspaceBId = await createInventoryGraphWorkspace(
          transaction,
          'graph-rls-b',
        );
        fixtureA = await createInventoryGraphFixture(
          transaction,
          workspaceAId,
          'graph-rls-a',
        );
        fixtureB = await createInventoryGraphFixture(
          transaction,
          workspaceBId,
          'graph-rls-b',
        );
        const relationships = await transaction
          .insert(inventoryRelationships)
          .values([
            {
              provenance: 'USER_MAPPED',
              relationshipType: 'GROUPS',
              sourceKind: 'PROJECT',
              sourceNodeId: fixtureA.projectNodeId,
              targetKind: 'DOMAIN',
              targetNodeId: fixtureA.domainNodeId,
              workspaceId: fixtureA.workspaceId,
            },
            {
              provenance: 'USER_MAPPED',
              relationshipType: 'GROUPS',
              sourceKind: 'PROJECT',
              sourceNodeId: fixtureB.projectNodeId,
              targetKind: 'DOMAIN',
              targetNodeId: fixtureB.domainNodeId,
              workspaceId: fixtureB.workspaceId,
            },
          ])
          .returning({
            id: inventoryRelationships.id,
            workspaceId: inventoryRelationships.workspaceId,
          });
        relationshipAId = relationships.find(
          ({ workspaceId }) => workspaceId === fixtureA?.workspaceId,
        )?.id;
        relationshipBId = relationships.find(
          ({ workspaceId }) => workspaceId === fixtureB?.workspaceId,
        )?.id;
      });

      if (!relationshipAId || !relationshipBId) {
        throw new Error('Inventory graph RLS relationship fixtures are missing');
      }
      runtimeConnection = await adminClient.pool.connect();
      await runtimeConnection.query(`set role ${runtimeRoleIdentifier}`);
      runtimeDatabase = drizzle(runtimeConnection, { schema, logger: false });
    });

    afterAll(async () => {
      if (runtimeConnection) {
        await runtimeConnection.query('reset role');
        runtimeConnection.release();
      }
      if (!adminClient) {
        return;
      }

      for (const fixture of [fixtureA, fixtureB]) {
        if (!fixture) {
          continue;
        }
        await adminClient.database
          .delete(inventoryRelationships)
          .where(eq(inventoryRelationships.workspaceId, fixture.workspaceId));
        await adminClient.database
          .delete(websiteApplications)
          .where(eq(websiteApplications.id, fixture.websiteApplicationId));
        await adminClient.database
          .delete(cloudResources)
          .where(eq(cloudResources.id, fixture.cloudResourceId));
        await adminClient.database
          .delete(servers)
          .where(eq(servers.id, fixture.serverId));
        await adminClient.database
          .delete(domains)
          .where(eq(domains.id, fixture.domainId));
        await adminClient.database
          .delete(projects)
          .where(eq(projects.id, fixture.projectId));
        await adminClient.database
          .delete(providerAccounts)
          .where(eq(providerAccounts.id, fixture.providerAccountId));
        await adminClient.database
          .delete(workspaces)
          .where(eq(workspaces.id, fixture.workspaceId));
      }

      if (runtimeRoleCreated) {
        await adminClient.pool.query(
          `revoke ${runtimeRoleIdentifier} from current_user`,
        );
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('uses a non-owner NOBYPASSRLS role with only the approved graph grants', async () => {
      const admin = getAdminClient();
      const roleResult = await admin.pool.query<{
        bypassRls: boolean;
        superuser: boolean;
      }>(
        'select rolbypassrls as "bypassRls", rolsuper as "superuser" from pg_roles where rolname = $1',
        [runtimeRoleName],
      );
      const tableResult = await admin.pool.query<{
        ownerName: string;
        rlsEnabled: boolean;
        tableName: string;
      }>(
        `select c.relname as "tableName", c.relrowsecurity as "rlsEnabled", pg_get_userbyid(c.relowner) as "ownerName"
         from pg_class c
         where c.oid in ('public.inventory_nodes'::regclass, 'public.inventory_relationships'::regclass)
         order by c.relname`,
      );
      const privilegeResult = await admin.pool.query<{
        nodeDelete: boolean;
        nodeInsert: boolean;
        nodeSelect: boolean;
        nodeUpdate: boolean;
        relationshipDelete: boolean;
        relationshipInsert: boolean;
        relationshipSelect: boolean;
        relationshipUpdate: boolean;
      }>(
        `select
          has_table_privilege($1, 'inventory_nodes', 'SELECT') as "nodeSelect",
          has_table_privilege($1, 'inventory_nodes', 'INSERT') as "nodeInsert",
          has_table_privilege($1, 'inventory_nodes', 'UPDATE') as "nodeUpdate",
          has_table_privilege($1, 'inventory_nodes', 'DELETE') as "nodeDelete",
          has_table_privilege($1, 'inventory_relationships', 'SELECT') as "relationshipSelect",
          has_table_privilege($1, 'inventory_relationships', 'INSERT') as "relationshipInsert",
          has_table_privilege($1, 'inventory_relationships', 'UPDATE') as "relationshipUpdate",
          has_table_privilege($1, 'inventory_relationships', 'DELETE') as "relationshipDelete"`,
        [runtimeRoleName],
      );

      expect(roleResult.rows[0]).toEqual({ bypassRls: false, superuser: false });
      expect(tableResult.rows.map(({ tableName }) => tableName)).toEqual([
        'inventory_nodes',
        'inventory_relationships',
      ]);
      for (const table of tableResult.rows) {
        expect(table.rlsEnabled).toBe(true);
        expect(table.ownerName).not.toBe(runtimeRoleName);
      }
      expect(privilegeResult.rows[0]).toEqual({
        nodeDelete: false,
        nodeInsert: false,
        nodeSelect: true,
        nodeUpdate: false,
        relationshipDelete: true,
        relationshipInsert: true,
        relationshipSelect: true,
        relationshipUpdate: true,
      });
    });

    it('shows nodes only for the current workspace and fails closed without context', async () => {
      const database = getRuntimeDatabase();
      const a = getFixtureA();
      const b = getFixtureB();
      const nodesA = await withWorkspaceContext(database, a.workspaceId, (tx) =>
        tx.select().from(inventoryNodes),
      );
      const nodesB = await withWorkspaceContext(database, b.workspaceId, (tx) =>
        tx.select().from(inventoryNodes),
      );
      expect(nodesA).toHaveLength(5);
      expect(nodesA.every(({ workspaceId }) => workspaceId === a.workspaceId)).toBe(
        true,
      );
      expect(nodesB).toHaveLength(5);
      expect(nodesB.every(({ workspaceId }) => workspaceId === b.workspaceId)).toBe(
        true,
      );
      await expect(database.select().from(inventoryNodes)).resolves.toHaveLength(0);
    });

    it('allows same-workspace relationship reads and writes', async () => {
      const database = getRuntimeDatabase();
      const fixture = getFixtureA();
      const rollbackProbe = new Error('rollback graph RLS write probe');

      await expect(
        withWorkspaceContext(database, fixture.workspaceId, async (transaction) => {
          const visible = await transaction.select().from(inventoryRelationships);
          expect(visible.map(({ id }) => id)).toEqual([relationshipAId]);
          const [inserted] = await transaction
            .insert(inventoryRelationships)
            .values({
              provenance: 'USER_MAPPED',
              relationshipType: 'HOSTED_ON',
              sourceKind: 'WEBSITE_APPLICATION',
              sourceNodeId: fixture.websiteApplicationNodeId,
              targetKind: 'SERVER',
              targetNodeId: fixture.serverNodeId,
              workspaceId: fixture.workspaceId,
            })
            .returning({ id: inventoryRelationships.id });
          if (!inserted) {
            throw new Error('Same-workspace graph relationship was not created');
          }
          const updated = await transaction
            .update(inventoryRelationships)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(inventoryRelationships.id, inserted.id))
            .returning({ inventoryState: inventoryRelationships.inventoryState });
          const deleted = await transaction
            .delete(inventoryRelationships)
            .where(eq(inventoryRelationships.id, inserted.id))
            .returning({ id: inventoryRelationships.id });
          expect(updated).toEqual([{ inventoryState: 'ARCHIVED' }]);
          expect(deleted).toEqual([{ id: inserted.id }]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('hides cross-workspace relationships and fails closed without context', async () => {
      const database = getRuntimeDatabase();
      const fixture = getFixtureA();
      const visible = await withWorkspaceContext(
        database,
        fixture.workspaceId,
        (transaction) => transaction.select().from(inventoryRelationships),
      );
      expect(visible.map(({ id }) => id)).toEqual([relationshipAId]);
      await expect(
        database.select().from(inventoryRelationships),
      ).resolves.toHaveLength(0);
    });

    it('blocks cross-workspace relationship inserts, updates, and deletes', async () => {
      const database = getRuntimeDatabase();
      const a = getFixtureA();
      const b = getFixtureB();
      await expectPostgreSqlError(
        () =>
          withWorkspaceContext(database, a.workspaceId, (transaction) =>
            transaction.insert(inventoryRelationships).values({
              provenance: 'USER_MAPPED',
              relationshipType: 'HOSTED_ON',
              sourceKind: 'WEBSITE_APPLICATION',
              sourceNodeId: b.websiteApplicationNodeId,
              targetKind: 'SERVER',
              targetNodeId: b.serverNodeId,
              workspaceId: b.workspaceId,
            }),
          ),
        '42501',
      );
      const changed = await withWorkspaceContext(
        database,
        a.workspaceId,
        async (transaction) => ({
          deleted: await transaction
            .delete(inventoryRelationships)
            .where(eq(inventoryRelationships.id, relationshipBId ?? randomUUID()))
            .returning({ id: inventoryRelationships.id }),
          updated: await transaction
            .update(inventoryRelationships)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(inventoryRelationships.id, relationshipBId ?? randomUUID()))
            .returning({ id: inventoryRelationships.id }),
        }),
      );
      expect(changed.deleted).toHaveLength(0);
      expect(changed.updated).toHaveLength(0);
    });

    it('denies direct runtime mutation of inventory nodes', async () => {
      const database = getRuntimeDatabase();
      const fixture = getFixtureA();
      const mutations: (() => Promise<unknown>)[] = [
        () =>
          withWorkspaceContext(database, fixture.workspaceId, (transaction) =>
            transaction.insert(inventoryNodes).values({
              entityId: randomUUID(),
              entityKind: 'PROJECT',
              workspaceId: fixture.workspaceId,
            }),
          ),
        () =>
          withWorkspaceContext(database, fixture.workspaceId, (transaction) =>
            transaction
              .update(inventoryNodes)
              .set({ entityKind: 'DOMAIN' })
              .where(eq(inventoryNodes.nodeId, fixture.projectNodeId)),
          ),
        () =>
          withWorkspaceContext(database, fixture.workspaceId, (transaction) =>
            transaction
              .delete(inventoryNodes)
              .where(eq(inventoryNodes.nodeId, fixture.projectNodeId)),
          ),
      ];
      for (const mutation of mutations) {
        await expectPostgreSqlError(mutation, '42501');
      }
    });
  },
);
