import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabaseClient } from '../src/client/database-client';
import type { DatabaseClient } from '../src/client/database-types';
import { users, workspaceMembers, workspaces } from '../src/schema';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;
const MIGRATION_BREAKPOINT = '--> statement-breakpoint';

describeWithPostgreSql(
  'personal workspace migration (requires a disposable TEST_DATABASE_URL)',
  () => {
    let client: DatabaseClient | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Personal workspace migration client was not initialized');
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

    it('backfills one non-PII personal workspace and owner membership for an existing user', async () => {
      const migrationSql = await readFile(
        resolve('migrations/0002_personal_workspace_invariant.sql'),
        'utf8',
      );
      const statements = migrationSql
        .split(MIGRATION_BREAKPOINT)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);
      const rollbackProbe = new Error('rollback personal workspace migration probe');
      const userId = randomUUID();
      const email = `legacy-${randomUUID()}@example.test`;

      await expect(
        getClient().transaction(async (transaction) => {
          await transaction.execute(
            sql`drop index "users_personal_workspace_id_unique"`,
          );
          await transaction.execute(sql`
            alter table users
            drop constraint "users_personal_workspace_id_workspaces_id_fk"
          `);
          await transaction.execute(
            sql`alter table users drop column personal_workspace_id`,
          );
          await transaction.execute(sql`
            insert into users (id, email, normalized_email)
            values (${userId}, ${email}, ${email})
          `);

          for (const statement of statements) {
            await transaction.execute(sql.raw(statement));
          }

          const [backfilled] = await transaction
            .select({
              membershipId: workspaceMembers.id,
              personalWorkspaceId: users.personalWorkspaceId,
              role: workspaceMembers.role,
              workspaceName: workspaces.name,
              workspaceSlug: workspaces.slug,
            })
            .from(users)
            .innerJoin(
              workspaces,
              eq(workspaces.id, users.personalWorkspaceId),
            )
            .innerJoin(
              workspaceMembers,
              and(
                eq(workspaceMembers.userId, users.id),
                eq(workspaceMembers.workspaceId, users.personalWorkspaceId),
              ),
            )
            .where(eq(users.id, userId));

          expect(typeof backfilled?.membershipId).toBe('string');
          expect(typeof backfilled?.personalWorkspaceId).toBe('string');
          expect(backfilled?.role).toBe('owner');
          expect(backfilled?.workspaceName).toBe('Personal Workspace');
          expect(backfilled?.workspaceSlug).toMatch(/^personal-[a-f0-9]{32}$/u);
          expect(backfilled?.workspaceSlug).not.toContain('legacy');
          expect(backfilled?.workspaceSlug).not.toContain('@');

          throw rollbackProbe;
        }),
      ).rejects.toBe(rollbackProbe);
    });
  },
);
