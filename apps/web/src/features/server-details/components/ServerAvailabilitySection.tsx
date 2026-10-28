import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  getServerAvailability,
  listServerAvailabilityRuns,
  postServerAvailabilityRun,
  putServerAvailability,
  type AvailabilityAddressSource,
  type ServerAvailabilityRun,
  type ServerAvailabilityTargetApiResponse,
} from '@/api/server-availability';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  failureLabel,
  formatAvailabilityDate,
  formatLatency,
  observedStatus,
  runStatusLabel,
  statusVariant,
} from '../serverAvailability.present';

interface Props {
  serverId: string;
  inventoryState: 'TRACKED' | 'ARCHIVED';
  primaryIp: string | null;
  hostname: string | null;
}

const PAGE_SIZE = 10;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 404) {
    return 'Network availability monitoring is not available on this backend.';
  }
  return error instanceof ApiError ? error.detail : error instanceof Error ? error.message : fallback;
}

export const ServerAvailabilitySection: React.FC<Props> = ({ serverId, inventoryState, primaryIp, hostname }) => {
  const [response, setResponse] = useState<ServerAvailabilityTargetApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [interval, setInterval] = useState('5');
  const [addressSource, setAddressSource] = useState<AvailabilityAddressSource>('PRIMARY_IP');
  const [port, setPort] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [writeForbidden, setWriteForbidden] = useState(false);
  const [manualPending, setManualPending] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ServerAvailabilityRun[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const targetGeneration = useRef(0);
  const runsGeneration = useRef(0);
  const targetController = useRef<AbortController | null>(null);
  const runsController = useRef<AbortController | null>(null);
  const loadMoreFlight = useRef(false);

  const loadRuns = useCallback(async (cursor: string | null = null, append = false) => {
    if (append && loadMoreFlight.current) return;
    if (append) loadMoreFlight.current = true;
    const generation = ++runsGeneration.current;
    runsController.current?.abort();
    const controller = new AbortController();
    runsController.current = controller;
    if (append) {
      setLoadingMore(true);
      setLoadMoreError(null);
    } else {
      setRunsLoading(true);
      setRunsError(null);
    }
    try {
      const page = await listServerAvailabilityRuns(serverId, { cursor: cursor ?? undefined, limit: PAGE_SIZE }, controller.signal);
      if (generation !== runsGeneration.current || controller.signal.aborted) return;
      if (append) {
        setRuns((previous) => {
          const unique = new Map(previous.map((run) => [run.id, run]));
          for (const run of page.items) unique.set(run.id, run);
          return [...unique.values()];
        });
      } else {
        setRuns(page.items);
      }
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (generation !== runsGeneration.current || controller.signal.aborted) return;
      if (append) setLoadMoreError(errorMessage(error, 'More checks could not be loaded.'));
      else setRunsError(errorMessage(error, 'Availability history could not be loaded.'));
    } finally {
      if (generation === runsGeneration.current) {
        setRunsLoading(false);
        setLoadingMore(false);
        loadMoreFlight.current = false;
      }
    }
  }, [serverId]);

  const loadTarget = useCallback(async () => {
    const generation = ++targetGeneration.current;
    targetController.current?.abort();
    const controller = new AbortController();
    targetController.current = controller;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getServerAvailability(serverId, controller.signal);
      if (generation !== targetGeneration.current || controller.signal.aborted) return;
      setResponse(result);
      if (result.configured) {
        setEnabled(result.target.enabled);
        setInterval(String(result.target.checkIntervalMinutes));
        setAddressSource(result.target.addressSource);
        setPort(String(result.target.port));
        void loadRuns();
      } else {
        runsGeneration.current += 1;
        runsController.current?.abort();
        setRuns([]);
        setNextCursor(null);
        setRunsError(null);
      }
    } catch (error) {
      if (generation !== targetGeneration.current || controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 404) {
        setResponse({ configured: false, serverId, currentStatus: 'UNKNOWN' });
        return;
      }
      setLoadError(errorMessage(error, 'Network availability could not be loaded.'));
    } finally {
      if (generation === targetGeneration.current) setLoading(false);
    }
  }, [loadRuns, serverId]);

  useEffect(() => {
    setResponse(null);
    setRuns([]);
    setNextCursor(null);
    setRunsLoading(false);
    setLoadingMore(false);
    setRunsError(null);
    setLoadMoreError(null);
    setWriteForbidden(false);
    setSaveError(null);
    setManualError(null);
    setManualMessage(null);
    setEnabled(true);
    setInterval('5');
    setAddressSource(primaryIp ? 'PRIMARY_IP' : 'HOSTNAME');
    setPort('');
    void loadTarget();
    return () => {
      targetGeneration.current += 1;
      runsGeneration.current += 1;
      targetController.current?.abort();
      runsController.current?.abort();
      loadMoreFlight.current = false;
    };
  }, [loadTarget, serverId]);

  const archived = inventoryState !== 'TRACKED';
  const readOnly = archived || writeForbidden;
  const target = response?.configured ? response.target : null;
  const selectedAddress = addressSource === 'PRIMARY_IP' ? primaryIp : hostname;

  const handleSave = async () => {
    if (readOnly || saving) return;
    const minutes = Number(interval);
    const targetPort = Number(port);
    if (!interval.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 10_080) {
      setSaveError('Check interval must be a whole number from 1 to 10080 minutes.');
      return;
    }
    if (!port.trim() || !Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65_535) {
      setSaveError('Port must be a whole number from 1 to 65535.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await putServerAvailability(serverId, {
        enabled,
        checkIntervalMinutes: minutes,
        addressSource,
        port: targetPort,
      });
      setResponse(result);
      if (result.configured) {
        setEnabled(result.target.enabled);
        setInterval(String(result.target.checkIntervalMinutes));
        setAddressSource(result.target.addressSource);
        setPort(String(result.target.port));
        void loadRuns();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setWriteForbidden(true);
        setSaveError('Read-only: owner or admin access is required to change availability monitoring.');
      } else {
        setSaveError(errorMessage(error, 'Availability settings could not be saved.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleManual = async () => {
    if (readOnly || !target?.enabled || manualPending) return;
    setManualPending(true);
    setManualError(null);
    setManualMessage(null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const run = await postServerAvailabilityRun(serverId, idempotencyKey);
      setManualMessage(`Check ${run.id.slice(0, 8)} queued. Refresh to see its final result.`);
      void loadRuns();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setWriteForbidden(true);
        setManualError('Read-only: owner or admin access is required to run checks.');
      } else {
        setManualError(errorMessage(error, 'The check could not be queued.'));
      }
    } finally {
      setManualPending(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm" aria-label="Network availability">
      <div className="flex flex-wrap items-center justify-between gap-unit-sm border-b border-outline-variant/30 bg-surface-container-low p-unit-md">
        <div className="flex items-center gap-unit-sm"><span className="material-symbols-outlined text-[20px] text-primary">monitoring</span><div><h2 className="text-headline-sm font-semibold text-on-surface">Network availability</h2><p className="text-caption-xs text-secondary">Observed by DomainPulse-side TCP checks; separate from provider-reported status</p></div></div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void loadTarget()}>Refresh</Button>
      </div>

      {loading && !response ? <div className="p-unit-md text-body-sm text-secondary" role="status">Loading network availability…</div> : null}
      {loadError && <div className="m-unit-md rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert"><p className="text-body-sm text-error">{loadError}</p><Button className="mt-unit-xs" onClick={() => void loadTarget()}>Try again</Button></div>}
      {!loading && !loadError && response && !response.configured && (
        <div className="p-unit-md"><StatusBadge status="neutral" label="UNKNOWN" /><p className="mt-unit-xs text-body-sm text-secondary">Availability checks have not been configured. No network result is available.</p></div>
      )}

      {target && !loadError && (
        <div className="p-unit-md">
          <div className="flex flex-wrap items-center gap-unit-sm"><span className="text-caption-xs text-secondary">Current status (last observation)</span><StatusBadge status={statusVariant(target.currentStatus)} label={target.currentStatus} /><span className="text-caption-xs text-secondary">Monitoring {target.enabled ? 'enabled' : 'disabled'}</span></div>
          <dl className="mt-unit-md grid grid-cols-1 gap-unit-sm sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Latency', formatLatency(target.lastLatencyMs)],
              ['Last check', formatAvailabilityDate(target.lastRunAt, 'Not checked')],
              ['Next check', target.enabled ? formatAvailabilityDate(target.nextRunAt, 'Not scheduled') : 'Not scheduled (disabled)'],
              ['Failure reason', failureLabel(target.lastFailureCode)],
              ['Failure streak', String(target.consecutiveFailures)],
              ['Last recovery', formatAvailabilityDate(target.lastRecoveredAt, 'No recovery recorded')],
            ].map(([label, value]) => <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs text-secondary">{label}</dt><dd className="mt-unit-2xs break-words text-body-sm font-semibold text-on-surface">{value}</dd></div>)}
          </dl>
        </div>
      )}

      {response && !loadError && (
        <div className="border-t border-outline-variant/30 p-unit-md">
          <h3 className="text-label-md font-semibold text-on-surface">Monitoring controls</h3>
          {readOnly ? <div className="mt-unit-xs text-body-sm text-secondary"><p>{archived ? 'Archived servers are read-only and cannot be checked.' : 'Read-only: owner or admin access is required to configure or run checks.'}</p>{target && <p className="mt-unit-xs">{target.enabled ? 'Enabled' : 'Disabled'} · every {target.checkIntervalMinutes} minutes · {target.addressSource === 'PRIMARY_IP' ? 'Primary IP' : 'Hostname'} · TCP port {target.port}</p>}</div> : (
            <div className="mt-unit-sm flex flex-wrap items-end gap-unit-sm">
              <label className="flex min-w-40 flex-col gap-unit-2xs text-label-md">Check interval (minutes)<input className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3" type="number" min="1" max="10080" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} /></label>
              <label className="flex min-w-40 flex-col gap-unit-2xs text-label-md">Address source<select className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3" value={addressSource} onChange={(event) => setAddressSource(event.target.value as AvailabilityAddressSource)}><option value="PRIMARY_IP">Primary IP</option><option value="HOSTNAME">Hostname</option></select></label>
              <label className="flex min-w-32 flex-col gap-unit-2xs text-label-md">TCP port<input className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3" type="number" min="1" max="65535" step="1" value={port} onChange={(event) => setPort(event.target.value)} /></label>
              <label className="flex h-10 items-center gap-unit-xs text-body-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Enabled</label>
              <Button variant="primary" disabled={saving} onClick={() => void handleSave()}>{saving ? 'Saving…' : target ? 'Save settings' : 'Configure monitoring'}</Button>
              {target && <Button variant="outline" disabled={!target.enabled || manualPending} onClick={() => void handleManual()}>{manualPending ? 'Queueing…' : 'Run Now'}</Button>}
            </div>
          )}
          <p className="mt-unit-xs text-caption-xs text-secondary">Selected address: {selectedAddress || 'Not recorded'}{!selectedAddress ? ' — checks will report no target address.' : ''}</p>
          {target && !target.enabled && !readOnly && <p className="mt-unit-xs text-caption-xs text-secondary">Enable monitoring before running a manual check.</p>}
          {saveError && <p className="mt-unit-xs text-body-sm text-error" role="alert">{saveError}</p>}
          {manualError && <p className="mt-unit-xs text-body-sm text-error" role="alert">{manualError}</p>}
          {manualMessage && <p className="mt-unit-xs text-body-sm text-primary" role="status">{manualMessage}</p>}
        </div>
      )}

      {target && !loadError && (
        <div className="border-t border-outline-variant/30 p-unit-md">
          <h3 className="text-label-md font-semibold text-on-surface">Availability history</h3>
          {runsLoading && runs.length === 0 ? <p className="mt-unit-sm text-body-sm text-secondary" role="status">Loading checks…</p> : null}
          {runsError && <div className="mt-unit-sm rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert"><p className="text-body-sm text-error">{runsError}</p><Button className="mt-unit-xs" onClick={() => void loadRuns()}>Try again</Button></div>}
          {!runsLoading && !runsError && runs.length === 0 && <p className="mt-unit-sm text-body-sm text-secondary">No checks have been recorded yet.</p>}
          {runs.length > 0 && <ul className="mt-unit-sm divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/30">{runs.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-unit-sm p-unit-sm text-body-sm">
              <div className="flex flex-wrap items-center gap-unit-xs"><StatusBadge status={statusVariant(observedStatus(run.status))} label={runStatusLabel(run.status)} /><span className="text-secondary">{formatAvailabilityDate(run.createdAt)}</span></div>
              <div className="flex flex-wrap items-center gap-unit-sm text-caption-xs text-secondary"><span>Latency: {formatLatency(run.latencyMs)}</span><span>Reason: {failureLabel(run.failureCode)}</span><span>{run.trigger.toLowerCase()} · attempt {run.attemptNo}</span></div>
            </li>
          ))}</ul>}
          {loadMoreError && <p className="mt-unit-xs text-body-sm text-error" role="alert">{loadMoreError}</p>}
          {nextCursor && <Button className="mt-unit-sm" disabled={loadingMore} onClick={() => void loadRuns(nextCursor, true)}>{loadingMore ? 'Loading…' : loadMoreError ? 'Retry Load more' : 'Load more'}</Button>}
        </div>
      )}
    </section>
  );
};
