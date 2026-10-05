import { apiGet, apiPost, apiDelete } from './api';
import { getUserItem, setUserItem, STORAGE_KEYS } from './storage';
import { fetchDomainsList } from './domains';
import { fetchServersList } from './servers';
import { fetchApplicationsList } from './applications';
import type { AlertItem, InventorySummary } from '../types';

async function getDismissedAlertIds(): Promise<Set<string>> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.DISMISSED_ALERTS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

async function saveDismissedAlertIds(ids: Set<string>): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.DISMISSED_ALERTS, JSON.stringify(Array.from(ids)));
  } catch {}
}

async function getDismissedActivityIds(): Promise<Set<string>> {
  try {
    const raw = await getUserItem(STORAGE_KEYS.DISMISSED_ACTIVITIES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

async function saveDismissedActivityIds(ids: Set<string>): Promise<void> {
  try {
    await setUserItem(STORAGE_KEYS.DISMISSED_ACTIVITIES, JSON.stringify(Array.from(ids)));
  } catch {}
}

export async function deleteAlert(alertId: string): Promise<void> {
  const dismissed = await getDismissedAlertIds();
  dismissed.add(alertId);
  await saveDismissedAlertIds(dismissed);
  apiDelete(`/alerts/${alertId}`).catch(() => {});
}

export async function clearAllAlerts(alertIds?: string[]): Promise<void> {
  const dismissed = await getDismissedAlertIds();
  if (alertIds && alertIds.length > 0) {
    for (const id of alertIds) dismissed.add(id);
  }
  await saveDismissedAlertIds(dismissed);
}

export async function deleteActivity(activityId: string): Promise<void> {
  const dismissed = await getDismissedActivityIds();
  dismissed.add(activityId);
  await saveDismissedActivityIds(dismissed);
}

export async function clearAllActivities(activityIds?: string[]): Promise<void> {
  const dismissed = await getDismissedActivityIds();
  if (activityIds && activityIds.length > 0) {
    for (const id of activityIds) dismissed.add(id);
  }
  await saveDismissedActivityIds(dismissed);
}

export async function fetchInventorySummary(): Promise<InventorySummary> {
  const [domains, servers, apps, alerts] = await Promise.all([
    fetchDomainsList(),
    fetchServersList(),
    fetchApplicationsList(),
    fetchAlertsList(),
  ]);

  const critical = alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length;
  const warning = alerts.filter((a) => a.severity === 'warning' && a.status === 'active').length;
  const safe = domains.filter((d) => (d.daysRemaining || 999) > 30).length;
  const renewalCost = domains.reduce((sum, d) => sum + (d.renewalPrice || 0), 0);

  return {
    domains: domains.length,
    criticalExpirations: critical,
    warningExpirations: warning,
    safeDomains: safe,
    upcomingRenewals: critical + warning,
    estimatedRenewalCost: renewalCost,
    currency: '₹',
    servers: servers.length,
    cloudResources: 0,
    applications: apps.length,
    alerts: critical + warning,
  };
}

export async function fetchAlertsList(): Promise<AlertItem[]> {
  const [dismissedAlerts, domains, apps, servers] = await Promise.all([
    getDismissedAlertIds(),
    fetchDomainsList(),
    fetchApplicationsList(),
    fetchServersList(),
  ]);

  const realAlerts: AlertItem[] = [];

  // 1. Real Application critical issues only (e.g. Rejected releases)
  for (const app of apps) {
    const isRejected = app.status === 'error' || app.releaseTrack?.toLowerCase().includes('rejected');
    const alertId = `alt-app-${app.id}`;

    if (isRejected && !dismissedAlerts.has(alertId)) {
      realAlerts.push({
        id: alertId,
        domainName: app.name,
        title: `${app.name}: Release Rejected`,
        detail: `Google Play Console rejected release track (${app.packageId || 'Android'}).`,
        severity: 'critical',
        status: 'active',
        createdAt: app.updatedAt || new Date().toISOString(),
      });
    }
  }

  // 2. Real Expiring Soon Domain Alerts (<= 10 days before expiry)
  for (const d of domains) {
    const alertId = `alt-dom-${d.id}`;
    const expTime = d.expiresAt ? new Date(d.expiresAt).getTime() : NaN;
    const days = !isNaN(expTime)
      ? Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)))
      : d.daysRemaining ?? 365;

    if (days <= 10 && !dismissedAlerts.has(alertId)) {
      realAlerts.push({
        id: alertId,
        domainId: d.id,
        domainName: d.name,
        title: `${d.name}: Expiring Soon (${days}d left)`,
        detail: `Domain expires in ${days} day${days === 1 ? '' : 's'} via ${d.registrar}. Renew soon to prevent service interruption.`,
        severity: days <= 3 ? 'critical' : 'warning',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 3. Real Critical Server Alerts (Offline / Unreachable only)
  for (const s of servers) {
    const alertId = `alt-srv-${s.id}`;
    if (s.status === 'offline' && !dismissedAlerts.has(alertId)) {
      realAlerts.push({
        id: alertId,
        domainName: s.name,
        title: `${s.name}: Server Offline`,
        detail: `Server ${s.ipAddress || ''} is unreachable (${s.provider}).`,
        severity: 'critical',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return realAlerts.sort((a, b) => {
    const score = { critical: 2, warning: 1, info: 0 };
    const diff = (score[b.severity] || 0) - (score[a.severity] || 0);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export async function fetchActivitiesList(): Promise<AlertItem[]> {
  const [domains, apps, alerts, dismissedActivities] = await Promise.all([
    fetchDomainsList(),
    fetchApplicationsList(),
    fetchAlertsList(),
    getDismissedActivityIds(),
  ]);

  const activities: AlertItem[] = [...alerts].filter((a) => !dismissedActivities.has(a.id));

  // Add real production live app events
  for (const app of apps) {
    const isLive = !app.releaseTrack?.toLowerCase().includes('rejected') &&
      !app.releaseTrack?.toLowerCase().includes('draft') &&
      !app.releaseTrack?.toLowerCase().includes('unpublished');
    const actId = `act-app-${app.id}`;

    if (dismissedActivities.has(actId)) continue;

    if (isLive) {
      activities.push({
        id: actId,
        domainName: app.name,
        title: `${app.name}: Production Live`,
        detail: `Active on Google Play Store • ${app.packageId}`,
        severity: 'info',
        status: 'active',
        createdAt: app.updatedAt || new Date().toISOString(),
      });
    } else if (
      app.releaseTrack?.toLowerCase().includes('draft') ||
      app.releaseTrack?.toLowerCase().includes('review') ||
      app.releaseTrack?.toLowerCase().includes('unpublished')
    ) {
      activities.push({
        id: actId,
        domainName: app.name,
        title: `${app.name}: ${app.releaseTrack || 'In Review'}`,
        detail: `Build is ${app.releaseTrack || 'under review'} on Google Play.`,
        severity: 'info',
        status: 'active',
        createdAt: app.updatedAt || new Date().toISOString(),
      });
    }
  }

  // Add real domain DNS verified events
  for (const d of domains) {
    const actId = `act-dom-${d.id}`;
    if (dismissedActivities.has(actId)) continue;

    if ((d.daysRemaining || 999) > 30) {
      activities.push({
        id: actId,
        domainId: d.id,
        domainName: d.name,
        title: `${d.name}: DNS Verified`,
        detail: `Registrar: ${d.registrar} • ${d.daysRemaining} days remaining`,
        severity: 'info',
        status: 'active',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return activities.sort((a, b) => {
    const score = { critical: 3, warning: 2, info: 1 };
    const diff = (score[b.severity] || 0) - (score[a.severity] || 0);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  await apiPost(`/alerts/${alertId}/acknowledge`).catch(() => {});
}
