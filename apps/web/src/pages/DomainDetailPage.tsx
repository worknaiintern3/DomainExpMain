import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { archiveInventory, getInventory, updateInventory } from '@/api/inventory';
import { getDomainMetadata, refreshDomainMetadata } from '@/api/metadata';
import { getImmediateRelationships } from '@/api/read-models';
import type { Domain, DomainMetadataResponse } from '@/api/types';
import { lookupWhois } from '@/api/whois';
import type { NormalizedWhoisData } from '@/api/whois.types';
import { Button } from '@/components/common/Button';
import { EntityAssociations } from '@/components/integration/EntityAssociations';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { WhoisDetailsModal } from '@/components/whois/WhoisDetailsModal';
import { domainConfiguration } from '@/features/integration/resource-configs';
import { DomainMetadataSection } from '@/features/domain-details/components/DomainMetadataSection';
import { DomainMonitoringSection } from '@/features/monitoring/components/DomainMonitoringSection';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';

const formatDate = (value: string | null, includeTime = false) => value
  ? new Date(value).toLocaleString(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'long' })
  : 'Unknown';

function expiryDetail(value: string | null) {
  if (!value) return { label: 'Expiry not recorded', tone: 'text-secondary' };
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'text-error' };
  if (days === 0) return { label: 'Expires today', tone: 'text-error' };
  return { label: `${days} days remaining`, tone: days <= 30 ? 'text-amber-700' : 'text-on-surface' };
}

export const DomainDetailPage: React.FC = () => {
  const { domainId = '' } = useParams<{ domainId: string }>();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const generationRef = useRef(0);
  const metadataGenerationRef = useRef(0);
  const [metadata, setMetadata] = useState<DomainMetadataResponse | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataNotice, setMetadataNotice] = useState<string | null>(null);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);

  // Live WHOIS state
  const [whoisModalOpen, setWhoisModalOpen] = useState(false);
  const [whoisData, setWhoisData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisError, setWhoisError] = useState<string | null>(null);

  const handleOpenWhois = async () => {
    if (!domain) return;
    setWhoisModalOpen(true);
    setWhoisLoading(true);
    setWhoisError(null);
    try {
      const res = await lookupWhois(domain.domainName, domain.id);
      setWhoisData(res);
    } catch (err) {
      setWhoisError(err instanceof Error ? err.message : 'Failed to lookup WHOIS details');
    } finally {
      setWhoisLoading(false);
    }
  };

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    setDomain(null);
    setLoading(true);
    setError(null);
    setNotFound(false);
    void getInventory('domains', domainId, controller.signal)
      .then((record) => { if (generation === generationRef.current) setDomain(record); })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setNotFound(requestError instanceof ApiError && requestError.status === 404);
        setError(requestError instanceof Error ? requestError.message : 'The domain could not be loaded.');
      })
      .finally(() => { if (generation === generationRef.current) setLoading(false); });
    return () => {
      controller.abort();
      generationRef.current += 1;
    };
  }, [domainId]);

  const loadMetadata = useCallback((signal?: AbortSignal) => {
    const generation = ++metadataGenerationRef.current;
    setMetadata(null);
    setMetadataLoading(true);
    setMetadataError(null);
    setMetadataNotice(null);
    return getDomainMetadata(domainId, signal)
      .then((result) => {
        if (generation === metadataGenerationRef.current) setMetadata(result);
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted || generation !== metadataGenerationRef.current) return;
        setMetadataError(requestError instanceof Error ? requestError.message : 'Retrieved metadata could not be loaded.');
      })
      .finally(() => {
        if (generation === metadataGenerationRef.current) setMetadataLoading(false);
      });
  }, [domainId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadMetadata(controller.signal);
    return () => {
      controller.abort();
      metadataGenerationRef.current += 1;
    };
  }, [loadMetadata]);

  const providerLabels = useProviderLabels([
    domain?.registrarProviderAccountId,
    domain?.dnsProviderAccountId,
  ]);
  const config = useMemo(() => domainConfiguration(providerLabels), [providerLabels]);
  const associationSources = useMemo(() => [{
    context: 'Immediate relationship',
    load: (signal: AbortSignal) => getImmediateRelationships('DOMAIN', domainId, signal),
  }], [domainId]);
  const expiry = expiryDetail(domain?.expiresAt ?? null);

  const changeState = async () => {
    if (!domain || changingState) return;
    setChangingState(true);
    setError(null);
    try {
      if (domain.inventoryState === 'TRACKED') {
        await archiveInventory('domains', domain.id);
        setDomain({ ...domain, inventoryState: 'ARCHIVED' });
      } else {
        setDomain(await updateInventory('domains', domain.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The domain could not be updated.');
    } finally {
      setChangingState(false);
    }
  };

  const refreshMetadata = async () => {
    if (refreshingMetadata || !metadata?.canRefresh) return;
    setRefreshingMetadata(true);
    setMetadataError(null);
    setMetadataNotice(null);
    try {
      const response = await refreshDomainMetadata(domainId);
      setMetadata(response.metadata);
      const incomplete = Object.entries(response.results)
        .filter(([, result]) => result.status !== 'SUCCESS')
        .map(([source, result]) => `${source.toUpperCase()}: ${result.errorCode?.split('_').join(' ').toLowerCase() ?? result.status.toLowerCase()}`);
      setMetadataNotice(incomplete.length > 0
        ? `Refresh completed with source issues. ${incomplete.join('; ')}.`
        : 'Metadata refresh completed.');
    } catch (requestError) {
      setMetadataError(requestError instanceof Error ? requestError.message : 'Metadata could not be refreshed.');
    } finally {
      setRefreshingMetadata(false);
    }
  };

  if (loading) return <StatePanel icon="progress_activity" message="Loading domain…" spinning />;
  if (!domain) return (
    <StatePanel
      icon={notFound ? 'domain_disabled' : 'error'}
      message={notFound ? 'This domain is unavailable in the current workspace.' : (error ?? 'The domain could not be loaded.')}
      action={<Link className="font-semibold text-primary" to="/domains">Back to domains</Link>}
    />
  );

  const registrar = domain.registrarProviderAccountId
    ? providerLabels.get(domain.registrarProviderAccountId) ?? 'Resolving provider…'
    : 'Unknown';
  const dnsProvider = domain.dnsProviderAccountId
    ? providerLabels.get(domain.dnsProviderAccountId) ?? 'Resolving provider…'
    : 'Unknown';

  return (
    <div className="flex w-full flex-col gap-unit-lg">
      <header className="flex flex-col gap-unit-md border-b border-outline-variant/30 pb-unit-lg lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link className="inline-flex items-center gap-1 text-caption-xs font-semibold text-primary hover:underline" to="/domains"><span className="material-symbols-outlined text-[15px]">arrow_back</span>Domain portfolio</Link>
          <div className="mt-unit-sm flex flex-wrap items-center gap-unit-sm"><h1 className="break-all font-label-mono text-headline-lg font-semibold tracking-tight text-on-surface">{domain.domainName}</h1><InventoryState state={domain.inventoryState} /></div>
          <p className="mt-unit-xs text-body-sm text-secondary">Stored domain identity, registration metadata, and immediate workspace relationships.</p>
        </div>
        <div className="flex shrink-0 gap-unit-sm">
          <Button variant="outline" iconLeading="travel_explore" onClick={() => void handleOpenWhois()}>
            Live WHOIS
          </Button>
          <Button iconLeading="edit" onClick={() => setEditing(true)}>Edit metadata</Button>
          <Button variant={domain.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} disabled={changingState} onClick={() => void changeState()}>{changingState ? 'Updating…' : domain.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-error/20 bg-error-container/20 p-unit-sm text-body-sm text-error">{error}</p>}

      <section className="grid grid-cols-1 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Domain highlights">
        {[
          ['event', 'Expiry', formatDate(domain.expiresAt), expiry.label, expiry.tone],
          ['autorenew', 'Auto-renew', domain.autoRenew === null ? 'Unknown' : domain.autoRenew ? 'Enabled' : 'Disabled', 'Stored preference', 'text-on-surface'],
          ['badge', 'Registrar', registrar, domain.registrarProviderAccountId ? 'Provider account' : 'Not mapped', 'text-on-surface'],
          ['history', 'Last updated', formatDate(domain.updatedAt, true), domain.provenance.split('_').join(' '), 'text-on-surface'],
        ].map(([icon, label, value, supporting, tone]) => (
          <div key={String(label)} className="border-b border-outline-variant/25 p-unit-md last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 xl:border-b-0 xl:[&:nth-child(even)]:border-r xl:last:border-r-0">
            <div className="flex items-center gap-unit-xs text-caption-xs uppercase tracking-wider text-secondary"><span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>{label}</div>
            <p className={`mt-unit-xs break-words text-label-lg font-semibold ${tone}`}>{value}</p><p className={`mt-0.5 text-caption-xs ${tone}`}>{supporting}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 items-start gap-unit-lg xl:grid-cols-3">
        <div className="flex flex-col gap-unit-lg xl:col-span-2">
          <EntityAssociations title="Immediate inventory relationships" sources={associationSources} />

          <DomainMetadataSection
            error={metadataError}
            loading={metadataLoading}
            metadata={metadata}
            notice={metadataNotice}
            onRefresh={() => void refreshMetadata()}
            onRetry={() => void loadMetadata()}
            refreshing={refreshingMetadata}
          />

          <DomainMonitoringSection domainId={domainId} inventoryState={domain.inventoryState} />

          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm">
            <div className="mb-unit-md flex items-center justify-between">
              <div className="flex items-center gap-unit-sm">
                <span className="material-symbols-outlined flex size-9 items-center justify-center rounded-lg bg-primary/10 text-[20px] text-primary">assignment</span>
                <div>
                  <h2 className="text-headline-sm font-semibold">Registration metadata</h2>
                  <p className="text-caption-xs text-secondary">Direct values stored on this domain record</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" iconLeading="edit" onClick={() => setEditing(true)}>Edit</Button>
            </div>
            <dl className="grid grid-cols-1 gap-unit-sm md:grid-cols-2">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">Domain name</dt>
                <dd className="mt-1 break-words font-label-mono text-body-sm font-semibold text-on-surface">{domain.domainName}</dd>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">Expires at (ISO)</dt>
                <dd className="mt-1 text-body-sm font-semibold text-on-surface">{formatDate(domain.expiresAt)}</dd>
                <dd className="mt-0.5 font-label-mono text-[11px] text-secondary">{domain.expiresAt || 'Not recorded'}</dd>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">Auto-renew</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-caption-xs font-semibold ${
                    domain.autoRenew === true ? 'bg-success/15 text-success' : domain.autoRenew === false ? 'bg-amber-500/15 text-amber-600' : 'bg-surface-container text-secondary'
                  }`}>
                    {domain.autoRenew === null ? 'Not recorded' : domain.autoRenew ? 'Enabled' : 'Disabled'}
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">Registrar account ID</dt>
                <dd className="mt-1 font-label-mono text-body-sm font-semibold text-on-surface break-all">
                  {domain.registrarProviderAccountId || 'Not recorded'}
                </dd>
                {registrar !== 'Unknown' && <dd className="mt-0.5 text-caption-xs text-secondary">{registrar}</dd>}
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">DNS provider account ID</dt>
                <dd className="mt-1 font-label-mono text-body-sm font-semibold text-on-surface break-all">
                  {domain.dnsProviderAccountId || 'Not recorded'}
                </dd>
                {dnsProvider !== 'Unknown' && <dd className="mt-0.5 text-caption-xs text-secondary">{dnsProvider}</dd>}
              </div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
                <dt className="text-caption-xs uppercase tracking-wider text-secondary">Registered at (ISO)</dt>
                <dd className="mt-1 text-body-sm font-semibold text-on-surface">{formatDate(domain.registeredAt)}</dd>
                <dd className="mt-0.5 font-label-mono text-[11px] text-secondary">{domain.registeredAt || 'Not recorded'}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="flex flex-col gap-unit-lg">
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm">
            <h2 className="text-headline-sm font-semibold">Record lifecycle</h2>
            <dl className="mt-unit-md flex flex-col gap-unit-sm text-body-sm"><div><dt className="text-caption-xs uppercase text-secondary">Created</dt><dd className="mt-1">{formatDate(domain.createdAt, true)}</dd></div><div><dt className="text-caption-xs uppercase text-secondary">Updated</dt><dd className="mt-1">{formatDate(domain.updatedAt, true)}</dd></div><div><dt className="text-caption-xs uppercase text-secondary">Provenance</dt><dd className="mt-1">{domain.provenance.split('_').join(' ')}</dd></div></dl>
          </section>
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm"><h2 className="text-headline-sm font-semibold">Notes</h2><p className="mt-unit-sm whitespace-pre-wrap text-body-sm leading-relaxed text-secondary">{domain.notes || 'No notes have been recorded.'}</p></section>
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-unit-lg"><div className="flex gap-unit-sm"><span className="material-symbols-outlined text-primary">visibility_off</span><div><h2 className="text-label-lg font-semibold">Unavailable telemetry</h2><p className="mt-unit-xs text-caption-xs leading-relaxed text-secondary">Uptime, live health, pricing, renewal cost, traffic, and utilization are not provided by the current API and are intentionally not shown.</p></div></div></section>
        </aside>
      </div>

      {editing && <ResourceFormModal config={config} record={domain} onClose={() => setEditing(false)} onSaved={setDomain} />}

      <WhoisDetailsModal
        isOpen={whoisModalOpen}
        onClose={() => setWhoisModalOpen(false)}
        data={whoisData}
        loading={whoisLoading}
        error={whoisError}
        onRefresh={() => void handleOpenWhois()}
      />
    </div>
  );
};
