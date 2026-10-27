import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchDomainsList,
  createDomain,
  deleteDomain,
  toggleDomainAutoRenew,
  updateDomainWithWhois,
  syncAllProviders,
  type DomainItem,
  PROVIDER_LOGOS,
} from '@/services/portfolioService';
import { updateInventory } from '@/api/inventory';
import { lookupWhois } from '@/api/whois';
import type { NormalizedWhoisData } from '@/api/whois.types';
import { WhoisDetailsModal } from '@/components/whois/WhoisDetailsModal';

export const DomainsPage: React.FC = () => {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Warning' | 'Safe'>('All');

  // Add Domain Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newRegistrar, setNewRegistrar] = useState('Cloudflare');
  const [newAutoRenew, setNewAutoRenew] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Live WHOIS modal
  const [whoisModalOpen, setWhoisModalOpen] = useState(false);
  const [whoisData, setWhoisData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisError, setWhoisError] = useState<string | null>(null);

  const loadData = async (force = false) => {
    try {
      const list = await fetchDomainsList({ forceRefresh: force });
      setDomains(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleUpdated = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        void loadData();
      }, 1000);
    };
    window.addEventListener('domainpulse:portfolio-updated', handleUpdated);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('domainpulse:portfolio-updated', handleUpdated);
    };
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllProviders();
      await loadData(true);
      setSyncFeedback(res.message);
    } catch {
      setSyncFeedback('Failed to sync provider domains.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLookupWhois = async (domainName: string) => {
    const clean = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return;
    setWhoisModalOpen(true);
    setWhoisLoading(true);
    setWhoisError(null);
    try {
      const result = await lookupWhois(clean);
      setWhoisData(result);
      if (result && result.isRegistered) {
        const updated = updateDomainWithWhois(clean, result);
        if (updated) {
          setDomains((prev) => prev.map((d) => (d.name.toLowerCase() === clean ? updated : d)));
        }
      }
    } catch (err) {
      setWhoisError(err instanceof Error ? err.message : 'Failed to query live WHOIS directory');
    } finally {
      setWhoisLoading(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const domainInput = newDomainName.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domainInput || !domainInput.includes('.')) {
      setAddError('Please enter a valid domain name with extension (e.g. yourcompany.com)');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createDomain({
        name: domainInput,
        registrar: newRegistrar,
        autoRenew: newAutoRenew,
      });
      setDomains((prev) => [created, ...prev.filter((d) => d.id !== created.id && d.name.toLowerCase() !== domainInput)]);
      setIsAddModalOpen(false);
      setNewDomainName('');

      // Auto-query live WHOIS in background to populate real registry dates & registrar
      void lookupWhois(domainInput).then(async (live) => {
        if (live && live.isRegistered) {
          const synced = updateDomainWithWhois(domainInput, live);
          if (synced) {
            setDomains((prev) => prev.map((d) => (d.name.toLowerCase() === domainInput ? synced : d)));
          }
          try {
            await updateInventory('domains', created.id, {
              registeredAt: live.registeredAt || undefined,
              expiresAt: live.expiresAt || undefined,
              notes: `Registrar: ${live.registrar?.name || newRegistrar} | Nameservers: ${(live.nameservers || []).join(', ')}`,
            });
          } catch {}
        }
      }).catch(() => {});
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add domain to portfolio');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDomain = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from your tracked portfolio?`)) return;
    setDomains((prev) => prev.filter((d) => d.id !== id));
    await deleteDomain(id);
  };

  const handleToggleAutoRenew = async (domain: DomainItem) => {
    const updated = await toggleDomainAutoRenew(domain.id, !domain.autoRenew);
    if (updated) {
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? updated : d)));
    }
  };

  const filteredDomains = useMemo(() => {
    const q = search.trim().toLowerCase();
    return domains.filter((d) => {
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.registrar.toLowerCase().includes(q) ||
        d.dnsProvider.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q));

      if (filter === 'Critical') return matchesSearch && d.status === 'critical';
      if (filter === 'Warning') return matchesSearch && d.status === 'warning';
      if (filter === 'Safe') return matchesSearch && d.status === 'safe';
      return matchesSearch;
    });
  }, [domains, search, filter]);

  const criticalCount = domains.filter((d) => d.status === 'critical').length;
  const warningCount = domains.filter((d) => d.status === 'warning').length;
  const safeCount = domains.filter((d) => d.status === 'safe').length;

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      {/* Sync Feedback Modal */}
      {syncFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="text-title-md font-bold text-on-surface">Portfolio Synced</h3>
                <p className="text-caption-xs text-secondary">Registrar &amp; Cloud accounts updated</p>
              </div>
            </div>
            <p className="mt-4 text-body-sm text-secondary leading-relaxed">{syncFeedback}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSyncFeedback(null)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary/90 shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Domain Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="text-title-md font-bold text-on-surface">Add Domain to Portfolio</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleAddDomain} className="mt-4 flex flex-col gap-4">
              {addError && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-caption-xs text-rose-500 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Domain Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. yourcompany.com"
                  value={newDomainName}
                  onChange={(e) => {
                    setNewDomainName(e.target.value);
                    if (addError) setAddError(null);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Registrar Provider
                </label>
                <select
                  value={newRegistrar}
                  onChange={(e) => setNewRegistrar(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="Cloudflare">Cloudflare</option>
                  <option value="Hostinger">Hostinger</option>
                  <option value="GoDaddy">GoDaddy</option>
                  <option value="Namecheap">Namecheap</option>
                  <option value="AWS Route 53">AWS Route 53</option>
                  <option value="Hetzner">Hetzner</option>
                  <option value="Porkbun">Porkbun</option>
                  <option value="Google Domains">Google Domains</option>
                  <option value="Other">Other / Custom Registrar</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-outline-variant/60 bg-surface-container-low p-3.5">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Auto-Renewal</p>
                  <p className="text-caption-xs text-secondary">Keep active before expiration</p>
                </div>
                <input
                  type="checkbox"
                  checked={newAutoRenew}
                  onChange={(e) => setNewAutoRenew(e.target.checked)}
                  className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddError(null);
                  }}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding…' : 'Add Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-headline-md font-bold tracking-tight text-on-surface">
              My Domains Portfolio
            </h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-caption-xs font-bold text-primary border border-primary/20">
              {domains.length} DOMAINS
            </span>
          </div>
          <p className="mt-1 text-body-sm text-secondary">
            Live WHOIS records, SSL security status, expiration countdowns &amp; renewal forecast.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container hover:border-primary/40 disabled:opacity-50 shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px] text-primary ${isSyncing ? 'animate-spin' : ''}`}>
              sync
            </span>
            <span>{isSyncing ? 'Syncing…' : 'Sync Providers'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary/90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Domain</span>
          </button>
        </div>
      </div>

      {/* Top Portfolio Counters */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Domain Status Summary">
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>Total Domains</span>
            <span className="material-symbols-outlined text-[18px] text-primary">language</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">{domains.length}</p>
          <p className="mt-1 text-caption-xs text-secondary">All monitored extensions</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
            <span>Healthy (&gt;30d)</span>
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{safeCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">Safe expiration timeline</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-amber-700 dark:text-amber-400">
            <span>Warning (&le;30d)</span>
            <span className="material-symbols-outlined text-[18px]">schedule</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{warningCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">Expiring in 30 days</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-rose-700 dark:text-rose-400">
            <span>Critical (&le;14d)</span>
            <span className="material-symbols-outlined text-[18px]">alarm</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{criticalCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">Immediate renewal required</p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Critical', 'Warning', 'Safe'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                filter === tab
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              {tab === 'All' ? `All (${domains.length})` : tab === 'Critical' ? `Critical (${criticalCount})` : tab === 'Warning' ? `Warning (${warningCount})` : `Healthy (${safeCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">
            search
          </span>
          <input
            type="text"
            placeholder="Search domains, registrars, TLDs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Main Domains Table */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low text-caption-xs font-semibold uppercase tracking-wider text-secondary">
                <th className="py-3.5 px-4">Domain</th>
                <th className="py-3.5 px-4">Registrar</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Days Left</th>
                <th className="py-3.5 px-4">Renewal (₹)</th>
                <th className="py-3.5 px-4">Auto-Renew</th>
                <th className="py-3.5 px-4">DNS &amp; SSL</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-secondary">
                    <span className="material-symbols-outlined inline-block animate-spin text-[28px] text-primary mb-2">
                      progress_activity
                    </span>
                    <p className="text-body-sm font-medium">Loading live domains…</p>
                  </td>
                </tr>
              ) : filteredDomains.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-secondary">
                    <span className="material-symbols-outlined text-[32px] text-outline mb-2">search_off</span>
                    <p className="text-body-sm font-medium">No domains match the selected criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredDomains.map((d) => {
                  const isCrit = d.status === 'critical';
                  const isWarn = d.status === 'warning';
                  const regKey = (d.providerKey || d.providerLabel || d.registrar || 'hostinger').toLowerCase();
                  const matchedLogo = Object.keys(PROVIDER_LOGOS).find((k) => regKey.includes(k));
                  const logo = matchedLogo ? PROVIDER_LOGOS[matchedLogo] : '/images/providers/hostinger.png';

                return (
                  <tr key={d.id} className="transition-colors hover:bg-surface-container-low/40">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={d.logoUrl || `https://www.google.com/s2/favicons?domain=${d.name}&sz=64`}
                          alt={d.name}
                          className="h-8 w-8 rounded-lg object-contain bg-surface-container-high border border-outline-variant/40 p-1"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                        <div>
                          <Link to={`/domains/${d.id}`} className="font-semibold text-on-surface hover:text-primary transition-colors">
                            {d.name}
                          </Link>
                          <div className="flex items-center gap-1.5 text-caption-xs text-secondary">
                            <span className="font-mono font-bold text-primary uppercase text-[10px]">{d.tld}</span>
                            <span>·</span>
                            <span>Reg: {d.registrationDate || '2023-01-15'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <img src={logo} alt="Registrar" className="h-5 w-5 object-contain" />
                        <span className="text-body-sm font-medium text-on-surface">
                          {d.registrar.split(' ')[0]}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-body-sm text-secondary">
                      {new Date(d.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isCrit
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : isWarn
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {d.daysRemaining} days left
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      ₹{d.renewalPrice || 899}
                    </td>

                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleAutoRenew(d)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors border ${
                          d.autoRenew
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-surface-container-high text-secondary border-outline-variant/40 hover:bg-surface-container'
                        }`}
                        title="Click to toggle auto-renewal"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {d.autoRenew ? 'check_circle' : 'cancel'}
                        </span>
                        <span>{d.autoRenew ? 'Enabled' : 'Disabled'}</span>
                      </button>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-caption-xs text-secondary">
                        <span className="font-medium text-on-surface">{d.dnsProvider}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">lock</span>
                          SSL Active
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLookupWhois(d.name)}
                          className="rounded-lg p-1.5 text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                          title="Query Live WHOIS Data"
                        >
                          <span className="material-symbols-outlined text-[18px]">manage_search</span>
                        </button>
                        <Link
                          to={`/domains/${d.id}`}
                          className="rounded-lg p-1.5 text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                          title="View Full Details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteDomain(d.id, d.name)}
                          className="rounded-lg p-1.5 text-secondary hover:bg-error/10 hover:text-error transition-colors"
                          title="Delete Domain"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live WHOIS Details Modal */}
      <WhoisDetailsModal
        data={whoisData}
        error={whoisError}
        isOpen={whoisModalOpen}
        loading={whoisLoading}
        onClose={() => setWhoisModalOpen(false)}
      />
    </div>
  );
};
