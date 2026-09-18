import { useCallback, useEffect, useRef, useState } from 'react';

import { listRelationships } from '@/api/relationships';
import type { InventoryRelationship } from '@/api/types';

export function useRelationships(includeArchived: boolean) {
  const [items, setItems] = useState<InventoryRelationship[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const loadFlightRef = useRef<object | null>(null);

  const reload = useCallback(async () => {
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    loadFlightRef.current = null;
    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor(null);
    try {
      const page = await listRelationships({ includeArchived, signal: controller.signal });
      if (generation === generationRef.current) {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      }
    } catch (requestError) {
      if (!controller.signal.aborted && generation === generationRef.current) {
        setError(requestError instanceof Error ? requestError.message : 'Relationships could not be loaded.');
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void reload();
    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
      loadFlightRef.current = null;
    };
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadFlightRef.current) return;
    const flight = {};
    loadFlightRef.current = flight;
    const generation = generationRef.current;
    setLoadingMore(true);
    try {
      const page = await listRelationships({ cursor: nextCursor, includeArchived });
      if (generation !== generationRef.current || loadFlightRef.current !== flight) return;
      setItems((current) => {
        const deduped = new Map([...current, ...page.items].map((item) => [item.id, item]));
        return [...deduped.values()];
      });
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      if (generation === generationRef.current) setError(requestError instanceof Error ? requestError.message : 'More relationships could not be loaded.');
    } finally {
      if (loadFlightRef.current === flight) {
        loadFlightRef.current = null;
        if (generation === generationRef.current) setLoadingMore(false);
      }
    }
  }, [includeArchived, nextCursor]);

  const upsert = useCallback((relationship: InventoryRelationship) => setItems((current) => {
    const found = current.some((item) => item.id === relationship.id);
    return found ? current.map((item) => item.id === relationship.id ? relationship : item) : [relationship, ...current];
  }), []);
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);

  return { error, items, loadMore, loading, loadingMore, nextCursor, reload, remove, upsert };
}
