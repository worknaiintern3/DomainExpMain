import { useCallback, useEffect, useRef, useState } from 'react';

import { listInventory } from '@/api/inventory';
import type {
  InventoryMetadata,
  InventoryResource,
  InventoryResourceMap,
} from '@/api/types';

export function useCursorInventory<R extends InventoryResource>(
  resource: R,
  includeArchived: boolean,
) {
  const [items, setItems] = useState<Array<InventoryResourceMap[R]>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const loadMoreFlightRef = useRef<object | null>(null);

  const reload = useCallback(async () => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    loadMoreFlightRef.current = null;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setLoadMoreError(null);
    try {
      const page = await listInventory(resource, {
        includeArchived,
        signal: controller.signal,
      });
      if (generation !== generationRef.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setItems([]);
      setNextCursor(null);
      setError(requestError instanceof Error ? requestError.message : 'Inventory could not be loaded.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [includeArchived, resource]);

  useEffect(() => {
    void reload();
    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
      loadMoreFlightRef.current = null;
    };
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (loadMoreFlightRef.current || !nextCursor) return;
    const flight = {};
    loadMoreFlightRef.current = flight;
    const generation = generationRef.current;
    const cursor = nextCursor;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await listInventory(resource, { cursor, includeArchived });
      if (generation !== generationRef.current || loadMoreFlightRef.current !== flight) return;
      setItems((current) => {
        const byId = new Map<string, InventoryResourceMap[R]>();
        for (const item of [...current, ...page.items]) byId.set(item.id, item);
        return [...byId.values()];
      });
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      if (generation === generationRef.current) {
        setLoadMoreError(requestError instanceof Error ? requestError.message : 'More records could not be loaded.');
      }
    } finally {
      if (loadMoreFlightRef.current === flight) {
        loadMoreFlightRef.current = null;
        if (generation === generationRef.current) setLoadingMore(false);
      }
    }
  }, [includeArchived, nextCursor, resource]);

  const upsert = useCallback((record: InventoryResourceMap[R]) => {
    setItems((current) => {
      const existingIndex = current.findIndex((item) => item.id === record.id);
      if (existingIndex === -1) return [record, ...current];
      return current.map((item) => (item.id === record.id ? record : item));
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const markArchived = useCallback((id: string) => {
    setItems((current) => current.map((item) =>
      item.id === id
        ? ({ ...item, inventoryState: 'ARCHIVED' } as InventoryResourceMap[R] & InventoryMetadata)
        : item,
    ));
  }, []);

  return {
    error,
    items,
    loadMore,
    loadMoreError,
    loading,
    loadingMore,
    markArchived,
    nextCursor,
    reload,
    remove,
    upsert,
  };
}
