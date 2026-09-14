import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import { acknowledgeAlert, listAlerts, type AlertEventResponse } from '@/api/monitoring';
import { Button } from '@/components/common/Button';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type Filters = { status?: string; severity?: string; ruleKey?: string; domainId?: string };

export const AlertsPage: React.FC<{ role?: 'owner' | 'admin' | 'member' }> = ({ role = 'owner' }) => {
  const canWrite = role === 'owner' || role === 'admin';
  const [alerts, setAlerts] = useState<AlertEventResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [ackPending, setAckPending] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async (cursor?: string | null, append = false) => {
    const generation = ++generationRef.current;
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const page = await listAlerts({ ...filters, cursor: cursor ?? undefined, limit: 20 });
      if (generation !== generationRef.current) return;
      if (append) {
        setAlerts((prev) => {
          const byId = new Map<string, AlertEventResponse>();
          for (const item of [...prev, ...page.items]) byId.set(item.id, item);
          return [...byId.values()];
        });
      } else {
        setAlerts(page.items);
      }
      setNextCursor(page.nextCursor);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(e instanceof Error ? e.message : 'Alerts could not be loaded.');
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    void load(null, false);
    return () => { generationRef.current += 1; };
  }, [load]);

  const handleAck = async (alertId: string) => {
    if (!canWrite) return;
    setAckPending(alertId);
    setAckError(null);
    try {
      const result = await acknowledgeAlert(alertId);
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: 'ACKNOWLEDGED', ackedAt: result.acknowledgedAt, ackedByUserId: result.acknowledgedByUserId } : a));
    } catch (e) {
      setAckError(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not acknowledge.');
    } finally {
      setAckPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-unit-lg pb-unit-2xl">
      <div className="flex flex-col gap-unit-sm">
        <h1 className="font-headline-sm text-headline-sm font-semibold">Alerts</h1>
        <p className="text-caption-xs text-secondary">Truthful monitoring alerts from scheduled checks. No synthetic health.</p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
        <label className="flex flex-col gap-1 text-label-md">
          Status
          <select className="h-10 rounded-lg border border-outline-variant px-3" value={filters.status ?? ''} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}>
            <option value="">All</option>
            <option value="OPEN">OPEN</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          Severity
          <select className="h-10 rounded-lg border border-outline-variant px-3" value={filters.severity ?? ''} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value || undefined }))}>
            <option value="">All</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-label-md">
          Rule
          <select className="h-10 rounded-lg border border-outline-variant px-3" value={filters.ruleKey ?? ''} onChange={(e) => setFilters((f) => ({ ...f, ruleKey: e.target.value || undefined }))}>
            <option value="">All</option>
            <option value="DOMAIN_EXPIRY_CRITICAL">DOMAIN_EXPIRY_CRITICAL</option>
            <option value="DOMAIN_EXPIRY_WARNING">DOMAIN_EXPIRY_WARNING</option>
            <option value="TLS_EXPIRY_CRITICAL">TLS_EXPIRY_CRITICAL</option>
            <option value="TLS_EXPIRY_WARNING">TLS_EXPIRY_WARNING</option>
            <option value="RETRIEVAL_FAILURE_REPEATED">RETRIEVAL_FAILURE_REPEATED</option>
            <option value="DNS_CHANGED">DNS_CHANGED</option>
            <option value="CERT_CHANGED">CERT_CHANGED</option>
          </select>
        </label>
        <Button variant="outline" onClick={() => setFilters({})}>Reset filters</Button>
      </div>

      {loading && <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center text-body-sm text-secondary" role="status">Loading alerts…</div>}
      {error && <div className="rounded-xl border border-error/30 bg-error/5 p-4" role="alert"><p className="font-semibold text-error">Alerts unavailable</p><p className="mt-1 text-body-sm text-secondary">{error}</p><Button className="mt-3" onClick={() => void load(null, false)}>Try again</Button></div>}
      {!loading && !error && alerts.length === 0 && <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center"><p className="font-semibold">No alerts</p><p className="mt-1 text-body-sm text-secondary">No alerts match the current filters.</p></div>}
      {!loading && !error && alerts.length > 0 && (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${alert.severity === 'CRITICAL' ? 'bg-error/10 text-error' : alert.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container text-secondary'}`}>{alert.severity}</span>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${alert.status === 'OPEN' ? 'bg-primary/10 text-primary' : alert.status === 'ACKNOWLEDGED' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container text-secondary'}`}>{alert.status}</span>
                <span className="text-caption-xs text-secondary">Occurrences: {alert.occurrenceCount}</span>
              </div>
              <h3 className="mt-2 font-semibold">{alert.title}</h3>
              <p className="mt-1 text-body-sm text-secondary">{alert.detail}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-caption-xs text-secondary sm:grid-cols-2">
                <span>Domain: {alert.domainId.slice(0, 8)}…</span>
                <span>First seen: {formatDate(alert.firstSeenAt)}</span>
                <span>Last seen: {formatDate(alert.lastSeenAt)}</span>
                {alert.ackedAt && <span>Acknowledged: {formatDate(alert.ackedAt)}</span>}
                {alert.resolvedAt && <span>Resolved: {formatDate(alert.resolvedAt)}</span>}
              </div>
              {alert.evidence && Object.keys(alert.evidence).length > 0 && <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-surface-container-low p-3 text-xs">{JSON.stringify(alert.evidence, null, 2)}</pre>}
              {alert.status === 'OPEN' && canWrite && <Button className="mt-3" disabled={ackPending === alert.id} onClick={() => void handleAck(alert.id)}>{ackPending === alert.id ? 'Acknowledging…' : 'Acknowledge'}</Button>}
              {alert.status === 'ACKNOWLEDGED' && <p className="mt-3 text-body-sm text-secondary">Acknowledged</p>}
              {alert.status === 'RESOLVED' && <p className="mt-3 text-body-sm text-secondary">Resolved — no action</p>}
            </li>
          ))}
        </ul>
      )}
      {ackError && <p role="alert" className="text-body-sm text-error">{ackError}</p>}
      {nextCursor && <Button disabled={loadingMore} onClick={() => void load(nextCursor, true)} className="mt-4">{loadingMore ? 'Loading…' : 'Load more'}</Button>}
    </div>
  );
};
export default AlertsPage;
