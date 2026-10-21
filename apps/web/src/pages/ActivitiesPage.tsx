import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listInventory } from '@/api/inventory';
import { listAlerts } from '@/api/monitoring';
import { listNotificationHistory } from '@/api/notifications';
import type { AlertEventResponse } from '@/api/monitoring';
import type { NotificationHistoryItem } from '@/api/notifications';
import type { Application, Domain, Server } from '@/api/types';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatePanel } from '@/components/integration/InventoryWorkspace';

type FilterCategory = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO' | 'DOMAINS' | 'SERVERS' | 'APPS';
type Severity = 'critical' | 'warning' | 'info';
type Category = 'DOMAIN' | 'SERVER' | 'APP' | 'SECURITY' | 'SYSTEM';

interface ActivityEvent {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  category: Category;
  createdAt: string;
  assetName: string;
  href: string | null;
}

const DISMISSED_KEY = 'dp_dismissed_activities';

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Dismissal state is a convenience; storage failures must not break the feed.
  }
}

function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return 'Unknown time';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

function categoryForAsset(assetType: NotificationHistoryItem['assetType']): Category {
  if (assetType === 'server') return 'SERVER';
  if (assetType === 'ssl') return 'SECURITY';
  if (assetType === 'hosting') return 'APP';
  return 'DOMAIN';
}

function hrefForNotification(item: NotificationHistoryItem): string | null {
  if (item.assetType === 'domain' || item.assetType === 'ssl') return `/domains/${encodeURIComponent(item.assetId)}`;
  if (item.assetType === 'server') return `/servers/${encodeURIComponent(item.assetId)}`;
  return '/websites';
}

function buildEvents(input: {
  alerts: AlertEventResponse[];
  applications: Application[];
  domains: Domain[];
  notifications: NotificationHistoryItem[];
  servers: Server[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const alert of input.alerts) {
    events.push({
      assetName: alert.domainId ? `Domain ${alert.domainId.slice(0, 8)}…` : 'Workspace alert',
      category: 'DOMAIN',
      createdAt: alert.lastSeenAt || alert.firstSeenAt,
      detail: alert.detail,
      href: alert.domainId ? `/domains/${encodeURIComponent(alert.domainId)}` : '/alerts',
      id: `alert:${alert.id}`,
      severity: alert.severity.toLowerCase() as Severity,
      title: alert.title,
    });
  }

  for (const notification of input.notifications) {
    events.push({
      assetName: notification.assetName,
      category: categoryForAsset(notification.assetType),
      createdAt: notification.createdAt,
      detail: notification.body,
      href: hrefForNotification(notification),
      id: `notification:${notification.id}`,
      severity: notification.status === 'FAILED' ? 'warning' : 'info',
      title: notification.title,
    });
  }

  for (const domain of input.domains) {
    const days = daysUntil(domain.expiresAt);
    if (days !== null && days <= 30) {
      events.push({
        assetName: domain.domainName,
        category: 'DOMAIN',
        createdAt: domain.updatedAt,
        detail: days < 0
          ? `${domain.domainName} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago.`
          : `Registration expires in ${days} day${days === 1 ? '' : 's'}.`,
        href: `/domains/${encodeURIComponent(domain.id)}`,
        id: `domain-expiry:${domain.id}:${domain.expiresAt}`,
        severity: days <= 7 ? 'critical' : 'warning',
        title: days < 0 ? 'Domain expired' : 'Domain expiring soon',
      });
    }
    events.push({
      assetName: domain.domainName,
      category: 'DOMAIN',
      createdAt: domain.updatedAt,
      detail: `Domain record updated · ${domain.provenance.split('_').join(' ').toLowerCase()}`,
      href: `/domains/${encodeURIComponent(domain.id)}`,
      id: `domain:${domain.id}:${domain.updatedAt}`,
      severity: 'info',
      title: 'Domain record updated',
    });
  }

  for (const server of input.servers) {
    events.push({
      assetName: server.name,
      category: 'SERVER',
      createdAt: server.updatedAt,
      detail: `${server.hostname || server.primaryIp || 'Server'} · ${server.provenance.split('_').join(' ').toLowerCase()}`,
      href: `/servers/${encodeURIComponent(server.id)}`,
      id: `server:${server.id}:${server.updatedAt}`,
      severity: 'info',
      title: 'Server record updated',
    });
  }

  for (const application of input.applications) {
    events.push({
      assetName: application.name,
      category: 'APP',
      createdAt: application.updatedAt,
      detail: `${application.kind.split('_').join(' ').toLowerCase()}${application.primaryUrl ? ` · ${application.primaryUrl}` : ''}`,
      href: `/websites/${encodeURIComponent(application.id)}`,
      id: `application:${application.id}:${application.updatedAt}`,
      severity: 'info',
      title: 'Application record updated',
    });
  }

  return events.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

const SEVERITY_STYLE: Record<Severity, { accent: string; badge: string; dot: string }> = {
  critical: { accent: 'text-error', badge: 'bg-error/10 text-error', dot: 'bg-error' },
  info: { accent: 'text-primary', badge: 'bg-primary/10 text-primary', dot: 'bg-primary' },
  warning: { accent: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
};

const CATEGORY_ICON: Record<Category, string> = {
  APP: 'smartphone',
  DOMAIN: 'language',
  SECURITY: 'shield',
  SERVER: 'dns',
  SYSTEM: 'settings',
};

export const ActivitiesPage: React.FC = () => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPartial(false);
    void Promise.allSettled([
      listInventory('domains', { includeArchived: true, limit: 100, signal: controller.signal }),
      listInventory('servers', { includeArchived: true, limit: 100, signal: controller.signal }),
      listInventory('applications', { includeArchived: true, limit: 100, signal: controller.signal }),
      listAlerts({ limit: 100 }, controller.signal),
      listNotificationHistory(50, controller.signal),
    ]).then(([domains, servers, applications, alerts, notifications]) => {
      if (controller.signal.aborted) return;
      const failures = [domains, servers, applications, alerts, notifications].filter((result) => result.status === 'rejected');
      if (failures.length === 5) {
        setError('Recent activity could not be loaded.');
        setEvents([]);
        return;
      }
      setPartial(failures.length > 0);
      setEvents(buildEvents({
        alerts: alerts.status === 'fulfilled' ? alerts.value.items : [],
        applications: applications.status === 'fulfilled' ? applications.value.items : [],
        domains: domains.status === 'fulfilled' ? domains.value.items : [],
        notifications: notifications.status === 'fulfilled' ? notifications.value : [],
        servers: servers.status === 'fulfilled' ? servers.value.items : [],
      }));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reloadKey]);

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      if (dismissed.has(event.id)) return false;
      if (filter === 'CRITICAL' && event.severity !== 'critical') return false;
      if (filter === 'WARNING' && event.severity !== 'warning') return false;
      if (filter === 'INFO' && event.severity !== 'info') return false;
      if (filter === 'DOMAINS' && event.category !== 'DOMAIN') return false;
      if (filter === 'SERVERS' && event.category !== 'SERVER') return false;
      if (filter === 'APPS' && event.category !== 'APP') return false;
      if (!query) return true;
      return [event.title, event.detail, event.assetName, event.severity, event.category]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [dismissed, events, filter, search]);

  const stats = useMemo(() => ({
    apps: events.filter((event) => event.category === 'APP').length,
    critical: events.filter((event) => event.severity === 'critical').length,
    domains: events.filter((event) => event.category === 'DOMAIN').length,
    info: events.filter((event) => event.severity === 'info').length,
    servers: events.filter((event) => event.category === 'SERVER').length,
    total: events.length,
    warning: events.filter((event) => event.severity === 'warning').length,
  }), [events]);

  const dismiss = (id: string) => {
    setDismissed((current) => {
      const next = new Set(current);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  };

  const clearAll = () => {
    setDismissed((current) => {
      const next = new Set(current);
      visibleEvents.forEach((event) => next.add(event.id));
      persistDismissed(next);
      return next;
    });
  };

  const resetDismissed = () => {
    const next = new Set<string>();
    persistDismissed(next);
    setDismissed(next);
  };

  const filters: Array<{ count: number; id: FilterCategory; label: string }> = [
    { count: stats.total, id: 'ALL', label: 'All' },
    { count: stats.critical, id: 'CRITICAL', label: 'Critical' },
    { count: stats.warning, id: 'WARNING', label: 'Warning' },
    { count: stats.info, id: 'INFO', label: 'Verified' },
    { count: stats.domains, id: 'DOMAINS', label: 'Domains' },
    { count: stats.servers, id: 'SERVERS', label: 'Servers' },
    { count: stats.apps, id: 'APPS', label: 'Apps' },
  ];

  return (
    <div className="flex w-full flex-col gap-unit-lg">
      <PageHeader
        actions={(
          <div className="flex gap-unit-xs">
            <Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Refresh</Button>
            <Button disabled={visibleEvents.length === 0} variant="destructive" onClick={clearAll}>Clear all</Button>
          </div>
        )}
        badge="LIVE FEED"
        description="Chronological audit trail derived from alerts, delivered reminders, expiry warnings, and inventory changes across domains, servers, and applications."
        title="Recent Activity"
      />

      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Activity summary">
        {[
          { icon: 'pulse', label: 'Total events', tone: 'text-primary', value: stats.total },
          { icon: 'alert-circle', label: 'Critical', tone: 'text-error', value: stats.critical },
          { icon: 'warning', label: 'Warnings', tone: 'text-amber-700', value: stats.warning },
          { icon: 'check-circle', label: 'Verified', tone: 'text-primary', value: stats.info },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{item.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${item.tone}`}>{item.icon}</span>
            </div>
            <p className={`mt-unit-xs font-label-mono text-headline-md font-semibold ${item.tone}`}>{item.value}</p>
            <p className="mt-1 text-caption-xs text-secondary">Captured events</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-unit-sm rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-sm shadow-sm">
        <div className="flex flex-col gap-unit-sm lg:flex-row lg:items-center">
          <label className="relative min-w-[240px] flex-1">
            <span className="sr-only">Filter activities</span>
            <span className="material-symbols-outlined pointer-events-none absolute left-unit-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary">search</span>
            <input
              className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-0 pl-9 pr-unit-md text-body-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Filter by domain, server, app, or keyword…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-1">
            {filters.map((option) => (
              <button
                aria-pressed={filter === option.id}
                className={`inline-flex items-center gap-1 rounded-full border px-unit-sm py-1 text-caption-xs font-semibold transition-colors ${filter === option.id ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/40 bg-surface-container-low text-on-surface hover:border-primary/50'}`}
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
              >
                {option.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === option.id ? 'bg-white/20' : 'bg-surface-container text-secondary'}`}>{option.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-unit-xs border-t border-outline-variant/20 pt-unit-xs text-caption-xs text-secondary">
          <span>{visibleEvents.length} shown from {events.length} captured events</span>
          <div className="flex items-center gap-unit-sm">
            {dismissed.size > 0 && <button className="font-semibold text-primary hover:underline" type="button" onClick={resetDismissed}>Restore {dismissed.size} dismissed</button>}
            {(search || filter !== 'ALL') && <button className="font-semibold text-primary hover:underline" type="button" onClick={() => { setSearch(''); setFilter('ALL'); }}>Clear filters</button>}
          </div>
        </div>
      </div>

      {partial && <p className="text-caption-xs text-amber-700" role="status">Some activity sources are unavailable; showing everything that loaded.</p>}

      {loading ? <StatePanel icon="progress_activity" message="Loading recent activity…" spinning />
        : error ? <StatePanel icon="error" message={error} action={<Button onClick={() => setReloadKey((value) => value + 1)}>Try again</Button>} />
        : visibleEvents.length === 0 ? (
          <StatePanel
            icon="history_toggle_off"
            message={search || filter !== 'ALL' ? 'No activities match these filters.' : dismissed.size > 0 ? 'All captured activities have been dismissed.' : 'No recent activity has been recorded yet.'}
            action={dismissed.size > 0 ? <Button onClick={resetDismissed}>Restore dismissed</Button> : undefined}
          />
        ) : (
          <ol className="flex flex-col">
            {visibleEvents.map((event, index) => {
              const style = SEVERITY_STYLE[event.severity];
              return (
                <li className="flex gap-unit-sm" key={event.id}>
                  <div className="flex w-6 shrink-0 flex-col items-center">
                    <span className={`mt-4 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-surface-container-lowest ${event.severity === 'critical' ? 'border-error' : event.severity === 'warning' ? 'border-amber-500' : 'border-primary'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    </span>
                    {index < visibleEvents.length - 1 && <span className="w-px flex-1 bg-outline-variant/40" />}
                  </div>
                  <article className="mb-unit-md min-w-0 flex-1 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-unit-xs">
                      <div className="flex flex-wrap items-center gap-unit-xs">
                        <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary">{event.category}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>{event.severity}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-caption-xs text-secondary">
                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                        {formatRelativeTime(event.createdAt)}
                      </span>
                    </div>
                    <div className="mt-unit-sm flex items-start gap-unit-sm">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                        <span className="material-symbols-outlined text-[20px]">{CATEGORY_ICON[event.category]}</span>
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-body-md font-semibold text-on-surface">{event.title}</h2>
                        <p className="mt-0.5 line-clamp-3 text-body-sm text-secondary">{event.detail}</p>
                      </div>
                    </div>
                    <div className="mt-unit-sm flex flex-wrap items-center justify-between gap-unit-xs border-t border-outline-variant/20 pt-unit-sm">
                      <span className="truncate text-caption-xs font-medium text-secondary">{event.assetName}</span>
                      <div className="flex items-center gap-unit-sm">
                        {event.href && <Link className={`inline-flex items-center gap-0.5 text-caption-xs font-semibold hover:underline ${style.accent}`} to={event.href}>Inspect<span className="material-symbols-outlined text-[14px]">chevron_right</span></Link>}
                        <button aria-label="Dismiss this activity" className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-secondary hover:text-error" type="button" onClick={() => dismiss(event.id)}>
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}
    </div>
  );
};
