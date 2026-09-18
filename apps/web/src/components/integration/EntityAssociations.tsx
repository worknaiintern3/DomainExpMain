import React, { useEffect, useState } from 'react';

import { getInventory } from '@/api/inventory';
import type { EntityReference, ItemCollection } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { graphKindResource } from '@/features/integration/resource-configs';

interface DisplayAssociation extends EntityReference {
  context: string;
  label: string;
}

export interface AssociationSource {
  context: string;
  load(signal: AbortSignal): Promise<ItemCollection<unknown>>;
}

function referenceFrom(value: unknown): EntityReference | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const candidate = typeof record.entity === 'object' && record.entity !== null
    ? record.entity as Record<string, unknown>
    : record;
  return typeof candidate.entityId === 'string' && typeof candidate.entityKind === 'string'
    ? { entityId: candidate.entityId, entityKind: candidate.entityKind as EntityReference['entityKind'] }
    : null;
}

function labelFor(record: Record<string, unknown>, fallback: EntityReference): string {
  for (const key of ['domainName', 'name', 'label']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return `${fallback.entityKind.split('_').join(' ')} record`;
}

export const EntityAssociations: React.FC<{
  sources: AssociationSource[];
  title: string;
}> = ({ sources, title }) => {
  const { sessionScopeKey } = useAuth();
  const [items, setItems] = useState<DisplayAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setItems([]);
    void (async () => {
      const responses = await Promise.all(sources.map((source) => source.load(controller.signal)));
      const unique = new Map<string, { context: string; reference: EntityReference }>();
      responses.forEach((response, index) => {
        response.items.forEach((item) => {
          const reference = referenceFrom(item);
          if (reference) unique.set(`${reference.entityKind}:${reference.entityId}`, {
            context: sources[index]?.context ?? 'relationship',
            reference,
          });
        });
      });
      const pending = [...unique.values()];
      const hydrated: DisplayAssociation[] = [];
      let nextIndex = 0;
      const hydrateWorker = async () => {
        while (nextIndex < pending.length && !controller.signal.aborted) {
          const entry = pending[nextIndex++];
          if (!entry) continue;
          const { context, reference } = entry;
          const resource = graphKindResource(reference.entityKind);
          if (!resource) {
            hydrated.push({ ...reference, context, label: reference.entityKind.split('_').join(' ') });
            continue;
          }
          try {
            const record = await getInventory(resource, reference.entityId, controller.signal);
            hydrated.push({ ...reference, context, label: labelFor(record as unknown as Record<string, unknown>, reference) });
          } catch {
            if (!controller.signal.aborted) {
              hydrated.push({ ...reference, context, label: `${reference.entityKind.split('_').join(' ')} unavailable` });
            }
          }
        }
      };
      await Promise.all(Array.from(
        { length: Math.min(4, pending.length) },
        () => hydrateWorker(),
      ));
      if (!controller.signal.aborted) setItems(hydrated);
    })().catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Relationships could not be loaded.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [sessionScopeKey, sources]);

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5">
      <h2 className="text-headline-sm font-semibold">{title}</h2>
      {loading ? <p className="mt-3 text-body-sm text-secondary">Loading one-hop relationships…</p>
        : error ? <p role="alert" className="mt-3 text-body-sm text-error">{error}</p>
        : items.length === 0 ? <p className="mt-3 text-body-sm text-secondary">No tracked relationships are available.</p>
        : <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">{items.map((item) => (
          <li key={`${item.entityKind}:${item.entityId}`} className="rounded-lg bg-surface-container-low border border-outline-variant/20 p-3">
            <p className="font-label-md font-semibold">{item.label}</p>
            <p className="text-caption-xs text-secondary mt-1">{item.entityKind.split('_').join(' ')} · {item.context}</p>
          </li>
        ))}</ul>}
    </section>
  );
};
