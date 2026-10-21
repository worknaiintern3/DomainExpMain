import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getLiveDns,
  getLiveSsl,
  getLiveWhois,
  refreshWhois,
  type LiveDnsData,
  type LiveDnsRecord,
  type LiveSslCertificate,
  type LiveSslData,
  type LiveWhoisData,
} from '@/api/whois';
import { Button } from '@/components/common/Button';

import { formatDateTime } from '@/lib/format';

type LookupTab = 'whois' | 'dns' | 'ssl';

interface LookupState<T> {
  data: T | null;
  error: string | null;
  loadedAt: string | null;
  loading: boolean;
}

const EMPTY_STATE: LookupState<never> = { data: null, error: null, loadedAt: null, loading: false };

const TABS: ReadonlyArray<{ id: LookupTab; icon: string; label: string }> = [
  { id: 'whois', icon: 'assignment', label: 'WHOIS' },
  { id: 'dns', icon: 'dns', label: 'DNS records' },
  { id: 'ssl', icon: 'verified_user', label: 'SSL certificates' },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The live lookup could not be completed.';
}

function formatLookupDate(value: string | null | undefined): string {
  if (!value) return 'Not reported';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDateTime(value, value);
}

function daysRemaining(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / 86_400_000);
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{label}</dt>
      <dd className="mt-1 break-words text-body-sm font-medium text-on-surface">{value}</dd>
    </div>
  );
}

function Values({ empty = 'None reported', values }: { empty?: string; values: readonly string[] }) {
  return values.length > 0
    ? <ul className="space-y-1">{values.map((value) => <li className="break-all font-label-mono text-caption-xs" key={value}>{value}</li>)}</ul>
    : <span className="text-secondary">{empty}</span>;
}

function contactName(contact: LiveWhoisData['registrant']): string {
  if (!contact) return 'Not reported';
  const parts = [contact.name, contact.company, contact.email_address].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Not reported';
}

const WhoisView: React.FC<{ data: LiveWhoisData }> = ({ data }) => {
  const remaining = data.daysRemaining ?? daysRemaining(data.expiresAt);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-caption-xs font-semibold ${data.isRegistered ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
          {data.isRegistered ? 'Registered' : 'Not registered'}
        </span>
        {remaining !== null && (
          <span className={`rounded-full px-3 py-1 text-caption-xs font-semibold ${remaining < 0 ? 'bg-error/10 text-error' : remaining <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-surface-container text-secondary'}`}>
            {remaining < 0 ? `Expired ${Math.abs(remaining)} days ago` : `${remaining} days remaining`}
          </span>
        )}
        {data.savedToDatabase && <span className="rounded-full bg-surface-container px-3 py-1 text-caption-xs text-secondary">Snapshot saved</span>}
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Registrar" value={data.registrar.name ?? 'Not reported'} />
        <Field label="IANA ID" value={data.registrar.ianaId ?? 'Not reported'} />
        <Field label="Registered" value={formatLookupDate(data.registeredAt)} />
        <Field label="Expires" value={formatLookupDate(data.expiresAt)} />
        <Field label="Last updated" value={formatLookupDate(data.updatedDate)} />
        <Field label="Query time" value={formatLookupDate(data.queryTime)} />
        <Field label="Registrant" value={contactName(data.registrant)} />
        <Field label="Technical contact" value={contactName(data.technicalContact)} />
        <Field label="Admin contact" value={contactName(data.administrativeContact)} />
        <Field label="Nameservers" value={<Values values={data.nameservers} />} />
        <Field label="Domain statuses" value={<Values values={data.statuses} />} />
        <Field label="Registrar website" value={data.registrar.websiteUrl ?? 'Not reported'} />
      </dl>
      {data.rawWhois && (
        <details className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
          <summary className="cursor-pointer text-body-sm font-semibold text-on-surface">Raw WHOIS response</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-label-mono text-caption-xs text-secondary">{data.rawWhois}</pre>
        </details>
      )}
    </>
  );
};

function dnsValue(record: LiveDnsRecord): string {
  if (record.rawText) return record.rawText;
  const parts = [
    record.address,
    record.singleName,
    record.exchange,
    record.target,
    record.text,
    record.admin ? `${record.admin}${record.hostmaster ? ` ${record.hostmaster}` : ''}` : null,
    record.priority !== undefined ? `priority ${record.priority}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

const DnsView: React.FC<{ data: LiveDnsData }> = ({ data }) => {
  const records = data.dnsRecords ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, LiveDnsRecord[]>();
    for (const record of records) {
      const type = record.dnsType || 'OTHER';
      const list = map.get(type) ?? [];
      list.push(record);
      map.set(type, list);
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [records]);

  if (records.length === 0) {
    return <p className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-body-sm text-secondary">{data.message || 'No DNS records were returned for this domain.'}</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-caption-xs text-secondary">
        {records.length} records · queried {formatLookupDate(data.queryTime)}
      </p>
      {grouped.map(([type, typeRecords]) => (
        <section className="overflow-hidden rounded-lg border border-outline-variant/30" key={type}>
          <header className="flex items-center justify-between bg-surface-container-low px-3 py-2">
            <h4 className="font-label-mono text-caption-xs font-bold uppercase tracking-wider text-primary">{type}</h4>
            <span className="text-caption-xs text-secondary">{typeRecords.length}</span>
          </header>
          <ul className="divide-y divide-outline-variant/20">
            {typeRecords.map((record, index) => (
              <li className="px-3 py-2" key={`${record.name}:${record.dnsType}:${index}`}>
                <p className="break-all font-label-mono text-caption-xs text-on-surface">{dnsValue(record)}</p>
                <p className="mt-0.5 text-[10px] text-secondary">{record.name}{record.ttl !== undefined ? ` · TTL ${record.ttl}s` : ''}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

function certificateDays(certificate: LiveSslCertificate): number | null {
  return daysRemaining(certificate.validityEndDate);
}

const CertificateCard: React.FC<{ certificate: LiveSslCertificate; index: number }> = ({ certificate, index }) => {
  const remaining = certificateDays(certificate);
  const names = certificate.extensions?.subjectAlternativeNames?.dnsNames ?? [];
  return (
    <article className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          {certificate.chainOrder || `Certificate ${index + 1}`}
        </span>
        <span className="text-body-sm font-semibold text-on-surface">{certificate.subject?.['commonName'] || 'Unknown subject'}</span>
        {remaining !== null && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${remaining < 0 ? 'bg-error/10 text-error' : remaining <= 30 ? 'bg-amber-100 text-amber-800' : 'bg-surface-container text-secondary'}`}>
            {remaining < 0 ? `Expired ${Math.abs(remaining)}d ago` : `${remaining}d remaining`}
          </span>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Issuer" value={[certificate.issuer?.['commonName'], certificate.issuer?.['organization']].filter(Boolean).join(' · ') || 'Not reported'} />
        <Field label="Valid from" value={formatLookupDate(certificate.validityStartDate)} />
        <Field label="Valid until" value={formatLookupDate(certificate.validityEndDate)} />
        <Field label="Authentication" value={certificate.authenticationType ?? 'Not reported'} />
        <Field label="Signature algorithm" value={certificate.signatureAlgorithm ?? 'Not reported'} />
        <Field label="Public key" value={certificate.publicKey ? `${certificate.publicKey.keyAlgorithm ?? 'Key'} ${certificate.publicKey.keySize ?? ''}`.trim() : 'Not reported'} />
        <Field label="Serial number" value={<span className="break-all font-label-mono text-caption-xs">{certificate.serialNumber ?? 'Not reported'}</span>} />
        <Field label="Subject alternative names" value={<Values empty="None reported" values={names} />} />
      </dl>
    </article>
  );
};

const SslView: React.FC<{ data: LiveSslData }> = ({ data }) => {
  const certificates = data.sslCertificates ?? [];
  if (certificates.length === 0) {
    return <p className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-body-sm text-secondary">{data.message || 'No TLS certificates were returned for this domain.'}</p>;
  }
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-caption-xs text-secondary">{certificates.length} certificate{certificates.length === 1 ? '' : 's'} · queried {formatLookupDate(data.queryTime)}</p>
      {certificates.map((certificate, index) => <CertificateCard certificate={certificate} index={index} key={certificate.serialNumber ?? index} />)}
    </div>
  );
};

export const DomainLiveLookupSection: React.FC<{
  domainId: string;
  domainName: string;
}> = ({ domainId, domainName }) => {
  const [tab, setTab] = useState<LookupTab>('whois');
  const [whois, setWhois] = useState<LookupState<LiveWhoisData>>(EMPTY_STATE);
  const [dns, setDns] = useState<LookupState<LiveDnsData>>(EMPTY_STATE);
  const [ssl, setSsl] = useState<LookupState<LiveSslData>>(EMPTY_STATE);

  const load = useCallback(async (which: LookupTab, refresh = false) => {
    if (which === 'whois') setWhois((current) => ({ ...current, error: null, loading: true }));
    else if (which === 'dns') setDns((current) => ({ ...current, error: null, loading: true }));
    else setSsl((current) => ({ ...current, error: null, loading: true }));
    try {
      if (which === 'whois') {
        const data = refresh && domainId ? await refreshWhois(domainId) : await getLiveWhois(domainName, domainId);
        setWhois({ data, error: null, loadedAt: new Date().toISOString(), loading: false });
      } else if (which === 'dns') {
        const data = await getLiveDns(domainName);
        setDns({ data, error: null, loadedAt: new Date().toISOString(), loading: false });
      } else {
        const data = await getLiveSsl(domainName);
        setSsl({ data, error: null, loadedAt: new Date().toISOString(), loading: false });
      }
    } catch (error) {
      const message = errorMessage(error);
      if (which === 'whois') setWhois((current) => ({ ...current, error: message, loading: false }));
      else if (which === 'dns') setDns((current) => ({ ...current, error: message, loading: false }));
      else setSsl((current) => ({ ...current, error: message, loading: false }));
    }
  }, [domainId, domainName]);

  useEffect(() => {
    setWhois(EMPTY_STATE);
    setDns(EMPTY_STATE);
    setSsl(EMPTY_STATE);
    void load('whois');
  }, [load]);

  const selectTab = (next: LookupTab) => {
    setTab(next);
    const current = next === 'whois' ? whois : next === 'dns' ? dns : ssl;
    if (!current.data && !current.loading && !current.error) void load(next);
  };

  const active = tab === 'whois' ? whois : tab === 'dns' ? dns : ssl;
  const loadedAt = active.loadedAt;

  return (
    <section aria-labelledby="domain-live-lookup-title" className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-unit-md shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface" id="domain-live-lookup-title">Live domain lookup</h2>
          <p className="mt-1 text-caption-xs text-secondary">
            On-demand WHOIS, DNS, and TLS queries for {domainName}. These are live provider responses and are not stored monitoring snapshots.
          </p>
        </div>
        <Button disabled={active.loading} iconLeading="refresh" onClick={() => void load(tab, true)} variant="outline">
          {active.loading ? 'Querying…' : 'Refresh lookup'}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-outline-variant/30" role="tablist" aria-label="Live lookup type">
        {TABS.map((item) => (
          <button
            aria-selected={tab === item.id}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-label-md transition-colors ${tab === item.id ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-on-surface'}`}
            key={item.id}
            role="tab"
            type="button"
            onClick={() => selectTab(item.id)}
          >
            <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {active.loading && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 text-body-sm text-secondary" role="status">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Querying {tab === 'whois' ? 'WHOIS' : tab === 'dns' ? 'DNS' : 'TLS'} provider…
        </div>
      )}
      {!active.loading && active.error && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/20 bg-error-container/20 p-3 text-body-sm text-on-error-container" role="alert">
          <span>{active.error}</span>
          <Button onClick={() => void load(tab)} size="sm">Retry</Button>
        </div>
      )}
      {!active.loading && !active.error && active.data && (
        <div className="mt-3">
          {tab === 'whois' && <WhoisView data={whois.data as LiveWhoisData} />}
          {tab === 'dns' && <DnsView data={dns.data as LiveDnsData} />}
          {tab === 'ssl' && <SslView data={ssl.data as LiveSslData} />}
          {loadedAt && <p className="mt-3 text-[10px] text-secondary">Live result received {formatLookupDate(loadedAt)}</p>}
        </div>
      )}
    </section>
  );
};
