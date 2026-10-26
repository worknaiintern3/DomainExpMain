import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, updateInventory } from '@/api/inventory';
import type { EmailAccount, ProviderAccount } from '@/api/types';
import { Button } from '@/components/common/Button';
import { InventoryState, ResourceFormModal, StatePanel } from '@/components/integration/InventoryWorkspace';
import { useEmailLabel } from '@/features/email-accounts/useEmailLabel';
import { emailConfiguration, providerConfiguration } from '@/features/integration/resource-configs';
import { useCursorInventory } from '@/hooks/useCursorInventory';
import {
  PROVIDER_LOGOS,
  syncAllProviders,
  syncSingleProvider,
  fetchPortfolioSummary,
} from '@/services/portfolioService';

type AccountView = 'providers' | 'emails';

const LoginEmail: React.FC<{ id: string | null }> = ({ id }) => {
  if (!id) return <span className="text-outline">Not set</span>;
  return <ResolvedLoginEmail id={id} />;
};

const ResolvedLoginEmail: React.FC<{ id: string }> = ({ id }) => {
  const result = useEmailLabel(id);
  return (
    <span title={id}>
      {result.status === 'ready'
        ? result.label
        : result.status === 'resolving' ? 'Resolving email…' : 'Email reference unavailable'}
    </span>
  );
};

export const AccountsPage: React.FC = () => {
  const [view, setView] = useState<AccountView>('providers');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editingProvider, setEditingProvider] = useState<ProviderAccount | 'create' | null>(null);
  const [editingEmail, setEditingEmail] = useState<EmailAccount | 'create' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [portfolioStats, setPortfolioStats] = useState<{
    domains: number;
    servers: number;
    apps: number;
  }>({ domains: 0, servers: 0, apps: 0 });

  const [syncModal, setSyncModal] = useState<{
    totalDomains: number;
    totalServers: number;
    totalApps: number;
    message: string;
  } | null>(null);

  const providers = useCursorInventory('provider-accounts', includeArchived);
  const emails = useCursorInventory('email-accounts', includeArchived);

  const loadSummaryStats = async () => {
    try {
      const summary = await fetchPortfolioSummary();
      setPortfolioStats({
        domains: summary.totalDomains,
        servers: summary.totalServers,
        apps: summary.totalApps,
      });
    } catch {}
  };

  useEffect(() => {
    void loadSummaryStats();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handlePortfolioUpdated = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadSummaryStats();
        void providers.reload();
        void emails.reload();
      }, 1000);
    };
    window.addEventListener('domainpulse:portfolio-updated', handlePortfolioUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('domainpulse:portfolio-updated', handlePortfolioUpdated);
    };
  }, []);

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers.items;
    return providers.items.filter((account) => [
      account.label,
      account.providerKey,
      account.notes,
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [providers.items, search]);

  const visibleEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return emails.items;
    return emails.items.filter((account) => [account.email, account.label, account.notes]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [emails.items, search]);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const result = await syncAllProviders();
      setPortfolioStats({
        domains: result.totalDomains,
        servers: result.totalServers,
        apps: result.totalApps,
      });
      setSyncModal({
        totalDomains: result.totalDomains,
        totalServers: result.totalServers,
        totalApps: result.totalApps,
        message: result.message,
      });
      await providers.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to sync providers');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleSyncSingle = async (accountId: string) => {
    setSyncingId(accountId);
    try {
      const result = await syncSingleProvider(accountId);
      setPortfolioStats({
        domains: result.totalDomains,
        servers: result.totalServers,
        apps: result.totalApps,
      });
      setSyncModal({
        totalDomains: result.totalDomains,
        totalServers: result.totalServers,
        totalApps: result.totalApps,
        message: result.message,
      });
      await providers.reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to sync provider account');
    } finally {
      setSyncingId(null);
    }
  };

  const changeState = async (record: ProviderAccount | EmailAccount, resource: AccountView) => {
    setBusyId(record.id);
    setActionError(null);
    const list = resource === 'providers' ? providers : emails;
    const endpoint = resource === 'providers' ? 'provider-accounts' : 'email-accounts';
    try {
      if (record.inventoryState === 'TRACKED') {
        await archiveInventory(endpoint, record.id);
        if (includeArchived) list.markArchived(record.id);
        else list.remove(record.id);
      } else {
        const restored = await updateInventory(endpoint, record.id, { inventoryState: 'TRACKED' });
        if (resource === 'providers') providers.upsert(restored as ProviderAccount);
        else emails.upsert(restored as EmailAccount);
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The account record could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const getProviderLogo = (providerKey?: string) => {
    if (!providerKey) return null;
    const key = providerKey.toLowerCase().replace(/[^a-z0-9-]/g, '');
    for (const [pKey, path] of Object.entries(PROVIDER_LOGOS)) {
      if (key.includes(pKey) || pKey.includes(key)) {
        return path;
      }
    }
    return null;
  };

  const activeList = view === 'providers' ? providers : emails;
  const visibleCount = view === 'providers' ? visibleProviders.length : visibleEmails.length;

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-headline-md font-semibold text-on-surface">Accounts &amp; Emails</h1>
            <span className="rounded-full bg-primary-fixed px-2 py-1 text-caption-xs font-semibold text-on-primary-fixed-variant">
              {providers.items.length + emails.items.length} records loaded
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-body-sm text-secondary">
            Maintain provider identities, cloud credentials, and optional login-email references. Synchronize domains, servers, and applications with a single click.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            iconLeading="cloud_sync"
            onClick={() => void handleSyncAll()}
            disabled={isSyncingAll}
          >
            {isSyncingAll ? 'Syncing all…' : 'Sync All Providers'}
          </Button>
          <Button iconLeading="alternate_email" onClick={() => setEditingEmail('create')}>
            Add email
          </Button>
          <Button iconLeading="add_link" onClick={() => setEditingProvider('create')} variant="primary">
            Add provider account
          </Button>
        </div>
      </header>

      {/* Consistent Metrics Summary */}
      <section aria-label="Loaded account summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Connected Providers</p>
          <p className="mt-1 text-headline-md font-semibold text-primary">{providers.items.length}</p>
          <p className="text-caption-xs text-secondary">Cloud &amp; Registrar Accounts</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Synced Domains</p>
          <p className="mt-1 text-headline-md font-semibold text-on-surface">{portfolioStats.domains}</p>
          <p className="text-caption-xs text-secondary">Live portfolio inventory</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Synced Servers</p>
          <p className="mt-1 text-headline-md font-semibold text-on-surface">{portfolioStats.servers}</p>
          <p className="text-caption-xs text-secondary">VPS &amp; Cloud Nodes</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Email Accounts</p>
          <p className="mt-1 text-headline-md font-semibold text-on-surface">{emails.items.length}</p>
          <p className="text-caption-xs text-secondary">Administrative Inboxes</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-1" role="tablist" aria-label="Account inventory type">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'providers'}
              onClick={() => setView('providers')}
              className={`rounded-md px-3 py-2 text-label-md font-semibold ${view === 'providers' ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'}`}
            >
              Provider accounts ({providers.items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'emails'}
              onClick={() => setView('emails')}
              className={`rounded-md px-3 py-2 text-label-md font-semibold ${view === 'emails' ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'}`}
            >
              Email accounts ({emails.items.length})
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="w-full max-w-md">
              <span className="sr-only">Filter loaded account records</span>
              <input
                className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-body-sm text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary"
                placeholder="Filter loaded records only…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 whitespace-nowrap text-body-sm text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => setIncludeArchived(event.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary"
              />
              Include archived
            </label>
          </div>
        </div>

        {activeList.loading ? (
          <StatePanel icon="progress_activity" message={`Loading ${view === 'providers' ? 'provider accounts' : 'email accounts'}…`} spinning />
        ) : activeList.error ? (
          <StatePanel icon="error" message={activeList.error} action={<Button onClick={activeList.reload}>Try again</Button>} />
        ) : visibleCount === 0 ? (
          <StatePanel icon="account_circle" message={search ? 'No loaded records match this filter.' : `No ${view === 'providers' ? 'provider accounts' : 'email accounts'} have been added.`} />
        ) : view === 'providers' ? (
          <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
            {visibleProviders.map((account) => {
              const logoUrl = getProviderLogo(account.providerKey);
              const isSyncingThis = syncingId === account.id;

              return (
                <article key={account.id} className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4 hover:border-outline-variant transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest border border-outline-variant/60 p-2 shadow-xs">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt={account.label}
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="material-symbols-outlined text-[24px] text-primary">cloud</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-title-md font-semibold text-on-surface">{account.label}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-caption-xs text-secondary uppercase bg-surface-container px-1.5 py-0.5 rounded">
                            {account.providerKey}
                          </span>
                          <span className="text-caption-xs text-secondary">
                            ID: {account.externalAccountId || 'Default'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <InventoryState state={account.inventoryState} />
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 border-t border-outline-variant/30 pt-3">
                    <div>
                      <dt className="text-caption-xs uppercase font-medium text-secondary">Login email</dt>
                      <dd className="mt-1 break-words text-body-sm font-medium text-on-surface">
                        <LoginEmail id={account.loginEmailAccountId} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption-xs uppercase font-medium text-secondary">Sync Status</dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-body-sm font-medium text-primary">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        Live Synchronized
                      </dd>
                    </div>
                    {account.notes && (
                      <div className="sm:col-span-2">
                        <dt className="text-caption-xs uppercase font-medium text-secondary">Notes</dt>
                        <dd className="mt-1 line-clamp-2 text-body-sm text-secondary">{account.notes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3">
                    <button
                      type="button"
                      disabled={isSyncingThis}
                      onClick={() => void handleSyncSingle(account.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-caption-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${isSyncingThis ? 'animate-spin' : ''}`}>
                        sync
                      </span>
                      {isSyncingThis ? 'Syncing…' : 'Sync Now'}
                    </button>

                    <div className="flex items-center gap-1">
                      <Link
                        className="inline-flex h-8 items-center px-2.5 text-caption-xs font-semibold text-primary hover:underline"
                        to={`/accounts/${account.id}`}
                      >
                        Details
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => setEditingProvider(account)}>
                        Edit
                      </Button>
                      <Button
                        disabled={busyId === account.id}
                        size="sm"
                        variant={account.inventoryState === 'TRACKED' ? 'ghost' : 'outline'}
                        onClick={() => void changeState(account, 'providers')}
                      >
                        {account.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleEmails.map((account) => (
              <article key={account.id} className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <span className="material-symbols-outlined text-[20px]">mail</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-title-md font-semibold text-on-surface">{account.label || account.email}</h2>
                      <p className="truncate text-body-sm text-secondary font-mono text-caption-xs">{account.email}</p>
                    </div>
                  </div>
                  <InventoryState state={account.inventoryState} />
                </div>
                {account.notes && <p className="mt-3 line-clamp-2 text-body-sm text-secondary">{account.notes}</p>}
                <div className="mt-4 flex justify-end gap-1 border-t border-outline-variant/30 pt-3">
                  <Button size="sm" variant="ghost" onClick={() => setEditingEmail(account)}>
                    Edit
                  </Button>
                  <Button
                    disabled={busyId === account.id}
                    size="sm"
                    variant={account.inventoryState === 'TRACKED' ? 'ghost' : 'outline'}
                    onClick={() => void changeState(account, 'emails')}
                  >
                    {account.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/30 px-4 py-3">
          <p className="text-caption-xs text-secondary">
            {visibleCount} shown from {activeList.items.length} loaded records.
          </p>
          {activeList.nextCursor && (
            <Button disabled={activeList.loadingMore} onClick={() => void activeList.loadMore()}>
              {activeList.loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      </section>

      {(actionError || activeList.loadMoreError) && (
        <p className="text-body-sm text-error" role="alert">
          {actionError ?? activeList.loadMoreError}
        </p>
      )}

      {/* Sync Completion Modal */}
      {syncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[28px]">cloud_sync</span>
              </div>
              <div>
                <h3 className="text-title-lg font-bold text-on-surface">Provider Sync Complete</h3>
                <p className="text-caption-xs text-secondary font-medium">All provider inventory synchronized</p>
              </div>
            </div>

            <p className="mt-4 text-body-md text-on-surface leading-relaxed border-y border-outline-variant/40 py-3">
              {syncModal.message}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5 text-center">
                <div className="text-headline-sm font-bold text-primary">{syncModal.totalDomains}</div>
                <div className="text-caption-xs uppercase font-medium text-secondary">Domains</div>
              </div>
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5 text-center">
                <div className="text-headline-sm font-bold text-primary">{syncModal.totalServers}</div>
                <div className="text-caption-xs uppercase font-medium text-secondary">Servers</div>
              </div>
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5 text-center">
                <div className="text-headline-sm font-bold text-primary">{syncModal.totalApps}</div>
                <div className="text-caption-xs uppercase font-medium text-secondary">Apps</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSyncModal(null)}
                className="rounded-xl bg-primary px-5 py-2.5 text-label-md font-semibold text-on-primary shadow-sm hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProvider && (
        <ResourceFormModal
          config={providerConfiguration}
          record={editingProvider === 'create' ? undefined : editingProvider}
          onClose={() => setEditingProvider(null)}
          onSaved={providers.upsert}
        />
      )}
      {editingEmail && (
        <ResourceFormModal
          config={emailConfiguration}
          record={editingEmail === 'create' ? undefined : editingEmail}
          onClose={() => setEditingEmail(null)}
          onSaved={emails.upsert}
        />
      )}
    </div>
  );
};
