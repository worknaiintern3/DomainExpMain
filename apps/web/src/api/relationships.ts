import { apiRequest } from './client';
import type { CursorPage, InventoryRelationship } from './types';

export interface RelationshipInput {
  notes?: string | null;
  relationshipType: InventoryRelationship['relationshipType'];
  source: InventoryRelationship['source'];
  target: InventoryRelationship['target'];
}

export function listRelationships(options: {
  cursor?: string;
  includeArchived?: boolean;
  signal?: AbortSignal;
} = {}): Promise<CursorPage<InventoryRelationship>> {
  const query = new URLSearchParams({ limit: '50' });
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.includeArchived) query.set('includeArchived', 'true');
  return apiRequest(`/inventory-relationships?${query.toString()}`, { signal: options.signal });
}

export function createRelationship(input: RelationshipInput): Promise<InventoryRelationship> {
  return apiRequest('/inventory-relationships', { body: input, method: 'POST' });
}

export function updateRelationship(id: string, input: { inventoryState?: 'TRACKED' | 'ARCHIVED'; notes?: string | null }): Promise<InventoryRelationship> {
  return apiRequest(`/inventory-relationships/${encodeURIComponent(id)}`, { body: input, method: 'PATCH' });
}

export function archiveRelationship(id: string): Promise<void> {
  return apiRequest(`/inventory-relationships/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
