import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/auth/AuthContext';
import {
  activateProviderCacheScope,
  getCachedProviderAccount,
  resolveProviderAccount,
} from './provider-cache';

const EMPTY_LABELS: ReadonlyMap<string, string> = new Map();

interface ProviderLabelSnapshot {
  labels: ReadonlyMap<string, string>;
  scopeKey: string | null;
}

export function useProviderLabels(ids: Array<string | null | undefined>): ReadonlyMap<string, string> {
  const { sessionScopeKey } = useAuth();
  const stableIds = useMemo(
    () => [...new Set(ids.filter((id): id is string => Boolean(id)))].sort(),
    [ids.join('|')],
  );
  const [snapshot, setSnapshot] = useState<ProviderLabelSnapshot>({
    labels: EMPTY_LABELS,
    scopeKey: null,
  });

  useEffect(() => {
    activateProviderCacheScope(sessionScopeKey);
    let current = true;
    const initial = new Map<string, string>();
    for (const id of stableIds) {
      const cached = getCachedProviderAccount(id);
      if (cached) initial.set(id, cached.label);
    }
    setSnapshot({ labels: initial, scopeKey: sessionScopeKey });
    void Promise.allSettled(stableIds.map(async (id) => {
      const provider = await resolveProviderAccount(id);
      if (!current) return;
      setSnapshot((previous) => ({
        labels: new Map(previous.labels).set(id, provider.label),
        scopeKey: sessionScopeKey,
      }));
    }));
    return () => { current = false; };
  }, [sessionScopeKey, stableIds]);

  return snapshot.scopeKey === sessionScopeKey ? snapshot.labels : EMPTY_LABELS;
}
