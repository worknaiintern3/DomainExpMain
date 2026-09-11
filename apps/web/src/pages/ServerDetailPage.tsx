import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { archiveInventory, getInventory, updateInventory } from '@/api/inventory';
import { getImmediateRelationships, getServerHostedApplications } from '@/api/read-models';
import type { Server } from '@/api/types';
import { Button } from '@/components/common/Button';
import { EntityAssociations } from '@/components/integration/EntityAssociations';
import { InventoryState, ResourceFormModal, StatePanel } from '@/components/integration/InventoryWorkspace';
import { serverConfiguration } from '@/features/integration/resource-configs';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';

const metadata = (value: string | null) => value || 'Not recorded';

export const ServerDetailPage: React.FC = () => {
  const { serverId = '' } = useParams<{ serverId: string }>();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const providerLabels = useProviderLabels([server?.providerAccountId]);
  const config = useMemo(() => serverConfiguration(providerLabels), [providerLabels]);
  const associationSources = useMemo(() => [
    {
      context: 'Hosted application',
      load: (signal: AbortSignal) => getServerHostedApplications(serverId, signal),
    },
    {
      context: 'Immediate relationship',
      load: (signal: AbortSignal) => getImmediateRelationships('SERVER', serverId, signal),
    },
  ], [serverId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setServer(null);
    void getInventory('servers', serverId, controller.signal)
      .then(setServer)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Server not found.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [serverId]);

  const changeState = async () => {
    if (!server) return;
    setError(null);
    try {
      if (server.inventoryState === 'TRACKED') {
        await archiveInventory('servers', server.id);
        setServer({ ...server, inventoryState: 'ARCHIVED' });
      } else {
        setServer(await updateInventory('servers', server.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The server could not be updated.');
    }
  };

  if (loading) return <StatePanel icon="progress_activity" spinning message="Loading server record…" />;
  if (!server) return <StatePanel icon="search_off" message={error ?? 'Server not found.'} action={<Link className="font-semibold text-primary" to="/servers">Back to servers</Link>} />;
  const providerLabel = server.providerAccountId ? providerLabels.get(server.providerAccountId) ?? 'Resolving provider…' : 'Not mapped';

  return (
    <div className="flex w-full flex-col gap-unit-lg">
      <header className="flex flex-col gap-unit-xs">
        <div className="flex items-center gap-unit-xs text-caption-xs text-secondary"><Link className="hover:text-primary" to="/servers">VPS &amp; Servers</Link><span>/</span><span className="font-semibold text-on-surface">{server.name}</span></div>
        <div className="mt-unit-2xs flex flex-col justify-between gap-unit-md lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-unit-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-primary shadow-sm"><span className="material-symbols-outlined text-[24px]">dns</span></span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-unit-sm"><h1 className="truncate text-headline-md font-semibold tracking-tight text-on-surface">{server.name}</h1><span className="rounded border border-outline-variant/30 bg-surface-container-high px-unit-sm py-unit-2xs font-label-mono text-label-mono text-primary">{metadata(server.hostname)}</span><InventoryState state={server.inventoryState} /></div><p className="mt-1 text-caption-xs text-secondary">{providerLabel} · Stored server inventory record</p></div>
          </div>
          <div className="flex flex-wrap gap-unit-xs"><Button iconLeading="edit" onClick={() => setEditing(true)}>Edit server</Button><Button variant={server.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} iconLeading={server.inventoryState === 'TRACKED' ? 'archive' : 'unarchive'} onClick={() => void changeState()}>{server.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
        </div>
      </header>

      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <section className="grid grid-cols-1 gap-unit-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Server identity summary">
        {[
          ['dns', 'Hostname', metadata(server.hostname)],
          ['lan', 'Primary IP', metadata(server.primaryIp)],
          ['public', 'Region', metadata(server.region)],
          ['category', 'Server kind', metadata(server.serverKind)],
        ].map(([icon, label, value]) => <div key={label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm"><div className="flex items-center justify-between"><span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{label}</span><span className="material-symbols-outlined text-[20px] text-primary">{icon}</span></div><p className="mt-unit-xs break-words text-headline-sm font-semibold text-on-surface">{value}</p><p className="mt-1 text-caption-xs text-secondary">Stored metadata</p></div>)}
      </section>

      <div className="rounded-xl border border-primary/15 bg-primary/5 p-unit-md"><div className="flex items-start gap-unit-sm"><span className="material-symbols-outlined text-[20px] text-primary">monitoring</span><div><p className="text-label-md font-semibold text-on-surface">Inventory record, not live monitoring</p><p className="mt-1 text-body-sm text-secondary">CPU, memory, storage usage, uptime, latency, health, renewal, and billing telemetry are not supplied by the current API.</p></div></div></div>

      <div className="grid grid-cols-1 items-start gap-unit-lg lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm lg:col-span-2">
          <div className="flex items-center gap-unit-sm border-b border-outline-variant/30 bg-surface-container-low p-unit-md"><span className="material-symbols-outlined text-[20px] text-primary">database</span><h2 className="text-headline-sm font-semibold text-on-surface">Stored server metadata</h2></div>
          <dl className="grid grid-cols-1 gap-unit-md p-unit-md sm:grid-cols-2">{[
            ['Name', server.name], ['Hostname', metadata(server.hostname)], ['Server kind', metadata(server.serverKind)], ['Region', metadata(server.region)], ['Primary IP', metadata(server.primaryIp)], ['Operating system', metadata(server.operatingSystem)], ['Provider account', providerLabel], ['Provenance', server.provenance.split('_').join(' ')], ['Created', new Date(server.createdAt).toLocaleString()], ['Updated', new Date(server.updatedAt).toLocaleString()],
          ].map(([label, value]) => <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs text-secondary">{label}</dt><dd className="mt-unit-2xs break-words text-body-sm font-semibold text-on-surface">{value}</dd></div>)}</dl>
          <div className="px-unit-md pb-unit-md"><div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs text-secondary">Notes</p><p className="mt-unit-2xs whitespace-pre-wrap text-body-sm text-on-surface">{metadata(server.notes)}</p></div></div>
        </section>

        <aside className="flex flex-col gap-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
          <div className="flex items-center gap-unit-sm"><span className="material-symbols-outlined text-[20px] text-primary">account_tree</span><h2 className="text-headline-sm font-semibold text-on-surface">Inventory context</h2></div>
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs text-secondary">Provider mapping</p><p className="mt-1 break-words text-body-sm font-semibold text-on-surface">{providerLabel}</p></div>
          <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs text-secondary">Inventory lifecycle</p><div className="mt-unit-xs"><InventoryState state={server.inventoryState} /></div></div>
          <Link className="text-label-md font-semibold text-primary hover:underline" to="/infrastructure-map">Open infrastructure map →</Link>
        </aside>
      </div>

      <EntityAssociations title="Hosted applications and immediate relationships" sources={associationSources} />
      {editing && <ResourceFormModal config={config} record={server} onClose={() => setEditing(false)} onSaved={setServer} />}
    </div>
  );
};
