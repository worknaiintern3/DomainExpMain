import React from 'react';

import type {
  DomainDnsMetadata,
  DomainMetadataAttempt,
  DomainMetadataResponse,
  DomainRdapMetadata,
  DomainTlsMetadata,
} from '@/api/types';
import { Button } from '@/components/common/Button';

function formatDate(value: string | null): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not reported'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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
  title: string;
}>> = ({ children, icon, metadata, title }) => (
  <article className="flex min-w-0 flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-md shadow-sm">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="material-symbols-outlined flex size-8 items-center justify-center rounded-lg bg-primary/10 text-[18px] text-primary">{icon}</span>
      <h3 className="text-label-lg font-semibold text-on-surface">{title}</h3>
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

const RdapCard: React.FC<{ metadata: DomainRdapMetadata | null }> = ({ metadata }) => (
  <MetadataCard icon="assignment" metadata={metadata} title="RDAP / Registration">
    {metadata && (
      <>
        <Field label="Registrar" value={metadata.registrarName ?? 'Not reported'} />
        <Field label="IANA registrar ID" value={metadata.registrarIanaId ?? 'Not reported'} />
        <Field label="Registered" value={formatDate(metadata.registeredAt)} />
        <Field label="Expires" value={formatDate(metadata.expiresAt)} />
        <Field label="Last changed" value={formatDate(metadata.changedAt)} />
        <Field label="Domain statuses" value={<Values values={metadata.statuses} />} />
        <Field label="Nameservers" value={<Values values={metadata.nameservers} />} />
        <Field label="DNS delegation signal" value={delegationLabel(metadata.secureDnsDelegationSigned)} />
      </>
    )}
  </MetadataCard>
);

const DnsCard: React.FC<{ metadata: DomainDnsMetadata | null }> = ({ metadata }) => {
  const recordErrors = metadata ? Object.entries(metadata.recordErrors) : [];
  return (
    <MetadataCard icon="dns" metadata={metadata} title="DNS">
      {metadata && (
        <>
          <Field label="A" value={<Values values={metadata.aRecords} />} />
          <Field label="AAAA" value={<Values values={metadata.aaaaRecords} />} />
          <Field label="CNAME" value={<Values values={metadata.cnameRecords} />} />
          <Field label="MX" value={<Values values={metadata.mxRecords.map(({ exchange, priority }) => `${priority} ${exchange}`)} />} />
          <Field label="NS" value={<Values values={metadata.nsRecords} />} />
          <Field label="DS records retrieved" value={<Values values={metadata.dsRecords.map(({ algorithm, digest, digestType, keyTag }) => `${keyTag} ${algorithm} ${digestType} ${digest}`)} />} />
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

const TlsCard: React.FC<{ metadata: DomainTlsMetadata | null }> = ({ metadata }) => (
  <MetadataCard icon="verified_user" metadata={metadata} title="TLS / Certificate">
    {metadata && (
      <>
        <Field label="Certificate validity" value={certificateValidity(metadata)} />
        <Field label="Subject" value={metadata.subjectCommonName ?? 'Not reported'} />
        <Field label="Issuer" value={metadata.issuerCommonName ?? 'Not reported'} />
        <Field label="Issuer organization" value={metadata.issuerOrganization ?? 'Not reported'} />
        <Field label="Subject alternative names" value={<Values values={metadata.subjectAltNames} />} />
        <Field label="Valid from" value={formatDate(metadata.validFrom)} />
        <Field label="Valid until" value={formatDate(metadata.validTo)} />
        <Field label="Serial number" value={metadata.serialNumber ?? 'Not reported'} />
        <Field label="SHA-256 fingerprint" value={<span className="break-all font-label-mono text-caption-xs">{metadata.fingerprint256 ?? 'Not reported'}</span>} />
      </>
    )}
  </MetadataCard>
);

export const DomainMetadataSection: React.FC<{
  error: string | null;
  loading: boolean;
  metadata: DomainMetadataResponse | null;
  notice: string | null;
  onRefresh(): void;
  onRetry(): void;
  refreshing: boolean;
}> = ({ error, loading, metadata, notice, onRefresh, onRetry, refreshing }) => (
  <section aria-labelledby="domain-metadata-title" className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-unit-md shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-headline-sm font-semibold text-on-surface" id="domain-metadata-title">Retrieved domain metadata</h2>
        <p className="mt-1 text-caption-xs text-secondary">Latest stored RDAP, DNS, and certificate snapshots. Manual retrieval only; this is not live monitoring.</p>
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
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RdapCard metadata={metadata.rdap} />
        <DnsCard metadata={metadata.dns} />
        <TlsCard metadata={metadata.tls} />
      </div>
    )}
  </section>
);
