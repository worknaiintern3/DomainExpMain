import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  users,
  workspaceMembers,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PostgresRegistrationRepository,
  RegistrationService,
  type RegisteredUser,
} from '../src/auth/registration';
import {
  PostgresWorkspaceContextRepository,
  WorkspaceAccessDeniedError,
  WorkspaceContextService,
} from '../src/workspace-context';
import {
  cleanupRegisteredUsers,
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

describeWithPostgreSql(
  'workspace context persistence (requires a disposable TEST_DATABASE_URL)',
  () => {
    const suitePrefix = `workspace-context-test-${randomUUID()}`;
    const additionalWorkspaceIds: string[] = [];
    let client: DatabaseClient | undefined;
    let firstUser: RegisteredUser | undefined;
    let firstUserPersonalWorkspaceId: string | undefined;
    let secondUser: RegisteredUser | undefined;
    let secondUserPersonalWorkspaceId: string | undefined;

    const getClient = (): DatabaseClient => {
      if (!client) {
        throw new Error('Workspace context integration client was not initialized');
      }

      return client;
    };

    const getFixture = () => {
      if (
        !firstUser ||
        !firstUserPersonalWorkspaceId ||
        !secondUser ||
        !secondUserPersonalWorkspaceId
      ) {
        throw new Error('Workspace context integration fixture was not initialized');
      }

      return {
        firstUser,
        firstUserPersonalWorkspaceId,
        secondUser,
        secondUserPersonalWorkspaceId,
      };
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, {
        migrationsFolder: '../../packages/database/migrations',
      });

      const registration = new RegistrationService(
        new PostgresRegistrationRepository(client),
        () => Promise.resolve('test-only-password-hash'),
      );
      firstUser = await registration.register({
        email: `${suitePrefix}-first@example.test`,
        password: 'bounded-test-input',
      });
      secondUser = await registration.register({
        email: `${suitePrefix}-second@example.test`,
        password: 'bounded-test-input',
      });

      const [firstRecord] = await client.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, firstUser.id));
      const [secondRecord] = await client.database
        .select({ personalWorkspaceId: users.personalWorkspaceId })
        .from(users)
        .where(eq(users.id, secondUser.id));

      firstUserPersonalWorkspaceId = firstRecord?.personalWorkspaceId;
      secondUserPersonalWorkspaceId = secondRecord?.personalWorkspaceId;

      for (const role of ['admin', 'member'] as const) {
        const workspaceId = randomUUID();
        additionalWorkspaceIds.push(workspaceId);
        await client.database.insert(workspaces).values({
          id: workspaceId,
          name: `${role} workspace`,
          slug: `${suitePrefix}-${role}`,
        });
        await client.database.insert(workspaceMembers).values({
          role,
          userId: firstUser.id,
          workspaceId,
        });
      }
    });

    afterAll(async () => {
      if (!client) {
        return;
      }

      await cleanupRegisteredUsers(client, suitePrefix);
      if (additionalWorkspaceIds.length > 0) {
        await client.database
          .delete(workspaces)
          .where(inArray(workspaces.id, additionalWorkspaceIds));
      }
      await client.close();
    });

    it('resolves the personal workspace when the header is absent', async () => {
      const fixture = getFixture();
      const service = new WorkspaceContextService(
        new PostgresWorkspaceContextRepository(getClient()),
      );
      const principal = {
        sessionId: randomUUID(),
        userId: fixture.firstUser.id,
      };

      await expect(service.resolve(principal)).resolves.toEqual(
        expect.objectContaining({
          ...principal,
          role: 'owner',
          workspaceId: fixture.firstUserPersonalWorkspaceId,
        }),
      );
    });

    it.each([
      ['owner', 0],
      ['admin', 1],
      ['member', 2],
    ] as const)('resolves an explicit %s membership', async (role, position) => {
      const fixture = getFixture();
      const workspaceIds = [
        fixture.firstUserPersonalWorkspaceId,
        ...additionalWorkspaceIds,
      ];
      const service = new WorkspaceContextService(
        new PostgresWorkspaceContextRepository(getClient()),
      );

      await expect(
        service.resolve(
          { sessionId: randomUUID(), userId: fixture.firstUser.id },
          workspaceIds[position],
        ),
      ).resolves.toEqual(
        expect.objectContaining({ role, workspaceId: workspaceIds[position] }),
      );
    });

    it('denies a non-member and a nonexistent workspace identically', async () => {
      const fixture = getFixture();
      const service = new WorkspaceContextService(
        new PostgresWorkspaceContextRepository(getClient()),
      );
      const principal = {
        sessionId: randomUUID(),
        userId: fixture.firstUser.id,
      };

      const nonMember = await service
        .resolve(principal, fixture.secondUserPersonalWorkspaceId)
        .catch((error: unknown) => error);
      const nonexistent = await service
        .resolve(principal, randomUUID())
        .catch((error: unknown) => error);

      for (const error of [nonMember, nonexistent]) {
        expect(error).toBeInstanceOf(WorkspaceAccessDeniedError);
        expect(error).toEqual(
          expect.objectContaining({
            code: 'WORKSPACE_ACCESS_DENIED',
            message: 'Workspace access denied',
          }),
        );
      }
    });
  },
);
