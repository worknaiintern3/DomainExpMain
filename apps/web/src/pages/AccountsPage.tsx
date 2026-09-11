import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, updateInventory } from '@/api/inventory';
import type { EmailAccount, ProviderAccount } from '@/api/types';
import { Button } from '@/components/common/Button';
import { InventoryState, ResourceFormModal, StatePanel } from '@/components/integration/InventoryWorkspace';
import { useEmailLabel } from '@/features/email-accounts/useEmailLabel';
import { emailConfiguration, providerConfiguration } from '@/features/integration/resource-configs';
import { useCursorInventory } from '@/hooks/useCursorInventory';

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
  const [actionError, setActionError] = useState<string | null>(null);
  const providers = useCursorInventory('provider-accounts', includeArchived);
  const emails = useCursorInventory('email-accounts', includeArchived);

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers.items;
    return providers.items.filter((account) => [
      account.label,
      account.providerKey,
      account.externalAccountId,
      account.notes,
    ].some((value) => value?.toLowerCase().includes(query)));
  }, [providers.items, search]);

  const visibleEmails = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return emails.items;
    return emails.items.filter((account) => [account.email, account.label, account.notes]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [emails.items, search]);

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
            Maintain provider identities and their optional login-email references. Billing, synchronization, and provider-centric asset totals are not connected.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button iconLeading="alternate_email" onClick={() => setEditingEmail('create')}>Add email</Button>
          <Button iconLeading="add_link" onClick={() => setEditingProvider('create')} variant="primary">Add provider account</Button>
        </div>
      </header>

      <section aria-label="Loaded account summary" className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Provider accounts loaded</p>
          <p className="mt-1 text-headline-md font-semibold">{providers.items.length}</p>
          <p className="text-caption-xs text-secondary">{providers.nextCursor ? 'More records are available' : 'Loaded page is complete'}</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Email accounts loaded</p>
          <p className="mt-1 text-headline-md font-semibold">{emails.items.length}</p>
          <p className="text-caption-xs text-secondary">{emails.nextCursor ? 'More records are available' : 'Loaded page is complete'}</p>
        </div>
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">Archived records loaded</p>
          <p className="mt-1 text-headline-md font-semibold">{[...providers.items, ...emails.items].filter((item) => item.inventoryState === 'ARCHIVED').length}</p>
          <p className="text-caption-xs text-secondary">Visible only when included below</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-1" role="tablist" aria-label="Account inventory type">
            <button type="button" role="tab" aria-selected={view === 'providers'} onClick={() => setView('providers')} className={`rounded-md px-3 py-2 text-label-md font-semibold ${view === 'providers' ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'}`}>Provider accounts</button>
            <button type="button" role="tab" aria-selected={view === 'emails'} onClick={() => setView('emails')} className={`rounded-md px-3 py-2 text-label-md font-semibold ${view === 'emails' ? 'bg-primary text-on-primary' : 'text-secondary hover:text-on-surface'}`}>Email accounts</button>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <label className="w-full max-w-md">
              <span className="sr-only">Filter loaded account records</span>
              <input className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3" placeholder="Filter loaded records only…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 whitespace-nowrap text-body-sm text-secondary">
              <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Include archived
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
            {visibleProviders.map((account) => (
              <article key={account.id} className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary"><span className="material-symbols-outlined">account_tree</span></div>
                    <div className="min-w-0"><h2 className="truncate text-title-md font-semibold">{account.label}</h2><p className="truncate font-label-mono text-caption-xs text-secondary">{account.providerKey}</p></div>
                  </div>
                  <InventoryState state={account.inventoryState} />
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><dt className="text-caption-xs uppercase text-secondary">External account</dt><dd className="mt-1 break-words text-body-sm">{account.externalAccountId || 'Not set'}</dd></div>
                  <div><dt className="text-caption-xs uppercase text-secondary">Login email</dt><dd className="mt-1 break-words text-body-sm"><LoginEmail id={account.loginEmailAccountId} /></dd></div>
                  {account.notes && <div className="sm:col-span-2"><dt className="text-caption-xs uppercase text-secondary">Notes</dt><dd className="mt-1 line-clamp-2 text-body-sm">{account.notes}</dd></div>}
                </dl>
                <div className="mt-4 flex justify-end gap-1 border-t border-outline-variant/30 pt-3">
                  <Link className="inline-flex h-8 items-center px-2 text-caption-xs font-semibold text-primary" to={`/accounts/${account.id}`}>Details</Link>
                  <Button size="sm" variant="ghost" onClick={() => setEditingProvider(account)}>Edit</Button>
                  <Button disabled={busyId === account.id} size="sm" variant={account.inventoryState === 'TRACKED' ? 'ghost' : 'outline'} onClick={() => void changeState(account, 'providers')}>{account.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleEmails.map((account) => (
              <article key={account.id} className="rounded-xl border border-outline-variant/50 bg-surface-container-low p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-title-md font-semibold">{account.label || account.email}</h2><p className="truncate text-body-sm text-secondary">{account.email}</p></div><InventoryState state={account.inventoryState} /></div>
                {account.notes && <p className="mt-3 line-clamp-2 text-body-sm text-secondary">{account.notes}</p>}
                <div className="mt-4 flex justify-end gap-1 border-t border-outline-variant/30 pt-3"><Button size="sm" variant="ghost" onClick={() => setEditingEmail(account)}>Edit</Button><Button disabled={busyId === account.id} size="sm" variant={account.inventoryState === 'TRACKED' ? 'ghost' : 'outline'} onClick={() => void changeState(account, 'emails')}>{account.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-outline-variant/30 px-4 py-3">
          <p className="text-caption-xs text-secondary">{visibleCount} shown from {activeList.items.length} loaded records. No workspace-wide total is implied.</p>
          {activeList.nextCursor && <Button disabled={activeList.loadingMore} onClick={() => void activeList.loadMore()}>{activeList.loadingMore ? 'Loading…' : 'Load more'}</Button>}
        </div>
      </section>

      {(actionError || activeList.loadMoreError) && <p className="text-body-sm text-error" role="alert">{actionError ?? activeList.loadMoreError}</p>}

      {editingProvider && <ResourceFormModal config={providerConfiguration} record={editingProvider === 'create' ? undefined : editingProvider} onClose={() => setEditingProvider(null)} onSaved={providers.upsert} />}
      {editingEmail && <ResourceFormModal config={emailConfiguration} record={editingEmail === 'create' ? undefined : editingEmail} onClose={() => setEditingEmail(null)} onSaved={emails.upsert} />}
    </div>
  );
};
