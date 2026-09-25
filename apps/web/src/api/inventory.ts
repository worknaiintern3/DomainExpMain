import { apiRequest } from './client';
import type {
  CursorPage,
  InventoryResource,
  InventoryResourceMap,
} from './types';

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

export interface ApplicationProbeResult {
  online: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  title: string | null;
  ssl: boolean;
  error: string | null;
}

export function probeApplicationUrl(
  url: string,
  signal?: AbortSignal,
): Promise<ApplicationProbeResult> {
  return apiRequest(`/applications/probe?url=${encodeURIComponent(url)}`, {
    signal,
  });
}
