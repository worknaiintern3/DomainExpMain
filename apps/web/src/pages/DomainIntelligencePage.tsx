import React, { useEffect, useState } from 'react';

import {
  checkWhoisAvailability,
  getHistoricalWhois,
  getWhoisHistory,
  type HistoricalWhoisData,
  type LiveWhoisData,
  type WhoisAvailabilityItem,
} from '@/api/whois';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { DomainLiveLookupSection } from '@/features/domain-details/components/DomainLiveLookupSection';

const TLDS = ['.com', '.in', '.ai', '.io', '.dev', '.app', '.tech', '.org'];

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The lookup could not be completed.';
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export const DomainIntelligencePage: React.FC = () => {
  const [input, setInput] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [historical, setHistorical] = useState<HistoricalWhoisData | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<WhoisAvailabilityItem[] | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [history, setHistory] = useState<LiveWhoisData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await getWhoisHistory());
    } catch (error) {
      setHistoryError(message(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean || !clean.includes('.')) return;
    setDomain(clean);
    setHistorical(null);
    setHistoricalError(null);
    setAvailability(null);
    setAvailabilityError(null);
  };

  const loadHistorical = async () => {
    if (!domain) return;
    setHistoricalLoading(true);
    setHistoricalError(null);
    try {
      setHistorical(await getHistoricalWhois(domain));
    } catch (error) {
      setHistoricalError(message(error));
    } finally {
      setHistoricalLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!domain) return;
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      setAvailability(await checkWhoisAvailability(domain.split('.')[0] ?? domain, TLDS));
    } catch (error) {
      setAvailabilityError(message(error));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <PageHeader
        badge="LIVE DOMAIN DATA"
        description="Query WHOIS, DNS, SSL, historical registration records, and TLD availability from the existing API. Review and refresh saved workspace lookups below."
        title="Domain Intelligence"
      />

      <section className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-label="Domain lookup">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined">travel_explore</span></span>
          <div><h2 className="text-headline-sm font-semibold text-on-surface">Investigate a domain</h2><p className="text-body-sm text-secondary">Enter a full domain to open its live records and research tools.</p></div>
        </div>
        <form className="mt-unit-lg flex flex-col gap-unit-sm sm:flex-row" onSubmit={submit}>
          <label className="sr-only" htmlFor="intelligence-domain">Domain name</label>
          <input
            className="min-w-0 flex-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 py-2 text-body-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            id="intelligence-domain"
            onChange={(event) => setInput(event.target.value)}
            placeholder="example.com"
            required
            value={input}
          />
          <Button iconLeading="search" type="submit" variant="primary">Look up domain</Button>
        </form>
      </section>

      {domain && (
        <>
          <DomainLiveLookupSection domainId="" domainName={domain} />
          <div className="grid grid-cols-1 gap-unit-lg xl:grid-cols-2">
            <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-labelledby="historical-heading">
              <div className="flex flex-wrap items-center justify-between gap-unit-sm">
                <div><h2 className="text-headline-sm font-semibold text-on-surface" id="historical-heading">Historical WHOIS</h2><p className="text-caption-xs text-secondary">Past registrar and registration snapshots for {domain}.</p></div>
                <Button disabled={historicalLoading} iconLeading="history" onClick={() => void loadHistorical()} size="sm" variant="outline">{historicalLoading ? 'Loading…' : 'Load history'}</Button>
              </div>
              {historicalError && <p className="mt-unit-md text-body-sm text-error" role="alert">{historicalError}</p>}
              {historical && <div className="mt-unit-md flex flex-col gap-unit-sm">
                {(historical.whois_domains_historical ?? []).length === 0 && <p className="text-body-sm text-secondary">{historical.message ?? 'No historical records returned.'}</p>}
                {(historical.whois_domains_historical ?? []).map((record, index) => (
                  <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm" key={`${record.query_time ?? ''}-${index}`}>
                    <p className="text-body-sm font-semibold text-on-surface">{record.domain_registrar?.normalized_name ?? record.domain_registrar?.registrar_name ?? 'Registrar not reported'}</p>
                    <p className="mt-1 text-caption-xs text-secondary">Queried {displayDate(record.query_time)} · Registered {displayDate(record.create_date)} · Expires {displayDate(record.expiry_date)}</p>
                    {record.name_servers?.length ? <p className="mt-1 break-all text-caption-xs text-secondary">Nameservers: {record.name_servers.join(', ')}</p> : null}
                  </div>
                ))}
              </div>}
            </section>

            <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-labelledby="availability-heading">
              <div className="flex flex-wrap items-center justify-between gap-unit-sm">
                <div><h2 className="text-headline-sm font-semibold text-on-surface" id="availability-heading">TLD availability</h2><p className="text-caption-xs text-secondary">Check the name across eight extensions.</p></div>
                <Button disabled={availabilityLoading} iconLeading="check_circle" onClick={() => void loadAvailability()} size="sm" variant="outline">{availabilityLoading ? 'Checking…' : 'Check TLDs'}</Button>
              </div>
              {availabilityError && <p className="mt-unit-md text-body-sm text-error" role="alert">{availabilityError}</p>}
              {availability && <div className="mt-unit-md grid grid-cols-1 gap-unit-xs sm:grid-cols-2">
                {availability.map((item) => <div className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm" key={item.domain}>
                  <span className="truncate text-body-sm font-medium text-on-surface">{item.domain}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption-xs font-semibold ${item.available ? 'bg-healthy-bg text-healthy-text' : 'bg-surface-container text-secondary'}`}>{item.available ? 'Available' : 'Registered'}</span>
                </div>)}
              </div>}
            </section>
          </div>
        </>
      )}

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-labelledby="lookup-history-heading">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-headline-sm font-semibold text-on-surface" id="lookup-history-heading">Workspace lookup history</h2><p className="text-caption-xs text-secondary">Saved WHOIS results from this workspace.</p></div><Button disabled={historyLoading} iconLeading="refresh" onClick={() => void loadHistory()} size="sm" variant="outline">Refresh</Button></div>
        {historyLoading && <p className="mt-unit-md text-body-sm text-secondary" role="status">Loading saved lookups…</p>}
        {historyError && <p className="mt-unit-md text-body-sm text-error" role="alert">{historyError}</p>}
        {!historyLoading && !historyError && history.length === 0 && <p className="mt-unit-md text-body-sm text-secondary">No saved WHOIS lookups yet.</p>}
        {history.length > 0 && <div className="mt-unit-md divide-y divide-outline-variant/30">{history.map((item, index) => <div className="flex flex-wrap items-center justify-between gap-unit-sm py-unit-sm" key={item.id ?? `${item.domainName}-${index}`}>
          <div><p className="text-body-sm font-semibold text-on-surface">{item.domainName}</p><p className="text-caption-xs text-secondary">{item.registrar.name ?? 'Registrar unknown'} · Updated {displayDate(item.retrievedAt)}</p></div>
          <span className="rounded-full bg-surface-container px-2 py-1 text-caption-xs text-secondary">{item.isRegistered ? 'Registered' : 'Unregistered'}</span>
        </div>)}</div>}
      </section>
    </div>
  );
};
