import React, { useEffect, useMemo, useRef, useState } from 'react';

import { getInventory, listInventory } from '@/api/inventory';
import {
  archiveRelationship,
  createRelationship,
  updateRelationship,
} from '@/api/relationships';
import type {
  EntityReference,
  GraphEntityKind,
  InventoryRelationship,
  InventoryResource,
  InventoryResourceMap,
  RelationshipType,
} from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { InventoryState, StatePanel } from '@/components/integration/InventoryWorkspace';
import { InventoryTopologyCanvas } from '@/features/infrastructure-map/components/InventoryTopologyCanvas';
import { useRelationships } from '@/hooks/useRelationships';

const GRAPH_KINDS: readonly GraphEntityKind[] = [
  'PROJECT',
  'DOMAIN',
  'SERVER',
  'CLOUD_RESOURCE',
  'WEBSITE_APPLICATION',
];

const RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  'GROUPS',
  'HOSTED_ON',
  'USES_DOMAIN',
  'DEPENDS_ON',
  'ROUTES_TO',
  'CONNECTED_TO',
];

type RelationshipPair = readonly [GraphEntityKind, GraphEntityKind];

const RELATIONSHIP_MATRIX = {
  GROUPS: [
    ['PROJECT', 'DOMAIN'],
    ['PROJECT', 'SERVER'],
    ['PROJECT', 'CLOUD_RESOURCE'],
    ['PROJECT', 'WEBSITE_APPLICATION'],
  ],
  HOSTED_ON: [
    ['WEBSITE_APPLICATION', 'SERVER'],
    ['WEBSITE_APPLICATION', 'CLOUD_RESOURCE'],
  ],
  USES_DOMAIN: [['WEBSITE_APPLICATION', 'DOMAIN']],
  DEPENDS_ON: [
    ['WEBSITE_APPLICATION', 'DOMAIN'],
    ['WEBSITE_APPLICATION', 'WEBSITE_APPLICATION'],
    ['WEBSITE_APPLICATION', 'SERVER'],
    ['WEBSITE_APPLICATION', 'CLOUD_RESOURCE'],
    ['SERVER', 'DOMAIN'],
    ['SERVER', 'WEBSITE_APPLICATION'],
    ['SERVER', 'SERVER'],
    ['SERVER', 'CLOUD_RESOURCE'],
    ['CLOUD_RESOURCE', 'DOMAIN'],
    ['CLOUD_RESOURCE', 'WEBSITE_APPLICATION'],
    ['CLOUD_RESOURCE', 'SERVER'],
    ['CLOUD_RESOURCE', 'CLOUD_RESOURCE'],
  ],
  ROUTES_TO: [
    ['DOMAIN', 'WEBSITE_APPLICATION'],
    ['DOMAIN', 'SERVER'],
    ['DOMAIN', 'CLOUD_RESOURCE'],
  ],
  CONNECTED_TO: [
    ['SERVER', 'SERVER'],
    ['SERVER', 'CLOUD_RESOURCE'],
    ['CLOUD_RESOURCE', 'SERVER'],
    ['CLOUD_RESOURCE', 'CLOUD_RESOURCE'],
  ],
} satisfies Record<RelationshipType, readonly RelationshipPair[]>;

const RESOURCE_BY_KIND: Record<GraphEntityKind, InventoryResource> = {
  CLOUD_RESOURCE: 'cloud-resources',
  DOMAIN: 'domains',
  PROJECT: 'projects',
  SERVER: 'servers',
  WEBSITE_APPLICATION: 'applications',
};

const KIND_LABELS: Record<GraphEntityKind, string> = {
  CLOUD_RESOURCE: 'Cloud resource',
  DOMAIN: 'Domain',
  PROJECT: 'Project',
  SERVER: 'Server',
  WEBSITE_APPLICATION: 'Application',
};

const KIND_STYLES: Record<GraphEntityKind, { dot: string; icon: string; surface: string }> = {
  CLOUD_RESOURCE: { dot: 'bg-purple-500', icon: 'cloud', surface: 'bg-purple-50 text-purple-800' },
  DOMAIN: { dot: 'bg-sky-500', icon: 'language', surface: 'bg-sky-50 text-sky-800' },
  PROJECT: { dot: 'bg-indigo-500', icon: 'folder', surface: 'bg-indigo-50 text-indigo-800' },
  SERVER: { dot: 'bg-amber-500', icon: 'dns', surface: 'bg-amber-50 text-amber-800' },
  WEBSITE_APPLICATION: { dot: 'bg-emerald-500', icon: 'web', surface: 'bg-emerald-50 text-emerald-800' },
};

type GraphRecord = InventoryResourceMap[InventoryResource];

interface EntityChoice {
  id: string;
  label: string;
}

interface ChoicePage {
  items: EntityChoice[];
  truncated: boolean;
}

const EMPTY_ENDPOINT_LABELS: ReadonlyMap<string, string> = new Map();

function entityKey(reference: EntityReference): string {
  return `${reference.entityKind}:${reference.entityId}`;
}

function displayEnum(value: string): string {
  return value.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
}

function recordLabel(kind: GraphEntityKind, record: GraphRecord): string {
  switch (kind) {
    case 'DOMAIN':
      return (record as InventoryResourceMap['domains']).domainName;
    case 'PROJECT':
      return (record as InventoryResourceMap['projects']).name;
    case 'SERVER':
      return (record as InventoryResourceMap['servers']).name;
    case 'CLOUD_RESOURCE':
      return (record as InventoryResourceMap['cloud-resources']).name;
    case 'WEBSITE_APPLICATION':
      return (record as InventoryResourceMap['applications']).name;
  }
}

function fallbackLabel(reference: EntityReference): string {
  return `${KIND_LABELS[reference.entityKind]} ${reference.entityId.slice(0, 8)}…`;
}

function uniqueEndpointReferences(relationships: readonly InventoryRelationship[]): EntityReference[] {
  const references = new Map<string, EntityReference>();
  for (const relationship of relationships) {
    references.set(entityKey(relationship.source), relationship.source);
    references.set(entityKey(relationship.target), relationship.target);
  }
  return [...references.values()];
}

function useEndpointLabels(
  relationships: readonly InventoryRelationship[],
  sessionScopeKey: string | null,
) {
  const references = useMemo(() => uniqueEndpointReferences(relationships), [relationships]);
  const cacheRef = useRef(new Map<string, string>());
  const scopeRef = useRef<string | null>(sessionScopeKey);
  const generationRef = useRef(0);
  const [labels, setLabels] = useState(new Map<string, string>());
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (scopeRef.current !== sessionScopeKey) {
      scopeRef.current = sessionScopeKey;
      cacheRef.current = new Map();
      setLabels(new Map());
    }

    const generation = ++generationRef.current;
    const controller = new AbortController();
    const missing = references.filter((reference) => !cacheRef.current.has(entityKey(reference)));

    if (missing.length === 0) {
      setLabels(new Map(cacheRef.current));
      setResolving(false);
      return () => controller.abort();
    }

    setResolving(true);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < missing.length && generation === generationRef.current) {
        const reference = missing[nextIndex++];
        if (!reference) continue;
        try {
          const record = await getInventory(
            RESOURCE_BY_KIND[reference.entityKind],
            reference.entityId,
            controller.signal,
          );
          if (generation === generationRef.current) {
            cacheRef.current.set(entityKey(reference), recordLabel(reference.entityKind, record));
          }
        } catch {
          // Failed lookups retain their safe public-identity fallback and are not cached.
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(4, missing.length) },
      () => worker(),
    );
    void Promise.all(workers).then(() => {
      if (generation === generationRef.current) {
        setLabels(new Map(cacheRef.current));
        setResolving(false);
      }
    });

    return () => {
      generationRef.current += 1;
      controller.abort();
    };
  }, [references, sessionScopeKey]);

  return {
    labels: scopeRef.current === sessionScopeKey ? labels : EMPTY_ENDPOINT_LABELS,
    resolving,
  };
}

function useEntityChoices(sourceKind: GraphEntityKind, targetKind: GraphEntityKind) {
  const [pages, setPages] = useState<Partial<Record<GraphEntityKind, ChoicePage>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const kinds = sourceKind === targetKind ? [sourceKind] : [sourceKind, targetKind];

    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const results = await Promise.all(kinds.map(async (kind) => {
          const page = await listInventory(RESOURCE_BY_KIND[kind], {
            limit: 100,
            signal: controller.signal,
          });
          return {
            kind,
            page: {
              items: page.items.map((record) => ({
                id: record.id,
                label: recordLabel(kind, record),
              })),
              truncated: page.nextCursor !== null,
            },
          };
        }));
        if (!active) return;
        setPages(Object.fromEntries(results.map(({ kind, page }) => [kind, page])));
      } catch (requestError) {
        if (!active || controller.signal.aborted) return;
        setPages({});
        setError(requestError instanceof Error ? requestError.message : 'Relationship endpoints could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [sourceKind, targetKind]);

  return { error, loading, pages };
}

const EntityCard: React.FC<{
  label?: string;
  reference: EntityReference;
}> = ({ label, reference }) => {
  const style = KIND_STYLES[reference.entityKind];
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-micro">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.surface}`} aria-hidden="true">
          <span className="material-symbols-outlined text-[19px]">{style.icon}</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
            <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">
              {KIND_LABELS[reference.entityKind]}
            </span>
          </div>
          <p className="mt-1 truncate text-body-sm font-semibold text-on-surface" title={label ?? fallbackLabel(reference)}>
            {label ?? fallbackLabel(reference)}
          </p>
          <p className="mt-0.5 truncate font-label-mono text-caption-xs text-secondary" title={reference.entityId}>
            ID {reference.entityId}
          </p>
        </div>
      </div>
    </div>
  );
};

const AddRelationshipModal: React.FC<{
  onClose(): void;
  onSaved(relationship: InventoryRelationship): void;
}> = ({ onClose, onSaved }) => {
  const titleId = React.useId();
  const helpId = React.useId();
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('GROUPS');
  const [sourceKind, setSourceKind] = useState<GraphEntityKind>('PROJECT');
  const [targetKind, setTargetKind] = useState<GraphEntityKind>('DOMAIN');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = useEntityChoices(sourceKind, targetKind);

  const pairs = RELATIONSHIP_MATRIX[relationshipType];
  const sourceKinds = GRAPH_KINDS.filter((kind) => pairs.some(([source]) => source === kind));
  const targetKinds = GRAPH_KINDS.filter((kind) => pairs.some(
    ([source, target]) => source === sourceKind && target === kind,
  ));
  const sourcePage = choices.pages[sourceKind];
  const targetPage = choices.pages[targetKind];
  const selfEdge = sourceKind === targetKind && sourceId !== '' && sourceId === targetId;

  const changeRelationshipType = (nextType: RelationshipType) => {
    const [nextSource, nextTarget] = RELATIONSHIP_MATRIX[nextType][0];
    setRelationshipType(nextType);
    setSourceKind(nextSource);
    setTargetKind(nextTarget);
    setSourceId('');
    setTargetId('');
    setError(null);
  };

  const changeSourceKind = (nextKind: GraphEntityKind) => {
    const nextTarget = RELATIONSHIP_MATRIX[relationshipType].find(
      ([source]) => source === nextKind,
    )?.[1];
    if (!nextTarget) return;
    setSourceKind(nextKind);
    setTargetKind(nextTarget);
    setSourceId('');
    setTargetId('');
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceId || !targetId || selfEdge) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await createRelationship({
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        relationshipType,
        source: { entityId: sourceId, entityKind: sourceKind },
        target: { entityId: targetId, entityKind: targetKind },
      });
      onSaved(saved);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The relationship could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation">
      <section
        aria-describedby={helpId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-modal"
        role="dialog"
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-headline-sm font-semibold text-on-surface">Add relationship</h2>
            <p id={helpId} className="mt-1 text-body-sm text-secondary">
              Create one stored edge between existing tracked inventory records. Available endpoint kinds follow the backend relationship rules.
            </p>
          </div>
          <Button aria-label="Close relationship dialog" iconLeading="close" onClick={onClose} variant="ghost" />
        </div>

        <form className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-label-md font-medium text-on-surface md:col-span-2" htmlFor="relationship-type">
            Relationship type
            <select
              className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"
              id="relationship-type"
              onChange={(event) => changeRelationshipType(event.target.value as RelationshipType)}
              value={relationshipType}
            >
              {RELATIONSHIP_TYPES.map((type) => <option key={type} value={type}>{displayEnum(type)}</option>)}
            </select>
          </label>

          <fieldset className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4">
            <legend className="px-1 text-label-md font-semibold text-on-surface">Source endpoint</legend>
            <label className="mt-1 flex flex-col gap-1.5 text-label-md font-medium text-on-surface" htmlFor="relationship-source-kind">
              Entity kind
              <select
                className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"
                id="relationship-source-kind"
                onChange={(event) => changeSourceKind(event.target.value as GraphEntityKind)}
                value={sourceKind}
              >
                {sourceKinds.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-label-md font-medium text-on-surface" htmlFor="relationship-source-id">
              Inventory record
              <select
                className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"
                disabled={choices.loading || !sourcePage?.items.length}
                id="relationship-source-id"
                onChange={(event) => setSourceId(event.target.value)}
                required
                value={sourceId}
              >
                <option value="">Select {KIND_LABELS[sourceKind].toLowerCase()}</option>
                {sourcePage?.items.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id.slice(0, 8)}</option>)}
              </select>
            </label>
            {sourcePage?.truncated && <p className="mt-2 text-caption-xs text-secondary">Showing the first 100 tracked records.</p>}
          </fieldset>

          <fieldset className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4">
            <legend className="px-1 text-label-md font-semibold text-on-surface">Target endpoint</legend>
            <label className="mt-1 flex flex-col gap-1.5 text-label-md font-medium text-on-surface" htmlFor="relationship-target-kind">
              Entity kind
              <select
                className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"
                id="relationship-target-kind"
                onChange={(event) => {
                  setTargetKind(event.target.value as GraphEntityKind);
                  setTargetId('');
                  setError(null);
                }}
                value={targetKind}
              >
                {targetKinds.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
              </select>
            </label>
            <label className="mt-3 flex flex-col gap-1.5 text-label-md font-medium text-on-surface" htmlFor="relationship-target-id">
              Inventory record
              <select
                className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3"
                disabled={choices.loading || !targetPage?.items.length}
                id="relationship-target-id"
                onChange={(event) => setTargetId(event.target.value)}
                required
                value={targetId}
              >
                <option value="">Select {KIND_LABELS[targetKind].toLowerCase()}</option>
                {targetPage?.items.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id.slice(0, 8)}</option>)}
              </select>
            </label>
            {targetPage?.truncated && <p className="mt-2 text-caption-xs text-secondary">Showing the first 100 tracked records.</p>}
          </fieldset>

          <label className="flex flex-col gap-1.5 text-label-md font-medium text-on-surface md:col-span-2" htmlFor="relationship-notes">
            Notes <span className="text-caption-xs font-normal text-secondary">Optional</span>
            <textarea
              className="min-h-24 rounded-lg border border-outline-variant bg-surface-container-lowest p-3"
              id="relationship-notes"
              maxLength={10000}
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>

          {choices.loading && <p className="text-body-sm text-secondary md:col-span-2">Loading tracked endpoint records…</p>}
          {choices.error && <p className="text-body-sm text-error md:col-span-2" role="alert">{choices.error}</p>}
          {selfEdge && <p className="text-body-sm text-error md:col-span-2" role="alert">A relationship cannot connect an entity to itself.</p>}
          {error && <p className="text-body-sm text-error md:col-span-2" role="alert">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-outline-variant/40 pt-4 md:col-span-2">
            <Button onClick={onClose} type="button">Cancel</Button>
            <Button
              disabled={saving || choices.loading || !sourceId || !targetId || selfEdge}
              type="submit"
              variant="primary"
            >
              {saving ? 'Creating…' : 'Create relationship'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};

export const InfrastructureMapPage: React.FC = () => {
  const { sessionScopeKey } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyRelationshipId, setBusyRelationshipId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const relationships = useRelationships(includeArchived);
  const endpoints = useMemo(() => uniqueEndpointReferences(relationships.items), [relationships.items]);
  const { labels, resolving } = useEndpointLabels(relationships.items, sessionScopeKey);

  const changeRelationshipState = async (relationship: InventoryRelationship) => {
    setBusyRelationshipId(relationship.id);
    setActionError(null);
    try {
      if (relationship.inventoryState === 'TRACKED') {
        await archiveRelationship(relationship.id);
        if (includeArchived) {
          relationships.upsert({ ...relationship, inventoryState: 'ARCHIVED' });
        } else {
          relationships.remove(relationship.id);
        }
      } else {
        relationships.upsert(await updateRelationship(relationship.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The relationship could not be updated.');
    } finally {
      setBusyRelationshipId(null);
    }
  };

  const initialFailure = !relationships.loading && relationships.items.length === 0 && relationships.error;

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <PageHeader
        actions={(
          <>
            <label className="flex h-9 items-center gap-2 rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-body-sm text-secondary shadow-micro">
              <input
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                type="checkbox"
              />
              Include archived
            </label>
            <Button iconLeading="add_link" onClick={() => setCreating(true)} variant="primary">Add relationship</Button>
          </>
        )}
        badge={`${relationships.items.length} relationships loaded`}
        description="Explore stored one-hop topology. Every connection below is a real relationship record; no edges are inferred from proximity or inventory metadata."
        title="Infrastructure Map"
      />

      {!relationships.loading && !initialFailure && relationships.items.length > 0 && (
        <section aria-label="Loaded topology summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-micro">
            <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Relationships loaded</p>
            <p className="mt-1 text-headline-md font-semibold text-on-surface">{relationships.items.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-micro">
            <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Entities in loaded edges</p>
            <p className="mt-1 text-headline-md font-semibold text-on-surface">{endpoints.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-micro">
            <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Tracked edges loaded</p>
            <p className="mt-1 text-headline-md font-semibold text-on-surface">
              {relationships.items.filter((relationship) => relationship.inventoryState === 'TRACKED').length}
            </p>
          </div>
        </section>
      )}

      {!relationships.loading && !initialFailure && (
        <InventoryTopologyCanvas
          labels={labels}
          relationships={relationships.items}
          resolvingLabels={resolving}
        />
      )}

      <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm" aria-labelledby="stored-topology-title">
        <div className="flex flex-col gap-2 border-b border-outline-variant/30 bg-surface-container-low px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="stored-topology-title" className="text-headline-sm font-semibold text-on-surface">Stored topology</h2>
            <p className="mt-0.5 text-caption-xs text-secondary">One card per loaded relationship. Entity labels are resolved from their public entity kind and entity ID.</p>
          </div>
          {resolving && (
            <span className="inline-flex items-center gap-1.5 text-caption-xs text-secondary" role="status">
              <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
              Resolving entity labels…
            </span>
          )}
        </div>

        {relationships.loading ? (
          <StatePanel icon="progress_activity" message="Loading stored relationships…" spinning />
        ) : initialFailure ? (
          <StatePanel icon="error" message={initialFailure} action={<Button onClick={relationships.reload}>Try again</Button>} />
        ) : relationships.items.length === 0 ? (
          <StatePanel
            action={<Button iconLeading="add_link" onClick={() => setCreating(true)} variant="primary">Add first relationship</Button>}
            icon="hub"
            message={includeArchived ? 'No stored relationships were found, including archived records.' : 'No tracked relationships have been added. The map will show only stored edges.'}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 2xl:grid-cols-2">
            {relationships.items.map((relationship) => (
              <article className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4" key={relationship.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <EntityCard label={labels.get(entityKey(relationship.source))} reference={relationship.source} />
                  <div className="flex shrink-0 items-center justify-center gap-2 lg:w-28 lg:flex-col" aria-label={displayEnum(relationship.relationshipType)}>
                    <span className="h-px flex-1 bg-outline-variant lg:h-5 lg:w-px lg:flex-none" aria-hidden="true" />
                    <span className="rounded-full bg-primary-fixed px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-on-primary-fixed-variant">
                      {displayEnum(relationship.relationshipType)}
                    </span>
                    <span className="material-symbols-outlined rotate-90 text-[18px] text-primary lg:rotate-0" aria-hidden="true">
                      {relationship.relationshipType === 'CONNECTED_TO' ? 'sync_alt' : 'arrow_forward'}
                    </span>
                  </div>
                  <EntityCard label={labels.get(entityKey(relationship.target))} reference={relationship.target} />
                </div>

                <div className="mt-3 flex flex-col gap-3 border-t border-outline-variant/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <InventoryState state={relationship.inventoryState} />
                      <span className="text-caption-xs text-secondary">{displayEnum(relationship.provenance)}</span>
                    </div>
                    {relationship.notes && <p className="mt-1 truncate text-caption-xs text-secondary" title={relationship.notes}>{relationship.notes}</p>}
                  </div>
                  <Button
                    disabled={busyRelationshipId === relationship.id}
                    onClick={() => void changeRelationshipState(relationship)}
                    size="sm"
                    variant={relationship.inventoryState === 'TRACKED' ? 'ghost' : 'outline'}
                  >
                    {busyRelationshipId === relationship.id
                      ? 'Updating…'
                      : relationship.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-outline-variant/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption-xs text-secondary">
            {relationships.items.length} relationship records loaded. This is not a workspace-wide total.
          </p>
          {relationships.nextCursor && (
            <Button disabled={relationships.loadingMore} onClick={() => void relationships.loadMore()}>
              {relationships.loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      </section>

      {(actionError || (relationships.items.length > 0 && relationships.error)) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-container bg-error-container/30 px-4 py-3" role="alert">
          <p className="text-body-sm text-on-error-container">{actionError ?? relationships.error}</p>
          {relationships.error && <Button onClick={relationships.reload} size="sm">Reload</Button>}
        </div>
      )}

      {creating && (
        <AddRelationshipModal
          onClose={() => setCreating(false)}
          onSaved={relationships.upsert}
        />
      )}
    </div>
  );
};

export default InfrastructureMapPage;
