import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, updateInventory } from '@/api/inventory';
import type { Server } from '@/api/types';
import { Button } from '@/components/common/Button';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { serverConfiguration } from '@/features/integration/resource-configs';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';
import { useCursorInventory } from '@/hooks/useCursorInventory';

const metadata = (value: string | null) => value || 'Not recorded';

export const ServersPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [editing, setEditing] = useState<Server | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = useCursorInventory('servers', includeArchived);
  const providerLabels = useProviderLabels(list.items.map((server) => server.providerAccountId));
  const config = useMemo(() => serverConfiguration(providerLabels), [providerLabels]);

  const kinds = useMemo(
    () => [...new Set(list.items.map((server) => server.serverKind).filter((value): value is string => Boolean(value)))].sort(),
    [list.items],
  );
  const regions = useMemo(
    () => [...new Set(list.items.map((server) => server.region).filter((value): value is string => Boolean(value)))].sort(),
    [list.items],
  );
  const visibleServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return list.items.filter((server) => {
      if (kind !== 'ALL' && server.serverKind !== kind) return false;
      if (region !== 'ALL' && server.region !== region) return false;
      if (!query) return true;
      const providerLabel = server.providerAccountId
        ? providerLabels.get(server.providerAccountId)
        : null;
      return [server.name, server.hostname, server.serverKind, server.region, server.primaryIp, server.operatingSystem, providerLabel]
        .some((value) => value?.toLowerCase().includes(query));
    });
  }, [kind, list.items, providerLabels, region, search]);
  const inspected = list.items.find((server) => server.id === inspectedId) ?? null;

  useEffect(() => {
    if (list.loading || list.items.length === 0) return;
    if (!inspectedId || !list.items.some((server) => server.id === inspectedId)) {
      setInspectedId(list.items[0]?.id ?? null);
    }
  }, [inspectedId, list.items, list.loading]);

  const changeState = async (server: Server) => {
    setActionError(null);
    try {
      if (server.inventoryState === 'TRACKED') {
        await archiveInventory('servers', server.id);
        if (includeArchived) list.markArchived(server.id);
        else list.remove(server.id);
      } else {
        list.upsert(await updateInventory('servers', server.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The server could not be updated.');
    }
  };

  const trackedCount = list.items.filter((server) => server.inventoryState === 'TRACKED').length;
  const archivedCount = list.items.length - trackedCount;
  const providerCount = new Set(list.items.map((server) => server.providerAccountId).filter(Boolean)).size;

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <header className="mb-unit-xs flex flex-col justify-between gap-unit-md lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-unit-xs">
            <h1 className="font-headline-md text-headline-md font-semibold tracking-tight text-on-surface">VPS &amp; Servers</h1>
            <span className="rounded border border-outline-variant/30 bg-surface-container-high px-unit-xs py-unit-2xs font-label-mono text-caption-xs font-semibold text-primary">{list.items.length} LOADED</span>
          </div>
          <p className="mt-unit-2xs max-w-3xl text-body-md text-secondary">Workspace server inventory, provider ownership, and recorded infrastructure metadata. Live health and utilization are not connected.</p>
        </div>
        <Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add Server</Button>
      </header>

      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Loaded server summary">
        {[
          { icon: 'dns', label: 'Loaded records', value: list.items.length },
          { icon: 'inventory_2', label: 'Tracked', value: trackedCount },
          { icon: 'archive', label: 'Archived', value: archivedCount },
          { icon: 'hub', label: 'Provider accounts', value: providerCount },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{item.label}</span><span className="material-symbols-outlined text-[20px] text-primary">{item.icon}</span></div>
            <p className="mt-unit-xs font-label-mono text-headline-md font-semibold text-on-surface">{item.value}</p>
            <p className="mt-1 text-caption-xs text-secondary">Current loaded page only</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col items-start gap-unit-lg xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-unit-sm">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-sm shadow-sm">
            <div className="flex flex-col gap-unit-sm lg:flex-row lg:items-center">
              <label className="relative min-w-[240px] flex-1"><span className="sr-only">Filter loaded servers</span><span className="material-symbols-outlined pointer-events-none absolute left-unit-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary">search</span><input className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-0 pl-9 pr-unit-md text-body-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Filter loaded servers by name, host, provider, IP, or OS…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <select aria-label="Filter by server kind" className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-label-md" value={kind} onChange={(event) => setKind(event.target.value)}><option value="ALL">All server kinds</option>{kinds.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <select aria-label="Filter by region" className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-label-md" value={region} onChange={(event) => setRegion(event.target.value)}><option value="ALL">All regions</option>{regions.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <label className="flex h-9 items-center gap-unit-xs whitespace-nowrap rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-caption-xs text-secondary"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />Include archived</label>
            </div>
            <div className="mt-unit-sm flex items-center justify-between border-t border-outline-variant/20 pt-unit-xs text-caption-xs text-secondary"><span>{visibleServers.length} shown from {list.items.length} loaded records</span>{(search || kind !== 'ALL' || region !== 'ALL') && <button className="font-semibold text-primary hover:underline" type="button" onClick={() => { setSearch(''); setKind('ALL'); setRegion('ALL'); }}>Clear filters</button>}</div>
          </div>

          <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            {list.loading ? <StatePanel icon="progress_activity" message="Loading server inventory…" spinning />
              : list.error ? <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
              : visibleServers.length === 0 ? <StatePanel icon="dns" message={search || kind !== 'ALL' || region !== 'ALL' ? 'No loaded servers match these filters.' : 'No server records have been added.'} action={!search && kind === 'ALL' && region === 'ALL' ? <Button variant="primary" onClick={() => setEditing('create')}>Add server</Button> : undefined} />
              : <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="h-9 border-b border-outline-variant/30 bg-surface-container-low text-caption-xs uppercase tracking-wider text-secondary"><th className="px-unit-sm font-semibold">Server / hostname</th><th className="px-unit-sm font-semibold">Kind</th><th className="px-unit-sm font-semibold">Provider</th><th className="px-unit-sm font-semibold">Primary IP</th><th className="px-unit-sm font-semibold">Region</th><th className="px-unit-sm font-semibold">State</th><th className="px-unit-sm text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-outline-variant/25 text-body-sm">
                {visibleServers.map((server) => <tr key={server.id} className={`${inspectedId === server.id ? 'bg-primary/5' : 'hover:bg-surface-container-low'} transition-colors`}><td className="px-unit-sm py-unit-sm"><div className="flex min-w-[180px] items-center gap-unit-sm"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary"><span className="material-symbols-outlined text-[18px]">dns</span></span><div className="min-w-0"><p className="truncate font-semibold text-on-surface">{server.name}</p><p className="truncate font-label-mono text-caption-xs text-secondary">{metadata(server.hostname)}</p></div></div></td><td className="px-unit-sm py-unit-sm text-secondary">{metadata(server.serverKind)}</td><td className="px-unit-sm py-unit-sm"><span className="font-medium text-on-surface">{server.providerAccountId ? (providerLabels.get(server.providerAccountId) ?? 'Resolving provider…') : 'Not mapped'}</span></td><td className="px-unit-sm py-unit-sm font-label-mono text-caption-xs text-on-surface">{metadata(server.primaryIp)}</td><td className="px-unit-sm py-unit-sm text-secondary">{metadata(server.region)}</td><td className="px-unit-sm py-unit-sm"><InventoryState state={server.inventoryState} /></td><td className="px-unit-sm py-unit-sm"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setInspectedId(server.id)}>Inspect</Button><Link className="inline-flex h-7 items-center px-2.5 text-[11px] font-semibold text-primary hover:underline" to={`/servers/${server.id}`}>Details</Link><Button size="sm" variant="ghost" onClick={() => setEditing(server)}>Edit</Button></div></td></tr>)}
              </tbody></table></div>}
            <footer className="flex min-h-11 items-center justify-between gap-unit-md border-t border-outline-variant/30 bg-surface-container-low px-unit-md py-unit-xs text-caption-xs text-secondary"><span>Search and filters apply to loaded records only.</span>{list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}</footer>
          </section>
          {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
        </div>

        {inspected && <aside className="flex w-full shrink-0 flex-col gap-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-md xl:sticky xl:top-unit-md xl:w-[360px]" aria-label={`Inspect ${inspected.name}`}>
          <div className="flex items-start justify-between gap-unit-sm border-b border-outline-variant/25 pb-unit-sm"><div className="min-w-0"><p className="truncate text-headline-sm font-semibold text-on-surface">{inspected.name}</p><p className="mt-1 truncate font-label-mono text-caption-xs text-secondary">{metadata(inspected.hostname)}</p></div><button className="text-secondary hover:text-on-surface" type="button" aria-label="Close server inspector" onClick={() => setInspectedId(null)}><span className="material-symbols-outlined text-[20px]">close</span></button></div>
          <div><InventoryState state={inspected.inventoryState} /></div>
          <dl className="grid grid-cols-2 gap-unit-xs">{[
            ['Provider', inspected.providerAccountId ? (providerLabels.get(inspected.providerAccountId) ?? 'Resolving provider…') : 'Not mapped'],
            ['Kind', metadata(inspected.serverKind)], ['Primary IP', metadata(inspected.primaryIp)], ['Region', metadata(inspected.region)], ['Operating system', metadata(inspected.operatingSystem)], ['Provenance', inspected.provenance.split('_').join(' ')],
          ].map(([label, value]) => <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs text-secondary">{label}</dt><dd className="mt-1 break-words text-body-sm font-medium text-on-surface">{value}</dd></div>)}</dl>
          {inspected.notes && <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs text-secondary">Notes</p><p className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface">{inspected.notes}</p></div>}
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm text-caption-xs text-secondary">Live CPU, memory, storage, uptime, latency, health, and billing are not available from the current API.</div>
          <Link className="flex h-9 items-center justify-center gap-unit-xs rounded-lg bg-primary-container text-label-md font-medium text-on-primary hover:bg-primary" to={`/servers/${inspected.id}`}>View full server page<span className="material-symbols-outlined text-[16px]">arrow_forward</span></Link>
          <div className="flex gap-unit-xs"><Button className="flex-1" onClick={() => setEditing(inspected)}>Edit</Button><Button className="flex-1" variant={inspected.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} onClick={() => void changeState(inspected)}>{inspected.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
        </aside>}
      </div>
      {editing && <ResourceFormModal config={config} record={editing === 'create' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.upsert} />}
    </div>
  );
};
