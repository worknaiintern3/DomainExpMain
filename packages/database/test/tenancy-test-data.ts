import { randomUUID } from 'node:crypto';

import type { DatabaseTransaction, User, Workspace } from '../src';
import { users, workspaces } from '../src/schema';

interface TestUserInput {
  readonly displayName?: string;
  readonly email: string;
  readonly id?: string;
  readonly normalizedEmail: string;
}

export async function createTestPersonalWorkspace(
  transaction: DatabaseTransaction,
): Promise<Workspace> {
  const workspaceId = randomUUID();
  const [workspace] = await transaction
    .insert(workspaces)
    .values({
      id: workspaceId,
      name: 'Test Personal Workspace',
      slug: `test-personal-${workspaceId.replaceAll('-', '')}`,
    })
    .returning();

  if (!workspace) {
    throw new Error('Test personal workspace insert did not return a row');
  }

  return workspace;
}

export async function insertTestUser(
  transaction: DatabaseTransaction,
  input: TestUserInput,
): Promise<User> {
  const personalWorkspace = await createTestPersonalWorkspace(transaction);
  const [user] = await transaction
    .insert(users)
    .values({ ...input, personalWorkspaceId: personalWorkspace.id })
    .returning();

  if (!user) {
    throw new Error('Test user insert did not return a row');
  }

  return user;
}
