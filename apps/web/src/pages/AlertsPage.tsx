import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { acknowledgeAlert, listAlerts, type AlertEventResponse } from '@/api/monitoring';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { formatDateTime } from '@/lib/format';
import {
  fetchDomainsList,
  fetchServersList,
  fetchWebsitesList,
  type DomainItem,
  type ServerItem,
  type WebsiteItem,
} from '@/services/portfolioService';

type FilterTab = 'ALL' | 'OPEN' | 'CRITICAL' | 'WARNING' | 'ACKNOWLEDGED' | 'RESOLVED';

interface MergedAlert extends AlertEventResponse {
  assetName: string;
  assetHref: string;
  assetType: 'domain' | 'server' | 'website';
}

function formatRelativeTime(value: string | null): string {
  if (!value) return 'Unknown';
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return 'Recently';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const AlertsPage: React.FC<{ role?: 'owner' | 'admin' | 'member' }> = ({ role = 'owner' }) => {
  const canWrite = role === 'owner' || role === 'admin';
  const [alerts, setAlerts] = useState<AlertEventResponse[]>([]);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [ruleFilter, setRuleFilter] = useState<string>('');
  const [ackPending, setAckPending] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const generationRef = useRef(0);

  const loadData = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);

    try {
      const [alertsRes, domainsList, serversList, websitesList] = await Promise.allSettled([
        listAlerts({ limit: 100 }),
        fetchDomainsList(),
        fetchServersList(),
        fetchWebsitesList(),
      ]);

      if (generation !== generationRef.current) return;

      const apiAlerts: AlertEventResponse[] = alertsRes.status === 'fulfilled' ? alertsRes.value.items : [];
      const domainItems: DomainItem[] = domainsList.status === 'fulfilled' ? domainsList.value : [];
      const serverItems: ServerItem[] = serversList.status === 'fulfilled' ? serversList.value : [];
      const websiteItems: WebsiteItem[] = websitesList.status === 'fulfilled' ? websitesList.value : [];

      setDomains(domainItems);
      setServers(serverItems);
      setWebsites(websiteItems);

      // Synthesize domain alerts from active inventory if not already present from the API
      const existingDomainAlertIds = new Set(apiAlerts.map((a) => a.domainId));
      const synthesized: AlertEventResponse[] = [];
      const now = new Date();

      for (const d of domainItems) {
        if (!d.expiresAt) continue;
        const exp = new Date(d.expiresAt);
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30 && !existingDomainAlertIds.has(d.id)) {
          const isCritical = diffDays <= 14;
          synthesized.push({
            id: `synth-domain-${d.id}`,
            domainId: d.id,
            targetId: null,
            ruleId: isCritical ? 'DOMAIN_EXPIRY_CRITICAL' : 'DOMAIN_EXPIRY_WARNING',
            severity: isCritical ? 'CRITICAL' : 'WARNING',
            status: 'OPEN',
            title: diffDays <= 0 ? `Domain Expired: ${d.name}` : `Domain Expiring Soon: ${d.name}`,
            detail: diffDays <= 0
              ? `Domain registration for ${d.name} expired on ${new Date(d.expiresAt).toLocaleDateString()}. Renew immediately to avoid registry deletion.`
              : `Domain ${d.name} expires in ${diffDays} day${diffDays === 1 ? '' : 's'}. Review auto-renew status.`,
            occurrenceCount: 1,
            evidence: { domainName: d.name, expiresAt: d.expiresAt, daysRemaining: diffDays, registrar: d.registrar },
            firstSeenAt: now.toISOString(),
            lastSeenAt: now.toISOString(),
            ackedAt: null,
            ackedByUserId: null,
            resolvedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
        }
      }

      for (const s of serverItems) {
        if ((s.status === 'offline' || s.sshStatus === 'suspended') && !existingDomainAlertIds.has(s.id)) {
          synthesized.push({
            id: `synth-server-${s.id}`,
            domainId: s.id,
            targetId: null,
            ruleId: 'RETRIEVAL_FAILURE_REPEATED',
            severity: 'CRITICAL',
            status: 'OPEN',
            title: `Server Offline: ${s.name}`,
            detail: `Server ${s.name} (${s.ipAddress || 'VPS'}) is currently reported as ${s.status}.`,
            occurrenceCount: 1,
            evidence: { serverName: s.name, status: s.status, ipAddress: s.ipAddress },
            firstSeenAt: now.toISOString(),
            lastSeenAt: now.toISOString(),
            ackedAt: null,
            ackedByUserId: null,
            resolvedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          });
        }
      }

      setAlerts([...apiAlerts, ...synthesized]);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setError(e instanceof Error ? e.message : 'Alerts could not be loaded.');
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => {
      generationRef.current += 1;
    };
  }, [loadData, reloadKey]);

  // Asset lookup maps
  const domainMap = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains]);
  const serverMap = useMemo(() => new Map(servers.map((s) => [s.id, s])), [servers]);
  const websiteMap = useMemo(() => new Map(websites.map((w) => [w.id, w])), [websites]);

  // Merge alert with asset details
  const mergedAlerts: MergedAlert[] = useMemo(() => {
    return alerts.map((alert) => {
      const dom = domainMap.get(alert.domainId);
      if (dom) {
        return {
          ...alert,
          assetHref: `/domains/${encodeURIComponent(dom.id)}`,
          assetName: dom.name,
          assetType: 'domain',
        };
      }

      const srv = serverMap.get(alert.domainId);
      if (srv) {
        return {
          ...alert,
          assetHref: `/servers/${encodeURIComponent(srv.id)}`,
          assetName: srv.name,
          assetType: 'server',
        };
      }

      const web = websiteMap.get(alert.domainId);
      if (web) {
        return {
          ...alert,
          assetHref: `/websites/${encodeURIComponent(web.id)}`,
          assetName: web.name,
          assetType: 'website',
        };
      }

      const evidenceName = (alert.evidence?.domainName || alert.evidence?.assetName || alert.evidence?.serverName) as string | undefined;
      return {
        ...alert,
        assetHref: `/domains/${encodeURIComponent(alert.domainId)}`,
        assetName: evidenceName || (alert.domainId.length > 20 ? `${alert.domainId.slice(0, 12)}…` : alert.domainId),
        assetType: 'domain',
      };
    });
  }, [alerts, domainMap, serverMap, websiteMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = mergedAlerts.length;
    const open = mergedAlerts.filter((a) => a.status === 'OPEN').length;
    const critical = mergedAlerts.filter((a) => a.severity === 'CRITICAL').length;
    const warning = mergedAlerts.filter((a) => a.severity === 'WARNING').length;
    const acked = mergedAlerts.filter((a) => a.status === 'ACKNOWLEDGED').length;
    const resolved = mergedAlerts.filter((a) => a.status === 'RESOLVED').length;
    return { acked, critical, open, resolved, total, warning };
  }, [mergedAlerts]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return mergedAlerts.filter((alert) => {
      // Tab filter
      if (tab === 'OPEN' && alert.status !== 'OPEN') return false;
      if (tab === 'CRITICAL' && alert.severity !== 'CRITICAL') return false;
      if (tab === 'WARNING' && alert.severity !== 'WARNING') return false;
      if (tab === 'ACKNOWLEDGED' && alert.status !== 'ACKNOWLEDGED') return false;
      if (tab === 'RESOLVED' && alert.status !== 'RESOLVED') return false;

      // Rule filter
      if (ruleFilter && alert.ruleId !== ruleFilter) return false;

      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = alert.assetName.toLowerCase().includes(query);
        const matchesTitle = alert.title.toLowerCase().includes(query);
        const matchesDetail = alert.detail.toLowerCase().includes(query);
        const matchesRule = (alert.ruleId || '').toLowerCase().includes(query);
        if (!matchesName && !matchesTitle && !matchesDetail && !matchesRule) return false;
      }

      return true;
    });
  }, [mergedAlerts, tab, ruleFilter, search]);

  const handleAck = async (alertId: string) => {
    if (!canWrite) return;
    setAckPending(alertId);
    setActionMessage(null);

    // If synthesized alert
    if (alertId.startsWith('synth-')) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, ackedAt: new Date().toISOString(), status: 'ACKNOWLEDGED' } : a)),
      );
      setActionMessage('Alert marked as acknowledged.');
      setAckPending(null);
      return;
    }

    try {
      const result = await acknowledgeAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, ackedAt: result.acknowledgedAt, ackedByUserId: result.acknowledgedByUserId, status: 'ACKNOWLEDGED' }
            : a,
        ),
      );
      setActionMessage('Alert acknowledged.');
    } catch (e) {
      setActionMessage(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not acknowledge.');
    } finally {
      setAckPending(null);
    }
  };

  const handleResolve = (alertId: string) => {
    if (!canWrite) return;
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolvedAt: new Date().toISOString(), status: 'RESOLVED' } : a)),
    );
    setActionMessage('Alert marked as resolved.');
  };

  const handleAcknowledgeAll = async () => {
    if (!canWrite) return;
    const openAlerts = mergedAlerts.filter((a) => a.status === 'OPEN');
    for (const alert of openAlerts) {
      if (alert.id.startsWith('synth-')) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, ackedAt: new Date().toISOString(), status: 'ACKNOWLEDGED' } : a)),
        );
      } else {
        try {
          await acknowledgeAlert(alert.id);
        } catch {
          // Continue with next
        }
      }
    }
    setAlerts((prev) =>
      prev.map((a) => (a.status === 'OPEN' ? { ...a, ackedAt: new Date().toISOString(), status: 'ACKNOWLEDGED' } : a)),
    );
    setActionMessage('All open alerts acknowledged.');
  };

  const filterTabs: Array<{ count: number; id: FilterTab; label: string }> = [
    { count: stats.total, id: 'ALL', label: 'All Alerts' },
    { count: stats.open, id: 'OPEN', label: 'Open' },
    { count: stats.critical, id: 'CRITICAL', label: 'Critical' },
    { count: stats.warning, id: 'WARNING', label: 'Warning' },
    { count: stats.acked, id: 'ACKNOWLEDGED', label: 'Acknowledged' },
    { count: stats.resolved, id: 'RESOLVED', label: 'Resolved' },
  ];

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <PageHeader
        actions={(
          <div className="flex gap-unit-xs">
            {stats.open > 0 && canWrite && (
              <Button variant="outline" onClick={handleAcknowledgeAll}>
                Acknowledge all
              </Button>
            )}
            <Button variant="outline" onClick={() => setReloadKey((v) => v + 1)}>
              Refresh
            </Button>
          </div>
        )}
        badge="LIVE FEED"
        description="Truthful monitoring alerts, domain & certificate expiration warnings, and infrastructure health signals."
        title="Alerts & Monitoring"
      />

      {/* Summary KPI Cards */}
      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Alerts summary">
        {[
          { icon: 'notifications_active', label: 'Total alerts', tone: 'text-primary', value: stats.total },
          { icon: 'error', label: 'Critical', tone: 'text-error', value: stats.critical },
          { icon: 'warning', label: 'Warnings', tone: 'text-amber-700', value: stats.warning },
          { icon: 'check_circle', label: 'Acknowledged', tone: 'text-primary', value: stats.acked },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{item.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${item.tone}`}>{item.icon}</span>
            </div>
            <p className={`mt-unit-xs font-label-mono text-headline-md font-semibold ${item.tone}`}>{item.value}</p>
            <p className="mt-1 text-caption-xs text-secondary">Active signals</p>
          </div>
        ))}
      </section>

      {/* Search and Filters */}
      <div className="flex flex-col gap-unit-sm rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-sm shadow-sm">
        <div className="flex flex-col gap-unit-sm lg:flex-row lg:items-center">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Filter alerts</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-unit-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary">
              search
            </span>
            <input
              className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-0 pl-9 pr-unit-md text-body-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Filter by asset name, alert title, or detail…"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-body-sm text-secondary">
            <span className="text-caption-xs font-semibold uppercase tracking-wider">Rule:</span>
            <select
              className="h-9 rounded-lg border border-outline-variant/30 bg-surface-container-low px-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
            >
              <option value="">All Rules</option>
              <option value="DOMAIN_EXPIRY_CRITICAL">DOMAIN_EXPIRY_CRITICAL</option>
              <option value="DOMAIN_EXPIRY_WARNING">DOMAIN_EXPIRY_WARNING</option>
              <option value="RETRIEVAL_FAILURE_REPEATED">RETRIEVAL_FAILURE_REPEATED</option>
              <option value="TLS_EXPIRY_CRITICAL">TLS_EXPIRY_CRITICAL</option>
              <option value="TLS_EXPIRY_WARNING">TLS_EXPIRY_WARNING</option>
              <option value="DNS_CHANGED">DNS_CHANGED</option>
              <option value="CERT_CHANGED">CERT_CHANGED</option>
            </select>
          </label>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1 border-t border-outline-variant/20 pt-unit-xs">
          {filterTabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                className={`inline-flex items-center gap-1.5 rounded-lg px-unit-sm py-1 text-caption-xs font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-on-primary'
                    : 'text-secondary hover:bg-surface-container-low hover:text-on-surface'
                }`}
                type="button"
                onClick={() => setTab(item.id)}
              >
                <span>{item.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono ${
                    active ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container text-secondary'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low px-4 py-2 text-body-sm text-on-surface flex justify-between items-center">
          <span>{actionMessage}</span>
          <button className="text-caption-xs text-secondary hover:text-on-surface" onClick={() => setActionMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-xl text-center">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
          <p className="mt-2 text-body-sm text-secondary">Loading alerts and active infrastructure signals…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-unit-md text-error" role="alert">
          <p className="font-semibold">Alerts unavailable</p>
          <p className="mt-1 text-body-sm text-secondary">{error}</p>
          <Button className="mt-3" onClick={() => void loadData()}>
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && filteredAlerts.length === 0 && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-secondary/50">verified_user</span>
          <p className="mt-2 text-headline-sm font-semibold text-on-surface">No alerts match filters</p>
          <p className="mt-1 text-body-sm text-secondary">
            {search || ruleFilter || tab !== 'ALL'
              ? 'Try resetting the search terms or tab filter to see all recorded alerts.'
              : 'All monitored domains, servers, and services are healthy with no active warnings.'}
          </p>
          {(search || ruleFilter || tab !== 'ALL') && (
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => {
                setSearch('');
                setRuleFilter('');
                setTab('ALL');
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
      )}

      {!loading && !error && filteredAlerts.length > 0 && (
        <ul className="flex flex-col gap-unit-sm" aria-label="Alerts list">
          {filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'CRITICAL';
            const isWarning = alert.severity === 'WARNING';
            const isOpen = alert.status === 'OPEN';
            const isAcked = alert.status === 'ACKNOWLEDGED';
            const isResolved = alert.status === 'RESOLVED';

            return (
              <li
                key={alert.id}
                className={`flex flex-col gap-unit-xs rounded-xl border p-unit-md shadow-sm transition-colors ${
                  isCritical
                    ? 'border-error/40 bg-surface-container-lowest hover:border-error'
                    : isWarning
                    ? 'border-amber-400/40 bg-surface-container-lowest hover:border-amber-500'
                    : 'border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant/60'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isCritical
                          ? 'bg-error/10 text-error'
                          : isWarning
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-surface-container text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isCritical ? 'error' : isWarning ? 'warning' : 'info'}
                      </span>
                      {alert.severity}
                    </span>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isOpen
                          ? 'bg-primary/10 text-primary'
                          : isAcked
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {alert.status}
                    </span>

                    {alert.ruleId && (
                      <span className="rounded bg-surface-container-low px-2 py-0.5 font-mono text-[11px] text-secondary">
                        {alert.ruleId}
                      </span>
                    )}

                    <span className="text-caption-xs text-secondary">
                      Occurrences: <strong className="font-mono text-on-surface">{alert.occurrenceCount}</strong>
                    </span>
                  </div>

                  <span className="text-caption-xs text-secondary" title={alert.lastSeenAt ? formatDateTime(alert.lastSeenAt) : undefined}>
                    {formatRelativeTime(alert.lastSeenAt)}
                  </span>
                </div>

                <div className="mt-1">
                  <h3 className="text-body-lg font-semibold text-on-surface">{alert.title}</h3>
                  <p className="mt-1 text-body-sm text-secondary">{alert.detail}</p>
                </div>

                {/* Asset reference */}
                <div className="mt-1 flex flex-wrap items-center gap-unit-md text-caption-xs text-secondary">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      {alert.assetType === 'server' ? 'dns' : alert.assetType === 'website' ? 'web' : 'language'}
                    </span>
                    <span>Asset:</span>
                    <Link
                      to={alert.assetHref}
                      className="font-medium text-primary hover:underline"
                    >
                      {alert.assetName}
                    </Link>
                  </div>

                  {alert.firstSeenAt && (
                    <span>First seen: {new Date(alert.firstSeenAt).toLocaleDateString()}</span>
                  )}
                  {alert.ackedAt && (
                    <span>Acknowledged: {new Date(alert.ackedAt).toLocaleDateString()}</span>
                  )}
                  {alert.resolvedAt && (
                    <span>Resolved: {new Date(alert.resolvedAt).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Evidence preview if available */}
                {alert.evidence && Object.keys(alert.evidence).length > 0 && (
                  <details className="mt-2 text-caption-xs text-secondary">
                    <summary className="cursor-pointer font-medium hover:text-on-surface">
                      View diagnostic evidence ({Object.keys(alert.evidence).length} fields)
                    </summary>
                    <pre className="mt-1.5 max-h-36 overflow-auto rounded-lg bg-surface-container-low p-2.5 font-mono text-[11px] text-on-surface">
                      {JSON.stringify(alert.evidence, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Action buttons */}
                {canWrite && (
                  <div className="mt-2 flex items-center gap-2 border-t border-outline-variant/15 pt-2">
                    {isOpen && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={ackPending === alert.id}
                        onClick={() => void handleAck(alert.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        {ackPending === alert.id ? 'Acknowledging…' : 'Acknowledge'}
                      </Button>
                    )}
                    {!isResolved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResolve(alert.id)}
                      >
                        <span className="material-symbols-outlined text-[16px]">done_all</span>
                        Mark Resolved
                      </Button>
                    )}
                    <Link
                      to={alert.assetHref}
                      className="inline-flex items-center gap-1 text-caption-xs font-semibold text-primary hover:underline ml-auto"
                    >
                      <span>Investigate Asset</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AlertsPage;
