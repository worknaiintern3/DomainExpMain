import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const lifecycleTimestamps = () => ({
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workspaceMembershipRoleEnum = pgEnum(
  'workspace_membership_role',
  ['owner', 'admin', 'member'],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    normalizedEmail: text('normalized_email').notNull(),
    displayName: text('display_name'),
    personalWorkspaceId: uuid('personal_workspace_id')
      .notNull()
      .references((): AnyPgColumn => workspaces.id, { onDelete: 'restrict' }),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('users_normalized_email_unique').on(table.normalizedEmail),
    uniqueIndex('users_personal_workspace_id_unique').on(
      table.personalWorkspaceId,
    ),
    check('users_email_not_blank', sql`length(btrim(${table.email})) > 0`),
    check(
      'users_normalized_email_matches_email',
      sql`${table.normalizedEmail} = lower(btrim(${table.email}))`,
    ),
  ],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    check('workspaces_name_not_blank', sql`length(btrim(${table.name})) > 0`),
    check(
      'workspaces_slug_canonical',
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: workspaceMembershipRoleEnum('role').notNull(),
    ...lifecycleTimestamps(),
  },
  (table) => [
    uniqueIndex('workspace_members_workspace_user_unique').on(
      table.workspaceId,
      table.userId,
    ),
    index('workspace_members_user_id_idx').on(table.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
