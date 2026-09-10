import {
  cloudResources,
  domains,
  emailAccounts,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  type DatabaseTransaction,
} from '@domainpulse/database';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import {
  InvalidInventoryInputError,
  InvalidInventoryReferenceError,
  InventoryConflictError,
  InventoryPersistenceError,
} from './inventory.errors';
import type {
  InventoryCursorPosition,
  InventoryDatabaseHost,
  InventoryRecordEnvelope,
  InventoryResourceKind,
  InventoryStore,
  InventoryStoreListInput,
  InventoryStorePage,
  PersistInventoryCreateCommand,
  PersistInventoryUpdateCommand,
} from './inventory.types';

const POSTGRESQL_UNIQUE_VIOLATION = '23505';
const POSTGRESQL_FOREIGN_KEY_VIOLATION = '23503';
const POSTGRESQL_CHECK_VIOLATION = '23514';
const POSTGRESQL_INVALID_TEXT_REPRESENTATION = '22P02';

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current = error;
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) {
      return undefined;
    }
    visited.add(current);
    const shape = current as { cause?: unknown; code?: unknown };
    if (typeof shape.code === 'string') {
      return shape.code;
    }
    current = shape.cause;
  }
  return undefined;
}

function translatePersistenceError(error: unknown): never {
  if (
    error instanceof InventoryConflictError ||
    error instanceof InvalidInventoryReferenceError ||
    error instanceof InvalidInventoryInputError ||
    error instanceof InventoryPersistenceError
  ) {
    throw error;
  }

  const code = getPostgreSqlErrorCode(error);
  if (code === POSTGRESQL_UNIQUE_VIOLATION) {
    throw new InventoryConflictError();
  }
  if (code === POSTGRESQL_FOREIGN_KEY_VIOLATION) {
    throw new InvalidInventoryReferenceError();
  }
  if (
    code === POSTGRESQL_CHECK_VIOLATION ||
    code === POSTGRESQL_INVALID_TEXT_REPRESENTATION
  ) {
    throw new InvalidInventoryInputError();
  }
  throw new InventoryPersistenceError();
}

function cursorPredicate(
  createdAt: AnyPgColumn,
  id: AnyPgColumn,
  cursor: InventoryCursorPosition | undefined,
) {
  return cursor
    ? sql`(${createdAt}, ${id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
    : undefined;
}

function preciseCursorTimestamp(createdAt: AnyPgColumn) {
  return sql<string>`to_char(${createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function toPage(
  rows: readonly {
    readonly cursorCreatedAt: string;
    readonly item: InventoryRecordEnvelope;
  }[],
  limit: number,
): InventoryStorePage {
  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : [...rows];
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(({ item }) => item),
    nextCursor:
      hasNextPage && last
        ? { createdAt: last.cursorCreatedAt, id: last.item.record.id }
        : null,
  };
}

function requireCreated<T>(record: T | undefined): T {
  if (!record) {
    throw new InventoryPersistenceError();
  }
  return record;
}

export class PostgresInventoryRepository implements InventoryStore {
  constructor(private readonly database: InventoryDatabaseHost) {}

  async create(
    workspaceId: string,
    command: PersistInventoryCreateCommand,
  ): Promise<InventoryRecordEnvelope> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          const base = {
            inventoryState: 'TRACKED' as const,
            provenance: 'USER_ADDED' as const,
            workspaceId,
          };
          switch (command.resource) {
            case 'email-account': {
              const [record] = await transaction
                .insert(emailAccounts)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'provider-account': {
              const [record] = await transaction
                .insert(providerAccounts)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'project': {
              const [record] = await transaction
                .insert(projects)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'domain': {
              const [record] = await transaction
                .insert(domains)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'server': {
              const [record] = await transaction
                .insert(servers)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'cloud-resource': {
              const [record] = await transaction
                .insert(cloudResources)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
            case 'application': {
              const [record] = await transaction
                .insert(websiteApplications)
                .values({ ...base, ...command.values })
                .returning();
              return {
                resource: command.resource,
                record: requireCreated(record),
              };
            }
          }
        },
      );
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  async findById(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<InventoryRecordEnvelope | undefined> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          switch (resource) {
            case 'email-account': {
              const [record] = await transaction
                .select()
                .from(emailAccounts)
                .where(
                  and(
                    eq(emailAccounts.workspaceId, workspaceId),
                    eq(emailAccounts.id, id),
                  ),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'provider-account': {
              const [record] = await transaction
                .select()
                .from(providerAccounts)
                .where(
                  and(
                    eq(providerAccounts.workspaceId, workspaceId),
                    eq(providerAccounts.id, id),
                  ),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'project': {
              const [record] = await transaction
                .select()
                .from(projects)
                .where(
                  and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'domain': {
              const [record] = await transaction
                .select()
                .from(domains)
                .where(
                  and(eq(domains.workspaceId, workspaceId), eq(domains.id, id)),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'server': {
              const [record] = await transaction
                .select()
                .from(servers)
                .where(
                  and(eq(servers.workspaceId, workspaceId), eq(servers.id, id)),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'cloud-resource': {
              const [record] = await transaction
                .select()
                .from(cloudResources)
                .where(
                  and(
                    eq(cloudResources.workspaceId, workspaceId),
                    eq(cloudResources.id, id),
                  ),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
            case 'application': {
              const [record] = await transaction
                .select()
                .from(websiteApplications)
                .where(
                  and(
                    eq(websiteApplications.workspaceId, workspaceId),
                    eq(websiteApplications.id, id),
                  ),
                )
                .limit(1);
              return record ? { resource, record } : undefined;
            }
          }
        },
      );
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  async list(
    workspaceId: string,
    resource: InventoryResourceKind,
    input: InventoryStoreListInput,
  ): Promise<InventoryStorePage> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          switch (resource) {
            case 'email-account': {
              const records = await transaction
                .select({
                  ...getTableColumns(emailAccounts),
                  cursorCreatedAt: preciseCursorTimestamp(
                    emailAccounts.createdAt,
                  ),
                })
                .from(emailAccounts)
                .where(
                  and(
                    eq(emailAccounts.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(emailAccounts.inventoryState, 'TRACKED'),
                    cursorPredicate(
                      emailAccounts.createdAt,
                      emailAccounts.id,
                      input.cursor,
                    ),
                  ),
                )
                .orderBy(desc(emailAccounts.createdAt), desc(emailAccounts.id))
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'provider-account': {
              const records = await transaction
                .select({
                  ...getTableColumns(providerAccounts),
                  cursorCreatedAt: preciseCursorTimestamp(
                    providerAccounts.createdAt,
                  ),
                })
                .from(providerAccounts)
                .where(
                  and(
                    eq(providerAccounts.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(providerAccounts.inventoryState, 'TRACKED'),
                    cursorPredicate(
                      providerAccounts.createdAt,
                      providerAccounts.id,
                      input.cursor,
                    ),
                  ),
                )
                .orderBy(
                  desc(providerAccounts.createdAt),
                  desc(providerAccounts.id),
                )
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'project': {
              const records = await transaction
                .select({
                  ...getTableColumns(projects),
                  cursorCreatedAt: preciseCursorTimestamp(projects.createdAt),
                })
                .from(projects)
                .where(
                  and(
                    eq(projects.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(projects.inventoryState, 'TRACKED'),
                    cursorPredicate(
                      projects.createdAt,
                      projects.id,
                      input.cursor,
                    ),
                  ),
                )
                .orderBy(desc(projects.createdAt), desc(projects.id))
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'domain': {
              const records = await transaction
                .select({
                  ...getTableColumns(domains),
                  cursorCreatedAt: preciseCursorTimestamp(domains.createdAt),
                })
                .from(domains)
                .where(
                  and(
                    eq(domains.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(domains.inventoryState, 'TRACKED'),
                    cursorPredicate(domains.createdAt, domains.id, input.cursor),
                  ),
                )
                .orderBy(desc(domains.createdAt), desc(domains.id))
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'server': {
              const records = await transaction
                .select({
                  ...getTableColumns(servers),
                  cursorCreatedAt: preciseCursorTimestamp(servers.createdAt),
                })
                .from(servers)
                .where(
                  and(
                    eq(servers.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(servers.inventoryState, 'TRACKED'),
                    cursorPredicate(servers.createdAt, servers.id, input.cursor),
                  ),
                )
                .orderBy(desc(servers.createdAt), desc(servers.id))
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'cloud-resource': {
              const records = await transaction
                .select({
                  ...getTableColumns(cloudResources),
                  cursorCreatedAt: preciseCursorTimestamp(
                    cloudResources.createdAt,
                  ),
                })
                .from(cloudResources)
                .where(
                  and(
                    eq(cloudResources.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(cloudResources.inventoryState, 'TRACKED'),
                    cursorPredicate(
                      cloudResources.createdAt,
                      cloudResources.id,
                      input.cursor,
                    ),
                  ),
                )
                .orderBy(
                  desc(cloudResources.createdAt),
                  desc(cloudResources.id),
                )
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
            case 'application': {
              const records = await transaction
                .select({
                  ...getTableColumns(websiteApplications),
                  cursorCreatedAt: preciseCursorTimestamp(
                    websiteApplications.createdAt,
                  ),
                })
                .from(websiteApplications)
                .where(
                  and(
                    eq(websiteApplications.workspaceId, workspaceId),
                    input.includeArchived
                      ? undefined
                      : eq(websiteApplications.inventoryState, 'TRACKED'),
                    cursorPredicate(
                      websiteApplications.createdAt,
                      websiteApplications.id,
                      input.cursor,
                    ),
                  ),
                )
                .orderBy(
                  desc(websiteApplications.createdAt),
                  desc(websiteApplications.id),
                )
                .limit(input.limit + 1);
              return toPage(
                records.map(({ cursorCreatedAt, ...record }) => ({
                  cursorCreatedAt,
                  item: { resource, record },
                })),
                input.limit,
              );
            }
          }
        },
      );
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  async update(
    workspaceId: string,
    id: string,
    command: PersistInventoryUpdateCommand,
  ): Promise<InventoryRecordEnvelope | undefined> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          switch (command.resource) {
            case 'email-account': {
              const [record] = await transaction
                .update(emailAccounts)
                .set(command.values)
                .where(
                  and(
                    eq(emailAccounts.workspaceId, workspaceId),
                    eq(emailAccounts.id, id),
                  ),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'provider-account': {
              const [record] = await transaction
                .update(providerAccounts)
                .set(command.values)
                .where(
                  and(
                    eq(providerAccounts.workspaceId, workspaceId),
                    eq(providerAccounts.id, id),
                  ),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'project': {
              const [record] = await transaction
                .update(projects)
                .set(command.values)
                .where(
                  and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'domain': {
              const [record] = await transaction
                .update(domains)
                .set(command.values)
                .where(
                  and(eq(domains.workspaceId, workspaceId), eq(domains.id, id)),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'server': {
              const [record] = await transaction
                .update(servers)
                .set(command.values)
                .where(
                  and(eq(servers.workspaceId, workspaceId), eq(servers.id, id)),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'cloud-resource': {
              const [record] = await transaction
                .update(cloudResources)
                .set(command.values)
                .where(
                  and(
                    eq(cloudResources.workspaceId, workspaceId),
                    eq(cloudResources.id, id),
                  ),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
            case 'application': {
              const [record] = await transaction
                .update(websiteApplications)
                .set(command.values)
                .where(
                  and(
                    eq(websiteApplications.workspaceId, workspaceId),
                    eq(websiteApplications.id, id),
                  ),
                )
                .returning();
              return record ? { resource: command.resource, record } : undefined;
            }
          }
        },
      );
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  async archive(
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<boolean> {
    try {
      return await this.database.withWorkspaceContext(
        workspaceId,
        async (transaction) => {
          const update = { inventoryState: 'ARCHIVED' as const, updatedAt: new Date() };
          return this.archiveRecord(transaction, workspaceId, resource, id, update);
        },
      );
    } catch (error) {
      translatePersistenceError(error);
    }
  }

  private async archiveRecord(
    transaction: DatabaseTransaction,
    workspaceId: string,
    resource: InventoryResourceKind,
    id: string,
    update: { readonly inventoryState: 'ARCHIVED'; readonly updatedAt: Date },
  ): Promise<boolean> {
    switch (resource) {
      case 'email-account':
        return (
          await transaction
            .update(emailAccounts)
            .set(update)
            .where(
              and(
                eq(emailAccounts.workspaceId, workspaceId),
                eq(emailAccounts.id, id),
              ),
            )
            .returning({ id: emailAccounts.id })
        ).length > 0;
      case 'provider-account':
        return (
          await transaction
            .update(providerAccounts)
            .set(update)
            .where(
              and(
                eq(providerAccounts.workspaceId, workspaceId),
                eq(providerAccounts.id, id),
              ),
            )
            .returning({ id: providerAccounts.id })
        ).length > 0;
      case 'project':
        return (
          await transaction
            .update(projects)
            .set(update)
            .where(
              and(eq(projects.workspaceId, workspaceId), eq(projects.id, id)),
            )
            .returning({ id: projects.id })
        ).length > 0;
      case 'domain':
        return (
          await transaction
            .update(domains)
            .set(update)
            .where(
              and(eq(domains.workspaceId, workspaceId), eq(domains.id, id)),
            )
            .returning({ id: domains.id })
        ).length > 0;
      case 'server':
        return (
          await transaction
            .update(servers)
            .set(update)
            .where(
              and(eq(servers.workspaceId, workspaceId), eq(servers.id, id)),
            )
            .returning({ id: servers.id })
        ).length > 0;
      case 'cloud-resource':
        return (
          await transaction
            .update(cloudResources)
            .set(update)
            .where(
              and(
                eq(cloudResources.workspaceId, workspaceId),
                eq(cloudResources.id, id),
              ),
            )
            .returning({ id: cloudResources.id })
        ).length > 0;
      case 'application':
        return (
          await transaction
            .update(websiteApplications)
            .set(update)
            .where(
              and(
                eq(websiteApplications.workspaceId, workspaceId),
                eq(websiteApplications.id, id),
              ),
            )
            .returning({ id: websiteApplications.id })
        ).length > 0;
    }
  }
}
