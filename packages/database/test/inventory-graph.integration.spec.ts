import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type {
  DatabaseClient,
  DatabaseTransaction,
} from '../src/client/database-types';
import {
  domains,
  inventoryNodes,
  inventoryRelationships,
  projects,
} from '../src/schema';
import {
  createInventoryGraphFixture,
  createInventoryGraphWorkspace,
} from './inventory-graph-test-data';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;
const MIGRATION_BREAKPOINT = '--> statement-breakpoint';

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

describeWithPostgreSql(
  'inventory graph schema (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Inventory graph integration client was not initialized');
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

    it('backfills all five existing entity kinds from the reviewed migration', async () => {
      const migrationSql = await readFile(
        resolve('migrations/0005_inventory_graph.sql'),
        'utf8',
      );
      const backfillStatement = migrationSql
        .split(MIGRATION_BREAKPOINT)
        .map((statement) => statement.trim())
        .find((statement) =>
          statement.startsWith(
            'INSERT INTO "public"."inventory_nodes" ("workspace_id", "entity_kind", "entity_id")',
          ),
        );
      if (!backfillStatement) {
        throw new Error('Inventory node backfill statement is missing');
      }

      const rollbackProbe = new Error('rollback inventory node backfill probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'backfill',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'backfill',
          );

          await transaction.execute(sql`
            alter table inventory_nodes
            disable trigger inventory_nodes_guard_mutation
          `);
          await transaction.delete(inventoryNodes);
          await transaction.execute(sql`
            alter table inventory_nodes
            enable trigger inventory_nodes_guard_mutation
          `);
          await transaction.execute(sql.raw(backfillStatement));

          const nodes = await transaction
            .select({
              entityId: inventoryNodes.entityId,
              entityKind: inventoryNodes.entityKind,
            })
            .from(inventoryNodes)
            .where(eq(inventoryNodes.workspaceId, workspaceId));
          expect(nodes).toEqual(
            expect.arrayContaining([
              { entityId: fixture.projectId, entityKind: 'PROJECT' },
              { entityId: fixture.domainId, entityKind: 'DOMAIN' },
              { entityId: fixture.serverId, entityKind: 'SERVER' },
              {
                entityId: fixture.cloudResourceId,
                entityKind: 'CLOUD_RESOURCE',
              },
              {
                entityId: fixture.websiteApplicationId,
                entityKind: 'WEBSITE_APPLICATION',
              },
            ]),
          );
          expect(nodes).toHaveLength(5);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('creates exactly one internal node per entity and permits equal entity UUIDs across kinds', async () => {
      const rollbackProbe = new Error('rollback graph node identity probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'node-identity',
          );
          const sharedEntityId = randomUUID();
          await transaction.insert(projects).values({
            id: sharedEntityId,
            name: 'Shared UUID project',
            normalizedName: 'shared uuid project',
            provenance: 'USER_ADDED',
            workspaceId,
          });
          await transaction.insert(domains).values({
            domainName: 'shared-uuid.example',
            id: sharedEntityId,
            normalizedDomainName: 'shared-uuid.example',
            provenance: 'USER_ADDED',
            workspaceId,
          });

          const nodes = await transaction
            .select()
            .from(inventoryNodes)
            .where(
              and(
                eq(inventoryNodes.workspaceId, workspaceId),
                eq(inventoryNodes.entityId, sharedEntityId),
              ),
            );
          expect(nodes).toHaveLength(2);
          expect(new Set(nodes.map(({ nodeId }) => nodeId)).size).toBe(2);
          expect(nodes.map(({ entityKind }) => entityKind).sort()).toEqual([
            'DOMAIN',
            'PROJECT',
          ]);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('removes a deleted entity node and cascades its flexible edges', async () => {
      const rollbackProbe = new Error('rollback graph entity delete probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'entity-delete',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'entity-delete',
          );
          const [relationship] = await transaction
            .insert(inventoryRelationships)
            .values({
              provenance: 'USER_MAPPED',
              relationshipType: 'GROUPS',
              sourceKind: 'PROJECT',
              sourceNodeId: fixture.projectNodeId,
              targetKind: 'DOMAIN',
              targetNodeId: fixture.domainNodeId,
              workspaceId,
            })
            .returning({ id: inventoryRelationships.id });
          if (!relationship) {
            throw new Error('Delete cascade relationship was not created');
          }

          await transaction.delete(domains).where(eq(domains.id, fixture.domainId));
          await expect(
            transaction
              .select()
              .from(inventoryNodes)
              .where(eq(inventoryNodes.nodeId, fixture.domainNodeId)),
          ).resolves.toHaveLength(0);
          await expect(
            transaction
              .select()
              .from(inventoryRelationships)
              .where(eq(inventoryRelationships.id, relationship.id)),
          ).resolves.toHaveLength(0);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('rejects entity identity mutation on every participating table', async () => {
      const triggerResult = await getClient().pool.query<{ tableName: string }>(
        `select event_object_table as "tableName"
         from information_schema.triggers
         where trigger_schema = 'public'
           and trigger_name like '%_inventory_identity_immutable'
         order by event_object_table`,
      );
      expect(triggerResult.rows.map(({ tableName }) => tableName)).toEqual([
        'cloud_resources',
        'domains',
        'projects',
        'servers',
        'website_applications',
      ]);

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'immutable-id',
            );
            const fixture = await createInventoryGraphFixture(
              transaction,
              workspaceId,
              'immutable-id',
            );
            await transaction
              .update(projects)
              .set({ id: randomUUID() })
              .where(eq(projects.id, fixture.projectId));
          }),
        '42501',
      );
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'immutable-workspace',
            );
            const targetWorkspaceId = await createInventoryGraphWorkspace(
              transaction,
              'immutable-target',
            );
            const fixture = await createInventoryGraphFixture(
              transaction,
              workspaceId,
              'immutable-workspace',
            );
            await transaction
              .update(domains)
              .set({ workspaceId: targetWorkspaceId })
              .where(eq(domains.id, fixture.domainId));
          }),
        '42501',
      );
    });

    it('rejects fabricated nodes and direct node mutation', async () => {
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'fabricated-node',
            );
            await transaction.insert(inventoryNodes).values({
              entityId: randomUUID(),
              entityKind: 'PROJECT',
              workspaceId,
            });
          }),
        '23503',
      );
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'node-delete',
            );
            const fixture = await createInventoryGraphFixture(
              transaction,
              workspaceId,
              'node-delete',
            );
            await transaction
              .delete(inventoryNodes)
              .where(eq(inventoryNodes.nodeId, fixture.projectNodeId));
          }),
        '23503',
      );
      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'node-update',
            );
            const fixture = await createInventoryGraphFixture(
              transaction,
              workspaceId,
              'node-update',
            );
            await transaction
              .update(inventoryNodes)
              .set({ entityKind: 'DOMAIN' })
              .where(eq(inventoryNodes.nodeId, fixture.projectNodeId));
          }),
        '23514',
      );
    });

    it('accepts the six locked relationship forms in one workspace', async () => {
      const rollbackProbe = new Error('rollback valid graph edge probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'valid-edges',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'valid-edges',
          );
          const connectedSourceIsServer =
            fixture.serverNodeId < fixture.cloudResourceNodeId;
          const rows = await transaction
            .insert(inventoryRelationships)
            .values([
              {
                provenance: 'USER_MAPPED',
                relationshipType: 'GROUPS',
                sourceKind: 'PROJECT',
                sourceNodeId: fixture.projectNodeId,
                targetKind: 'DOMAIN',
                targetNodeId: fixture.domainNodeId,
                workspaceId,
              },
              {
                provenance: 'USER_MAPPED',
                relationshipType: 'HOSTED_ON',
                sourceKind: 'WEBSITE_APPLICATION',
                sourceNodeId: fixture.websiteApplicationNodeId,
                targetKind: 'SERVER',
                targetNodeId: fixture.serverNodeId,
                workspaceId,
              },
              {
                provenance: 'USER_MAPPED',
                relationshipType: 'USES_DOMAIN',
                sourceKind: 'WEBSITE_APPLICATION',
                sourceNodeId: fixture.websiteApplicationNodeId,
                targetKind: 'DOMAIN',
                targetNodeId: fixture.domainNodeId,
                workspaceId,
              },
              {
                provenance: 'CALCULATED',
                relationshipType: 'DEPENDS_ON',
                sourceKind: 'SERVER',
                sourceNodeId: fixture.serverNodeId,
                targetKind: 'CLOUD_RESOURCE',
                targetNodeId: fixture.cloudResourceNodeId,
                workspaceId,
              },
              {
                provenance: 'DNS_RETRIEVED',
                relationshipType: 'ROUTES_TO',
                sourceKind: 'DOMAIN',
                sourceNodeId: fixture.domainNodeId,
                targetKind: 'CLOUD_RESOURCE',
                targetNodeId: fixture.cloudResourceNodeId,
                workspaceId,
              },
              {
                provenance: 'USER_MAPPED',
                relationshipType: 'CONNECTED_TO',
                sourceKind: connectedSourceIsServer
                  ? 'SERVER'
                  : 'CLOUD_RESOURCE',
                sourceNodeId: connectedSourceIsServer
                  ? fixture.serverNodeId
                  : fixture.cloudResourceNodeId,
                targetKind: connectedSourceIsServer
                  ? 'CLOUD_RESOURCE'
                  : 'SERVER',
                targetNodeId: connectedSourceIsServer
                  ? fixture.cloudResourceNodeId
                  : fixture.serverNodeId,
                workspaceId,
              },
            ])
            .returning({ id: inventoryRelationships.id });
          expect(rows).toHaveLength(6);
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });

    it('requires existing, correctly typed, same-workspace endpoints', async () => {
      const invalidEdges: ((
        transaction: DatabaseTransaction,
      ) => Promise<unknown>)[] = [
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'missing-source',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'missing-source',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: randomUUID(),
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'missing-target',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'missing-target',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: randomUUID(),
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'wrong-source-kind',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'wrong-source-kind',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'DNS_RETRIEVED',
            relationshipType: 'ROUTES_TO',
            sourceKind: 'DOMAIN',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.serverNodeId,
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'wrong-target-kind',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'wrong-target-kind',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.domainNodeId,
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceAId = await createInventoryGraphWorkspace(
            transaction,
            'cross-endpoint-a',
          );
          const workspaceBId = await createInventoryGraphWorkspace(
            transaction,
            'cross-endpoint-b',
          );
          const fixtureA = await createInventoryGraphFixture(
            transaction,
            workspaceAId,
            'cross-endpoint-a',
          );
          const fixtureB = await createInventoryGraphFixture(
            transaction,
            workspaceBId,
            'cross-endpoint-b',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'USER_MAPPED',
            relationshipType: 'GROUPS',
            sourceKind: 'PROJECT',
            sourceNodeId: fixtureA.projectNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixtureB.domainNodeId,
            workspaceId: workspaceAId,
          });
        },
      ];

      for (const invalidEdge of invalidEdges) {
        await expectPostgreSqlError(
          () => getClient().transaction(invalidEdge),
          '23503',
        );
      }
    });

    it('rejects invalid pairs, self edges, noncanonical connections, and duplicates', async () => {
      const invalidCases: ((
        transaction: DatabaseTransaction,
      ) => Promise<unknown>)[] = [
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'invalid-pair',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'invalid-pair',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'USER_MAPPED',
            relationshipType: 'HOSTED_ON',
            sourceKind: 'PROJECT',
            sourceNodeId: fixture.projectNodeId,
            targetKind: 'DOMAIN',
            targetNodeId: fixture.domainNodeId,
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'self-edge',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'self-edge',
          );
          return transaction.insert(inventoryRelationships).values({
            provenance: 'CALCULATED',
            relationshipType: 'DEPENDS_ON',
            sourceKind: 'SERVER',
            sourceNodeId: fixture.serverNodeId,
            targetKind: 'SERVER',
            targetNodeId: fixture.serverNodeId,
            workspaceId,
          });
        },
        async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'reverse-connected',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'reverse-connected',
          );
          const sourceIsServer =
            fixture.serverNodeId > fixture.cloudResourceNodeId;
          return transaction.insert(inventoryRelationships).values({
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
            workspaceId,
          });
        },
      ];
      for (const invalidCase of invalidCases) {
        await expectPostgreSqlError(
          () => getClient().transaction(invalidCase),
          '23514',
        );
      }

      await expectPostgreSqlError(
        () =>
          getClient().transaction(async (transaction) => {
            const workspaceId = await createInventoryGraphWorkspace(
              transaction,
              'duplicate-edge',
            );
            const fixture = await createInventoryGraphFixture(
              transaction,
              workspaceId,
              'duplicate-edge',
            );
            const edge = {
              provenance: 'USER_MAPPED' as const,
              relationshipType: 'GROUPS' as const,
              sourceKind: 'PROJECT' as const,
              sourceNodeId: fixture.projectNodeId,
              targetKind: 'DOMAIN' as const,
              targetNodeId: fixture.domainNodeId,
              workspaceId,
            };
            await transaction.insert(inventoryRelationships).values(edge);
            await transaction.insert(inventoryRelationships).values(edge);
          }),
        '23505',
      );
    });

    it('accepts only locked provenance values and preserves archived edges', async () => {
      const rollbackProbe = new Error('rollback relationship provenance probe');
      await expect(
        getClient().transaction(async (transaction) => {
          const workspaceId = await createInventoryGraphWorkspace(
            transaction,
            'provenance',
          );
          const fixture = await createInventoryGraphFixture(
            transaction,
            workspaceId,
            'provenance',
          );
          const rows = await transaction
            .insert(inventoryRelationships)
            .values([
              {
                provenance: 'USER_MAPPED',
                relationshipType: 'GROUPS',
                sourceKind: 'PROJECT',
                sourceNodeId: fixture.projectNodeId,
                targetKind: 'DOMAIN',
                targetNodeId: fixture.domainNodeId,
                workspaceId,
              },
              {
                provenance: 'IMPORTED',
                relationshipType: 'HOSTED_ON',
                sourceKind: 'WEBSITE_APPLICATION',
                sourceNodeId: fixture.websiteApplicationNodeId,
                targetKind: 'SERVER',
                targetNodeId: fixture.serverNodeId,
                workspaceId,
              },
              {
                provenance: 'PROVIDER_API',
                relationshipType: 'USES_DOMAIN',
                sourceKind: 'WEBSITE_APPLICATION',
                sourceNodeId: fixture.websiteApplicationNodeId,
                targetKind: 'DOMAIN',
                targetNodeId: fixture.domainNodeId,
                workspaceId,
              },
              {
                provenance: 'DNS_RETRIEVED',
                relationshipType: 'ROUTES_TO',
                sourceKind: 'DOMAIN',
                sourceNodeId: fixture.domainNodeId,
                targetKind: 'SERVER',
                targetNodeId: fixture.serverNodeId,
                workspaceId,
              },
              {
                inventoryState: 'ARCHIVED',
                provenance: 'CALCULATED',
                relationshipType: 'DEPENDS_ON',
                sourceKind: 'SERVER',
                sourceNodeId: fixture.serverNodeId,
                targetKind: 'CLOUD_RESOURCE',
                targetNodeId: fixture.cloudResourceNodeId,
                workspaceId,
              },
            ])
            .returning({ inventoryState: inventoryRelationships.inventoryState });
          expect(rows).toHaveLength(5);
          expect(rows).toContainEqual({ inventoryState: 'ARCHIVED' });
          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);

      for (const provenance of [
        'USER_ADDED',
        'RDAP_RETRIEVED',
        'SSL_RETRIEVED',
      ] as const) {
        await expectPostgreSqlError(
          () =>
            getClient().transaction(async (transaction) => {
              const workspaceId = await createInventoryGraphWorkspace(
                transaction,
                'invalid-provenance',
              );
              const fixture = await createInventoryGraphFixture(
                transaction,
                workspaceId,
                'invalid-provenance',
              );
              await transaction.insert(inventoryRelationships).values({
                provenance,
                relationshipType: 'GROUPS',
                sourceKind: 'PROJECT',
                sourceNodeId: fixture.projectNodeId,
                targetKind: 'DOMAIN',
                targetNodeId: fixture.domainNodeId,
                workspaceId,
              });
            }),
          '23514',
        );
      }
    });
  },
);
