import React, { useMemo, useState } from 'react';

import { archiveInventory, updateInventory } from '@/api/inventory';
import { getCloudResourceHostedApplications } from '@/api/read-models';
import type { CloudResource } from '@/api/types';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityAssociations } from '@/components/integration/EntityAssociations';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { cloudConfiguration } from '@/features/integration/resource-configs';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';
import { useCursorInventory } from '@/hooks/useCursorInventory';
import { formatDateTime } from '@/lib/format';

const metadata = (value: string | null) => value || 'Not recorded';

export const CloudResourcesPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [editing, setEditing] = useState<CloudResource | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const list = useCursorInventory('cloud-resources', includeArchived);
  const providerLabels = useProviderLabels(list.items.map((resource) => resource.providerAccountId));
  const config = useMemo(() => cloudConfiguration(providerLabels), [providerLabels]);

  const resourceTypes = useMemo(
    () => [...new Set(list.items.map((resource) => resource.resourceType).filter(Boolean))].sort(),
    [list.items],
  );
  const regions = useMemo(
    () => [...new Set(list.items.map((resource) => resource.region).filter((value): value is string => Boolean(value)))].sort(),
    [list.items],
  );
  const visibleResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.items.filter((resource) => {
      if (resourceType !== 'ALL' && resource.resourceType !== resourceType) return false;
      if (region !== 'ALL' && resource.region !== region) return false;
      if (!query) return true;
      return [
        resource.name,
        resource.resourceType,
        resource.region,
        resource.externalResourceId,
        resource.notes,
        providerLabels.get(resource.providerAccountId),
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [list.items, providerLabels, region, resourceType, search]);

  const inspected = list.items.find((resource) => resource.id === inspectedId) ?? null;
  const associationSources = useMemo(
    () => [{
      context: 'Hosted application',
      load: (signal: AbortSignal) => inspectedId
        ? getCloudResourceHostedApplications(inspectedId, signal)
        : Promise.resolve({ items: [] }),
    }],
    [inspectedId],
  );

  const changeState = async (resource: CloudResource) => {
    if (pendingId) return;
    setActionError(null);
    setPendingId(resource.id);
    try {
      if (resource.inventoryState === 'TRACKED') {
        await archiveInventory('cloud-resources', resource.id);
        if (includeArchived) list.markArchived(resource.id);
        else list.remove(resource.id);
      } else {
        list.upsert(await updateInventory('cloud-resources', resource.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The cloud resource could not be updated.');
    } finally {
      setPendingId(null);
    }
  };

  const trackedCount = list.items.filter((resource) => resource.inventoryState === 'TRACKED').length;
  const providerCount = new Set(list.items.map((resource) => resource.providerAccountId).filter(Boolean)).size;

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <PageHeader
        actions={<Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add Cloud Resource</Button>}
        badge={`${list.items.length} LOADED`}
        description="Stored cloud resource inventory such as instances, buckets, functions, and databases. Live provider state, utilization, and cost are not exposed by the current API."
        title="Cloud Resources"
      />

      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Loaded cloud resource summary">
        {[
          { icon: 'cloud', label: 'Loaded records', value: list.items.length },
          { icon: 'inventory_2', label: 'Tracked', value: trackedCount },
          { icon: 'archive', label: 'Archived', value: list.items.length - trackedCount },
          { icon: 'hub', label: 'Provider accounts', value: providerCount },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{item.label}</span>
              <span className="material-symbols-outlined text-[20px] text-primary">{item.icon}</span>
            </div>
            <p className="mt-unit-xs font-label-mono text-headline-md font-semibold text-on-surface">{item.value}</p>
            <p className="mt-1 text-caption-xs text-secondary">Current loaded page only</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col items-start gap-unit-lg xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-unit-sm">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-sm shadow-sm">
            <div className="flex flex-col gap-unit-sm lg:flex-row lg:items-center">
              <label className="relative min-w-[240px] flex-1">
                <span className="sr-only">Filter loaded cloud resources</span>
                <span className="material-symbols-outlined pointer-events-none absolute left-unit-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary">search</span>
                <input
                  className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-0 pl-9 pr-unit-md text-body-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Filter loaded resources by name, type, provider, region, or external ID…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select aria-label="Filter by resource type" className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-label-md" value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
                <option value="ALL">All resource types</option>
                {resourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select aria-label="Filter by region" className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-label-md" value={region} onChange={(event) => setRegion(event.target.value)}>
                <option value="ALL">All regions</option>
                {regions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <label className="flex h-9 items-center gap-unit-xs whitespace-nowrap rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-caption-xs text-secondary">
                <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                Include archived
              </label>
            </div>
            <div className="mt-unit-sm flex items-center justify-between border-t border-outline-variant/20 pt-unit-xs text-caption-xs text-secondary">
              <span>{visibleResources.length} shown from {list.items.length} loaded records</span>
              {(search || resourceType !== 'ALL' || region !== 'ALL') && <button className="font-semibold text-primary hover:underline" type="button" onClick={() => { setSearch(''); setResourceType('ALL'); setRegion('ALL'); }}>Clear filters</button>}
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            {list.loading ? <StatePanel icon="progress_activity" message="Loading cloud resources…" spinning />
              : list.error ? <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
              : visibleResources.length === 0 ? <StatePanel icon="cloud" message={search || resourceType !== 'ALL' || region !== 'ALL' ? 'No loaded cloud resources match these filters.' : 'No cloud resource records have been added.'} action={!search && resourceType === 'ALL' && region === 'ALL' ? <Button variant="primary" onClick={() => setEditing('create')}>Add cloud resource</Button> : undefined} />
              : <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="h-9 border-b border-outline-variant/30 bg-surface-container-low text-caption-xs uppercase tracking-wider text-secondary"><th className="px-unit-sm font-semibold">Resource</th><th className="px-unit-sm font-semibold">Type</th><th className="px-unit-sm font-semibold">Provider</th><th className="px-unit-sm font-semibold">Region</th><th className="px-unit-sm font-semibold">State</th><th className="px-unit-sm text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-outline-variant/25 text-body-sm">
                {visibleResources.map((resource) => (
                  <tr key={resource.id} className={`${inspectedId === resource.id ? 'bg-primary/5' : 'hover:bg-surface-container-low'} transition-colors`}>
                    <td className="px-unit-sm py-unit-sm">
                      <div className="flex min-w-[180px] items-center gap-unit-sm">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary"><span className="material-symbols-outlined text-[18px]">cloud</span></span>
                        <div className="min-w-0"><p className="truncate font-semibold text-on-surface">{resource.name}</p><p className="truncate font-label-mono text-caption-xs text-secondary">{metadata(resource.externalResourceId)}</p></div>
                      </div>
                    </td>
                    <td className="px-unit-sm py-unit-sm text-secondary">{resource.resourceType}</td>
                    <td className="px-unit-sm py-unit-sm"><span className="font-medium text-on-surface">{providerLabels.get(resource.providerAccountId) ?? 'Resolving provider…'}</span></td>
                    <td className="px-unit-sm py-unit-sm text-secondary">{metadata(resource.region)}</td>
                    <td className="px-unit-sm py-unit-sm"><InventoryState state={resource.inventoryState} /></td>
                    <td className="px-unit-sm py-unit-sm"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setInspectedId(resource.id)}>Inspect</Button><Button size="sm" variant="ghost" onClick={() => setEditing(resource)}>Edit</Button></div></td>
                  </tr>
                ))}
              </tbody></table></div>}
            <footer className="flex min-h-11 items-center justify-between gap-unit-md border-t border-outline-variant/30 bg-surface-container-low px-unit-md py-unit-xs text-caption-xs text-secondary">
              <span>Search and filters apply to loaded records only.</span>
              {list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}
            </footer>
          </section>
          {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
        </div>

        {inspected && (
          <aside className="flex w-full shrink-0 flex-col gap-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-md xl:sticky xl:top-unit-md xl:w-[380px]" aria-label={`Inspect ${inspected.name}`}>
            <div className="flex items-start justify-between gap-unit-sm border-b border-outline-variant/25 pb-unit-sm">
              <div className="min-w-0"><p className="truncate text-headline-sm font-semibold text-on-surface">{inspected.name}</p><p className="mt-1 truncate font-label-mono text-caption-xs text-secondary">{inspected.id}</p></div>
              <button className="text-secondary hover:text-on-surface" type="button" aria-label="Close cloud resource inspector" onClick={() => setInspectedId(null)}><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <div><InventoryState state={inspected.inventoryState} /></div>
            <dl className="grid grid-cols-2 gap-unit-xs">
              {[
                ['Type', inspected.resourceType],
                ['Provider', providerLabels.get(inspected.providerAccountId) ?? 'Resolving provider…'],
                ['Region', metadata(inspected.region)],
                ['External ID', metadata(inspected.externalResourceId)],
                ['Created', formatDateTime(inspected.createdAt)],
                ['Updated', formatDateTime(inspected.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                  <dt className="text-caption-xs text-secondary">{label}</dt>
                  <dd className="mt-1 break-words text-body-sm font-medium text-on-surface">{value}</dd>
                </div>
              ))}
            </dl>
            {inspected.notes && <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs text-secondary">Notes</p><p className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface">{inspected.notes}</p></div>}
            <EntityAssociations sources={associationSources} title="Hosted applications" />
            <div className="flex gap-unit-xs"><Button className="flex-1" onClick={() => setEditing(inspected)}>Edit</Button><Button className="flex-1" variant={inspected.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} disabled={pendingId === inspected.id} onClick={() => void changeState(inspected)}>{inspected.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
          </aside>
        )}
      </div>

      {editing && <ResourceFormModal config={config} record={editing === 'create' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.upsert} />}
    </div>
  );
};
