import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
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
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

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

async function createWorkspace(
  transaction: DatabaseTransaction,
  label: string,
): Promise<string> {
  const id = randomUUID();
  await transaction.insert(workspaces).values({
    id,
    name: `${label} workspace`,
    slug: `${label}-${id}`,
  });
  return id;
}

async function insertPortfolioParents(
  transaction: DatabaseTransaction,
  workspaceId: string,
  suffix: string,
): Promise<{
  readonly domainId: string;
  readonly emailAccountId: string;
  readonly projectId: string;
  readonly providerAccountId: string;
}> {
  const [project] = await transaction
    .insert(projects)
    .values({
      name: `Project ${suffix}`,
      normalizedName: `project ${suffix}`,
      provenance: 'USER_ADDED',
      workspaceId,
    })
    .returning({ id: projects.id });
  const [emailAccount] = await transaction
    .insert(emailAccounts)
    .values({
      email: `${suffix}@example.test`,
      normalizedEmail: `${suffix}@example.test`,
      provenance: 'USER_ADDED',
      workspaceId,
    })
    .returning({ id: emailAccounts.id });
  const [providerAccount] = await transaction
    .insert(providerAccounts)
    .values({
      label: `Provider ${suffix}`,
      loginEmailAccountId: emailAccount?.id,
      providerKey: 'example_provider',
      provenance: 'USER_MAPPED',
      workspaceId,
    })
    .returning({ id: providerAccounts.id });
  const [domain] = await transaction
    .insert(domains)
    .values({
      dnsProviderAccountId: providerAccount?.id,
      domainName: `${suffix}.example`,
      normalizedDomainName: `${suffix}.example`,
      provenance: 'USER_ADDED',
      registrarProviderAccountId: providerAccount?.id,
      workspaceId,
    })
    .returning({ id: domains.id });

  if (!project || !emailAccount || !providerAccount || !domain) {
    throw new Error('Portfolio fixture insert did not return required rows');
  }

  return {
    domainId: domain.id,
    emailAccountId: emailAccount.id,
    projectId: project.id,
    providerAccountId: providerAccount.id,
  };
}

describeWithPostgreSql(
  'core portfolio schema (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Core portfolio integration client was not initialized');
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

    it('creates all seven tables with common IDs, state, provenance, and timestamps', async () => {
      const tableResult = await getClient().database.execute<{
        tableName: string;
      }>(sql`
        select table_name as "tableName"
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (
            'email_accounts', 'provider_accounts', 'projects', 'domains',
            'servers', 'cloud_resources', 'website_applications'
          )
        order by table_name
      `);

      expect(tableResult.rows.map(({ tableName }) => tableName)).toEqual([
        'cloud_resources',
        'domains',
        'email_accounts',
        'projects',
        'provider_accounts',
        'servers',
        'website_applications',
      ]);

      const rollbackProbe = new Error('rollback portfolio defaults probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createWorkspace(transaction, 'defaults');
          const parents = await insertPortfolioParents(
            transaction,
            workspaceId,
            randomUUID(),
          );
          await transaction.insert(servers).values({
            name: 'Defaults server',
            providerAccountId: parents.providerAccountId,
            provenance: 'USER_ADDED',
            workspaceId,
          });
          await transaction.insert(cloudResources).values({
            name: 'Defaults cloud resource',
            providerAccountId: parents.providerAccountId,
            provenance: 'USER_ADDED',
            resourceType: 'compute',
            workspaceId,
          });
          await transaction.insert(websiteApplications).values({
            kind: 'WEBSITE',
            name: 'Defaults website',
            primaryDomainId: parents.domainId,
            projectId: parents.projectId,
            provenance: 'USER_ADDED',
            workspaceId,
          });

          const commonSelection = {
            createdAt: projects.createdAt,
            id: projects.id,
            inventoryState: projects.inventoryState,
            provenance: projects.provenance,
            updatedAt: projects.updatedAt,
            workspaceId: projects.workspaceId,
          };
          const commonRows = [
            ...(await transaction
              .select(commonSelection)
              .from(projects)
              .where(eq(projects.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: emailAccounts.createdAt,
                id: emailAccounts.id,
                inventoryState: emailAccounts.inventoryState,
                provenance: emailAccounts.provenance,
                updatedAt: emailAccounts.updatedAt,
                workspaceId: emailAccounts.workspaceId,
              })
              .from(emailAccounts)
              .where(eq(emailAccounts.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: providerAccounts.createdAt,
                id: providerAccounts.id,
                inventoryState: providerAccounts.inventoryState,
                provenance: providerAccounts.provenance,
                updatedAt: providerAccounts.updatedAt,
                workspaceId: providerAccounts.workspaceId,
              })
              .from(providerAccounts)
              .where(eq(providerAccounts.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: domains.createdAt,
                id: domains.id,
                inventoryState: domains.inventoryState,
                provenance: domains.provenance,
                updatedAt: domains.updatedAt,
                workspaceId: domains.workspaceId,
              })
              .from(domains)
              .where(eq(domains.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: servers.createdAt,
                id: servers.id,
                inventoryState: servers.inventoryState,
                provenance: servers.provenance,
                updatedAt: servers.updatedAt,
                workspaceId: servers.workspaceId,
              })
              .from(servers)
              .where(eq(servers.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: cloudResources.createdAt,
                id: cloudResources.id,
                inventoryState: cloudResources.inventoryState,
                provenance: cloudResources.provenance,
                updatedAt: cloudResources.updatedAt,
                workspaceId: cloudResources.workspaceId,
              })
              .from(cloudResources)
              .where(eq(cloudResources.workspaceId, workspaceId))),
            ...(await transaction
              .select({
                ...commonSelection,
                createdAt: websiteApplications.createdAt,
                id: websiteApplications.id,
                inventoryState: websiteApplications.inventoryState,
                provenance: websiteApplications.provenance,
                updatedAt: websiteApplications.updatedAt,
                workspaceId: websiteApplications.workspaceId,
              })
              .from(websiteApplications)
              .where(eq(websiteApplications.workspaceId, workspaceId))),
          ];

          expect(commonRows).toHaveLength(7);
          for (const row of commonRows) {
            expect(row).toMatchObject({
              inventoryState: 'TRACKED',
              workspaceId,
            });
            expect(row.id).toMatch(/^[0-9a-f-]{36}$/u);
            expect(row.createdAt).toBeInstanceOf(Date);
            expect(row.updatedAt).toBeInstanceOf(Date);
          }
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('allows normalized identities to repeat across workspaces', async () => {
      const rollbackProbe = new Error('rollback scoped uniqueness probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceAId = await createWorkspace(transaction, 'scope-a');
          const workspaceBId = await createWorkspace(transaction, 'scope-b');
          await transaction.insert(projects).values([
            {
              name: 'Shared Project',
              normalizedName: 'shared project',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            },
            {
              name: 'Shared Project',
              normalizedName: 'shared project',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            },
          ]);
          await transaction.insert(emailAccounts).values([
            {
              email: 'shared@example.test',
              normalizedEmail: 'shared@example.test',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            },
            {
              email: 'shared@example.test',
              normalizedEmail: 'shared@example.test',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            },
          ]);
          await transaction.insert(domains).values([
            {
              domainName: 'shared.example',
              normalizedDomainName: 'shared.example',
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            },
            {
              domainName: 'shared.example',
              normalizedDomainName: 'shared.example',
              provenance: 'USER_ADDED',
              workspaceId: workspaceBId,
            },
          ]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('accepts every same-workspace structural reference', async () => {
      const rollbackProbe = new Error('rollback valid references probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createWorkspace(transaction, 'references');
          const parents = await insertPortfolioParents(
            transaction,
            workspaceId,
            randomUUID(),
          );
          await transaction.insert(servers).values({
            name: 'Application server',
            providerAccountId: parents.providerAccountId,
            provenance: 'USER_MAPPED',
            workspaceId,
          });
          await transaction.insert(cloudResources).values({
            name: 'Compute instance',
            providerAccountId: parents.providerAccountId,
            provenance: 'PROVIDER_API',
            resourceType: 'compute_instance',
            workspaceId,
          });
          await transaction.insert(websiteApplications).values({
            kind: 'WEB_APPLICATION',
            name: 'Portfolio app',
            primaryDomainId: parents.domainId,
            projectId: parents.projectId,
            provenance: 'USER_MAPPED',
            workspaceId,
          });
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('rejects every cross-workspace composite reference', async () => {
      const cases: (
        (transaction: DatabaseTransaction, workspaceAId: string, workspaceBId: string) => Promise<unknown>
      )[] = [
        async (transaction, workspaceAId, workspaceBId) => {
          const email = `${randomUUID()}@example.test`;
          const [emailAccount] = await transaction
            .insert(emailAccounts)
            .values({
              email,
              normalizedEmail: email,
              provenance: 'USER_ADDED',
              workspaceId: workspaceAId,
            })
            .returning({ id: emailAccounts.id });
          return transaction.insert(providerAccounts).values({
            label: 'Cross workspace provider',
            loginEmailAccountId: emailAccount?.id,
            providerKey: 'cross_provider',
            provenance: 'USER_MAPPED',
            workspaceId: workspaceBId,
          });
        },
        async (transaction, workspaceAId, workspaceBId) => {
          const parents = await insertPortfolioParents(
            transaction,
            workspaceAId,
            randomUUID(),
          );
          return transaction.insert(domains).values({
            dnsProviderAccountId: parents.providerAccountId,
            domainName: `${randomUUID()}.example`,
            normalizedDomainName: `${randomUUID()}.example`,
            provenance: 'USER_MAPPED',
            registrarProviderAccountId: parents.providerAccountId,
            workspaceId: workspaceBId,
          });
        },
        async (transaction, workspaceAId, workspaceBId) => {
          const parents = await insertPortfolioParents(
            transaction,
            workspaceAId,
            randomUUID(),
          );
          return transaction.insert(servers).values({
            name: 'Cross workspace server',
            providerAccountId: parents.providerAccountId,
            provenance: 'USER_MAPPED',
            workspaceId: workspaceBId,
          });
        },
        async (transaction, workspaceAId, workspaceBId) => {
          const parents = await insertPortfolioParents(
            transaction,
            workspaceAId,
            randomUUID(),
          );
          return transaction.insert(cloudResources).values({
            name: 'Cross workspace resource',
            providerAccountId: parents.providerAccountId,
            provenance: 'USER_MAPPED',
            resourceType: 'compute',
            workspaceId: workspaceBId,
          });
        },
        async (transaction, workspaceAId, workspaceBId) => {
          const parents = await insertPortfolioParents(
            transaction,
            workspaceAId,
            randomUUID(),
          );
          return transaction.insert(websiteApplications).values({
            kind: 'WEBSITE',
            name: 'Cross workspace website',
            primaryDomainId: parents.domainId,
            projectId: parents.projectId,
            provenance: 'USER_MAPPED',
            workspaceId: workspaceBId,
          });
        },
      ];

      for (const crossWorkspaceInsert of cases) {
        await expectPostgreSqlError(
          () =>
            getClient().transaction(async (transaction) => {
              const workspaceAId = await createWorkspace(transaction, 'cross-a');
              const workspaceBId = await createWorkspace(transaction, 'cross-b');
              await crossWorkspaceInsert(
                transaction,
                workspaceAId,
                workspaceBId,
              );
            }),
          '23503',
        );
      }
    });

    it('preserves true, false, and unknown auto-renew semantics', async () => {
      const rollbackProbe = new Error('rollback auto-renew probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createWorkspace(transaction, 'auto-renew');
          const suffix = randomUUID();
          const rows = await transaction
            .insert(domains)
            .values([
              {
                autoRenew: true,
                domainName: `true-${suffix}.example`,
                normalizedDomainName: `true-${suffix}.example`,
                provenance: 'USER_ADDED',
                workspaceId,
              },
              {
                autoRenew: false,
                domainName: `false-${suffix}.example`,
                normalizedDomainName: `false-${suffix}.example`,
                provenance: 'USER_ADDED',
                workspaceId,
              },
              {
                autoRenew: null,
                domainName: `unknown-${suffix}.example`,
                normalizedDomainName: `unknown-${suffix}.example`,
                provenance: 'USER_ADDED',
                workspaceId,
              },
            ])
            .returning({ autoRenew: domains.autoRenew });
          expect(rows.map(({ autoRenew }) => autoRenew)).toEqual([
            true,
            false,
            null,
          ]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('rejects expiry at or before registration', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createWorkspace(transaction, 'expiry');
            await transaction.insert(domains).values({
              domainName: 'expired.example',
              expiresAt: new Date('2026-01-01T00:00:00.000Z'),
              normalizedDomainName: 'expired.example',
              provenance: 'RDAP_RETRIEVED',
              registeredAt: new Date('2026-01-02T00:00:00.000Z'),
              workspaceId,
            });
          }),
        '23514',
      );
    });

    it('enforces provider and cloud partial uniqueness only for known external IDs', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createWorkspace(transaction, 'provider-unique');
            await transaction.insert(providerAccounts).values([
              {
                externalAccountId: 'account-1',
                label: 'First',
                providerKey: 'provider',
                provenance: 'USER_ADDED',
                workspaceId,
              },
              {
                externalAccountId: 'account-1',
                label: 'Second',
                providerKey: 'provider',
                provenance: 'USER_ADDED',
                workspaceId,
              },
            ]);
          }),
        '23505',
      );

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createWorkspace(transaction, 'cloud-unique');
            const parents = await insertPortfolioParents(
              transaction,
              workspaceId,
              randomUUID(),
            );
            await transaction.insert(cloudResources).values([
              {
                externalResourceId: 'resource-1',
                name: 'First',
                providerAccountId: parents.providerAccountId,
                provenance: 'PROVIDER_API',
                resourceType: 'database',
                workspaceId,
              },
              {
                externalResourceId: 'resource-1',
                name: 'Second',
                providerAccountId: parents.providerAccountId,
                provenance: 'PROVIDER_API',
                resourceType: 'database',
                workspaceId,
              },
            ]);
          }),
        '23505',
      );

      const rollbackProbe = new Error('rollback null external IDs probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createWorkspace(transaction, 'null-external');
          const [provider] = await transaction
            .insert(providerAccounts)
            .values([
              {
                label: 'First unknown account',
                providerKey: 'provider',
                provenance: 'USER_ADDED',
                workspaceId,
              },
              {
                label: 'Second unknown account',
                providerKey: 'provider',
                provenance: 'USER_ADDED',
                workspaceId,
              },
            ])
            .returning({ id: providerAccounts.id });
          if (!provider) {
            throw new Error('Null external ID provider fixture was not created');
          }
          await transaction.insert(cloudResources).values([
            {
              name: 'First unknown resource',
              providerAccountId: provider.id,
              provenance: 'USER_ADDED',
              resourceType: 'compute',
              workspaceId,
            },
            {
              name: 'Second unknown resource',
              providerAccountId: provider.id,
              provenance: 'USER_ADDED',
              resourceType: 'compute',
              workspaceId,
            },
          ]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('enforces normalized project, email, and domain uniqueness per workspace', async () => {
      const duplicateCases: (
        (transaction: DatabaseTransaction, workspaceId: string) => Promise<unknown>
      )[] = [
        (transaction, workspaceId) =>
          transaction.insert(projects).values([
            {
              name: 'Duplicate',
              normalizedName: 'duplicate',
              provenance: 'USER_ADDED',
              workspaceId,
            },
            {
              name: 'DUPLICATE',
              normalizedName: 'duplicate',
              provenance: 'USER_ADDED',
              workspaceId,
            },
          ]),
        (transaction, workspaceId) =>
          transaction.insert(emailAccounts).values([
            {
              email: 'duplicate@example.test',
              normalizedEmail: 'duplicate@example.test',
              provenance: 'USER_ADDED',
              workspaceId,
            },
            {
              email: 'DUPLICATE@example.test',
              normalizedEmail: 'duplicate@example.test',
              provenance: 'USER_ADDED',
              workspaceId,
            },
          ]),
        (transaction, workspaceId) =>
          transaction.insert(domains).values([
            {
              domainName: 'Duplicate.Example',
              normalizedDomainName: 'duplicate.example',
              provenance: 'USER_ADDED',
              workspaceId,
            },
            {
              domainName: 'duplicate.example',
              normalizedDomainName: 'duplicate.example',
              provenance: 'USER_ADDED',
              workspaceId,
            },
          ]),
      ];

      for (const duplicateInsert of duplicateCases) {
        await expectPostgreSqlError(
          () =>
            getClient().transaction(async (transaction) => {
              const workspaceId = await createWorkspace(transaction, 'duplicate');
              await duplicateInsert(transaction, workspaceId);
            }),
          '23505',
        );
      }
    });
  },
);
