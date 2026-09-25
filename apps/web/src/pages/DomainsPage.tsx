import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, updateInventory } from '@/api/inventory';
import type { Domain } from '@/api/types';
import { lookupWhois } from '@/api/whois';
import type { NormalizedWhoisData } from '@/api/whois.types';
import { Button } from '@/components/common/Button';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { WhoisDetailsModal } from '@/components/whois/WhoisDetailsModal';
import { domainConfiguration } from '@/features/integration/resource-configs';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';
import { useCursorInventory } from '@/hooks/useCursorInventory';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Unknown';

function expiryPresentation(value: string | null) {
  if (!value) return { label: 'Unknown', tone: 'text-secondary' };
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)}d ago`, tone: 'text-error' };
  if (days === 0) return { label: 'Expires today', tone: 'text-error' };
  if (days <= 30) return { label: `${days} days`, tone: 'text-amber-700' };
  return { label: `${days} days`, tone: 'text-on-surface' };
}

const ProviderName: React.FC<{
  id: string | null;
  labels: ReadonlyMap<string, string>;
}> = ({ id, labels }) => {
  if (!id) return <span className="text-secondary">Unknown</span>;
  return <span title={id}>{labels.get(id) ?? 'Resolving provider…'}</span>;
};

export const DomainsPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Domain | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // WHOIS live lookup modal state
  const [whoisModalOpen, setWhoisModalOpen] = useState(false);
  const [whoisData, setWhoisData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisError, setWhoisError] = useState<string | null>(null);
  const [targetDomain, setTargetDomain] = useState<string>('');

  const list = useCursorInventory('domains', includeArchived);

  const providerIds = useMemo(
    () => list.items.flatMap((domain) => [
      domain.registrarProviderAccountId,
      domain.dnsProviderAccountId,
    ]),
    [list.items],
  );
  const providerLabels = useProviderLabels(providerIds);
  const config = useMemo(() => domainConfiguration(providerLabels), [providerLabels]);

  const visibleDomains = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list.items;
    return list.items.filter((domain) => {
      const searchable = [
        domain.domainName,
        domain.notes,
        domain.registrarProviderAccountId
          ? providerLabels.get(domain.registrarProviderAccountId)
          : null,
        domain.dnsProviderAccountId
          ? providerLabels.get(domain.dnsProviderAccountId)
          : null,
      ];
      return searchable.some((value) => value?.toLowerCase().includes(query));
    });
  }, [list.items, providerLabels, search]);

  const inspected = list.items.find((domain) => domain.id === inspectedId) ?? null;
  const loadedSummary = useMemo(() => ({
    archived: list.items.filter((domain) => domain.inventoryState === 'ARCHIVED').length,
    expiryRecorded: list.items.filter((domain) => domain.expiresAt !== null).length,
    tracked: list.items.filter((domain) => domain.inventoryState === 'TRACKED').length,
  }), [list.items]);

  const handleLookupWhois = async (domainName: string) => {
    const clean = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return;
    setTargetDomain(clean);
    setWhoisModalOpen(true);
    setWhoisLoading(true);
    setWhoisError(null);
    try {
      const result = await lookupWhois(clean);
      setWhoisData(result);
    } catch (err) {
      setWhoisError(err instanceof Error ? err.message : 'Failed to lookup WHOIS details');
    } finally {
      setWhoisLoading(false);
    }
  };

  const changeState = async (domain: Domain) => {
    if (pendingId) return;
    setActionError(null);
    setPendingId(domain.id);
    try {
      if (domain.inventoryState === 'TRACKED') {
        await archiveInventory('domains', domain.id);
        if (includeArchived) list.markArchived(domain.id);
        else list.remove(domain.id);
      } else {
        list.upsert(await updateInventory('domains', domain.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The domain could not be updated.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <header className="flex flex-col gap-unit-md pt-unit-xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-unit-sm">
            <h1 className="font-headline-md text-headline-md font-semibold tracking-tight text-on-surface">My Domains</h1>
            <span className="rounded-full bg-surface-container px-unit-sm py-0.5 font-label-mono text-caption-xs font-semibold text-primary">
              {list.items.length} LOADED
            </span>
          </div>
          <p className="mt-unit-2xs max-w-3xl font-body-sm text-body-sm text-secondary">
            Manage the domain records stored in this workspace. Filters apply only to pages loaded in this view.
          </p>
        </div>
        <div className="flex items-center gap-unit-sm">
          <Button
            variant="outline"
            iconLeading="travel_explore"
            onClick={() => handleLookupWhois(search.trim() || 'google.com')}
          >
            WHOIS Lookup
          </Button>
          <Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add Domain</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm lg:grid-cols-4" aria-label="Loaded domain summary">
        {[
          ['domain', 'Loaded', list.items.length],
          ['verified', 'Tracked', loadedSummary.tracked],
          ['event', 'Expiry recorded', loadedSummary.expiryRecorded],
          ['archive', 'Archived loaded', loadedSummary.archived],
        ].map(([icon, label, value]) => (
          <div key={String(label)} className="flex items-center gap-unit-sm border-b border-outline-variant/25 p-unit-md last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
            <span className="material-symbols-outlined flex size-9 items-center justify-center rounded-lg bg-surface-container text-[20px] text-primary">{icon}</span>
            <div><p className="text-caption-xs uppercase tracking-wider text-secondary">{label}</p><p className="font-label-mono text-headline-sm font-semibold">{value}</p></div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-unit-sm border-b border-outline-variant/30 p-unit-md md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-2xl">
            <label className="relative flex-1">
              <span className="material-symbols-outlined pointer-events-none absolute left-3 top-2.5 text-[18px] text-secondary">search</span>
              <span className="sr-only">Filter loaded domains</span>
              <input
                className="h-10 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low pl-10 pr-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Filter loaded domains or enter any domain (e.g. google.com)…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && search.trim()) {
                    e.preventDefault();
                    handleLookupWhois(search.trim());
                  }
                }}
              />
            </label>
            {search.trim().length > 2 && (
              <Button
                size="sm"
                variant="primary"
                iconLeading="travel_explore"
                onClick={() => handleLookupWhois(search.trim())}
              >
                WHOIS
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2 text-body-sm text-secondary">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
            Include archived
          </label>
        </div>

        {list.loading ? (
          <StatePanel icon="progress_activity" message="Loading domains…" spinning />
        ) : list.error ? (
          <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
        ) : visibleDomains.length === 0 ? (
          <StatePanel
            icon="domain_disabled"
            message={search ? `No loaded workspace domains match "${search}".` : 'No domains have been added to this workspace.'}
            action={
              search ? (
                <Button variant="primary" iconLeading="travel_explore" onClick={() => handleLookupWhois(search)}>
                  Lookup live WHOIS for "{search}" via WhoisFreaks
                </Button>
              ) : (
                <Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add Domain</Button>
              )
            }
          />
        ) : (
          <div className="flex items-start">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low text-caption-xs uppercase tracking-wider text-secondary">
                  <tr><th className="px-unit-md py-unit-sm">Domain</th><th className="px-unit-md py-unit-sm">Registrar</th><th className="px-unit-md py-unit-sm">Expiry</th><th className="px-unit-md py-unit-sm">Auto-renew</th><th className="px-unit-md py-unit-sm">State</th><th className="px-unit-md py-unit-sm text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/25">
                  {visibleDomains.map((domain) => {
                    const expiry = expiryPresentation(domain.expiresAt);
                    return (
                      <tr key={domain.id} className={`transition-colors hover:bg-surface-container-low/70 ${inspectedId === domain.id ? 'bg-primary/5' : ''}`}>
                        <td className="px-unit-md py-unit-sm"><button type="button" className="text-left font-label-mono text-body-sm font-semibold text-on-surface hover:text-primary" onClick={() => setInspectedId(domain.id)}>{domain.domainName}</button><p className="mt-0.5 max-w-64 truncate text-caption-xs text-secondary">{domain.notes || 'No notes'}</p></td>
                        <td className="px-unit-md py-unit-sm text-body-sm"><ProviderName id={domain.registrarProviderAccountId} labels={providerLabels} /></td>
                        <td className="px-unit-md py-unit-sm"><p className="text-body-sm">{formatDate(domain.expiresAt)}</p><p className={`text-caption-xs font-medium ${expiry.tone}`}>{expiry.label}</p></td>
                        <td className="px-unit-md py-unit-sm text-body-sm">{domain.autoRenew === null ? <span className="text-secondary">Unknown</span> : domain.autoRenew ? 'Enabled' : 'Disabled'}</td>
                        <td className="px-unit-md py-unit-sm"><InventoryState state={domain.inventoryState} /></td>
                        <td className="px-unit-md py-unit-sm">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleLookupWhois(domain.domainName)}>WHOIS</Button>
                            <Link className="inline-flex h-7 items-center px-2.5 text-[11px] font-semibold text-primary" to={`/domains/${domain.id}`}>Details</Link>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(domain)}>Edit</Button>
                            <Button size="sm" variant={domain.inventoryState === 'TRACKED' ? 'ghost' : 'outline'} disabled={pendingId === domain.id} onClick={() => void changeState(domain)}>{domain.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {inspected && (
              <aside className="hidden w-[340px] shrink-0 border-l border-outline-variant/30 p-unit-lg xl:flex xl:flex-col xl:gap-unit-md" aria-label="Domain details inspector">
                <div className="flex items-start justify-between border-b border-outline-variant/25 pb-unit-sm"><div className="min-w-0"><h2 className="truncate font-label-mono text-headline-sm font-semibold">{inspected.domainName}</h2><p className="mt-1 text-caption-xs text-secondary">Stored domain metadata</p></div><Button variant="ghost" size="sm" iconLeading="close" aria-label="Close inspector" onClick={() => setInspectedId(null)} /></div>
                <div className="grid grid-cols-2 gap-unit-xs"><div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs uppercase text-secondary">Expiry</p><p className={`mt-1 font-label-mono text-label-md font-semibold ${expiryPresentation(inspected.expiresAt).tone}`}>{expiryPresentation(inspected.expiresAt).label}</p></div><div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><p className="text-caption-xs uppercase text-secondary">Auto-renew</p><p className="mt-1 text-label-md font-semibold">{inspected.autoRenew === null ? 'Unknown' : inspected.autoRenew ? 'Enabled' : 'Disabled'}</p></div></div>
                <dl className="flex flex-col gap-unit-xs text-caption-xs">
                  <div className="flex justify-between gap-3 border-b border-surface-container py-1">
                    <dt className="text-secondary">Registrar</dt>
                    <dd className="text-right font-semibold"><ProviderName id={inspected.registrarProviderAccountId} labels={providerLabels} /></dd>
                  </div>
                  {inspected.registrarProviderAccountId && (
                    <div className="flex justify-between gap-3 border-b border-surface-container py-0.5">
                      <dt className="text-[10px] uppercase tracking-wider text-secondary">Registrar account ID</dt>
                      <dd className="text-right font-mono text-[10px] text-secondary truncate max-w-44" title={inspected.registrarProviderAccountId}>{inspected.registrarProviderAccountId}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-b border-surface-container py-1">
                    <dt className="text-secondary">DNS provider</dt>
                    <dd className="text-right font-semibold"><ProviderName id={inspected.dnsProviderAccountId} labels={providerLabels} /></dd>
                  </div>
                  {inspected.dnsProviderAccountId && (
                    <div className="flex justify-between gap-3 border-b border-surface-container py-0.5">
                      <dt className="text-[10px] uppercase tracking-wider text-secondary">DNS provider ID</dt>
                      <dd className="text-right font-mono text-[10px] text-secondary truncate max-w-44" title={inspected.dnsProviderAccountId}>{inspected.dnsProviderAccountId}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-b border-surface-container py-1">
                    <dt className="text-secondary">Registered</dt>
                    <dd className="text-right font-semibold">{formatDate(inspected.registeredAt)}</dd>
                  </div>
                  {inspected.registeredAt && (
                    <div className="flex justify-between gap-3 border-b border-surface-container py-0.5">
                      <dt className="text-[10px] uppercase tracking-wider text-secondary">Registered at (ISO)</dt>
                      <dd className="text-right font-mono text-[10px] text-secondary truncate max-w-44">{inspected.registeredAt}</dd>
                    </div>
                  )}
                  {inspected.expiresAt && (
                    <div className="flex justify-between gap-3 border-b border-surface-container py-0.5">
                      <dt className="text-[10px] uppercase tracking-wider text-secondary">Expires at (ISO)</dt>
                      <dd className="text-right font-mono text-[10px] text-secondary truncate max-w-44">{inspected.expiresAt}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-b border-surface-container py-1">
                    <dt className="text-secondary">Provenance</dt>
                    <dd className="text-right font-semibold">{inspected.provenance.split('_').join(' ')}</dd>
                  </div>
                </dl>
                {inspected.notes && <div className="rounded-lg border border-primary/15 bg-primary/5 p-unit-sm"><p className="text-caption-xs font-bold uppercase tracking-wider text-primary">Notes</p><p className="mt-1 whitespace-pre-wrap text-caption-xs leading-relaxed text-on-surface">{inspected.notes}</p></div>}
                <div className="mt-auto flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeading="travel_explore"
                    onClick={() => handleLookupWhois(inspected.domainName)}
                  >
                    Live WHOIS (WhoisFreaks)
                  </Button>
                  <div className="grid grid-cols-2 gap-unit-xs">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(inspected)}>Edit</Button>
                    <Link className="inline-flex h-7 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-on-primary" to={`/domains/${inspected.id}`}>Full details</Link>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        <footer className="flex items-center justify-between gap-unit-md border-t border-outline-variant/30 p-unit-md">
          <p className="text-caption-xs text-secondary">{visibleDomains.length} shown from {list.items.length} loaded records. Workspace totals and server-side search are unavailable.</p>
          {list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}
        </footer>
      </section>

      {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
      {editing && (
        <ResourceFormModal
          config={config}
          record={editing === 'create' || !editing.id ? undefined : editing}
          initialValues={typeof editing === 'object' && !editing.id ? (editing as unknown as Domain) : undefined}
          onClose={() => setEditing(null)}
          onSaved={list.upsert}
        />
      )}

      <WhoisDetailsModal
        isOpen={whoisModalOpen}
        onClose={() => setWhoisModalOpen(false)}
        data={whoisData}
        loading={whoisLoading}
        error={whoisError}
        onRefresh={() => targetDomain && handleLookupWhois(targetDomain)}
        onAddToPortfolio={(domainName, expiresAt) => {
          setWhoisModalOpen(false);
          setEditing({
            domainName,
            normalizedDomainName: domainName.toLowerCase(),
            registrarProviderAccountId: null,
            dnsProviderAccountId: null,
            registeredAt: whoisData?.registeredAt || null,
            expiresAt: expiresAt || whoisData?.expiresAt || null,
            autoRenew: null,
            notes: `Imported via WhoisFreaks WHOIS on ${new Date().toLocaleDateString()}`,
            inventoryState: 'TRACKED',
            provenance: 'USER_ADDED',
          } as unknown as Domain);
        }}
      />
    </div>
  );
};

