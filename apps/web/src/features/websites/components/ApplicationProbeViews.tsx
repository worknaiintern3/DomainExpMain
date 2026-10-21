import React from 'react';

import { Button } from '@/components/common/Button';

import {
  PROBE_TONE_CLASSES,
  formatLatency,
  probeHeadline,
  probeSslSummary,
  type ProbeTone,
} from '../applicationProbe';
import type { ProbeEntry } from '../useApplicationProbe';

import { formatDate as formatDateOnly, formatDateTime } from '@/lib/format';
const Chip: React.FC<{ children: React.ReactNode; icon?: string; spinning?: boolean; title?: string; tone: ProbeTone }> = ({
  children,
  icon,
  spinning,
  title,
  tone,
}) => (
  <span
    className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${PROBE_TONE_CLASSES[tone]}`}
    title={title}
  >
    {icon && <span className={`material-symbols-outlined text-[13px] leading-none ${spinning ? 'animate-spin' : ''}`}>{icon}</span>}
    <span className="truncate">{children}</span>
  </span>
);

/** Compact outcome shown under a record's URL in the table. */
export const ApplicationProbeInline: React.FC<{ entry: ProbeEntry | undefined }> = ({ entry }) => {
  if (!entry) return null;
  if (entry.state === 'loading') {
    return <div className="mt-1"><Chip icon="progress_activity" spinning tone="neutral">Probing…</Chip></div>;
  }
  if (entry.state === 'failed') {
    return <div className="mt-1"><Chip icon="error" title={entry.message} tone="error">{entry.message}</Chip></div>;
  }
  const headline = probeHeadline(entry.result);
  const ssl = probeSslSummary(entry.result.ssl);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Chip icon={headline.tone === 'ok' ? 'check_circle' : headline.tone === 'warn' ? 'warning' : 'cancel'} tone={headline.tone}>
        {headline.label}{headline.detail ? ` · ${headline.detail}` : ''}
      </Chip>
      <Chip icon={ssl.tone === 'ok' ? 'lock' : 'lock_open'} tone={ssl.tone}>{ssl.label}</Chip>
    </div>
  );
};

const formatDate = (iso: string | null): string => formatDateOnly(iso);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ children, label }) => (
  <div>
    <dt className="text-caption-xs uppercase text-secondary">{label}</dt>
    <dd className="mt-1 break-words text-body-sm text-on-surface">{children}</dd>
  </div>
);

/** Full probe section for the selected-record inspector. */
export const ApplicationProbeDetails: React.FC<{
  entry: ProbeEntry | undefined;
  onProbe: () => void;
  url: string | null;
}> = ({ entry, onProbe, url }) => {
  const loading = entry?.state === 'loading';
  return (
    <section aria-label="Live probe" className="mt-unit-lg border-t border-outline-variant/30 pt-unit-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Live probe</p>
        <Button disabled={!url || loading} iconLeading="network_check" onClick={onProbe} size="sm">
          {loading ? 'Probing…' : entry ? 'Probe again' : 'Probe now'}
        </Button>
      </div>
      {!url && <p className="mt-2 text-caption-xs text-secondary">Set a primary URL to run a probe.</p>}
      {entry?.state === 'failed' && <p role="alert" className="mt-2 text-body-sm text-error">{entry.message}</p>}
      {entry?.state === 'done' && <ApplicationProbeResultList result={entry.result} />}
      <p className="mt-3 text-caption-xs text-secondary">
        One request from the DomainPulse server to a public http(s) URL. Nothing is stored and private or internal addresses are never contacted.
      </p>
    </section>
  );
};

const ApplicationProbeResultList: React.FC<{ result: Extract<ProbeEntry, { state: 'done' }>['result'] }> = ({ result }) => {
  const headline = probeHeadline(result);
  const ssl = probeSslSummary(result.ssl);
  return (
    <dl className="mt-3 space-y-unit-sm">
      <Row label="Status">
        <span className="inline-flex flex-wrap items-center gap-1">
          <Chip tone={headline.tone}>{headline.label}</Chip>
          {result.redirectCount > 0 && <span className="text-caption-xs text-secondary">after {result.redirectCount} redirect{result.redirectCount === 1 ? '' : 's'}</span>}
        </span>
      </Row>
      <Row label="Response time">{formatLatency(result.latencyMs) ?? '—'}</Row>
      <Row label="Page title">{result.title ?? '—'}</Row>
      <Row label="Certificate">
        <span className="inline-flex flex-wrap items-center gap-1"><Chip tone={ssl.tone}>{ssl.label}</Chip></span>
        {result.ssl.valid === true && (
          <span className="mt-1 block text-caption-xs text-secondary">
            {[result.ssl.issuer, result.ssl.protocol, result.ssl.validTo ? `expires ${formatDate(result.ssl.validTo)}` : null].filter(Boolean).join(' · ')}
          </span>
        )}
      </Row>
      <Row label="Checked">{formatDateTime(result.checkedAt)}</Row>
    </dl>
  );
};
