import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, createInventory, listInventory, updateInventory } from '@/api/inventory';
import type { CursorPage, EmailAccount, InventoryMetadata, InventoryResource, InventoryResourceMap } from '@/api/types';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { useCursorInventory } from '@/hooks/useCursorInventory';

import { formatDateTime } from '@/lib/format';
import { usePreferences } from '@/preferences/PreferencesContext';
export interface ResourceField {
  create?: boolean;
  helpText?: string;
  input?: 'text' | 'textarea' | 'select' | 'email-account-select';
  key: string;
  label: string;
  list?: boolean;
  maxLength?: number;
  nullable?: boolean;
  options?: Array<{ label: string; value: string }>;
  pattern?: string;
  placeholder?: string;
  required?: boolean;
  render?(value: unknown, record: InventoryMetadata & Record<string, unknown>): React.ReactNode;
  trimOnBlur?: boolean;
  validate?(value: string): string | null;
  valueType?: 'boolean' | 'string';
}

export interface ResourceConfiguration<R extends InventoryResource> {
  description: string;
  detailBase?: string;
  fields: ResourceField[];
  resource: R;
  singular: string;
  title: string;
}

function displayValue(field: ResourceField, record: InventoryMetadata & Record<string, unknown>) {
  const value = record[field.key];
  if (field.render) return field.render(value, record);
  if (value === null || value === undefined || value === '') return <span className="text-outline">Unknown</span>;
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (field.key.endsWith('At') && typeof value === 'string') return formatDateTime(value);
  return String(value).split('_').join(' ');
}

function initialForm(
  fields: ResourceField[],
  record?: InventoryMetadata & Record<string, unknown>,
  createDefaults: Record<string, string> = {},
) {
  return Object.fromEntries(fields.filter((field) => field.create !== false).map((field) => {
    const value = record?.[field.key];
    const createDefault = createDefaults[field.key];
    if (!record && createDefault !== undefined && (value === null || value === undefined)) {
      return [field.key, createDefault];
    }
    if (
      !record &&
      (value === null || value === undefined) &&
      field.input === 'select' &&
      field.required &&
      !field.nullable
    ) {
      return [field.key, field.options?.[0]?.value ?? ''];
    }
    return [field.key, value === null || value === undefined ? '' : String(value)];
  }));
}

function toValue(field: ResourceField, value: string): unknown {
  if (field.valueType === 'boolean') return value === '' ? null : value === 'true';
  const clean = value.trim();
  return clean === '' && field.nullable ? null : clean;
}

const EmailAccountSelect: React.FC<{
  onChange(value: string): void;
  value: string;
}> = ({ onChange, value }) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const byId = new Map<string, EmailAccount>();
        let cursor: string | null = null;
        do {
          const page: CursorPage<EmailAccount> = await listInventory('email-accounts', {
            ...(cursor ? { cursor } : {}),
            includeArchived: true,
            limit: 100,
            signal: controller.signal,
          });
          for (const account of page.items) byId.set(account.id, account);
          cursor = page.nextCursor;
        } while (cursor && !controller.signal.aborted);
        if (!controller.signal.aborted) setAccounts([...byId.values()]);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : 'Email accounts could not be loaded.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const available = accounts.filter((account) => account.inventoryState === 'TRACKED' || account.id === value);
  const hasCurrent = available.some((account) => account.id === value);
  return (
    <>
      <select
        className="h-10 rounded-lg border border-outline-variant px-3"
        disabled={loading || loadError !== null}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{!loading && !loadError && available.length === 0 ? 'No email accounts available' : 'Not recorded'}</option>
        {value && !hasCurrent && <option value={value}>Current email account</option>}
        {available.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label ? `${account.label} — ${account.email}` : account.email}
            {account.inventoryState === 'ARCHIVED' ? ' (archived)' : ''}
          </option>
        ))}
      </select>
      {loadError && <span className="text-caption-xs font-normal text-error">{loadError}</span>}
    </>
  );
};

export const ResourceFormModal = <R extends InventoryResource>({
  config,
  onClose,
  onSaved,
  record,
}: {
  config: ResourceConfiguration<R>;
  onClose(): void;
  onSaved(record: InventoryResourceMap[R]): void;
  record?: InventoryResourceMap[R];
}) => {
  const editableFields = config.fields.filter((field) => field.create !== false);
  const { portfolio, status: preferencesStatus } = usePreferences();
  // New domains start with the auto-renew default from Portfolio settings ("unknown" leaves it blank).
  const createDefaults: Record<string, string> =
    config.resource === 'domains' && portfolio.defaultAutoRenew !== 'unknown'
      ? { autoRenew: portfolio.defaultAutoRenew === 'on' ? 'true' : 'false' }
      : {};
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(editableFields, record as unknown as InventoryMetadata & Record<string, unknown>, createDefaults));
  const [autoRenewEdited, setAutoRenewEdited] = useState(false);
  useEffect(() => {
    if (record || config.resource !== 'domains' || preferencesStatus !== 'ready' || autoRenewEdited) return;
    setForm((current) => ({ ...current, autoRenew: portfolio.defaultAutoRenew === 'unknown' ? '' : String(portfolio.defaultAutoRenew === 'on') }));
  }, [autoRenewEdited, config.resource, portfolio.defaultAutoRenew, preferencesStatus, record]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input: Record<string, unknown> = {};
    for (const field of editableFields) {
      const validationError = field.validate?.(form[field.key] ?? '');
      if (validationError) {
        setError(`${field.label}: ${validationError}`);
        return;
      }
      const parsed = toValue(field, form[field.key] ?? '');
      if (!record) {
        if (parsed !== '' && (parsed !== null || field.nullable)) input[field.key] = parsed;
      } else {
        const original = (record as unknown as InventoryMetadata & Record<string, unknown>)[field.key];
        if (!Object.is(parsed, original)) input[field.key] = parsed;
      }
    }
    if (record && Object.keys(input).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = record
        ? await updateInventory(config.resource, record.id, input)
        : await createInventory(config.resource, input);
      onSaved(saved);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
      <section className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface-container-lowest border border-outline-variant shadow-xl p-6" role="dialog" aria-modal="true" aria-labelledby="resource-form-title">
        <div className="flex items-center justify-between mb-5">
          <h2 id="resource-form-title" className="text-headline-sm font-semibold">{record ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close dialog" iconLeading="close" />
        </div>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={submit}>
          {editableFields.map((field) => (
            <label key={field.key} className={`flex flex-col gap-1.5 text-label-md font-medium ${field.input === 'textarea' ? 'md:col-span-2' : ''}`}>
              {field.label}{field.nullable && <span className="text-caption-xs text-secondary">Optional; blank clears</span>}
              {field.input === 'textarea' ? (
                <textarea className="min-h-24 rounded-lg border border-outline-variant p-3" maxLength={field.maxLength} value={form[field.key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))} />
              ) : field.input === 'email-account-select' ? (
                <EmailAccountSelect value={form[field.key] ?? ''} onChange={(value) => { setError(null); setForm((current) => ({ ...current, [field.key]: value })); }} />
              ) : field.input === 'select' ? (
                <select className="h-10 rounded-lg border border-outline-variant px-3" required={field.required} value={form[field.key] ?? ''} onChange={(event) => { if (field.key === 'autoRenew') setAutoRenewEdited(true); setForm((current) => ({ ...current, [field.key]: event.target.value })); }}>
                  {field.nullable && <option value="">Not recorded</option>}
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : (
                <input className="h-10 rounded-lg border border-outline-variant px-3 font-body-sm" maxLength={field.maxLength} pattern={field.pattern} placeholder={field.placeholder} required={field.required} title={field.helpText} value={form[field.key] ?? ''} onBlur={field.trimOnBlur ? (event) => setForm((current) => ({ ...current, [field.key]: event.target.value.trim() })) : undefined} onChange={(event) => { setError(null); setForm((current) => ({ ...current, [field.key]: event.target.value })); }} />
              )}
              {field.helpText && <span className="text-caption-xs font-normal text-secondary">{field.helpText}</span>}
            </label>
          ))}
          {error && <p role="alert" className="md:col-span-2 text-body-sm text-error">{error}</p>}
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </section>
    </div>
  );
};

export const InventoryWorkspace = <R extends InventoryResource>({ config }: { config: ResourceConfiguration<R> }) => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<InventoryResourceMap[R] | null | 'create'>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = useCursorInventory(config.resource, includeArchived);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list.items;
    return list.items.filter((item) => Object.values(item).some((value) =>
      typeof value === 'string' && value.toLowerCase().includes(query),
    ));
  }, [list.items, search]);
  const listFields = config.fields.filter((field) => field.list !== false).slice(0, 5);

  const archive = async (record: InventoryResourceMap[R]) => {
    setActionError(null);
    try {
      await archiveInventory(config.resource, record.id);
      if (includeArchived) list.markArchived(record.id);
      else list.remove(record.id);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The record could not be archived.');
    }
  };

  const restore = async (record: InventoryResourceMap[R]) => {
    setActionError(null);
    try {
      list.upsert(await updateInventory(config.resource, record.id, { inventoryState: 'TRACKED' }));
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The record could not be restored.');
    }
  };

  return (
    <div className="flex flex-col gap-unit-md w-full">
      <PageHeader title={config.title} badge={`${list.items.length} loaded`} description={config.description} actions={<Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add {config.singular}</Button>} />
      <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <label className="flex-1 max-w-xl">
            <span className="sr-only">Filter loaded records</span>
            <input className="w-full h-10 rounded-lg border border-outline-variant px-3" placeholder="Filter loaded records only…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-body-sm text-secondary">
            <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Include archived
          </label>
        </div>
        {list.loading ? (
          <StatePanel icon="progress_activity" message={`Loading ${config.title.toLowerCase()}…`} spinning />
        ) : list.error ? (
          <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
        ) : visibleItems.length === 0 ? (
          <StatePanel icon="inventory_2" message={search ? 'No loaded records match this filter.' : `No ${config.title.toLowerCase()} have been added.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-caption-xs uppercase text-secondary"><tr>{listFields.map((field) => <th key={field.key} className="px-4 py-3">{field.label}</th>)}<th className="px-4 py-3">State</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-outline-variant/25">
                {visibleItems.map((item) => {
                  const record = item as unknown as InventoryMetadata & Record<string, unknown>;
                  return <tr key={item.id} className="hover:bg-surface-container-low/60">{listFields.map((field) => <td key={field.key} className="px-4 py-3 text-body-sm max-w-xs truncate">{displayValue(field, record)}</td>)}<td className="px-4 py-3"><InventoryState state={item.inventoryState} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1">{config.detailBase && <Link className="h-8 px-2 inline-flex items-center text-primary font-semibold text-caption-xs" to={`${config.detailBase}/${item.id}`}>Details</Link>}<Button size="sm" variant="ghost" onClick={() => setEditing(item)}>Edit</Button>{item.inventoryState === 'ARCHIVED' ? <Button size="sm" variant="outline" onClick={() => void restore(item)}>Restore</Button> : <Button size="sm" variant="ghost" onClick={() => void archive(item)}>Archive</Button>}</div></td></tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-outline-variant/30 flex items-center justify-between gap-4">
          <p className="text-caption-xs text-secondary">{visibleItems.length} shown from {list.items.length} loaded records. Server-wide totals and search are unavailable.</p>
          {list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}
        </div>
      </div>
      {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
      {editing && <ResourceFormModal config={config} record={editing === 'create' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.upsert} />}
    </div>
  );
};

export const InventoryState: React.FC<{ state: InventoryMetadata['inventoryState'] }> = ({ state }) => (
  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${state === 'TRACKED' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-secondary'}`}>{state === 'TRACKED' ? 'Tracked' : 'Archived'}</span>
);

export const StatePanel: React.FC<{ action?: React.ReactNode; icon: string; message: string; spinning?: boolean }> = ({ action, icon, message, spinning }) => (
  <div className="min-h-52 flex flex-col items-center justify-center text-center p-8 gap-3">
    <span className={`material-symbols-outlined text-primary text-3xl ${spinning ? 'animate-spin' : ''}`}>{icon}</span>
    <p className="text-body-sm text-secondary max-w-lg">{message}</p>{action}
  </div>
);
