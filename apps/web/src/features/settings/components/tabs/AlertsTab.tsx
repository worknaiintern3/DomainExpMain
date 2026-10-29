import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { listAlertRules, patchAlertRule, type AlertRuleResponse } from '@/api/monitoring';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/api/notifications';
import { BrowserPushControl } from './BrowserPushControl';

const RULES = [
  'DOMAIN_EXPIRY_CRITICAL',
  'DOMAIN_EXPIRY_WARNING',
  'TLS_EXPIRY_CRITICAL',
  'TLS_EXPIRY_WARNING',
  'RETRIEVAL_FAILURE_REPEATED',
  'DNS_CHANGED',
  'CERT_CHANGED',
] as const;

type RuleKey = (typeof RULES)[number];

function isExpiry(key: RuleKey) {
  return key.includes('_EXPIRY_');
}
function isRetrieval(key: RuleKey) {
  return key === 'RETRIEVAL_FAILURE_REPEATED';
}

interface RuleMeta {
  key: RuleKey;
  name: string;
  category: 'Domain & DNS' | 'TLS & Security' | 'System Health';
  description: string;
  icon: string;
  defaultSeverity: 'CRITICAL' | 'WARNING' | 'INFO';
  defaultThresholdDays?: number;
  defaultThresholdCount?: number;
}

const RULE_METAS: Record<RuleKey, RuleMeta> = {
  DOMAIN_EXPIRY_CRITICAL: {
    key: 'DOMAIN_EXPIRY_CRITICAL',
    name: 'Domain Expiry Critical',
    category: 'Domain & DNS',
    description: 'Triggers high-priority escalation when a domain enters its critical expiration window.',
    icon: 'hourglass_empty',
    defaultSeverity: 'CRITICAL',
    defaultThresholdDays: 7,
  },
  DOMAIN_EXPIRY_WARNING: {
    key: 'DOMAIN_EXPIRY_WARNING',
    name: 'Domain Expiry Warning',
    category: 'Domain & DNS',
    description: 'Sends early renewal notification ahead of upcoming domain expiration.',
    icon: 'event_upcoming',
    defaultSeverity: 'WARNING',
    defaultThresholdDays: 30,
  },
  TLS_EXPIRY_CRITICAL: {
    key: 'TLS_EXPIRY_CRITICAL',
    name: 'TLS / SSL Certificate Expiry Critical',
    category: 'TLS & Security',
    description: 'Escalates when an active SSL/TLS certificate expires in less than the critical threshold days.',
    icon: 'gpp_bad',
    defaultSeverity: 'CRITICAL',
    defaultThresholdDays: 7,
  },
  TLS_EXPIRY_WARNING: {
    key: 'TLS_EXPIRY_WARNING',
    name: 'TLS / SSL Certificate Expiry Warning',
    category: 'TLS & Security',
    description: 'Early warning when an SSL/TLS certificate is up for renewal or re-issuance.',
    icon: 'verified_user',
    defaultSeverity: 'WARNING',
    defaultThresholdDays: 30,
  },
  RETRIEVAL_FAILURE_REPEATED: {
    key: 'RETRIEVAL_FAILURE_REPEATED',
    name: 'Repeated Metadata Retrieval Failure',
    category: 'System Health',
    description: 'Triggers when RDAP, DNS, or HTTP health checks continuously fail multiple consecutive runs.',
    icon: 'sync_problem',
    defaultSeverity: 'WARNING',
    defaultThresholdCount: 3,
  },
  DNS_CHANGED: {
    key: 'DNS_CHANGED',
    name: 'DNS Zone & Nameserver Changes',
    category: 'Domain & DNS',
    description: 'Flags unexpected alterations to DNS nameservers, root A/AAAA records, or MX routing.',
    icon: 'dns',
    defaultSeverity: 'WARNING',
  },
  CERT_CHANGED: {
    key: 'CERT_CHANGED',
    name: 'Certificate Re-issuance / Alteration',
    category: 'TLS & Security',
    description: 'Detects unexpected certificate authority changes or SHA-256 fingerprint shifts.',
    icon: 'security',
    defaultSeverity: 'WARNING',
  },
};

const COMMON_EXPIRY_REMINDER_DAYS = [60, 30, 15, 7, 3, 1, 0];

interface RuleDraft {
  enabled: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  thresholdDays?: number | null;
  thresholdCount?: number | null;
}

export const AlertsTab: React.FC<{
  role?: 'owner' | 'admin' | 'member' | null;
  onNotify?: (message: string, description?: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ role, onNotify }) => {
  // Any user who is owner, admin, or in personal workspace (role null/undefined) has full write access
  const canWrite = role !== 'member';

  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Form state for rules
  const [form, setForm] = useState<Record<RuleKey, RuleDraft>>({} as Record<RuleKey, RuleDraft>);
  const [initialForm, setInitialForm] = useState<Record<RuleKey, RuleDraft>>({} as Record<RuleKey, RuleDraft>);

  // Notification Preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [initialNotifPrefs, setInitialNotifPrefs] = useState<NotificationPreferences | null>(null);

  const reload = async () => {
    setLoading(true);
    setLoadError(null);
    setSaveError(null);
    try {
      const [rulesData, prefsData] = await Promise.allSettled([
        listAlertRules(),
        getNotificationPreferences(),
      ]);

      const fetchedRules = rulesData.status === 'fulfilled' ? rulesData.value : [];
      setRules(fetchedRules);

      const nextForm: Record<RuleKey, RuleDraft> = {} as Record<RuleKey, RuleDraft>;
      for (const key of RULES) {
        const found = fetchedRules.find((r) => r.key === key);
        const meta = RULE_METAS[key];
        nextForm[key] = {
          enabled: found?.enabled ?? true,
          severity: found?.severity ?? meta.defaultSeverity,
          thresholdDays: found?.thresholdDays ?? meta.defaultThresholdDays ?? null,
          thresholdCount: found?.thresholdCount ?? meta.defaultThresholdCount ?? null,
        };
      }
      setForm(nextForm);
      setInitialForm(JSON.parse(JSON.stringify(nextForm)));

      if (prefsData.status === 'fulfilled') {
        setNotifPrefs(prefsData.value);
        setInitialNotifPrefs(JSON.parse(JSON.stringify(prefsData.value)));
      } else {
        // Fallback default notification preferences
        const fallbackPrefs: NotificationPreferences = {
          id: 'default',
          userId: 'default',
          workspaceId: 'default',
          pushEnabled: false,
          reminderThresholds: [30, 15, 7, 3, 1, 0],
          notifyDomains: true,
          notifyServers: true,
          notifyHosting: true,
          notifySsl: true,
          timeZone: 'Asia/Kolkata',
          preferredHour: 9,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setNotifPrefs(fallbackPrefs);
        setInitialNotifPrefs(fallbackPrefs);
      }
    } catch (e) {
      setLoadError(
        e instanceof ApiError
          ? e.detail
          : e instanceof Error
            ? e.message
            : 'Could not load alert configuration',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  // Check if any rule or notification preference has been modified
  const isDirty = useMemo(() => {
    if (notifPrefs && initialNotifPrefs) {
      if (
        notifPrefs.notifyDomains !== initialNotifPrefs.notifyDomains ||
        notifPrefs.notifyServers !== initialNotifPrefs.notifyServers ||
        notifPrefs.notifyHosting !== initialNotifPrefs.notifyHosting ||
        notifPrefs.notifySsl !== initialNotifPrefs.notifySsl ||
        JSON.stringify(notifPrefs.reminderThresholds) !== JSON.stringify(initialNotifPrefs.reminderThresholds)
      ) {
        return true;
      }
    }
    return JSON.stringify(form) !== JSON.stringify(initialForm);
  }, [form, initialForm, notifPrefs, initialNotifPrefs]);

  const handleSaveSingleRule = async (key: RuleKey) => {
    if (!canWrite) return;
    setSavingKey(key);
    setSaveError(null);
    setSavedSuccessMessage(null);

    const current = form[key];
    const meta = RULE_METAS[key];

    if (isExpiry(key)) {
      const days = current?.thresholdDays ?? meta.defaultThresholdDays ?? 7;
      if (!Number.isInteger(days) || days < 0) {
        setSaveError(`${meta.name}: enter a valid threshold in days (0 or greater).`);
        setSavingKey(null);
        return;
      }
    } else if (isRetrieval(key)) {
      const count = current?.thresholdCount ?? meta.defaultThresholdCount ?? 3;
      if (!Number.isInteger(count) || count < 1) {
        setSaveError(`${meta.name}: enter a valid failure count (1 or greater).`);
        setSavingKey(null);
        return;
      }
    }

    const payload: Record<string, unknown> = {
      enabled: current.enabled,
      severity: current.severity,
    };
    if (isExpiry(key)) {
      payload.thresholdDays = current.thresholdDays ?? meta.defaultThresholdDays ?? 7;
    } else if (isRetrieval(key)) {
      payload.thresholdCount = current.thresholdCount ?? meta.defaultThresholdCount ?? 3;
    }

    try {
      const updated = await patchAlertRule(key, payload as never);
      setRules((prev) => {
        const exists = prev.find((r) => r.key === key);
        return exists ? prev.map((r) => (r.key === key ? updated : r)) : [...prev, updated];
      });
      setForm((prev) => ({
        ...prev,
        [key]: {
          enabled: updated.enabled,
          severity: updated.severity,
          thresholdDays: updated.thresholdDays,
          thresholdCount: updated.thresholdCount,
        },
      }));
      setInitialForm((prev) => ({
        ...prev,
        [key]: {
          enabled: updated.enabled,
          severity: updated.severity,
          thresholdDays: updated.thresholdDays,
          thresholdCount: updated.thresholdCount,
        },
      }));
      setSavedSuccessMessage(`Saved rule "${meta.name}" successfully.`);
      onNotify?.('Rule Saved', `${meta.name} configuration updated.`, 'success');
      setTimeout(() => setSavedSuccessMessage(null), 3000);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not save rule';
      setSaveError(msg);
      onNotify?.('Save Failed', msg, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAll = async () => {
    if (!canWrite) return;
    setIsSavingAll(true);
    setSaveError(null);
    setSavedSuccessMessage(null);

    try {
      const savePromises: Promise<any>[] = [];

      // 1. Save Notification Preferences if modified
      if (notifPrefs) {
        savePromises.push(
          updateNotificationPreferences({
            notifyDomains: notifPrefs.notifyDomains,
            notifyServers: notifPrefs.notifyServers,
            notifyHosting: notifPrefs.notifyHosting,
            notifySsl: notifPrefs.notifySsl,
            reminderThresholds: notifPrefs.reminderThresholds,
          })
            .then((updated) => {
              setNotifPrefs(updated);
              setInitialNotifPrefs(JSON.parse(JSON.stringify(updated)));
            })
            .catch(() => {
              try {
                localStorage.setItem('domainpulse:notif_prefs', JSON.stringify(notifPrefs));
              } catch {}
              setInitialNotifPrefs(JSON.parse(JSON.stringify(notifPrefs)));
            }),
        );
      }

      // 2. Save all modified Alert Rules
      for (const key of RULES) {
        const current = form[key];
        const initial = initialForm[key];
        if (JSON.stringify(current) !== JSON.stringify(initial)) {
          const meta = RULE_METAS[key];
          const payload: Record<string, unknown> = {
            enabled: current.enabled,
            severity: current.severity,
          };
          if (isExpiry(key)) {
            payload.thresholdDays = current.thresholdDays ?? meta.defaultThresholdDays ?? 7;
          } else if (isRetrieval(key)) {
            payload.thresholdCount = current.thresholdCount ?? meta.defaultThresholdCount ?? 3;
          }
          savePromises.push(
            patchAlertRule(key, payload as never).then((updated) => {
              setRules((prev) => {
                const exists = prev.find((r) => r.key === key);
                return exists ? prev.map((r) => (r.key === key ? updated : r)) : [...prev, updated];
              });
            }),
          );
        }
      }

      await Promise.all(savePromises);
      setInitialForm(JSON.parse(JSON.stringify(form)));
      setSavedSuccessMessage('All alert rules and notification settings saved successfully.');
      onNotify?.('Preferences Saved', 'All alert rules and notification thresholds have been persisted.', 'success');
      setTimeout(() => setSavedSuccessMessage(null), 3500);
    } catch (e) {
      const msg = e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not save settings';
      setSaveError(msg);
      onNotify?.('Save Failed', msg, 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  const applyPreset = (preset: 'standard' | 'strict' | 'relaxed') => {
    const nextForm = { ...form };
    if (preset === 'standard') {
      nextForm.DOMAIN_EXPIRY_CRITICAL = { enabled: true, severity: 'CRITICAL', thresholdDays: 7, thresholdCount: null };
      nextForm.DOMAIN_EXPIRY_WARNING = { enabled: true, severity: 'WARNING', thresholdDays: 30, thresholdCount: null };
      nextForm.TLS_EXPIRY_CRITICAL = { enabled: true, severity: 'CRITICAL', thresholdDays: 7, thresholdCount: null };
      nextForm.TLS_EXPIRY_WARNING = { enabled: true, severity: 'WARNING', thresholdDays: 30, thresholdCount: null };
      nextForm.RETRIEVAL_FAILURE_REPEATED = { enabled: true, severity: 'WARNING', thresholdDays: null, thresholdCount: 3 };
      nextForm.DNS_CHANGED = { enabled: true, severity: 'WARNING', thresholdDays: null, thresholdCount: null };
      nextForm.CERT_CHANGED = { enabled: true, severity: 'WARNING', thresholdDays: null, thresholdCount: null };
      if (notifPrefs) {
        setNotifPrefs({
          ...notifPrefs,
          reminderThresholds: [30, 15, 7, 3, 1, 0],
          notifyDomains: true,
          notifyServers: true,
          notifyHosting: true,
          notifySsl: true,
        });
      }
    } else if (preset === 'strict') {
      nextForm.DOMAIN_EXPIRY_CRITICAL = { enabled: true, severity: 'CRITICAL', thresholdDays: 14, thresholdCount: null };
      nextForm.DOMAIN_EXPIRY_WARNING = { enabled: true, severity: 'WARNING', thresholdDays: 45, thresholdCount: null };
      nextForm.TLS_EXPIRY_CRITICAL = { enabled: true, severity: 'CRITICAL', thresholdDays: 14, thresholdCount: null };
      nextForm.TLS_EXPIRY_WARNING = { enabled: true, severity: 'WARNING', thresholdDays: 45, thresholdCount: null };
      nextForm.RETRIEVAL_FAILURE_REPEATED = { enabled: true, severity: 'CRITICAL', thresholdDays: null, thresholdCount: 2 };
      nextForm.DNS_CHANGED = { enabled: true, severity: 'CRITICAL', thresholdDays: null, thresholdCount: null };
      nextForm.CERT_CHANGED = { enabled: true, severity: 'CRITICAL', thresholdDays: null, thresholdCount: null };
      if (notifPrefs) {
        setNotifPrefs({
          ...notifPrefs,
          reminderThresholds: [60, 30, 15, 7, 3, 1, 0],
          notifyDomains: true,
          notifyServers: true,
          notifyHosting: true,
          notifySsl: true,
        });
      }
    } else if (preset === 'relaxed') {
      nextForm.DOMAIN_EXPIRY_CRITICAL = { enabled: true, severity: 'WARNING', thresholdDays: 3, thresholdCount: null };
      nextForm.DOMAIN_EXPIRY_WARNING = { enabled: true, severity: 'INFO', thresholdDays: 15, thresholdCount: null };
      nextForm.TLS_EXPIRY_CRITICAL = { enabled: true, severity: 'WARNING', thresholdDays: 3, thresholdCount: null };
      nextForm.TLS_EXPIRY_WARNING = { enabled: true, severity: 'INFO', thresholdDays: 15, thresholdCount: null };
      nextForm.RETRIEVAL_FAILURE_REPEATED = { enabled: true, severity: 'INFO', thresholdDays: null, thresholdCount: 5 };
      nextForm.DNS_CHANGED = { enabled: true, severity: 'INFO', thresholdDays: null, thresholdCount: null };
      nextForm.CERT_CHANGED = { enabled: true, severity: 'INFO', thresholdDays: null, thresholdCount: null };
      if (notifPrefs) {
        setNotifPrefs({
          ...notifPrefs,
          reminderThresholds: [15, 7, 0],
          notifyDomains: true,
          notifyServers: true,
          notifyHosting: false,
          notifySsl: true,
        });
      }
    }
    setForm(nextForm);
  };

  const toggleReminderThreshold = (days: number) => {
    if (!notifPrefs) return;
    const current = notifPrefs.reminderThresholds ?? [];
    const next = current.includes(days)
      ? current.filter((d) => d !== days)
      : [...current, days].sort((a, b) => b - a);
    if (next.length === 0) return; // Keep at least one threshold
    setNotifPrefs({ ...notifPrefs, reminderThresholds: next });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-body-sm text-secondary flex flex-col items-center justify-center gap-3">
        <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
        <span>Loading alert rules &amp; notification policies…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-6 shadow-sm" role="alert">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-[24px]">error</span>
          <div>
            <h4 className="font-headline-sm text-headline-sm font-semibold text-error">
              Unable to load alert configuration
            </h4>
            <p className="mt-1 text-body-sm text-secondary">{loadError}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary/90 transition"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const enabledCount = Object.values(form).filter((f) => f.enabled).length;

  return (
    <section className="flex flex-col gap-unit-lg pb-unit-2xl">
      {/* 1. Definition & Scope Header Card */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-surface-container-lowest to-surface-container-low/50 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-[28px]">notifications_active</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  Alert Rules &amp; Notification Automation
                </h3>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-primary border border-primary/20">
                  REAL-TIME RISK ESCALATION
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-1.5 max-w-3xl leading-relaxed">
                DomainPulse continuously evaluates automated telemetry across your domains, DNS zones, TLS certificates, and hosting assets.
                Configure trigger thresholds, severity classifications, and notification channels below to stay ahead of expirations and unauthorized changes.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/alerts"
              className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low border border-outline-variant/40 px-4 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container transition"
            >
              <span className="material-symbols-outlined text-[18px]">view_timeline</span>
              <span>Open Alerts Center</span>
            </Link>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-outline-variant/30 pt-4">
          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Active Rules</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">
                {enabledCount} of {RULES.length} Enabled
              </p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-primary">rule</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Channels</p>
              <p className="font-mono text-sm font-bold text-on-surface mt-1">In-App &amp; Web Push</p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-indigo-600">send_and_archive</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Assets Scoped</p>
              <p className="font-mono text-xl font-bold text-on-surface mt-0.5">
                {[notifPrefs?.notifyDomains, notifPrefs?.notifySsl, notifPrefs?.notifyServers, notifPrefs?.notifyHosting].filter(Boolean).length} / 4 Types
              </p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-emerald-600">category</span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-secondary">Access Level</p>
              <p className="font-mono text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Full Access</span>
              </p>
            </div>
            <span className="material-symbols-outlined text-[22px] text-amber-600">admin_panel_settings</span>
          </div>
        </div>
      </div>

      {/* Global Presets & Batch Save Bar */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-micro border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-secondary uppercase tracking-wider mr-1">Threshold Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('standard')}
            className="px-3 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface text-caption-xs font-medium transition cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Enterprise Standard (7d/30d)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('strict')}
            className="px-3 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface text-caption-xs font-medium transition cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">security</span>
            <span>High Vigilance (14d/45d)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('relaxed')}
            className="px-3 py-1 rounded-lg border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface text-caption-xs font-medium transition cursor-pointer flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">bedtime</span>
            <span>Relaxed (3d/15d)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            disabled={!isDirty || isSavingAll || !canWrite}
            onClick={() => void handleSaveAll()}
            className="h-9 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary/90 transition shadow-micro cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSavingAll ? (
              <>
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></span>
                <span>Saving All…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Save All Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-4 rounded-xl border border-error/30 bg-error/5 text-error text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>{saveError}</span>
        </div>
      )}

      {savedSuccessMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-body-sm flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{savedSuccessMessage}</span>
        </div>
      )}

      {/* 2. Notification Preferences & Asset Scope */}
      {notifPrefs && (
        <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
          <div className="flex flex-col pb-unit-sm border-b border-surface-container-low">
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Asset Notification Scope
            </h4>
            <p className="font-body-sm text-body-sm text-secondary mt-1">
              Select which asset categories dispatch automated expiration and change notifications.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-unit-sm">
            {/* Domains Toggle */}
            <label className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60 transition flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">language</span>
                </div>
                <div>
                  <span className="font-label-md text-label-md font-semibold text-on-surface block">Domains</span>
                  <span className="text-[11px] text-secondary">Expiry &amp; Registrar Status</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.notifyDomains}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, notifyDomains: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </label>

            {/* SSL/TLS Toggle */}
            <label className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60 transition flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">shield</span>
                </div>
                <div>
                  <span className="font-label-md text-label-md font-semibold text-on-surface block">SSL / TLS</span>
                  <span className="text-[11px] text-secondary">Cert Validity &amp; Ciphers</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.notifySsl}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, notifySsl: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </label>

            {/* Cloud Servers Toggle */}
            <label className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60 transition flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">dns</span>
                </div>
                <div>
                  <span className="font-label-md text-label-md font-semibold text-on-surface block">Cloud Servers</span>
                  <span className="text-[11px] text-secondary">IP Routing &amp; Host Uptime</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.notifyServers}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, notifyServers: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </label>

            {/* Web Hosting Toggle */}
            <label className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:border-outline-variant/60 transition flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">cloud</span>
                </div>
                <div>
                  <span className="font-label-md text-label-md font-semibold text-on-surface block">Web Hosting</span>
                  <span className="text-[11px] text-secondary">Service Expirations</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifPrefs.notifyHosting}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, notifyHosting: e.target.checked })}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </label>
          </div>

          {/* Expiry Reminder Schedule */}
          <div className="mt-2 p-unit-md rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">schedule</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface">
                  Automated Expiry Reminder Schedule
                </span>
              </div>
              <span className="font-caption-xs text-caption-xs text-secondary">
                Dispatches notifications at these day milestones before expiration
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {COMMON_EXPIRY_REMINDER_DAYS.map((days) => {
                const active = notifPrefs.reminderThresholds?.includes(days);
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => toggleReminderThreshold(days)}
                    className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? 'bg-primary text-on-primary border-primary shadow-sm'
                        : 'bg-surface-container-lowest text-secondary border-outline-variant/40 hover:text-on-surface'
                    }`}
                  >
                    <span>{days === 0 ? 'Day of Expiry (0d)' : `${days} Days`}</span>
                    {active && <span className="material-symbols-outlined text-[14px]">check</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Alert Trigger Rules by Category */}
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30 flex flex-col gap-unit-md">
        <div className="flex flex-col pb-unit-sm border-b border-surface-container-low">
          <div className="flex items-center justify-between">
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Monitoring Trigger Rules ({RULES.length})
            </h4>
            <span className="font-caption-xs text-caption-xs text-secondary">
              Per-rule detection policy evaluated on automated syncs
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Configure individual trigger logic, severity escalations, and threshold values. You can save each rule individually or click &quot;Save All Changes&quot; above.
          </p>
        </div>

        <div className="flex flex-col gap-unit-md">
          {RULES.map((key) => {
            const meta = RULE_METAS[key];
            const rule = rules.find((r) => r.key === key);
            const draft = form[key] ?? {
              enabled: true,
              severity: meta.defaultSeverity,
              thresholdDays: meta.defaultThresholdDays ?? null,
              thresholdCount: meta.defaultThresholdCount ?? null,
            };
            const isConfigured = !!rule;
            const isSavingThis = savingKey === key;

            return (
              <div
                key={key}
                className="rounded-xl border border-outline-variant/30 bg-surface-container-low/40 hover:bg-surface-container-low transition p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-surface-container-lowest border border-outline-variant/40 flex items-center justify-center text-primary shadow-sm">
                      <span className="material-symbols-outlined text-[22px]">{meta.icon}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-label-lg text-label-lg font-semibold text-on-surface">
                          {meta.name}
                        </h5>
                        <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-surface-container-high text-secondary border border-outline-variant/30">
                          {meta.category}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            !isConfigured
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : draft.enabled
                                ? 'bg-primary/10 text-primary'
                                : 'bg-surface-container text-secondary'
                          }`}
                        >
                          {isConfigured ? (draft.enabled ? 'Active' : 'Disabled') : 'Default Active'}
                        </span>
                      </div>
                      <p className="text-[12px] text-secondary mt-0.5">{meta.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={isSavingThis || !canWrite}
                      onClick={() => void handleSaveSingleRule(key)}
                      className="h-8 px-3 rounded-lg bg-surface-container-lowest hover:bg-primary hover:text-on-primary border border-outline-variant/50 text-label-md text-secondary hover:border-primary transition font-medium cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingThis ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[15px]">save</span>
                          <span>Save Rule</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Rule Controls Form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-outline-variant/20">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                      Rule State
                    </span>
                    <select
                      className="h-9 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-label-md text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                      value={String(draft.enabled)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [key]: { ...draft, enabled: e.target.value === 'true' },
                        }))
                      }
                      disabled={!canWrite}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                      Alert Severity
                    </span>
                    <select
                      className="h-9 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-label-md text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                      value={draft.severity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          [key]: {
                            ...draft,
                            severity: e.target.value as 'CRITICAL' | 'WARNING' | 'INFO',
                          },
                        }))
                      }
                      disabled={!canWrite}
                    >
                      <option value="CRITICAL">CRITICAL (Red Escalation)</option>
                      <option value="WARNING">WARNING (Amber Notice)</option>
                      <option value="INFO">INFO (Blue Telemetry)</option>
                    </select>
                  </label>

                  {isExpiry(key) && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                        Threshold (Days to Expiry)
                      </span>
                      <input
                        className="h-9 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-mono text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 shadow-inner"
                        type="number"
                        min={0}
                        max={365}
                        value={draft.thresholdDays ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [key]: {
                              ...draft,
                              thresholdDays: e.target.value === '' ? null : Number(e.target.value),
                            },
                          }))
                        }
                        disabled={!canWrite}
                        placeholder={String(meta.defaultThresholdDays ?? 7)}
                      />
                    </label>
                  )}

                  {isRetrieval(key) && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                        Threshold (Consecutive Failures)
                      </span>
                      <input
                        className="h-9 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 font-mono text-label-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 shadow-inner"
                        type="number"
                        min={1}
                        max={20}
                        value={draft.thresholdCount ?? ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            [key]: {
                              ...draft,
                              thresholdCount: e.target.value === '' ? null : Number(e.target.value),
                            },
                          }))
                        }
                        disabled={!canWrite}
                        placeholder={String(meta.defaultThresholdCount ?? 3)}
                      />
                    </label>
                  )}

                  {!isExpiry(key) && !isRetrieval(key) && (
                    <div className="flex flex-col gap-1 justify-center">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                        Detection Trigger
                      </span>
                      <span className="h-9 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex items-center text-caption-xs text-secondary font-mono">
                        Instant Zone Diff On Sync
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Notification Delivery Channels */}
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-micro flex flex-col gap-unit-md">
        <div className="flex flex-col pb-unit-sm border-b border-surface-container-low">
          <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Notification Delivery Channels
          </h4>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Choose where alert notifications are routed when anomalies occur.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
          {/* Channel 1: In-App Center */}
          <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
                  </div>
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                    In-App Notification Feed
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Active</span>
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-2.5 leading-relaxed">
                Critical warnings, threshold breaches, and zone diffs are displayed live in the top bell indicator and the centralized Alerts dashboard.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex justify-end">
              <Link
                to="/alerts"
                className="text-primary hover:underline text-xs font-semibold flex items-center gap-1"
              >
                <span>Open Alerts Dashboard</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          {/* Channel 2: Browser Push */}
          <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                  </div>
                  <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                    Browser Web Push
                  </span>
                </div>
              </div>
              <p className="font-body-sm text-body-sm text-secondary mt-2.5 leading-relaxed">
                Receive instant desktop alerts even when the DomainPulse tab is minimized or closed.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20">
              <BrowserPushControl />
            </div>
          </div>
        </div>

        {/* Channels Roadmap */}
        <div className="p-3.5 rounded-xl border border-outline-variant/20 bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-caption-xs text-secondary">
            <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
            <span>Email digest and WhatsApp delivery channels are currently scheduled for external integration.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-surface-container text-secondary">
              Email — Coming soon
            </span>
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-surface-container text-secondary">
              WhatsApp — Coming soon
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
