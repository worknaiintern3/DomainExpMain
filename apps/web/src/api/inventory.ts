import { apiRequest } from './client';
import type {
  CursorPage,
  InventoryResource,
  InventoryResourceMap,
} from './types';

export interface InventorySummary {
  applications: number;
  cloudResources?: number;
  domains: number;
  emailAccounts?: number;
  projects?: number;
  providerAccounts?: number;
  servers: number;
}

export function getInventorySummary(signal?: AbortSignal): Promise<InventorySummary> {
  return apiRequest('/inventory/summary', { signal });
}

export interface InventoryListOptions {
  cursor?: string;
  includeArchived?: boolean;
  limit?: number;
  signal?: AbortSignal;
}

function listQuery(options: InventoryListOptions): string {
  const query = new URLSearchParams();
  query.set('limit', String(options.limit ?? 50));
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.includeArchived) query.set('includeArchived', 'true');
  return query.toString();
}

export function listInventory<R extends InventoryResource>(
  resource: R,
  options: InventoryListOptions = {},
): Promise<CursorPage<InventoryResourceMap[R]>> {
  return apiRequest(`/${resource}?${listQuery(options)}`, {
    signal: options.signal,
  });
}

/** Collect every page when a view needs a complete relationship or import set. */
export async function listAllInventory<R extends InventoryResource>(
  resource: R,
  options: Pick<InventoryListOptions, 'includeArchived' | 'signal'> = {},
): Promise<Array<InventoryResourceMap[R]>> {
  const items: Array<InventoryResourceMap[R]> = [];
  let cursor: string | undefined;
  do {
    const page = await listInventory(resource, { ...options, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export function getInventory<R extends InventoryResource>(
  resource: R,
  id: string,
  signal?: AbortSignal,
): Promise<InventoryResourceMap[R]> {
  return apiRequest(`/${resource}/${encodeURIComponent(id)}`, { signal });
}

export function createInventory<R extends InventoryResource>(
  resource: R,
  input: Record<string, unknown>,
): Promise<InventoryResourceMap[R]> {
  return apiRequest(`/${resource}`, { body: input, method: 'POST' });
}

export function updateInventory<R extends InventoryResource>(
  resource: R,
  id: string,
  input: Record<string, unknown>,
): Promise<InventoryResourceMap[R]> {
  return apiRequest(`/${resource}/${encodeURIComponent(id)}`, {
    body: input,
    method: 'PATCH',
  });
}

export function archiveInventory(
  resource: InventoryResource,
  id: string,
): Promise<void> {
  return apiRequest(`/${resource}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
