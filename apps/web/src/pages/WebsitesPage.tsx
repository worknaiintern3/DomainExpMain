import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, updateInventory } from '@/api/inventory';
import type { Application } from '@/api/types';
import { Button } from '@/components/common/Button';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { applicationConfiguration } from '@/features/integration/resource-configs';
import { useCursorInventory } from '@/hooks/useCursorInventory';

const kindLabel = (kind: Application['kind']) => kind.split('_').join(' ');
const shortId = (id: string | null) => id ? `${id.slice(0, 8)}…` : 'Not mapped';

const SummaryCard: React.FC<{ icon: string; label: string; value: number; detail: string }> = ({ detail, icon, label, value }) => (
  <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
    <div className="flex items-center justify-between text-secondary">
      <span className="font-caption-xs text-caption-xs font-semibold uppercase tracking-wider">{label}</span>
      <span className="material-symbols-outlined text-[17px]">{icon}</span>
    </div>
    <p className="mt-unit-xs font-label-mono text-headline-md font-bold text-on-surface">{value}</p>
    <p className="mt-1 text-caption-xs text-secondary">{detail}</p>
  </div>
);

export const WebsitesPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Application | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = useCursorInventory('applications', includeArchived);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list.items;
    return list.items.filter((application) => [
      application.name,
      application.kind,
      application.primaryUrl,
      application.notes,
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [list.items, search]);

  const inspected = list.items.find((item) => item.id === inspectedId) ?? null;
  const trackedCount = list.items.filter((item) => item.inventoryState === 'TRACKED').length;
  const archivedCount = list.items.length - trackedCount;
  const mappedCount = list.items.filter((item) => item.primaryDomainId || item.projectId).length;

  const changeState = async (record: Application) => {
    setActionError(null);
    try {
      if (record.inventoryState === 'TRACKED') {
        await archiveInventory('applications', record.id);
        if (includeArchived) list.markArchived(record.id);
        else {
          list.remove(record.id);
          if (inspectedId === record.id) setInspectedId(null);
        }
      } else {
        list.upsert(await updateInventory('applications', record.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The application could not be updated.');
    }
  };

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <header className="flex flex-col gap-unit-md pt-unit-md md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="font-caption-xs text-caption-xs font-mono uppercase tracking-wider text-secondary">Website &amp; application inventory</p>
          <div className="mt-1 flex flex-wrap items-center gap-unit-sm">
            <h1 className="font-headline-md text-headline-md font-semibold tracking-tight text-on-surface">Websites &amp; Apps</h1>
            <span className="rounded border border-outline-variant/30 bg-surface-container-high px-unit-xs py-unit-2xs font-label-mono text-caption-xs font-semibold text-primary">{list.items.length} LOADED</span>
          </div>
          <p className="mt-unit-2xs max-w-3xl font-body-sm text-body-sm text-secondary">Manage stored applications, URLs, kinds, projects, and primary-domain mappings for this workspace.</p>
        </div>
        <Button variant="primary" iconLeading="add_circle" onClick={() => setEditing('create')}>Add website / app</Button>
      </header>

      <div className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4">
        <SummaryCard icon="web_asset" label="Loaded records" value={list.items.length} detail="Current loaded pages only" />
        <SummaryCard icon="inventory_2" label="Tracked" value={trackedCount} detail="Active in loaded inventory" />
        <SummaryCard icon="archive" label="Archived" value={archivedCount} detail={includeArchived ? 'Visible archived records' : 'None loaded while hidden'} />
        <SummaryCard icon="account_tree" label="Mapped" value={mappedCount} detail="Project or primary domain stored" />
      </div>

      <div className="flex flex-col items-start gap-unit-lg xl:flex-row">
        <section className="w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col gap-unit-sm border-b border-outline-variant/30 bg-surface-container-low/40 p-unit-md sm:flex-row sm:items-center sm:justify-between">
            <label className="relative w-full max-w-xl">
              <span className="sr-only">Filter loaded application records</span>
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">search</span>
              <input className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-body-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Filter loaded names, URLs, kinds, or notes…" value={search} />
            </label>
            <label className="flex shrink-0 items-center gap-2 text-body-sm text-secondary">
              <input type="checkbox" checked={includeArchived} onChange={(event) => { setInspectedId(null); setIncludeArchived(event.target.checked); }} />
              Include archived
            </label>
          </div>

          {list.loading ? (
            <StatePanel icon="progress_activity" message="Loading websites and applications…" spinning />
          ) : list.error ? (
            <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
          ) : visibleItems.length === 0 ? (
            <StatePanel icon="web_asset_off" message={search ? 'No loaded records match this filter.' : 'No websites or applications have been added.'} action={!search ? <Button variant="primary" onClick={() => setEditing('create')}>Add the first application</Button> : undefined} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead><tr className="h-9 border-b border-outline-variant/30 bg-surface-container-low/60 text-caption-xs uppercase tracking-wider text-secondary"><th className="px-unit-md font-semibold">Application</th><th className="px-unit-sm font-semibold">Kind</th><th className="px-unit-sm font-semibold">Primary URL</th><th className="px-unit-sm font-semibold">Mappings</th><th className="px-unit-sm font-semibold">State</th><th className="px-unit-md text-right font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y divide-outline-variant/25">
                  {visibleItems.map((application) => (
                    <tr key={application.id} className={`cursor-pointer transition-colors hover:bg-surface-container-low/70 ${inspectedId === application.id ? 'bg-primary-fixed/30' : ''}`} onClick={() => setInspectedId((current) => current === application.id ? null : application.id)}>
                      <td className="px-unit-md py-unit-sm"><p className="font-label-md font-semibold text-on-surface">{application.name}</p><p className="mt-0.5 font-label-mono text-[10px] text-secondary">{application.id}</p></td>
                      <td className="px-unit-sm py-unit-sm text-body-sm text-on-surface">{kindLabel(application.kind)}</td>
                      <td className="max-w-xs px-unit-sm py-unit-sm"><span className="block truncate font-label-mono text-caption-xs text-secondary">{application.primaryUrl ?? 'Not set'}</span></td>
                      <td className="px-unit-sm py-unit-sm text-caption-xs text-secondary"><span className="block">Project: {shortId(application.projectId)}</span><span className="mt-0.5 block">Domain: {shortId(application.primaryDomainId)}</span></td>
                      <td className="px-unit-sm py-unit-sm"><InventoryState state={application.inventoryState} /></td>
                      <td className="px-unit-md py-unit-sm" onClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1"><Link className="inline-flex h-7 items-center px-2 text-caption-xs font-semibold text-primary" to={`/websites/${application.id}`}>Details</Link><Button size="sm" variant="ghost" onClick={() => setEditing(application)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => void changeState(application)}>{application.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <footer className="flex flex-col gap-unit-sm border-t border-outline-variant/30 bg-surface-container-low/40 px-unit-md py-unit-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="font-caption-xs text-caption-xs text-secondary">Showing {visibleItems.length} of {list.items.length} loaded records. Filtering does not search unloaded pages.</p>
            {list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}
          </footer>
        </section>

        {inspected && (
          <aside className="w-full shrink-0 rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm xl:sticky xl:top-4 xl:w-80" aria-label="Application inspector">
            <div className="h-1 rounded-t-xl bg-gradient-to-r from-primary via-tertiary to-surface-variant" />
            <div className="p-unit-lg">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Selected application</p><h2 className="mt-1 truncate text-headline-sm font-semibold text-on-surface">{inspected.name}</h2></div><Button variant="ghost" size="sm" iconLeading="close" aria-label="Close application inspector" onClick={() => setInspectedId(null)} /></div>
              <div className="mt-unit-md flex flex-wrap gap-2"><InventoryState state={inspected.inventoryState} /><span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-semibold text-secondary">{kindLabel(inspected.kind)}</span></div>
              <dl className="mt-unit-md space-y-unit-sm">
                <div><dt className="text-caption-xs uppercase text-secondary">Primary URL</dt><dd className="mt-1 break-all text-body-sm text-on-surface">{inspected.primaryUrl ?? 'Not set'}</dd></div>
                <div><dt className="text-caption-xs uppercase text-secondary">Project record</dt><dd className="mt-1 break-all font-label-mono text-caption-xs text-on-surface">{inspected.projectId ?? 'Not mapped'}</dd></div>
                <div><dt className="text-caption-xs uppercase text-secondary">Primary domain record</dt><dd className="mt-1 break-all font-label-mono text-caption-xs text-on-surface">{inspected.primaryDomainId ?? 'Not mapped'}</dd></div>
                <div><dt className="text-caption-xs uppercase text-secondary">Notes</dt><dd className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface">{inspected.notes ?? 'No notes'}</dd></div>
              </dl>
              <div className="mt-unit-lg grid grid-cols-2 gap-2"><Link className="inline-flex h-9 items-center justify-center rounded-lg bg-primary text-label-md font-medium text-on-primary" to={`/websites/${inspected.id}`}>View details</Link><Button onClick={() => setEditing(inspected)}>Edit</Button></div>
            </div>
          </aside>
        )}
      </div>

      <div className="flex items-start gap-unit-sm rounded-xl border border-outline-variant/20 bg-surface-container-low p-unit-md"><span className="material-symbols-outlined text-[18px] text-primary">info</span><p className="text-caption-xs text-secondary">This view shows stored inventory and structural mappings only. Runtime health, stack detection, ports, repositories, SSL, uptime, and monitoring are not connected.</p></div>
      {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
      {editing && <ResourceFormModal config={applicationConfiguration} record={editing === 'create' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.upsert} />}
    </div>
  );
};
