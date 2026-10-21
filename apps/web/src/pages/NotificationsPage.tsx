import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/api/client';
import {
  getNotificationPreferences,
  listMonitoredExpiries,
  listNotificationHistory,
  markNotificationRead,
  triggerExpiryCheck,
  upsertMonitoredExpiry,
  updateNotificationPreferences,
  type ExpiryCheckResult,
  type MonitoredExpiry,
  type NotificationHistoryItem,
  type NotificationPreferences,
} from '@/api/notifications';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { formatDateTime } from '@/lib/format';

const REMINDER_THRESHOLDS = [15, 7, 3, 1, 0] as const;

const ASSET_LABEL: Record<MonitoredExpiry['assetType'], string> = {
  domain: 'Domain',
  hosting: 'Hosting',
  server: 'Server',
  ssl: 'SSL',
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || error.title || fallback;
  return error instanceof Error ? error.message : fallback;
}

function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return value;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function daysUntil(value: string): number | null {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.ceil((time - Date.now()) / 86_400_000);
}

function assetLink(item: Pick<NotificationHistoryItem, 'assetId' | 'assetType'>): string | null {
  if (item.assetType === 'domain') return `/domains/${encodeURIComponent(item.assetId)}`;
  if (item.assetType === 'server') return `/servers/${encodeURIComponent(item.assetId)}`;
  // TLS assets are keyed as `ssl_<domainId>` by the expiry monitor.
  if (item.assetType === 'ssl' && item.assetId.startsWith('ssl_')) {
    return `/domains/${encodeURIComponent(item.assetId.slice(4))}`;
  }
  return '/websites';
}

const ToggleRow: React.FC<{
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onChange(next: boolean): void;
}> = ({ checked, description, disabled, label, onChange }) => (
  <label className="flex items-start justify-between gap-unit-md rounded-lg border border-outline-variant/25 bg-surface-container-low p-unit-sm">
    <span className="min-w-0">
      <span className="block text-body-sm font-semibold text-on-surface">{label}</span>
      <span className="mt-0.5 block text-caption-xs text-secondary">{description}</span>
    </span>
    <input
      checked={checked}
      className="mt-1 h-4 w-4 shrink-0 accent-primary"
      disabled={disabled}
      type="checkbox"
      onChange={(event) => onChange(event.target.checked)}
    />
  </label>
);

export const NotificationsPage: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<NotificationHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [expiries, setExpiries] = useState<MonitoredExpiry[]>([]);
  const [expiriesLoading, setExpiriesLoading] = useState(true);
  const [expiriesError, setExpiriesError] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState({ assetId: '', assetType: 'domain' as MonitoredExpiry['assetType'], assetName: '', hostname: '', expiryDate: '' });
  const [expirySaving, setExpirySaving] = useState(false);
  const [expirySaveError, setExpirySaveError] = useState<string | null>(null);
  const [expirySaveNotice, setExpirySaveNotice] = useState<string | null>(null);

  const [checking, setChecking] = useState<'dry' | 'live' | null>(null);
  const [checkResult, setCheckResult] = useState<ExpiryCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const loadPreferences = useCallback(async (signal?: AbortSignal) => {
    setPreferencesLoading(true);
    setPreferencesError(null);
    try {
      const result = await getNotificationPreferences(signal);
      setPreferences(result);
      setDraft(result);
    } catch (error) {
      if (!signal?.aborted) setPreferencesError(errorMessage(error, 'Notification preferences could not be loaded.'));
    } finally {
      if (!signal?.aborted) setPreferencesLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (signal?: AbortSignal) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await listNotificationHistory(50, signal));
    } catch (error) {
      if (!signal?.aborted) setHistoryError(errorMessage(error, 'Notification history could not be loaded.'));
    } finally {
      if (!signal?.aborted) setHistoryLoading(false);
    }
  }, []);

  const loadExpiries = useCallback(async (signal?: AbortSignal) => {
    setExpiriesLoading(true);
    setExpiriesError(null);
    try {
      setExpiries(await listMonitoredExpiries(signal));
    } catch (error) {
      if (!signal?.aborted) setExpiriesError(errorMessage(error, 'Monitored expiries could not be loaded.'));
    } finally {
      if (!signal?.aborted) setExpiriesLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPreferences(controller.signal);
    void loadHistory(controller.signal);
    void loadExpiries(controller.signal);
    return () => controller.abort();
  }, [loadExpiries, loadHistory, loadPreferences]);

  const dirty = useMemo(() => {
    if (!preferences || !draft) return false;
    return (
      preferences.pushEnabled !== draft.pushEnabled ||
      preferences.notifyDomains !== draft.notifyDomains ||
      preferences.notifyServers !== draft.notifyServers ||
      preferences.notifyHosting !== draft.notifyHosting ||
      preferences.notifySsl !== draft.notifySsl ||
      preferences.reminderThresholds.join(',') !== draft.reminderThresholds.join(',')
    );
  }, [draft, preferences]);

  const unreadCount = history.filter((item) => !item.isRead).length;

  const updateDraft = (patch: Partial<NotificationPreferences>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setSaveNotice(null);
    setSaveError(null);
  };

  const toggleThreshold = (threshold: number) => {
    if (!draft) return;
    const next = draft.reminderThresholds.includes(threshold)
      ? draft.reminderThresholds.filter((value) => value !== threshold)
      : [...draft.reminderThresholds, threshold].sort((a, b) => b - a);
    if (next.length === 0) return;
    updateDraft({ reminderThresholds: next });
  };

  const savePreferences = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const saved = await updateNotificationPreferences({
        notifyDomains: draft.notifyDomains,
        notifyHosting: draft.notifyHosting,
        notifyServers: draft.notifyServers,
        notifySsl: draft.notifySsl,
        pushEnabled: draft.pushEnabled,
        reminderThresholds: draft.reminderThresholds,
      });
      setPreferences(saved);
      setDraft(saved);
      setSaveNotice('Notification preferences saved.');
    } catch (error) {
      setSaveError(errorMessage(error, 'Notification preferences could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (item: NotificationHistoryItem) => {
    if (item.isRead || markingId) return;
    setMarkingId(item.id);
    try {
      await markNotificationRead(item.id);
      setHistory((current) => current.map((entry) => entry.id === item.id
        ? { ...entry, isRead: true, readAt: new Date().toISOString() }
        : entry));
    } catch (error) {
      setHistoryError(errorMessage(error, 'The notification could not be marked as read.'));
    } finally {
      setMarkingId(null);
    }
  };

  const runCheck = async (dryRun: boolean) => {
    if (checking) return;
    setChecking(dryRun ? 'dry' : 'live');
    setCheckError(null);
    setCheckResult(null);
    try {
      const result = await triggerExpiryCheck({ dryRun });
      setCheckResult(result);
      if (!dryRun) {
        await Promise.all([loadHistory(), loadExpiries()]);
      }
    } catch (error) {
      setCheckError(errorMessage(error, 'The expiry check could not be run.'));
    } finally {
      setChecking(null);
    }
  };

  const saveExpiry = async (event: React.FormEvent) => {
    event.preventDefault();
    const date = new Date(expiryDraft.expiryDate);
    if (Number.isNaN(date.getTime())) {
      setExpirySaveError('Enter a valid expiry date and time.');
      return;
    }
    setExpirySaving(true);
    setExpirySaveError(null);
    setExpirySaveNotice(null);
    try {
      await upsertMonitoredExpiry({
        assetId: expiryDraft.assetId.trim(),
        assetType: expiryDraft.assetType,
        assetName: expiryDraft.assetName.trim(),
        hostname: expiryDraft.hostname.trim() || null,
        expiryDate: date.toISOString(),
      });
      setExpirySaveNotice('Expiry registered for monitoring.');
      setExpiryDraft({ assetId: '', assetType: 'domain', assetName: '', hostname: '', expiryDate: '' });
      await loadExpiries();
    } catch (error) {
      setExpirySaveError(errorMessage(error, 'The expiry could not be saved.'));
    } finally {
      setExpirySaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-unit-lg">
      <PageHeader
        actions={(
          <div className="flex flex-wrap gap-unit-xs">
            <Button disabled={checking !== null} variant="outline" onClick={() => void runCheck(true)}>
              {checking === 'dry' ? 'Previewing…' : 'Preview check (dry run)'}
            </Button>
            <Button disabled={checking !== null} onClick={() => void runCheck(false)}>
              {checking === 'live' ? 'Running…' : 'Run check & send'}
            </Button>
          </div>
        )}
        badge={unreadCount > 0 ? `${unreadCount} UNREAD` : undefined}
        description="Expiry reminders delivered to this account, the assets being watched, and the reminder thresholds used by the scheduler. Browser push subscriptions live in Settings → Alerts."
        title="Notifications"
      />

      {checkResult && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-unit-md text-body-sm" role="status">
          <p className="font-semibold text-on-surface">
            {checkResult.dryRun ? 'Dry run complete — no notifications were sent.' : 'Expiry check complete.'}
          </p>
          <p className="mt-1 text-secondary">
            Checked {checkResult.assetsChecked} asset{checkResult.assetsChecked === 1 ? '' : 's'} · identified {checkResult.remindersIdentified} reminder{checkResult.remindersIdentified === 1 ? '' : 's'} · sent {checkResult.remindersSent} · already sent {checkResult.remindersSkippedAlreadySent} · disabled {checkResult.remindersSkippedDisabled}.
          </p>
          {checkResult.errors.length > 0 && <p className="mt-1 text-caption-xs text-error">{checkResult.errors.length} error{checkResult.errors.length === 1 ? '' : 's'}: {checkResult.errors.join('; ')}</p>}
        </div>
      )}
      {checkError && <p className="text-body-sm text-error" role="alert">{checkError}</p>}

      <div className="grid grid-cols-1 items-start gap-unit-lg xl:grid-cols-3">
        <div className="flex flex-col gap-unit-lg xl:col-span-2">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-unit-sm">
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface">Delivery preferences</h2>
                <p className="mt-1 text-caption-xs text-secondary">Which assets generate reminders and how many days before expiry.</p>
              </div>
              <Link className="text-caption-xs font-semibold text-primary hover:underline" to="/settings">Browser push settings</Link>
            </div>

            {preferencesLoading ? <p className="mt-unit-md text-body-sm text-secondary" role="status">Loading preferences…</p>
              : preferencesError ? (
                <div className="mt-unit-md rounded-lg border border-error/30 bg-error/5 p-unit-sm" role="alert">
                  <p className="text-body-sm text-error">{preferencesError}</p>
                  <Button className="mt-unit-sm" size="sm" onClick={() => void loadPreferences()}>Try again</Button>
                </div>
              ) : draft && (
                <div className="mt-unit-md flex flex-col gap-unit-sm">
                  <ToggleRow checked={draft.pushEnabled} description="Master switch for every expiry reminder." label="Push notifications" onChange={(value) => updateDraft({ pushEnabled: value })} />
                  <div className="grid grid-cols-1 gap-unit-sm md:grid-cols-2">
                    <ToggleRow checked={draft.notifyDomains} description="Domain registration expiry reminders." label="Domains" onChange={(value) => updateDraft({ notifyDomains: value })} />
                    <ToggleRow checked={draft.notifyServers} description="Server and VPS renewal reminders." label="Servers" onChange={(value) => updateDraft({ notifyServers: value })} />
                    <ToggleRow checked={draft.notifyHosting} description="Hosting plan expiry reminders." label="Hosting" onChange={(value) => updateDraft({ notifyHosting: value })} />
                    <ToggleRow checked={draft.notifySsl} description="TLS certificate expiry reminders." label="SSL certificates" onChange={(value) => updateDraft({ notifySsl: value })} />
                  </div>
                  <div>
                    <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Reminder thresholds (days before expiry)</p>
                    <div className="mt-unit-xs flex flex-wrap gap-unit-xs">
                      {REMINDER_THRESHOLDS.map((threshold) => {
                        const selected = draft.reminderThresholds.includes(threshold);
                        return (
                          <button
                            aria-pressed={selected}
                            className={`rounded-full border px-unit-sm py-1 text-label-md transition-colors ${selected ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/40 bg-surface-container-low text-on-surface hover:border-primary/50'}`}
                            key={threshold}
                            type="button"
                            onClick={() => toggleThreshold(threshold)}
                          >
                            {threshold === 0 ? 'On expiry day' : `${threshold} days`}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-caption-xs text-secondary">At least one threshold must stay selected.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-unit-sm">
                    <Button disabled={!dirty || saving} onClick={() => void savePreferences()}>{saving ? 'Saving…' : 'Save preferences'}</Button>
                    {dirty && <span className="text-caption-xs text-secondary">Unsaved changes</span>}
                    {saveNotice && <span className="text-caption-xs font-semibold text-primary" role="status">{saveNotice}</span>}
                    {saveError && <span className="text-caption-xs text-error" role="alert">{saveError}</span>}
                  </div>
                </div>
              )}
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-unit-sm border-b border-outline-variant/25 p-unit-lg">
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface">Notification history</h2>
                <p className="mt-1 text-caption-xs text-secondary">The most recent 50 reminders recorded for this account.</p>
              </div>
              <div className="flex items-center gap-unit-xs">
                {unreadCount > 0 && <span className="rounded-full bg-primary/10 px-unit-sm py-0.5 text-caption-xs font-semibold text-primary">{unreadCount} unread</span>}
                <Button size="sm" variant="ghost" disabled={historyLoading} onClick={() => void loadHistory()}>Refresh</Button>
              </div>
            </div>
            {historyLoading ? <p className="p-unit-lg text-body-sm text-secondary" role="status">Loading notification history…</p>
              : historyError ? (
                <div className="p-unit-lg" role="alert">
                  <p className="text-body-sm text-error">{historyError}</p>
                  <Button className="mt-unit-sm" size="sm" onClick={() => void loadHistory()}>Try again</Button>
                </div>
              ) : history.length === 0 ? (
                <div className="p-unit-lg text-center">
                  <p className="font-semibold text-on-surface">No notifications yet</p>
                  <p className="mt-1 text-body-sm text-secondary">Run an expiry check or wait for the scheduler to record the first reminder.</p>
                </div>
              ) : (
                <ul className="divide-y divide-outline-variant/25">
                  {history.map((item) => {
                    const href = assetLink(item);
                    return (
                      <li className={`flex flex-col gap-unit-sm p-unit-md sm:flex-row sm:items-start sm:justify-between ${item.isRead ? '' : 'bg-primary/[0.03]'}`} key={item.id}>
                        <div className="flex min-w-0 items-start gap-unit-sm">
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.status === 'FAILED' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                            <span className="material-symbols-outlined text-[18px]">{item.assetType === 'server' ? 'dns' : item.assetType === 'ssl' ? 'shield' : item.assetType === 'hosting' ? 'cloud' : 'language'}</span>
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-unit-xs">
                              <p className="font-semibold text-on-surface">{item.title}</p>
                              {!item.isRead && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                              <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase text-secondary">{item.status}</span>
                            </div>
                            <p className="mt-1 text-body-sm text-secondary">{item.body}</p>
                            <p className="mt-1 text-caption-xs text-secondary">
                              {ASSET_LABEL[item.assetType]} · {item.assetName} · {item.reminderThreshold === 0 ? 'on expiry day' : `${item.reminderThreshold} days before expiry`} · {relativeTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-unit-xs sm:pl-unit-sm">
                          {href && <Link className="text-caption-xs font-semibold text-primary hover:underline" to={href}>Open asset</Link>}
                          {!item.isRead && <Button disabled={markingId === item.id} size="sm" variant="ghost" onClick={() => void markRead(item)}>{markingId === item.id ? 'Marking…' : 'Mark read'}</Button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
          </section>
        </div>

        <aside className="flex flex-col gap-unit-lg">
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
            <h2 className="text-headline-sm font-semibold text-on-surface">Track an expiry</h2>
            <p className="mt-1 text-caption-xs text-secondary">Add or update an asset reminder. Use the asset ID from its detail URL.</p>
            <form className="mt-unit-md flex flex-col gap-unit-sm" onSubmit={(event) => void saveExpiry(event)}>
              <label className="text-label-md font-medium text-on-surface">Asset type<select className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm" onChange={(event) => setExpiryDraft((draft) => ({ ...draft, assetType: event.target.value as MonitoredExpiry['assetType'] }))} value={expiryDraft.assetType}>{Object.entries(ASSET_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-label-md font-medium text-on-surface">Asset ID<input className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm" maxLength={120} onChange={(event) => setExpiryDraft((draft) => ({ ...draft, assetId: event.target.value }))} required value={expiryDraft.assetId} /></label>
              <label className="text-label-md font-medium text-on-surface">Asset name<input className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm" maxLength={255} onChange={(event) => setExpiryDraft((draft) => ({ ...draft, assetName: event.target.value }))} required value={expiryDraft.assetName} /></label>
              <label className="text-label-md font-medium text-on-surface">Hostname (optional)<input className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm" onChange={(event) => setExpiryDraft((draft) => ({ ...draft, hostname: event.target.value }))} value={expiryDraft.hostname} /></label>
              <label className="text-label-md font-medium text-on-surface">Expiry date and time<input className="mt-1 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 py-2 text-body-sm" onChange={(event) => setExpiryDraft((draft) => ({ ...draft, expiryDate: event.target.value }))} required type="datetime-local" value={expiryDraft.expiryDate} /></label>
              <Button disabled={expirySaving} type="submit">{expirySaving ? 'Saving…' : 'Save monitored expiry'}</Button>
              {expirySaveError && <p className="text-caption-xs text-error" role="alert">{expirySaveError}</p>}
              {expirySaveNotice && <p className="text-caption-xs text-healthy-text" role="status">{expirySaveNotice}</p>}
            </form>
          </section>
          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
            <div className="flex items-center justify-between gap-unit-sm">
              <h2 className="text-headline-sm font-semibold text-on-surface">Monitored expiries</h2>
              <span className="rounded bg-surface-container px-unit-xs py-0.5 font-label-mono text-caption-xs font-semibold text-primary">{expiries.length}</span>
            </div>
            <p className="mt-1 text-caption-xs text-secondary">Assets registered with the expiry monitor for this workspace.</p>
            {expiriesLoading ? <p className="mt-unit-md text-body-sm text-secondary" role="status">Loading expiries…</p>
              : expiriesError ? (
                <div className="mt-unit-md" role="alert">
                  <p className="text-body-sm text-error">{expiriesError}</p>
                  <Button className="mt-unit-sm" size="sm" onClick={() => void loadExpiries()}>Try again</Button>
                </div>
              ) : expiries.length === 0 ? (
                <p className="mt-unit-md text-body-sm text-secondary">No assets are registered with the expiry monitor yet.</p>
              ) : (
                <ul className="mt-unit-md flex flex-col gap-unit-sm">
                  {expiries.map((item) => {
                    const days = daysUntil(item.expiresAt);
                    const tone = days === null ? 'text-secondary' : days < 0 ? 'text-error' : days <= 7 ? 'text-error' : days <= 30 ? 'text-amber-700' : 'text-on-surface';
                    return (
                      <li className="rounded-lg border border-outline-variant/25 bg-surface-container-low p-unit-sm" key={item.id}>
                        <div className="flex items-start justify-between gap-unit-sm">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-on-surface">{item.assetName}</p>
                            <p className="mt-0.5 text-caption-xs text-secondary">{ASSET_LABEL[item.assetType]}{item.provider ? ` · ${item.provider}` : ''}{item.hostname ? ` · ${item.hostname}` : ''}</p>
                          </div>
                          <span className={`shrink-0 font-label-mono text-caption-xs font-semibold ${tone}`}>{days === null ? 'Unknown' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}</span>
                        </div>
                        <p className="mt-1 text-caption-xs text-secondary">Expires {formatDateTime(item.expiresAt)} · reminders {item.reminderThresholds.join(', ')} days before</p>
                      </li>
                    );
                  })}
                </ul>
              )}
          </section>

          <section className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-unit-lg">
            <div className="flex gap-unit-sm">
              <span className="material-symbols-outlined text-primary">info</span>
              <div>
                <h2 className="text-label-lg font-semibold text-on-surface">How reminders work</h2>
                <p className="mt-unit-xs text-caption-xs leading-relaxed text-secondary">
                  The scheduler checks monitored assets once a day and records one reminder per asset, expiry date, and threshold. A dry run reports what would be sent without creating notifications. Delivery requires an active device or browser push subscription.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};
