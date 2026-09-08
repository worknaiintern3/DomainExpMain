import {
  workspaceMembers,
  workspaces,
  users,
  parseDatabaseEnvironment,
  parseDatabaseUrl,
  type DatabaseClient,
  type DatabaseConfiguration,
} from '@domainpulse/database';
import { inArray, like } from 'drizzle-orm';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export const hasDisposableTestDatabase = Boolean(TEST_DATABASE_URL);

export async function cleanupRegisteredUsers(
  client: DatabaseClient,
  normalizedEmailPrefix: string,
): Promise<void> {
  const registeredUsers = await client.database
    .select({
      id: users.id,
      personalWorkspaceId: users.personalWorkspaceId,
    })
    .from(users)
    .where(like(users.normalizedEmail, `${normalizedEmailPrefix}-%`));

  if (registeredUsers.length === 0) {
    return;
  }

  const userIds = registeredUsers.map(({ id }) => id);
  const personalWorkspaceIds = registeredUsers.map(
    ({ personalWorkspaceId }) => personalWorkspaceId,
  );

  await client.database
    .delete(workspaceMembers)
    .where(inArray(workspaceMembers.userId, userIds));
  await client.database.delete(users).where(inArray(users.id, userIds));
  await client.database
    .delete(workspaces)
    .where(inArray(workspaces.id, personalWorkspaceIds));
}

export function getDisposableTestConfiguration(): DatabaseConfiguration {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');
  }

  const parsedUrl = new URL(parseDatabaseUrl(TEST_DATABASE_URL));
  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ''));
  const developmentUrl = process.env.DATABASE_URL;

  if (!/(?:^|[-_])test(?:[-_]|$)/iu.test(databaseName)) {
    throw new Error(
      'Integration test safety check failed: database name must identify a disposable test database',
    );
  }

  if (developmentUrl && parseDatabaseUrl(developmentUrl) === TEST_DATABASE_URL) {
    throw new Error(
      'Integration test safety check failed: TEST_DATABASE_URL must differ from DATABASE_URL',
    );
  }

  return parseDatabaseEnvironment({
    DATABASE_URL: TEST_DATABASE_URL,
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    DATABASE_IDLE_TIMEOUT_MS: '1000',
    DATABASE_POOL_MAX: '2',
  });
}
