import React, { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  getMonitoringTarget,
  listMonitoringRuns,
  postManualRun,
  putMonitoringTarget,
  type MonitoringRunResponse,
  type MonitoringTargetApiResponse,
} from '@/api/monitoring';
import { Button } from '@/components/common/Button';

function formatDate(value: string | null): string {
  if (!value) return 'Not scheduled';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Not scheduled' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function humanStatus(value: string | null): string {
  if (!value) return 'Not checked';
  switch (value) {
    case 'QUEUED': return 'Queued';
    case 'RUNNING': return 'Running';
    case 'SUCCESS': return 'Last check succeeded';
    case 'PARTIAL': return 'Last check partially succeeded';
    case 'FAILED': return 'Last check failed';
    default: return value;
  }
}

type Props = {
  domainId: string;
  inventoryState?: 'TRACKED' | 'ARCHIVED';
  role?: 'owner' | 'admin' | 'member';
};

export const DomainMonitoringSection: React.FC<Props> = ({ domainId, inventoryState = 'TRACKED', role = 'owner' }) => {
  const canWrite = role === 'owner' || role === 'admin';
  const [target, setTarget] = useState<MonitoringTargetApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [interval, setInterval] = useState('1440');
  const [enabled, setEnabled] = useState(true);
  const [manualPending, setManualPending] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualQueued, setManualQueued] = useState<string | null>(null);
  const [runs, setRuns] = useState<MonitoringRunResponse[]>([]);
  const [runsNextCursor, setRunsNextCursor] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const loadTarget = useCallback(async (signal?: AbortSignal) => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getMonitoringTarget(domainId, signal);
      if (generation !== generationRef.current) return;
      setTarget(data);
      if (data.configured) {
        setEnabled(data.target.enabled);
        setInterval(String(data.target.checkIntervalMinutes));
      }
    } catch (e) {
      if ((signal as AbortSignal | undefined)?.aborted || generation !== generationRef.current) return;
      setError(e instanceof Error ? e.message : 'Monitoring could not be loaded.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [domainId]);

  const loadRuns = useCallback(async (cursor?: string | null, append = false) => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const page = await listMonitoringRuns(domainId, { cursor: cursor ?? undefined, limit: 10 });
      if (append) {
        setRuns((prev) => {
          const byId = new Map<string, MonitoringRunResponse>();
          for (const item of [...prev, ...page.items]) byId.set(item.id, item);
          return [...byId.values()];
        });
      } else {
        setRuns(page.items);
      }
      setRunsNextCursor(page.nextCursor);
    } catch (e) {
      setRunsError(e instanceof Error ? e.message : 'History could not be loaded.');
    } finally {
      setRunsLoading(false);
    }
  }, [domainId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTarget(controller.signal);
    void loadRuns(null, false);
    return () => {
      controller.abort();
      generationRef.current += 1;
    };
  }, [loadTarget, loadRuns]);

  const handleSave = async () => {
    if (!canWrite) return;
    if (inventoryState === 'ARCHIVED' && enabled) {
      setSaveError('Cannot enable monitoring for archived domain');
      return;
    }
    const minutes = Number(interval);
    if (!Number.isInteger(minutes) || minutes < 60 || minutes > 10080) {
      setSaveError('Check interval must be between 60 and 10080 minutes');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await putMonitoringTarget(domainId, { enabled, checkIntervalMinutes: minutes });
      setTarget(result);
      if (result.configured) {
        setEnabled(result.target.enabled);
        setInterval(String(result.target.checkIntervalMinutes));
      }
      await loadRuns(null, false);
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not save monitoring');
    } finally {
      setSaving(false);
    }
  };

  const handleManual = async () => {
    if (!canWrite || manualPending) return;
    setManualPending(true);
    setManualError(null);
    setManualQueued(null);
    const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await postManualRun(domainId, idempotencyKey);
      setManualQueued(`Run ${result.id.slice(0, 8)} queued`);
      await loadRuns(null, false);
    } catch (e) {
      setManualError(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Manual run could not be queued.');
    } finally {
      setManualPending(false);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 text-body-sm text-secondary" role="status">Loading monitoring…</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-error/30 bg-error/5 p-4" role="alert"><p className="font-semibold text-error">Monitoring unavailable</p><p className="mt-1 text-body-sm text-secondary">{error}</p><Button onClick={() => void loadTarget()} className="mt-3">Try again</Button></div>;
  }
  if (!target) return null;

  if (!target.configured) {
    return (
      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm" aria-label="Monitoring">
        <h2 className="text-headline-sm font-semibold">Monitoring</h2>
        <p className="mt-2 text-body-sm text-secondary">Monitoring not configured</p>
        {canWrite ? (
          inventoryState === 'ARCHIVED' ? (
            <p className="mt-3 text-body-sm text-secondary">Archived domains cannot enable monitoring.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 max-w-sm">
              <label className="flex flex-col gap-1 text-label-md">
                Check interval (minutes)
                <input className="h-10 rounded-lg border border-outline-variant px-3" value={interval} onChange={(e) => setInterval(e.target.value)} placeholder="1440" inputMode="numeric" />
              </label>
              <label className="flex items-center gap-2 text-body-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
              {saveError && <p role="alert" className="text-body-sm text-error">{saveError}</p>}
              <Button variant="primary" disabled={saving} onClick={() => void handleSave()}>{saving ? 'Saving…' : 'Configure monitoring'}</Button>
            </div>
          )
        ) : (
          <p className="mt-3 text-body-sm text-secondary">Read-only: you need owner/admin to configure.</p>
        )}
      </section>
    );
  }

  const t = target.target;
  const isArchived = inventoryState === 'ARCHIVED';

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm" aria-label="Monitoring">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-headline-sm font-semibold">Monitoring</h2>
          <p className="mt-1 text-caption-xs text-secondary">Truthful status from scheduled checks</p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${t.enabled ? 'bg-primary/10 text-primary' : 'bg-surface-container text-secondary'}`}>{t.enabled ? 'Enabled' : 'Disabled'}</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Check interval</dt><dd className="mt-1 font-medium">{t.checkIntervalMinutes} minutes</dd></div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Next scheduled check</dt><dd className="mt-1 font-medium">{formatDate(t.nextRunAt)}</dd></div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Last run time</dt><dd className="mt-1 font-medium">{formatDate(t.lastRunAt)}</dd></div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Last run status</dt><dd className="mt-1 font-medium">{humanStatus(t.lastRunStatus)}</dd></div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Consecutive failures</dt><dd className="mt-1 font-medium">{t.consecutiveFailures}</dd></div>
        <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3"><dt className="text-caption-xs uppercase tracking-wider text-secondary">Target ID</dt><dd className="mt-1 break-all font-mono text-xs">{t.id.slice(0, 8)}…</dd></div>
      </dl>

      {canWrite ? (
        <div className="mt-6 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
          <h3 className="font-semibold text-label-md">Configuration</h3>
          {isArchived ? (
            <p className="mt-2 text-body-sm text-secondary">Archived domains cannot enable monitoring.</p>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-label-md flex-1 max-w-xs">
                  Check interval (minutes)
                  <input className="h-10 rounded-lg border border-outline-variant px-3" value={interval} onChange={(e) => setInterval(e.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-body-sm h-10">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
                </label>
                <Button variant="primary" disabled={saving} onClick={() => void handleSave()}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
              {saveError && <p role="alert" className="mt-2 text-body-sm text-error">{saveError}</p>}
            </>
          )}
          <div className="mt-4">
            <Button variant="outline" disabled={!t.enabled || manualPending || isArchived} onClick={() => void handleManual()}>{manualPending ? 'Queueing…' : 'Run check now'}</Button>
            {manualQueued && <p className="mt-2 text-body-sm text-primary" role="status">{manualQueued}</p>}
            {manualError && <p role="alert" className="mt-2 text-body-sm text-error">{manualError}</p>}
            {!t.enabled && <p className="mt-2 text-caption-xs text-secondary">Manual run available only when monitoring is enabled.</p>}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-body-sm text-secondary">Read-only: you need owner/admin to configure or run checks.</p>
      )}

      <div className="mt-6">
        <h3 className="font-semibold">Monitoring history</h3>
        {runsLoading && runs.length === 0 ? (
          <p className="mt-3 text-body-sm text-secondary" role="status">Loading history…</p>
        ) : runsError ? (
          <div className="mt-3 rounded-lg border border-error/20 bg-error/5 p-3" role="alert"><p className="text-body-sm text-error">{runsError}</p><Button className="mt-2" onClick={() => void loadRuns(null, false)}>Try again</Button></div>
        ) : runs.length === 0 ? (
          <p className="mt-3 text-body-sm text-secondary">No checks have been recorded.</p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-outline-variant/20 rounded-lg border border-outline-variant/30 overflow-hidden">
              {runs.map((run) => (
                <li key={run.id} className="p-3 bg-surface-container-lowest">
                  <div className="flex flex-wrap items-center gap-2 text-body-sm">
                    <span className="inline-flex rounded-full bg-surface-container px-2 py-1 text-xs font-semibold">{run.trigger}</span>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${run.status === 'SUCCESS' ? 'bg-primary/10 text-primary' : run.status === 'FAILED' ? 'bg-error/10 text-error' : 'bg-surface-container text-secondary'}`}>{humanStatus(run.status)}</span>
                    <span className="text-caption-xs text-secondary">Attempt {run.attemptNo}</span>
                    {run.errorCode && <span className="rounded bg-error/10 px-2 py-1 text-xs text-error">{run.errorCode}</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-caption-xs text-secondary">
                    <span>Started: {formatDate(run.startedAt)}</span>
                    <span>Finished: {formatDate(run.finishedAt)}</span>
                    <span>Duration: {run.durationMs !== null ? `${run.durationMs} ms` : '—'}</span>
                    <span>Sources: {run.sourcesSucceeded.length}/{run.sourcesAttempted.length} {run.sourcesSucceeded.join(', ') || '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
            {runsNextCursor && <Button className="mt-3" disabled={runsLoading} onClick={() => void loadRuns(runsNextCursor, true)}>{runsLoading ? 'Loading…' : 'Load more'}</Button>}
          </>
        )}
      </div>
    </section>
  );
};
