import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  Database,
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
import * as schema from '../src/schema';
import {
  cloudResources,
  domains,
  emailAccounts,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  workspaces,
} from '../src/schema';
import { withWorkspaceContext } from '../src/transactions/workspace-context';
import {
  getPrivilegedRlsTestConfiguration,
  hasPrivilegedRlsTestDatabase,
} from './test-database';

const describeWithPrivilegedPostgreSql = hasPrivilegedRlsTestDatabase
  ? describe
  : describe.skip;

const portfolioTableNames = [
  'cloud_resources',
  'domains',
  'email_accounts',
  'projects',
  'provider_accounts',
  'servers',
  'website_applications',
] as const;

interface PortfolioFixtureIds {
  readonly cloudResourceId: string;
  readonly domainId: string;
  readonly emailAccountId: string;
  readonly projectId: string;
  readonly providerAccountId: string;
  readonly serverId: string;
  readonly websiteApplicationId: string;
}

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

async function insertPortfolioFixture(
  transaction: DatabaseTransaction,
  workspaceId: string,
  label: string,
): Promise<PortfolioFixtureIds> {
  const projectId = randomUUID();
  const emailAccountId = randomUUID();
  const providerAccountId = randomUUID();
  const domainId = randomUUID();
  const serverId = randomUUID();
  const cloudResourceId = randomUUID();
  const websiteApplicationId = randomUUID();

  await transaction.insert(projects).values({
    id: projectId,
    name: `RLS ${label} project`,
    normalizedName: `rls ${label} project`,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(emailAccounts).values({
    email: `rls-${label}-${emailAccountId}@example.test`,
    id: emailAccountId,
    normalizedEmail: `rls-${label}-${emailAccountId}@example.test`,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(providerAccounts).values({
    id: providerAccountId,
    label: `RLS ${label} provider`,
    loginEmailAccountId: emailAccountId,
    providerKey: 'rls_provider',
    provenance: 'USER_MAPPED',
    workspaceId,
  });
  await transaction.insert(domains).values({
    dnsProviderAccountId: providerAccountId,
    domainName: `${label}-${domainId}.example`,
    id: domainId,
    normalizedDomainName: `${label}-${domainId}.example`,
    provenance: 'USER_ADDED',
    registrarProviderAccountId: providerAccountId,
    workspaceId,
  });
  await transaction.insert(servers).values({
    id: serverId,
    name: `RLS ${label} server`,
    providerAccountId,
    provenance: 'USER_MAPPED',
    workspaceId,
  });
  await transaction.insert(cloudResources).values({
    id: cloudResourceId,
    name: `RLS ${label} resource`,
    providerAccountId,
    provenance: 'PROVIDER_API',
    resourceType: 'compute_instance',
    workspaceId,
  });
  await transaction.insert(websiteApplications).values({
    id: websiteApplicationId,
    kind: 'WEB_APPLICATION',
    name: `RLS ${label} application`,
    primaryDomainId: domainId,
    projectId,
    provenance: 'USER_MAPPED',
    workspaceId,
  });

  return {
    cloudResourceId,
    domainId,
    emailAccountId,
    projectId,
    providerAccountId,
    serverId,
    websiteApplicationId,
  };
}

async function selectPortfolioIds(transaction: DatabaseTransaction) {
  return {
    cloudResources: await transaction
      .select({ id: cloudResources.id })
      .from(cloudResources),
    domains: await transaction.select({ id: domains.id }).from(domains),
    emailAccounts: await transaction
      .select({ id: emailAccounts.id })
      .from(emailAccounts),
    projects: await transaction.select({ id: projects.id }).from(projects),
    providerAccounts: await transaction
      .select({ id: providerAccounts.id })
      .from(providerAccounts),
    servers: await transaction.select({ id: servers.id }).from(servers),
    websiteApplications: await transaction
      .select({ id: websiteApplications.id })
      .from(websiteApplications),
  };
}

describeWithPrivilegedPostgreSql(
  'portfolio row-level security (requires RLS_TEST_DATABASE_URL)',
  () => {
    const runtimeRoleName = `domainpulse_portfolio_rls_${randomUUID().replaceAll('-', '')}`;
    const runtimeRoleIdentifier = quoteIdentifier(runtimeRoleName);
    const workspaceAId = randomUUID();
    const workspaceBId = randomUUID();
    let adminClient: DatabaseClient | undefined;
    let fixtureA: PortfolioFixtureIds | undefined;
    let fixtureB: PortfolioFixtureIds | undefined;
    let runtimeConnection: PoolClient | undefined;
    let runtimeDatabase: Database | undefined;
    let runtimeRoleCreated = false;

    const getAdminClient = (): DatabaseClient => {
      if (!adminClient) {
        throw new Error('Portfolio RLS admin client was not initialized');
      }
      return adminClient;
    };

    const getFixtureA = (): PortfolioFixtureIds => {
      if (!fixtureA) {
        throw new Error('Workspace A portfolio fixture was not initialized');
      }
      return fixtureA;
    };

    const getFixtureB = (): PortfolioFixtureIds => {
      if (!fixtureB) {
        throw new Error('Workspace B portfolio fixture was not initialized');
      }
      return fixtureB;
    };

    const getRuntimeDatabase = (): Database => {
      if (!runtimeDatabase) {
        throw new Error('Portfolio RLS runtime database was not initialized');
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
        `grant select, insert, update, delete on table ${portfolioTableNames.map(quoteIdentifier).join(', ')} to ${runtimeRoleIdentifier}`,
      );

      await adminClient.transaction(async (transaction) => {
        await transaction.insert(workspaces).values([
          {
            id: workspaceAId,
            name: 'Portfolio RLS Workspace A',
            slug: `portfolio-rls-a-${workspaceAId}`,
          },
          {
            id: workspaceBId,
            name: 'Portfolio RLS Workspace B',
            slug: `portfolio-rls-b-${workspaceBId}`,
          },
        ]);
        fixtureA = await insertPortfolioFixture(transaction, workspaceAId, 'a');
        fixtureB = await insertPortfolioFixture(transaction, workspaceBId, 'b');
      });

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

      await adminClient.database
        .delete(websiteApplications)
        .where(eq(websiteApplications.workspaceId, workspaceAId));
      await adminClient.database
        .delete(websiteApplications)
        .where(eq(websiteApplications.workspaceId, workspaceBId));
      await adminClient.database
        .delete(cloudResources)
        .where(eq(cloudResources.workspaceId, workspaceAId));
      await adminClient.database
        .delete(cloudResources)
        .where(eq(cloudResources.workspaceId, workspaceBId));
      await adminClient.database
        .delete(servers)
        .where(eq(servers.workspaceId, workspaceAId));
      await adminClient.database
        .delete(servers)
        .where(eq(servers.workspaceId, workspaceBId));
      await adminClient.database
        .delete(domains)
        .where(eq(domains.workspaceId, workspaceAId));
      await adminClient.database
        .delete(domains)
        .where(eq(domains.workspaceId, workspaceBId));
      await adminClient.database
        .delete(providerAccounts)
        .where(eq(providerAccounts.workspaceId, workspaceAId));
      await adminClient.database
        .delete(providerAccounts)
        .where(eq(providerAccounts.workspaceId, workspaceBId));
      await adminClient.database
        .delete(emailAccounts)
        .where(eq(emailAccounts.workspaceId, workspaceAId));
      await adminClient.database
        .delete(emailAccounts)
        .where(eq(emailAccounts.workspaceId, workspaceBId));
      await adminClient.database
        .delete(projects)
        .where(eq(projects.workspaceId, workspaceAId));
      await adminClient.database
        .delete(projects)
        .where(eq(projects.workspaceId, workspaceBId));
      await adminClient.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceAId));
      await adminClient.database
        .delete(workspaces)
        .where(eq(workspaces.id, workspaceBId));

      if (runtimeRoleCreated) {
        await adminClient.pool.query(`drop owned by ${runtimeRoleIdentifier}`);
        await adminClient.pool.query(
          `revoke ${runtimeRoleIdentifier} from current_user`,
        );
        await adminClient.pool.query(`drop role ${runtimeRoleIdentifier}`);
      }
      await adminClient.close();
    });

    it('enables RLS on all seven tables for a non-owner NOBYPASSRLS role', async () => {
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
         where c.oid in (${portfolioTableNames.map((name) => `'public.${name}'::regclass`).join(', ')})
         order by c.relname`,
      );

      expect(roleResult.rows[0]).toEqual({ bypassRls: false, superuser: false });
      expect(tableResult.rows.map(({ tableName }) => tableName)).toEqual(
        portfolioTableNames,
      );
      for (const table of tableResult.rows) {
        expect(table.rlsEnabled).toBe(true);
        expect(table.ownerName).not.toBe(runtimeRoleName);
      }
    });

    it('allows same-workspace reads and writes on all seven tables', async () => {
      const database = getRuntimeDatabase();
      const expected = getFixtureA();
      const rows = await withWorkspaceContext(
        database,
        workspaceAId,
        selectPortfolioIds,
      );
      expect(rows).toEqual({
        cloudResources: [{ id: expected.cloudResourceId }],
        domains: [{ id: expected.domainId }],
        emailAccounts: [{ id: expected.emailAccountId }],
        projects: [{ id: expected.projectId }],
        providerAccounts: [{ id: expected.providerAccountId }],
        servers: [{ id: expected.serverId }],
        websiteApplications: [{ id: expected.websiteApplicationId }],
      });

      const rollbackProbe = new Error('rollback same-workspace portfolio writes');
      await expect(
        withWorkspaceContext(database, workspaceAId, async (transaction) => {
          await insertPortfolioFixture(
            transaction,
            workspaceAId,
            randomUUID(),
          );
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('hides cross-workspace reads and fails closed without context', async () => {
      const database = getRuntimeDatabase();
      const expected = getFixtureA();
      const rowsForA = await withWorkspaceContext(
        database,
        workspaceAId,
        selectPortfolioIds,
      );
      expect(Object.values(rowsForA).flatMap((rows) => rows.map(({ id }) => id))).toEqual([
        expected.cloudResourceId,
        expected.domainId,
        expected.emailAccountId,
        expected.projectId,
        expected.providerAccountId,
        expected.serverId,
        expected.websiteApplicationId,
      ]);

      const missingContextRows = {
        cloudResources: await database.select().from(cloudResources),
        domains: await database.select().from(domains),
        emailAccounts: await database.select().from(emailAccounts),
        projects: await database.select().from(projects),
        providerAccounts: await database.select().from(providerAccounts),
        servers: await database.select().from(servers),
        websiteApplications: await database.select().from(websiteApplications),
      };
      for (const rows of Object.values(missingContextRows)) {
        expect(rows).toHaveLength(0);
      }
    });

    it('blocks cross-workspace inserts and makes updates and deletes affect zero rows', async () => {
      const database = getRuntimeDatabase();
      const target = getFixtureB();
      const crossWorkspaceInserts: (() => Promise<unknown>)[] = [
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(projects).values({
              name: 'Cross workspace project',
              normalizedName: 'cross workspace project',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          ),
        async () => {
          const email = `${randomUUID()}@example.test`;
          return withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(emailAccounts).values({
              email,
              normalizedEmail: email,
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          );
        },
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(providerAccounts).values({
              label: 'Cross workspace provider',
              providerKey: 'cross_provider',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          ),
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(domains).values({
              domainName: `${randomUUID()}.example`,
              normalizedDomainName: `${randomUUID()}.example`,
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          ),
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(servers).values({
              name: 'Cross workspace server',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          ),
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(cloudResources).values({
              name: 'Cross workspace resource',
              providerAccountId: target.providerAccountId,
              provenance: 'USER_ADDED',
              resourceType: 'compute',
              workspaceId: workspaceBId,
            }),
          ),
        () =>
          withWorkspaceContext(database, workspaceAId, (transaction) =>
            transaction.insert(websiteApplications).values({
              kind: 'WEBSITE',
              name: 'Cross workspace website',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            }),
          ),
      ];
      for (const insert of crossWorkspaceInserts) {
        await expectPostgreSqlError(insert, '42501');
      }

      const source = getFixtureA();
      const crossWorkspaceMoves: (() => Promise<unknown>)[] = [
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(projects).values({
              id,
              name: 'Project move probe',
              normalizedName: 'project move probe',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(projects)
              .set({ workspaceId: workspaceBId })
              .where(eq(projects.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            const email = `${id}@example.test`;
            await transaction.insert(emailAccounts).values({
              email,
              id,
              normalizedEmail: email,
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(emailAccounts)
              .set({ workspaceId: workspaceBId })
              .where(eq(emailAccounts.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(providerAccounts).values({
              id,
              label: 'Provider move probe',
              providerKey: 'move_provider',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(providerAccounts)
              .set({ workspaceId: workspaceBId })
              .where(eq(providerAccounts.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(domains).values({
              domainName: `${id}.example`,
              id,
              normalizedDomainName: `${id}.example`,
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(domains)
              .set({ workspaceId: workspaceBId })
              .where(eq(domains.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(servers).values({
              id,
              name: 'Server move probe',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(servers)
              .set({ workspaceId: workspaceBId })
              .where(eq(servers.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(cloudResources).values({
              id,
              name: 'Cloud move probe',
              providerAccountId: source.providerAccountId,
              provenance: 'USER_ADDED',
              resourceType: 'compute',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(cloudResources)
              .set({
                providerAccountId: target.providerAccountId,
                workspaceId: workspaceBId,
              })
              .where(eq(cloudResources.id, id));
          }),
        () =>
          withWorkspaceContext(database, workspaceAId, async (transaction) => {
            const id = randomUUID();
            await transaction.insert(websiteApplications).values({
              id,
              kind: 'WEBSITE',
              name: 'Website move probe',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            });
            return transaction
              .update(websiteApplications)
              .set({ workspaceId: workspaceBId })
              .where(eq(websiteApplications.id, id));
          }),
      ];
      for (const move of crossWorkspaceMoves) {
        await expectPostgreSqlError(move, '42501');
      }

      const updates = await withWorkspaceContext(
        database,
        workspaceAId,
        async (transaction) => ({
          cloudResources: await transaction
            .update(cloudResources)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(cloudResources.id, target.cloudResourceId))
            .returning({ id: cloudResources.id }),
          domains: await transaction
            .update(domains)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(domains.id, target.domainId))
            .returning({ id: domains.id }),
          emailAccounts: await transaction
            .update(emailAccounts)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(emailAccounts.id, target.emailAccountId))
            .returning({ id: emailAccounts.id }),
          projects: await transaction
            .update(projects)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(projects.id, target.projectId))
            .returning({ id: projects.id }),
          providerAccounts: await transaction
            .update(providerAccounts)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(providerAccounts.id, target.providerAccountId))
            .returning({ id: providerAccounts.id }),
          servers: await transaction
            .update(servers)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(servers.id, target.serverId))
            .returning({ id: servers.id }),
          websiteApplications: await transaction
            .update(websiteApplications)
            .set({ inventoryState: 'ARCHIVED' })
            .where(eq(websiteApplications.id, target.websiteApplicationId))
            .returning({ id: websiteApplications.id }),
        }),
      );
      for (const rows of Object.values(updates)) {
        expect(rows).toHaveLength(0);
      }

      const deletes = await withWorkspaceContext(
        database,
        workspaceAId,
        async (transaction) => ({
          cloudResources: await transaction
            .delete(cloudResources)
            .where(eq(cloudResources.id, target.cloudResourceId))
            .returning({ id: cloudResources.id }),
          domains: await transaction
            .delete(domains)
            .where(eq(domains.id, target.domainId))
            .returning({ id: domains.id }),
          emailAccounts: await transaction
            .delete(emailAccounts)
            .where(eq(emailAccounts.id, target.emailAccountId))
            .returning({ id: emailAccounts.id }),
          projects: await transaction
            .delete(projects)
            .where(eq(projects.id, target.projectId))
            .returning({ id: projects.id }),
          providerAccounts: await transaction
            .delete(providerAccounts)
            .where(eq(providerAccounts.id, target.providerAccountId))
            .returning({ id: providerAccounts.id }),
          servers: await transaction
            .delete(servers)
            .where(eq(servers.id, target.serverId))
            .returning({ id: servers.id }),
          websiteApplications: await transaction
            .delete(websiteApplications)
            .where(eq(websiteApplications.id, target.websiteApplicationId))
            .returning({ id: websiteApplications.id }),
        }),
      );
      for (const rows of Object.values(deletes)) {
        expect(rows).toHaveLength(0);
      }
    });
  },
);
