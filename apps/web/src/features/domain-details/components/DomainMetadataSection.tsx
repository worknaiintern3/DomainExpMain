import React from 'react';

import type {
  DomainDnsMetadata,
  DomainHttpMetadata,
  DomainInfraMetadata,
  DomainMetadataAttempt,
  DomainMetadataResponse,
  DomainMetadataSource,
  DomainRdapMetadata,
  DomainTlsMetadata,
} from '@/api/types';
import { Button } from '@/components/common/Button';

import { formatDateTime } from '@/lib/format';
function formatDate(value: string | null): string {
  return formatDateTime(value, 'Not reported');
}

function humanizeCode(value: string): string {
  return value.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
}

export function metadataAttemptMessage(metadata: DomainMetadataAttempt | null): string {
  if (!metadata) return 'Not checked yet';
  if (metadata.lastAttemptStatus === 'FAILED' && metadata.retrievedAt) {
    return `Latest refresh failed. Showing data retrieved on ${formatDate(metadata.retrievedAt)}.`;
  }
  if (metadata.lastAttemptStatus === 'FAILED') {
    return 'Latest refresh failed. No retrieved snapshot is available.';
  }
  if (metadata.lastAttemptStatus === 'PARTIAL') {
    return `Partial result retrieved on ${formatDate(metadata.retrievedAt)}.`;
  }
  return `Retrieved on ${formatDate(metadata.retrievedAt)}.`;
}

type SourceState = 'pending' | 'fetching' | 'completed' | 'partial' | 'failed';

function sourceState(metadata: DomainMetadataAttempt | null, loading: boolean): SourceState {
  if (!metadata) return loading ? 'fetching' : 'pending';
  if (metadata.lastAttemptStatus === 'SUCCESS') return 'completed';
  if (metadata.lastAttemptStatus === 'PARTIAL') return 'partial';
  return 'failed';
}

function stateIcon(state: SourceState): string {
  switch (state) {
    case 'completed': return '✓';
    case 'partial': return '✓';
    case 'fetching': return '⟳';
    case 'failed': return '✕';
    default: return '○';
  }
}

const SOURCE_LABELS: Readonly<Record<DomainMetadataSource, string>> = {
  dns: 'DNS',
  http: 'Website',
  infra: 'Infrastructure',
  rdap: 'Registration',
  tls: 'SSL/TLS',
};

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
    <dt className="text-[10px] font-semibold uppercase tracking-wider text-secondary">{label}</dt>
    <dd className="mt-1 break-words text-body-sm font-medium text-on-surface">{value}</dd>
  </div>
);

const Values: React.FC<{ empty?: string; values: readonly string[] }> = ({ empty = 'None reported', values }) => (
  values.length > 0
    ? <ul className="space-y-1">{values.map((value) => <li className="break-all font-label-mono text-caption-xs" key={value}>{value}</li>)}</ul>
    : <span className="text-secondary">{empty}</span>
);

const AttemptBanner: React.FC<{ metadata: DomainMetadataAttempt | null }> = ({ metadata }) => {
  const stale = metadata?.lastAttemptStatus === 'FAILED' && metadata.retrievedAt !== null;
  const tone = metadata?.lastAttemptStatus === 'FAILED'
    ? 'border-error/20 bg-error-container/20 text-on-error-container'
    : metadata?.lastAttemptStatus === 'PARTIAL'
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : 'border-outline-variant/30 bg-surface-container-low text-secondary';
  return (
    <div className={`rounded-lg border px-3 py-2 text-caption-xs ${tone}`}>
      <p className="font-medium">{metadataAttemptMessage(metadata)}</p>
      {metadata?.lastErrorCode && (
        <p className="mt-1">{stale ? 'Latest attempt: ' : ''}{humanizeCode(metadata.lastErrorCode)}</p>
      )}
    </div>
  );
};

const MetadataCard: React.FC<React.PropsWithChildren<{
  icon: string;
  metadata: DomainMetadataAttempt | null;
  onRetrySource?: () => void;
  retrying?: boolean;
  source: DomainMetadataSource;
  title: string;
}>> = ({ children, icon, metadata, onRetrySource, retrying, source, title }) => (
  <article className="flex min-w-0 flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-md shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="material-symbols-outlined flex size-8 items-center justify-center rounded-lg bg-primary/10 text-[18px] text-primary">{icon}</span>
        <h3 className="text-label-lg font-semibold text-on-surface">{title}</h3>
      </div>
      {metadata?.lastAttemptStatus === 'FAILED' && onRetrySource && (
        <Button disabled={retrying} onClick={onRetrySource} size="sm" variant="outline">
          {retrying ? 'Retrying…' : `Retry ${SOURCE_LABELS[source]}`}
        </Button>
      )}
    </div>
    <div className="mt-3"><AttemptBanner metadata={metadata} /></div>
    {metadata && <dl className="mt-3 grid grid-cols-1 gap-2">{children}</dl>}
  </article>
);

function delegationLabel(value: boolean | null): string {
  return value === true
    ? 'Delegation signed'
    : value === false ? 'Delegation not reported as signed' : 'Not reported';
}

const RdapCard: React.FC<{
  metadata: DomainRdapMetadata | null;
  onRetrySource?: () => void;
  retrying?: boolean;
}> = ({ metadata, onRetrySource, retrying }) => (
  <MetadataCard icon="assignment" metadata={metadata} onRetrySource={onRetrySource} retrying={retrying} source="rdap" title="RDAP / Registration">
    {metadata && (
      <>
        <Field label="Registrar" value={metadata.registrarName ?? 'Not reported'} />
        <Field label="IANA registrar ID" value={metadata.registrarIanaId ?? 'Not reported'} />
        <Field label="Registry domain ID" value={metadata.registryDomainId ?? 'Not reported'} />
        <Field label="Registered" value={formatDate(metadata.registeredAt)} />
        <Field label="Expires" value={formatDate(metadata.expiresAt)} />
        <Field label="Last changed" value={formatDate(metadata.changedAt)} />
        <Field label="Domain statuses" value={<Values values={metadata.statuses} />} />
        <Field label="Nameservers" value={<Values values={metadata.nameservers} />} />
        <Field label="Registration events" value={
          metadata.events.length > 0
            ? <ul className="space-y-1">{metadata.events.map((event) => <li key={`${event.action}:${event.date}`} className="text-caption-xs">{event.action} · {formatDate(event.date)}</li>)}</ul>
            : <span className="text-secondary">None reported</span>
        } />
        <Field label="Abuse contact emails" value={<Values empty="Unavailable" values={metadata.abuseEmails} />} />
        <Field label="Abuse contact phones" value={<Values empty="Unavailable" values={metadata.abusePhones} />} />
        <Field label="DNS delegation signal" value={delegationLabel(metadata.secureDnsDelegationSigned)} />
      </>
    )}
  </MetadataCard>
);

const DnsCard: React.FC<{
  metadata: DomainDnsMetadata | null;
  onRetrySource?: () => void;
  retrying?: boolean;
}> = ({ metadata, onRetrySource, retrying }) => {
  const recordErrors = metadata ? Object.entries(metadata.recordErrors) : [];
  return (
    <MetadataCard icon="dns" metadata={metadata} onRetrySource={onRetrySource} retrying={retrying} source="dns" title="DNS">
      {metadata && (
        <>
          <Field label="A" value={<Values values={metadata.aRecords} />} />
          <Field label="AAAA" value={<Values values={metadata.aaaaRecords} />} />
          <Field label="CNAME" value={<Values values={metadata.cnameRecords} />} />
          <Field label="MX" value={<Values values={metadata.mxRecords.map(({ exchange, priority }) => `${priority} ${exchange}`)} />} />
          <Field label="NS" value={<Values values={metadata.nsRecords} />} />
          <Field label="CAA" value={<Values values={metadata.caaRecords} />} />
          <Field label="SOA" value={metadata.soaRecord ? `${metadata.soaRecord.mname} · serial ${metadata.soaRecord.serial}` : 'Not reported'} />
          <Field label="SRV" value={<Values values={metadata.srvRecords.map(({ name, port, priority, target, weight }) => `${name} ${priority} ${weight} ${port} ${target}`)} />} />
          <Field label="DS records retrieved" value={<Values values={metadata.dsRecords.map(({ algorithm, digest, digestType, keyTag }) => `${keyTag} ${algorithm} ${digestType} ${digest}`)} />} />
          <Field label="DNSKEY records retrieved" value={<Values values={metadata.dnskeyRecords.map(({ algorithm, flags }) => `flags ${flags} · alg ${algorithm}`)} />} />
          <Field label="RRSIG records retrieved" value={<Values values={metadata.rrsigRecords.map(({ keyTag, signerName, typeCovered }) => `${typeCovered} · ${signerName} · key ${keyTag}`)} />} />
          <Field label="TXT" value={`${metadata.txtRecordCount} TXT ${metadata.txtRecordCount === 1 ? 'record' : 'records'} detected`} />
          {recordErrors.length > 0 && (
            <Field label="Partial lookup details" value={<ul>{recordErrors.map(([type, code]) => <li key={type}>{type}: {humanizeCode(code)}</li>)}</ul>} />
          )}
        </>
      )}
    </MetadataCard>
  );
};

function certificateValidity(metadata: DomainTlsMetadata): string {
  if (!metadata.validTo) return 'Validity not reported';
  const validTo = new Date(metadata.validTo);
  if (Number.isNaN(validTo.getTime())) return 'Validity not reported';
  const remainingDays = Math.ceil((validTo.getTime() - Date.now()) / 86_400_000);
  if (remainingDays < 0) return `Expired on ${formatDate(metadata.validTo)}`;
  if (remainingDays <= 30) return `Expires soon · ${formatDate(metadata.validTo)}`;
  return `Valid until ${formatDate(metadata.validTo)}`;
}

function tlsDaysRemaining(validTo: string | null): string {
  if (!validTo) return 'Not reported';
  const date = new Date(validTo);
  if (Number.isNaN(date.getTime())) return 'Not reported';
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  return days < 0 ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`;
}

const TlsCard: React.FC<{
  metadata: DomainTlsMetadata | null;
  onRetrySource?: () => void;
  retrying?: boolean;
}> = ({ metadata, onRetrySource, retrying }) => (
  <MetadataCard icon="verified_user" metadata={metadata} onRetrySource={onRetrySource} retrying={retrying} source="tls" title="TLS / Certificate">
    {metadata && (
      <>
        <Field label="Certificate validity" value={certificateValidity(metadata)} />
        <Field label="Certificate status" value={metadata.certificateStatus ?? 'Not reported'} />
        <Field label="Subject" value={metadata.subjectCommonName ?? 'Not reported'} />
        <Field label="Issuer" value={metadata.issuerCommonName ?? 'Not reported'} />
        <Field label="Issuer organization" value={metadata.issuerOrganization ?? 'Not reported'} />
        <Field label="Subject alternative names" value={<Values values={metadata.subjectAltNames} />} />
        <Field label="Valid from" value={formatDate(metadata.validFrom)} />
        <Field label="Valid until" value={formatDate(metadata.validTo)} />
        <Field label="Days remaining" value={tlsDaysRemaining(metadata.validTo)} />
        <Field label="TLS version" value={metadata.tlsVersion ?? 'Not reported'} />
        <Field label="Key algorithm" value={metadata.keyAlgorithm ?? 'Not reported'} />
        <Field label="Signature algorithm" value={metadata.signatureAlgorithm ?? 'Not reported'} />
        <Field label="Serial number" value={metadata.serialNumber ?? 'Not reported'} />
        <Field label="SHA-256 fingerprint" value={<span className="break-all font-label-mono text-caption-xs">{metadata.fingerprint256 ?? 'Not reported'}</span>} />
        <Field label="Chain" value={
          metadata.chain.length > 0
            ? <ul className="space-y-1">{metadata.chain.map((entry, index) => <li key={index} className="text-caption-xs">{entry.subject ?? 'Unknown subject'} · issued by {entry.issuer ?? 'unknown issuer'}</li>)}</ul>
            : <span className="text-secondary">None reported</span>
        } />
      </>
    )}
  </MetadataCard>
);

const HttpCard: React.FC<{
  metadata: DomainHttpMetadata | null;
  onRetrySource?: () => void;
  retrying?: boolean;
}> = ({ metadata, onRetrySource, retrying }) => (
  <MetadataCard icon="language" metadata={metadata} onRetrySource={onRetrySource} retrying={retrying} source="http" title="Website">
    {metadata && (
      <>
        <Field label="Reachable" value={metadata.reachable === null ? 'Not reported' : metadata.reachable ? 'Reachable' : 'Unreachable'} />
        <Field label="HTTP status" value={metadata.httpStatus === null ? 'Not reported' : String(metadata.httpStatus)} />
        <Field label="Final URL" value={metadata.finalUrl ?? 'Not reported'} />
        <Field label="Redirect chain" value={
          metadata.redirectChain.length > 0
            ? <ul className="space-y-1">{metadata.redirectChain.map((entry) => <li key={entry.url} className="break-all text-caption-xs">{entry.status ?? '—'} · {entry.url}</li>)}</ul>
            : <span className="text-secondary">No redirects</span>
        } />
        <Field label="Response time" value={metadata.responseTimeMs === null ? 'Not reported' : `${metadata.responseTimeMs} ms`} />
        <Field label="Page title" value={metadata.pageTitle ?? 'Not reported'} />
        <Field label="Content type" value={metadata.contentType ?? 'Not reported'} />
        <Field label="Server header" value={metadata.serverHeader ?? 'Not reported'} />
        <Field label="HSTS" value={metadata.hstsEnabled === null ? 'Not reported' : metadata.hstsEnabled ? 'Enabled' : 'Not enabled'} />
        <Field label="Security headers" value={
          Object.keys(metadata.securityHeaders).length > 0
            ? <ul className="space-y-1">{Object.entries(metadata.securityHeaders).map(([name, value]) => <li key={name} className="break-all text-caption-xs">{name}: {value.slice(0, 120)}</li>)}</ul>
            : <span className="text-secondary">None reported</span>
        } />
      </>
    )}
  </MetadataCard>
);

const InfraCard: React.FC<{
  metadata: DomainInfraMetadata | null;
  onRetrySource?: () => void;
  retrying?: boolean;
}> = ({ metadata, onRetrySource, retrying }) => (
  <MetadataCard icon="hub" metadata={metadata} onRetrySource={onRetrySource} retrying={retrying} source="infra" title="Infrastructure">
    {metadata && (
      <>
        <Field label="IP addresses" value={<Values values={metadata.ipAddresses} />} />
        <Field label="Reverse DNS" value={<Values empty="Unavailable" values={metadata.reverseDns} />} />
        <Field label="ASN" value={metadata.asn === null ? 'Unavailable' : String(metadata.asn)} />
        <Field label="Network" value={metadata.network ?? 'Unavailable'} />
        <Field label="Organization" value={metadata.organization ?? 'Unavailable'} />
        <Field label="Country" value={metadata.country ?? 'Unavailable'} />
        <Field label="Region" value={metadata.region ?? 'Unavailable'} />
        <Field label="CDN / proxy" value={metadata.cdnProxy ?? 'Unavailable'} />
      </>
    )}
  </MetadataCard>
);

const EnrichmentProgress: React.FC<{
  loading: boolean;
  metadata: DomainMetadataResponse;
}> = ({ loading, metadata }) => {
  const states: ReadonlyArray<{ key: DomainMetadataSource; state: SourceState }> = [
    { key: 'rdap', state: sourceState(metadata.rdap, loading) },
    { key: 'dns', state: sourceState(metadata.dns, loading) },
    { key: 'tls', state: sourceState(metadata.tls, loading) },
    { key: 'http', state: sourceState(metadata.http, loading) },
    { key: 'infra', state: sourceState(metadata.infra, loading) },
  ];
  const fetching = states.some(({ state }) => state === 'fetching');
  return (
    <div className="mt-4 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3" role="status">
      <p className="text-body-sm font-medium text-on-surface">
        {fetching ? 'Fetching domain intelligence...' : 'Domain intelligence'}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-secondary">
        {states.map(({ key, state }) => (
          <li key={key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">{stateIcon(state)}</span>
            <span>{SOURCE_LABELS[key]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const DomainMetadataSection: React.FC<{
  error: string | null;
  loading: boolean;
  metadata: DomainMetadataResponse | null;
  notice: string | null;
  onRefresh(): void;
  onRefreshSource?(source: DomainMetadataSource): void;
  onRetry(): void;
  refreshing: boolean;
  refreshingSource?: DomainMetadataSource | null;
}> = ({ error, loading, metadata, notice, onRefresh, onRefreshSource, onRetry, refreshing, refreshingSource }) => (
  <section aria-labelledby="domain-metadata-title" className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-unit-md shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-headline-sm font-semibold text-on-surface" id="domain-metadata-title">Retrieved domain metadata</h2>
        <p className="mt-1 text-caption-xs text-secondary">Latest stored registration, DNS, certificate, website, and infrastructure snapshots. Manual retrieval only; this is not live monitoring.</p>
      </div>
      {metadata?.canRefresh ? (
        <Button disabled={refreshing} iconLeading="refresh" onClick={onRefresh} variant="primary">
          {refreshing ? 'Refreshing metadata...' : 'Refresh metadata'}
        </Button>
      ) : metadata ? (
        <span className="rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 py-1.5 text-caption-xs font-medium text-secondary">Read-only access</span>
      ) : null}
    </div>

    {loading && (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 text-body-sm text-secondary" role="status">
        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Loading retrieved metadata...
      </div>
    )}
    {error && (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/20 bg-error-container/20 p-3 text-body-sm text-on-error-container" role="alert">
        <span>{error}</span><Button onClick={onRetry} size="sm">Retry</Button>
      </div>
    )}
    {notice && <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-body-sm text-amber-900" role="status">{notice}</p>}
    {!loading && metadata && (
      <>
        <EnrichmentProgress loading={loading} metadata={metadata} />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <RdapCard metadata={metadata.rdap} onRetrySource={onRefreshSource ? () => onRefreshSource('rdap') : undefined} retrying={refreshingSource === 'rdap'} />
          <DnsCard metadata={metadata.dns} onRetrySource={onRefreshSource ? () => onRefreshSource('dns') : undefined} retrying={refreshingSource === 'dns'} />
          <TlsCard metadata={metadata.tls} onRetrySource={onRefreshSource ? () => onRefreshSource('tls') : undefined} retrying={refreshingSource === 'tls'} />
          <HttpCard metadata={metadata.http} onRetrySource={onRefreshSource ? () => onRefreshSource('http') : undefined} retrying={refreshingSource === 'http'} />
          <InfraCard metadata={metadata.infra} onRetrySource={onRefreshSource ? () => onRefreshSource('infra') : undefined} retrying={refreshingSource === 'infra'} />
        </div>
      </>
    )}
  </section>
);
