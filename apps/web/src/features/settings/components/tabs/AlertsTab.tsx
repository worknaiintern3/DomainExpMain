import React, { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { listAlertRules, patchAlertRule, type AlertRuleResponse } from '@/api/monitoring';
import { Button } from '@/components/common/Button';

const RULES = [
  'DOMAIN_EXPIRY_CRITICAL',
  'DOMAIN_EXPIRY_WARNING',
  'TLS_EXPIRY_CRITICAL',
  'TLS_EXPIRY_WARNING',
  'RETRIEVAL_FAILURE_REPEATED',
  'DNS_CHANGED',
  'CERT_CHANGED',
] as const;

type RuleKey = typeof RULES[number];

function isExpiry(key: RuleKey) { return key.includes('_EXPIRY_'); }
function isRetrieval(key: RuleKey) { return key === 'RETRIEVAL_FAILURE_REPEATED'; }

import type { AlertsNotificationSettings } from '../../settings.types';

export const AlertsTab: React.FC<{
  settings: AlertsNotificationSettings;
  onChange: (updated: Partial<AlertsNotificationSettings>) => void;
  onSave: () => void;
  isSaving: boolean;
  onOpenChannelConfig: (channel: 'email' | 'whatsapp') => void;
  role?: 'owner' | 'admin' | 'member';
}> = ({ role = 'owner' }) => {
  const canWrite = role === 'owner' || role === 'admin';
  const [rules, setRules] = useState<AlertRuleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { enabled: boolean; severity: 'CRITICAL' | 'WARNING' | 'INFO'; thresholdDays?: number | null; thresholdCount?: number | null }>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAlertRules().then((data) => {
      if (cancelled) return;
      setRules(data);
      const next: typeof form = {};
      for (const r of data) {
        next[r.key] = { enabled: r.enabled, severity: r.severity, thresholdDays: r.thresholdDays, thresholdCount: r.thresholdCount };
      }
      setForm(next);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load rules');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (key: RuleKey) => {
    if (!canWrite) return;
    setSavingKey(key);
    setError(null);
    const current = form[key];
    if (!current) {
      setError('Rule not configured');
      setSavingKey(null);
      return;
    }
    const payload: Record<string, unknown> = { enabled: current.enabled, severity: current.severity };
    if (isExpiry(key)) payload.thresholdDays = current.thresholdDays ?? null;
    else if (isRetrieval(key)) payload.thresholdCount = current.thresholdCount ?? null;
    // DNS/CERT: no thresholds
    try {
      const updated = await patchAlertRule(key, payload as never);
      setRules((prev) => {
        const exists = prev.find((r) => r.key === key);
        if (exists) return prev.map((r) => r.key === key ? updated : r);
        return [...prev, updated];
      });
      setForm((prev) => ({ ...prev, [key]: { enabled: updated.enabled, severity: updated.severity, thresholdDays: updated.thresholdDays, thresholdCount: updated.thresholdCount } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-body-sm text-secondary" role="status">Loading alert rules…</div>;
  if (error) return <div className="rounded-xl border border-error/30 bg-error/5 p-4" role="alert"><p className="text-error">{error}</p></div>;

  return (
    <section className="flex flex-col gap-unit-lg">
      <div className="rounded-xl bg-surface-container-lowest p-unit-lg shadow-micro border border-outline-variant/30">
        <h3 className="font-headline-sm text-headline-sm font-semibold">Alert Rules</h3>
        <p className="mt-1 text-body-sm text-secondary">Truthful per-rule configuration from the server. No defaults are fabricated.</p>
        {!canWrite && <p className="mt-2 text-body-sm text-secondary">Read-only: you need owner/admin to configure.</p>}
      </div>
      <div className="flex flex-col gap-4">
        {RULES.map((key) => {
          const rule = rules.find((r) => r.key === key);
          const draft = form[key];
          const isConfigured = !!rule;
          return (
            <div key={key} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{key}</h4>
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${!isConfigured ? 'bg-surface-container text-secondary' : 'bg-primary/10 text-primary'}`}>{isConfigured ? 'Configured' : 'Not configured'}</span>
              </div>
              {!isConfigured && <p className="mt-2 text-body-sm text-secondary">Not configured — owner/admin may configure via PATCH.</p>}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-caption-xs uppercase text-secondary">Enabled</span>
                  <select className="h-10 rounded-lg border border-outline-variant px-3" value={draft ? String(draft.enabled) : 'true'} onChange={(e) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { enabled: true, severity: 'INFO' as const }), enabled: e.target.value === 'true' } }))} disabled={!canWrite}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-caption-xs uppercase text-secondary">Severity</span>
                  <select className="h-10 rounded-lg border border-outline-variant px-3" value={draft?.severity ?? 'INFO'} onChange={(e) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { enabled: true }), severity: e.target.value as never } }))} disabled={!canWrite}>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </label>
                {isExpiry(key) && (
                  <label className="flex flex-col gap-1">
                    <span className="text-caption-xs uppercase text-secondary">Threshold days</span>
                    <input className="h-10 rounded-lg border border-outline-variant px-3" type="number" min={0} value={draft?.thresholdDays ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { enabled: true, severity: 'INFO' as const }), thresholdDays: e.target.value === '' ? null : Number(e.target.value) } }))} disabled={!canWrite} placeholder="e.g. 7" />
                  </label>
                )}
                {isRetrieval(key) && (
                  <label className="flex flex-col gap-1">
                    <span className="text-caption-xs uppercase text-secondary">Threshold count</span>
                    <input className="h-10 rounded-lg border border-outline-variant px-3" type="number" min={1} value={draft?.thresholdCount ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: { ...(f[key] ?? { enabled: true, severity: 'INFO' as const }), thresholdCount: e.target.value === '' ? null : Number(e.target.value) } }))} disabled={!canWrite} placeholder="e.g. 3" />
                  </label>
                )}
              </div>
              {canWrite && <Button className="mt-3" disabled={savingKey === key} onClick={() => void handleSave(key)}>{savingKey === key ? 'Saving…' : isConfigured ? 'Save' : 'Configure'}</Button>}
            </div>
          );
        })}
      </div>
    </section>
  );
};
