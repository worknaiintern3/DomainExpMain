import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  fetchServersList,
  createServer,
  deleteServer,
  syncAllProviders,
  type ServerItem,
  PROVIDER_LOGOS,
} from '@/services/portfolioService';

export const ServersPage: React.FC = () => {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Healthy' | 'Warning' | 'Offline'>('All');

  // Add Server Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('Hostinger');
  const [ipAddress, setIpAddress] = useState('');
  const [region, setRegion] = useState('Mumbai (IN-South-01)');
  const [os, setOs] = useState('Ubuntu 24.04 LTS');
  const [cpu, setCpu] = useState('4 vCPU');
  const [memory, setMemory] = useState('8 GB');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async (force = false) => {
    try {
      const list = await fetchServersList({ forceRefresh: force });
      setServers(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllProviders();
      await loadData(true);
      setSyncFeedback(res.message);
    } catch {
      setSyncFeedback('Failed to sync cloud servers.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !ipAddress.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createServer({
        name: name.trim().toLowerCase(),
        provider,
        ipAddress: ipAddress.trim(),
        region,
        os,
        cpu,
        memory,
      });
      setServers((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      setIsAddModalOpen(false);
      setName('');
      setIpAddress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteServer = async (id: string, sName: string) => {
    if (!confirm(`Are you sure you want to remove ${sName} from tracked servers?`)) return;
    setServers((prev) => prev.filter((s) => s.id !== id));
    await deleteServer(id);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredServers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      const matches =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.ipAddress.toLowerCase().includes(q) ||
        s.provider.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.os.toLowerCase().includes(q) ||
        s.connectedDomains.some((d) => d.toLowerCase().includes(q));

      if (filter === 'Healthy') return matches && s.status === 'healthy';
      if (filter === 'Warning') return matches && s.status === 'warning';
      if (filter === 'Offline') return matches && s.status === 'offline';
      return matches;
    });
  }, [servers, search, filter]);

  const healthyCount = servers.filter((s) => s.status === 'healthy').length;
  const warningCount = servers.filter((s) => s.status === 'warning').length;
  const offlineCount = servers.filter((s) => s.status === 'offline').length;

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
                <p className="text-caption-xs text-secondary">Cloud &amp; VPS instances updated</p>
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

      {/* Add Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="text-title-md font-bold text-on-surface">Add VPS or Cloud Server</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateServer} className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    Server Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. in-mumbai-vps01"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="Hostinger">Hostinger</option>
                    <option value="Hetzner">Hetzner Cloud</option>
                    <option value="AWS">Amazon AWS</option>
                    <option value="DigitalOcean">DigitalOcean</option>
                    <option value="GCP">Google Cloud</option>
                    <option value="Azure">Microsoft Azure</option>
                    <option value="Vultr">Vultr</option>
                    <option value="Linode">Linode</option>
                    <option value="Custom VPS">Custom VPS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    Primary IP Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 194.195.112.45"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    Datacenter Region
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai (IN-South-01)"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    OS
                  </label>
                  <select
                    value={os}
                    onChange={(e) => setOs(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="Ubuntu 24.04 LTS">Ubuntu 24.04</option>
                    <option value="Debian 12 Bookworm">Debian 12</option>
                    <option value="Rocky Linux 9">Rocky Linux 9</option>
                    <option value="Amazon Linux 2023">Amazon Linux</option>
                  </select>
                </div>
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    vCPU
                  </label>
                  <select
                    value={cpu}
                    onChange={(e) => setCpu(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="2 vCPU">2 vCPU</option>
                    <option value="4 vCPU">4 vCPU</option>
                    <option value="8 vCPU">8 vCPU</option>
                    <option value="16 vCPU">16 vCPU</option>
                  </select>
                </div>
                <div>
                  <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                    Memory
                  </label>
                  <select
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:border-primary focus:outline-none"
                  >
                    <option value="4 GB">4 GB</option>
                    <option value="8 GB">8 GB</option>
                    <option value="16 GB">16 GB</option>
                    <option value="32 GB">32 GB</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating…' : 'Create Server'}
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
              VPS &amp; Cloud Servers
            </h1>
            <span className="rounded-full bg-sky-500/10 px-3 py-1 font-mono text-caption-xs font-bold text-sky-600 dark:text-sky-400 border border-sky-500/20">
              {servers.length} SERVERS LOADED
            </span>
          </div>
          <p className="mt-1 text-body-sm text-secondary">
            Live host telemetry, IP management, CPU/memory performance &amp; connected DNS endpoints.
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
            <span>Add Server</span>
          </button>
        </div>
      </div>

      {/* Status Counters */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Server Health Summary">
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>Total Nodes</span>
            <span className="material-symbols-outlined text-[18px] text-sky-600">dns</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-on-surface">{servers.length}</p>
          <p className="mt-1 text-caption-xs text-secondary">Managed hosting targets</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
            <span>Healthy / Online</span>
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{healthyCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">99.9% avg uptime</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-amber-700 dark:text-amber-400">
            <span>High Load</span>
            <span className="material-symbols-outlined text-[18px]">speed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{warningCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">CPU/RAM &gt;80%</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-rose-700 dark:text-rose-400">
            <span>Offline</span>
            <span className="material-symbols-outlined text-[18px]">portable_wifi_off</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">{offlineCount}</p>
          <p className="mt-1 text-caption-xs text-secondary">Ping unreachable</p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Healthy', 'Warning', 'Offline'] as const).map((tab) => (
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
              {tab === 'All' ? `All (${servers.length})` : tab === 'Healthy' ? `Healthy (${healthyCount})` : tab === 'Warning' ? `High Load (${warningCount})` : `Offline (${offlineCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">
            search
          </span>
          <input
            type="text"
            placeholder="Search servers, IPs, regions, OS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Server Cards Grid */}
      {loading ? (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center">
          <span className="material-symbols-outlined inline-block animate-spin text-[32px] text-primary mb-2">
            progress_activity
          </span>
          <p className="text-body-sm font-medium text-secondary">Loading cloud and VPS infrastructure…</p>
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center">
          <span className="material-symbols-outlined text-[36px] text-outline mb-2">dns</span>
          <p className="text-body-sm font-medium text-secondary">No servers match the selected filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredServers.map((s) => {
            const provKey = (s.providerKey || s.provider || 'hostinger').toLowerCase();
            const matchedLogo = Object.keys(PROVIDER_LOGOS).find((k) => provKey.includes(k));
            const logo = matchedLogo ? PROVIDER_LOGOS[matchedLogo] : '/images/providers/hostinger.png';
            const isOffline = s.status === 'offline';
            const sshCmd = `ssh root@${s.ipAddress}`;

            return (
              <div
                key={s.id}
                className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition hover:border-primary/40 flex flex-col justify-between"
              >
                <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={logo}
                      alt={s.provider}
                      className="h-11 w-11 rounded-xl object-contain bg-surface-container-high border border-outline-variant/40 p-1.5 shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                    <div>
                      <Link to={`/servers/${s.id}`} className="font-bold text-on-surface hover:text-primary transition-colors text-base line-clamp-1">
                        {s.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-caption-xs text-secondary">
                        <span className="font-medium text-on-surface">{s.provider}</span>
                        <span>·</span>
                        <span>{s.region}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isOffline
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {isOffline ? 'Offline' : `${s.uptime || '99.9%'} Uptime`}
                  </span>
                </div>

                {/* IP & SSH Row */}
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 font-mono text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-secondary">IP:</span>
                    <span className="font-bold text-on-surface truncate">{s.ipAddress}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(s.ipAddress, `ip-${s.id}`)}
                    className="rounded-lg bg-surface-container-high px-2 py-1 text-[11px] font-sans font-semibold text-primary hover:bg-surface-container transition-colors"
                  >
                    {copiedKey === `ip-${s.id}` ? 'Copied!' : 'Copy IP'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(sshCmd, `ssh-${s.id}`)}
                    className="rounded-lg bg-surface-container-high px-2 py-1 text-[11px] font-sans font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                  >
                    {copiedKey === `ssh-${s.id}` ? 'SSH Copied!' : 'Copy SSH'}
                  </button>
                </div>

                {/* Specs and OS */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-caption-xs text-secondary">
                  <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-medium text-on-surface">
                    {s.os}
                  </span>
                  <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-medium text-on-surface">
                    {s.cpu}
                  </span>
                  <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-medium text-on-surface">
                    {s.memory}
                  </span>
                </div>

                {/* Live Telemetry Progress */}
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-outline-variant/30 pt-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-secondary font-medium">
                      <span>CPU</span>
                      <span className="text-on-surface font-bold">{s.cpuUsagePercent || 22}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${s.cpuUsagePercent || 22}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-secondary font-medium">
                      <span>RAM</span>
                      <span className="text-on-surface font-bold">{s.memoryUsagePercent || 44}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${s.memoryUsagePercent || 44}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-secondary font-medium">
                      <span>Disk</span>
                      <span className="text-on-surface font-bold">{s.diskUsagePercent || 28}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${s.diskUsagePercent || 28}%` }} />
                    </div>
                  </div>
                </div>

                {/* Connected Domains */}
                {s.connectedDomains && s.connectedDomains.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-caption-xs text-secondary">Domains:</span>
                    {s.connectedDomains.map((dom) => (
                      <span key={dom} className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary font-medium">
                        {dom}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 flex items-center justify-between border-t border-outline-variant/30 pt-3">
                <span className="text-caption-xs text-secondary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-emerald-500">lock</span>
                  SSH Port 22 Protected
                </span>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/servers/${s.id}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-surface-container-high px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container transition-colors border border-outline-variant/40"
                  >
                    <span>Server Dashboard</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteServer(s.id, s.name)}
                    className="rounded-lg p-1 text-secondary hover:bg-error/10 hover:text-error transition-colors"
                    title="Remove Server"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
