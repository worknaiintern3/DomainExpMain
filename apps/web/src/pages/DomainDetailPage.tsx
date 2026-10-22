import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { archiveInventory, getInventory, updateInventory } from '@/api/inventory';
import { getDomainMetadata, refreshDomainMetadata } from '@/api/metadata';
import { getImmediateRelationships } from '@/api/read-models';
import type { Domain, DomainMetadataResponse, DomainMetadataSource } from '@/api/types';
import { Button } from '@/components/common/Button';
import { EntityAssociations } from '@/components/integration/EntityAssociations';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { domainConfiguration } from '@/features/integration/resource-configs';
import { DomainMetadataSection } from '@/features/domain-details/components/DomainMetadataSection';
import { DomainLiveLookupSection } from '@/features/domain-details/components/DomainLiveLookupSection';
import {
  resolveDomainExpiresAt,
  resolveDomainRegisteredAt,
  resolveDomainRegistrarLabel,
} from '@/features/domain-details/domainRegistrationSummary';
import { DomainMonitoringSection } from '@/features/monitoring/components/DomainMonitoringSection';
import { useProviderLabels } from '@/features/provider-accounts/useProviderLabels';

import { formatDate as formatDateOnly, formatDateTime } from '@/lib/format';
import { expiryTier } from '@/lib/expiry';
import { usePreferences } from '@/preferences/PreferencesContext';
const formatDate = (value: string | null, includeTime = false) =>
  includeTime ? formatDateTime(value, 'Unknown') : formatDateOnly(value, 'Unknown');

function expiryDetail(value: string | null) {
  if (!value) return { label: 'Expiry not recorded', tone: 'text-secondary' };
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { label: `Expired ${Math.abs(days)} days ago`, tone: 'text-error' };
  if (days === 0) return { label: 'Expires today', tone: 'text-error' };
  return { label: `${days} days remaining`, tone: expiryTier(days) !== 'healthy' ? 'text-amber-700' : 'text-on-surface' };
}

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_DURATION_MS = 30_000;

function isTerminalSource(value: { lastAttemptStatus: string } | null | undefined): boolean {
  return value != null && ['SUCCESS', 'PARTIAL', 'FAILED'].includes(value.lastAttemptStatus);
}

function isMetadataTerminal(response: DomainMetadataResponse | null, sources?: readonly DomainMetadataSource[]): boolean {
  if (!response) return false;
  const all: readonly DomainMetadataSource[] = ['rdap', 'dns', 'tls', 'http', 'infra'];
  const wanted = sources && sources.length > 0 ? sources : all;
  return wanted.every((source) => {
    if (source === 'rdap') return isTerminalSource(response.rdap);
    if (source === 'dns') return isTerminalSource(response.dns);
    if (source === 'tls') return isTerminalSource(response.tls);
    if (source === 'http') return isTerminalSource(response.http);
    return isTerminalSource(response.infra);
  });
}

const STALE_METADATA_MS = 24 * 60 * 60 * 1000;
const SOURCE_KEYS: readonly DomainMetadataSource[] = ['rdap', 'dns', 'tls', 'http', 'infra'];

export const DomainDetailPage: React.FC = () => {
  const { domainId = '' } = useParams<{ domainId: string }>();
  const { portfolio, status: preferencesStatus } = usePreferences();
  // Only the sources enabled in Portfolio settings are refreshed by "Refresh metadata" and by auto-refresh.
  const enabledSources = SOURCE_KEYS.filter((source) => portfolio.metadataSources[source]);
  const autoRefreshedRef = useRef<string | null>(null);
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
  const [refreshingSource, setRefreshingSource] = useState<DomainMetadataSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadlineRef = useRef(0);

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

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollMetadata = useCallback((sources?: readonly DomainMetadataSource[]) => {
    // Bounded polling: ~2.5s interval, ~30s max. Reads only (GET), never
    // enqueues new runs, so auto-refresh cannot trigger duplicates.
    stopPolling();
    pollDeadlineRef.current = Date.now() + POLL_MAX_DURATION_MS;
    pollTimerRef.current = setInterval(() => {
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling();
        return;
      }
      void getDomainMetadata(domainId).then((result) => {
        setMetadata(result);
        if (isMetadataTerminal(result, sources)) {
          stopPolling();
          setRefreshingMetadata(false);
          setRefreshingSource(null);
        }
      }).catch(() => {
        // Keep polling on transient read failures until the deadline.
      });
    }, POLL_INTERVAL_MS);
  }, [domainId, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const loadMetadata = useCallback((signal?: AbortSignal) => {
    const generation = ++metadataGenerationRef.current;
    stopPolling();
    setMetadata(null);
    setMetadataLoading(true);
    setMetadataError(null);
    setMetadataNotice(null);
    return getDomainMetadata(domainId, signal)
      .then((result) => {
        if (generation !== metadataGenerationRef.current) return;
        setMetadata(result);
        // Auto-refresh after creation: if enrichment was just queued, the
        // stored snapshots are still pending — poll until terminal or timeout.
        if (!isMetadataTerminal(result)) {
          pollMetadata(undefined);
        }
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted || generation !== metadataGenerationRef.current) return;
        setMetadataError(requestError instanceof Error ? requestError.message : 'Retrieved metadata could not be loaded.');
      })
      .finally(() => {
        if (generation === metadataGenerationRef.current) setMetadataLoading(false);
      });
  }, [domainId, pollMetadata, stopPolling]);

  useEffect(() => {
    const controller = new AbortController();
    void loadMetadata(controller.signal);
    return () => {
      controller.abort();
      metadataGenerationRef.current += 1;
      stopPolling();
    };
  }, [loadMetadata, stopPolling]);

  const providerLabels = useProviderLabels([
    domain?.registrarProviderAccountId,
    domain?.dnsProviderAccountId,
  ]);
  const config = useMemo(() => domainConfiguration(providerLabels), [providerLabels]);
  const associationSources = useMemo(() => [{
    context: 'Immediate relationship',
    load: (signal: AbortSignal) => getImmediateRelationships('DOMAIN', domainId, signal),
  }], [domainId]);
  // Prefer the directly stored domains-table value; fall back to the latest
  // RDAP lookup (already fetched into `metadata` for this page) so enriched
  // domains show real data instead of "Unknown" before anyone edits the record.
  const rdap = metadata?.rdap ?? null;
  const effectiveExpiresAt = resolveDomainExpiresAt(domain, rdap);
  const effectiveRegisteredAt = resolveDomainRegisteredAt(domain, rdap);
  const expiry = expiryDetail(effectiveExpiresAt);

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

  const runRefresh = async (sources?: readonly DomainMetadataSource[]) => {
    if (refreshingMetadata || refreshingSource || !metadata?.canRefresh) return;
    const single = sources && sources.length === 1 ? sources[0] ?? null : null;
    if (single) setRefreshingSource(single);
    else setRefreshingMetadata(true);
    setMetadataError(null);
    setMetadataNotice(null);
    try {
      // Async refresh: enqueue a monitoring/enrichment run and return fast
      // (202). Then poll GET /metadata until the requested sources settle.
      const response = await refreshDomainMetadata(domainId, sources);
      setMetadata(response.metadata);
      setMetadataNotice(`Refresh queued (run ${response.run.id.slice(0, 8)}). Updating results automatically…`);
      pollMetadata(response.requestedSources);
    } catch (requestError) {
      setMetadataError(requestError instanceof Error ? requestError.message : 'Metadata could not be refreshed.');
      setRefreshingMetadata(false);
      setRefreshingSource(null);
      stopPolling();
    }
  };

  const refreshMetadata = async () => {
    await runRefresh(enabledSources.length === SOURCE_KEYS.length ? undefined : enabledSources);
  };

  // "Refresh on open": once per visit, refresh stale or never-fetched metadata
  // for the enabled sources. Manual-only users never trigger this.
  useEffect(() => {
    if (
      preferencesStatus !== 'ready' ||
      portfolio.automaticMetadataRefresh !== 'on-open' ||
      !metadata?.canRefresh ||
      metadataLoading ||
      autoRefreshedRef.current === domainId
    ) {
      return;
    }
    autoRefreshedRef.current = domainId;
    const timestamps = enabledSources.map((source) => {
      const value = metadata[source];
      return value?.retrievedAt ? new Date(value.retrievedAt).getTime() : 0;
    });
    const stale = timestamps.length > 0 && timestamps.some((t) => Date.now() - t > STALE_METADATA_MS);
    if (stale) void refreshMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata, metadataLoading, preferencesStatus, portfolio.automaticMetadataRefresh, domainId]);

  const refreshSource = (source: DomainMetadataSource) => {
    void runRefresh([source]);
  };

  if (loading) return <StatePanel icon="progress_activity" message="Loading domain…" spinning />;
  if (!domain) return (
    <StatePanel
      icon={notFound ? 'domain_disabled' : 'error'}
      message={notFound ? 'This domain is unavailable in the current workspace.' : (error ?? 'The domain could not be loaded.')}
      action={<Link className="font-semibold text-primary" to="/domains">Back to domains</Link>}
    />
  );

  const registrar = resolveDomainRegistrarLabel(
    domain,
    domain.registrarProviderAccountId
      ? providerLabels.get(domain.registrarProviderAccountId)
      : undefined,
    rdap,
  );
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
        <div className="flex shrink-0 gap-unit-sm"><Button iconLeading="edit" onClick={() => setEditing(true)}>Edit metadata</Button><Button variant={domain.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} disabled={changingState} onClick={() => void changeState()}>{changingState ? 'Updating…' : domain.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-error/20 bg-error-container/20 p-unit-sm text-body-sm text-error">{error}</p>}

      <section className="grid grid-cols-1 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm sm:grid-cols-2 xl:grid-cols-4" aria-label="Domain highlights">
        {[
          ['event', 'Expiry', formatDate(effectiveExpiresAt), expiry.label, expiry.tone],
          ['autorenew', 'Auto-renew', domain.autoRenew === null ? 'Unknown' : domain.autoRenew ? 'Enabled' : 'Disabled', 'Stored preference', 'text-on-surface'],
          ['badge', 'Registrar', registrar, domain.registrarProviderAccountId ? 'Provider account' : rdap?.registrarName ? 'RDAP retrieved' : 'Not mapped', 'text-on-surface'],
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
            onRefreshSource={(source) => refreshSource(source)}
            onRetry={() => void loadMetadata()}
            refreshing={refreshingMetadata}
            refreshingSource={refreshingSource}
          />

          <DomainLiveLookupSection domainId={domainId} domainName={domain.domainName} />

          <DomainMonitoringSection domainId={domainId} inventoryState={domain.inventoryState} />

          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm">
            <div className="mb-unit-md flex items-center gap-unit-sm"><span className="material-symbols-outlined flex size-9 items-center justify-center rounded-lg bg-primary/10 text-[20px] text-primary">assignment</span><div><h2 className="text-headline-sm font-semibold">Registration metadata</h2><p className="text-caption-xs text-secondary">Stored domain record values, falling back to the latest RDAP lookup when unset</p></div></div>
            <dl className="grid grid-cols-1 gap-unit-sm md:grid-cols-2">
              {[
                ['Domain name', domain.domainName],
                ['Registered at', formatDate(effectiveRegisteredAt)],
                ['Expires at', formatDate(effectiveExpiresAt)],
                ['Auto-renew', domain.autoRenew === null ? 'Unknown' : domain.autoRenew ? 'Enabled' : 'Disabled'],
                ['Registrar account', registrar],
                ['DNS provider account', dnsProvider],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs uppercase tracking-wider text-secondary">{label}</dt><dd className="mt-1 break-words text-body-sm font-semibold text-on-surface">{value}</dd></div>)}
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
    </div>
  );
};
