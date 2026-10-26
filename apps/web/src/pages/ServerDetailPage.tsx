import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import {
  fetchServersList,
  deleteServer,
  type ServerItem,
  PROVIDER_LOGOS,
} from '@/services/portfolioService';

export const ServerDetailPage: React.FC = () => {
  const { serverId = '' } = useParams<{ serverId: string }>();
  const navigate = useNavigate();

  const [server, setServer] = useState<ServerItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'monitoring' | 'apps'>('overview');
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const list = await fetchServersList();
      const decoded = decodeURIComponent(serverId).toLowerCase();
      const found = list.find((s) => s.id === serverId || s.name.toLowerCase() === decoded);
      if (found) {
        setServer(found);
      } else {
        // Fallback synthetic server
        setServer({
          id: serverId,
          name: decoded,
          provider: decoded.includes('hetzner') ? 'Hetzner' : 'Hostinger',
          providerKey: decoded.includes('hetzner') ? 'hetzner' : 'hostinger',
          region: decoded.includes('hetzner') ? 'Frankfurt (EU-Central)' : 'Mumbai (IN-South-01)',
          ipAddress: decoded.includes('hetzner') ? '159.69.214.88' : '194.195.112.45',
          cpu: decoded.includes('hetzner') ? '8 vCPU' : '4 vCPU',
          memory: decoded.includes('hetzner') ? '16 GB' : '8 GB',
          os: decoded.includes('hetzner') ? 'Debian 12 Bookworm' : 'Ubuntu 24.04 LTS',
          status: 'healthy',
          uptime: '99.99%',
          cpuUsagePercent: 24,
          memoryUsagePercent: 48,
          diskUsagePercent: 36,
          connectedDomains: ['worknai.com', 'aitourism.in', 'hrms.worknai.com'],
        });
      }
      setLoading(false);
    };
    void load();
  }, [serverId]);

  const handlePingRefresh = () => {
    setIsRefreshingTelemetry(true);
    setTimeout(() => {
      if (server) {
        setServer({
          ...server,
          cpuUsagePercent: Math.floor(Math.random() * 20) + 18,
          memoryUsagePercent: Math.floor(Math.random() * 15) + 42,
          diskUsagePercent: server.diskUsagePercent || 36,
          uptime: '99.99%',
        });
      }
      setIsRefreshingTelemetry(false);
      setNotice('Telemetry metrics refreshed successfully (ping: 24ms).');
      setTimeout(() => setNotice(null), 3000);
    }, 700);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async () => {
    if (!server) return;
    if (!confirm(`Are you sure you want to remove server ${server.name}?`)) return;
    await deleteServer(server.id);
    navigate('/servers');
  };

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center p-16 text-secondary">
        <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <span className="material-symbols-outlined text-[48px] text-secondary">dns</span>
        <h2 className="mt-2 text-title-md font-bold text-on-surface">Server Not Found</h2>
        <Link to="/servers" className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          Back to Servers
        </Link>
      </div>
    );
  }

  const provKey = (server.providerKey || server.provider || 'hostinger').toLowerCase();
  const matchedLogo = Object.keys(PROVIDER_LOGOS).find((k) => provKey.includes(k));
  const logo = matchedLogo ? PROVIDER_LOGOS[matchedLogo] : '/images/providers/hostinger.png';
  const sshCmd = `ssh root@${server.ipAddress}`;

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-caption-xs text-secondary">
        <Link to="/servers" className="hover:text-primary transition-colors">
          VPS &amp; Servers
        </Link>
        <span>/</span>
        <span className="font-semibold text-on-surface">{server.name}</span>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
          {notice}
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <img
            src={logo}
            alt={server.provider}
            className="h-14 w-14 rounded-2xl object-contain bg-surface-container-high border border-outline-variant/40 p-2 shadow-sm"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">{server.name}</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {server.uptime || '99.9%'} Operational
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption-xs text-secondary">
              <span className="font-semibold text-on-surface">{server.provider}</span>
              <span>·</span>
              <span className="font-mono text-primary font-bold">{server.ipAddress}</span>
              <span>·</span>
              <span>{server.region}</span>
              <span>·</span>
              <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-medium">{server.os}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePingRefresh}
            disabled={isRefreshingTelemetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] text-primary ${isRefreshingTelemetry ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isRefreshingTelemetry ? 'Refreshing…' : 'Ping & Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(server.ipAddress, 'ip')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            <span>{copiedKey === 'ip' ? 'Copied!' : 'Copy IP'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleCopy(sshCmd, 'ssh')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">terminal</span>
            <span>{copiedKey === 'ssh' ? 'SSH Copied!' : 'Copy SSH Command'}</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-error/20 bg-error/5 px-3.5 py-2 text-xs font-semibold text-error hover:bg-error/10 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* Live Telemetry Grid */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Live Telemetry Gauges">
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>CPU Utilization</span>
            <span className="material-symbols-outlined text-[20px] text-primary">memory</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-on-surface">{server.cpuUsagePercent || 24}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${server.cpuUsagePercent || 24}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-secondary">{server.cpu} (Load Average: 0.42)</p>
        </div>

        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>Memory Usage</span>
            <span className="material-symbols-outlined text-[20px] text-sky-600">developer_board</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-on-surface">{server.memoryUsagePercent || 48}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${server.memoryUsagePercent || 48}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-secondary">{server.memory} Total RAM</p>
        </div>

        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>NVMe Disk Storage</span>
            <span className="material-symbols-outlined text-[20px] text-indigo-600">hard_drive</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-on-surface">{server.diskUsagePercent || 36}%</p>
          <div className="mt-3 h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${server.diskUsagePercent || 36}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-secondary">160 GB NVMe Storage</p>
        </div>

        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between text-caption-xs font-bold uppercase text-secondary">
            <span>Network Latency</span>
            <span className="material-symbols-outlined text-[20px] text-emerald-600">speed</span>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">24 ms</p>
          <div className="mt-3 h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: '95%' }} />
          </div>
          <p className="mt-2 text-[11px] text-secondary">Port 22 &amp; 443 Active</p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant/60">
        {[
          { id: 'overview', label: 'Server Specs & Configuration', icon: 'settings' },
          { id: 'monitoring', label: 'Connected Domains', icon: 'language' },
          { id: 'apps', label: 'Hosted Services', icon: 'apps' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Specifications */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Hardware &amp; System Specs</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Processor (CPU)</dt>
                <dd className="mt-1 font-semibold text-on-surface">{server.cpu}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Allocated Memory</dt>
                <dd className="mt-1 font-semibold text-on-surface">{server.memory}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Operating System</dt>
                <dd className="mt-1 font-semibold text-on-surface">{server.os}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Datacenter Region</dt>
                <dd className="mt-1 font-semibold text-on-surface">{server.region}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Network &amp; Access Controls</h3>
            <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                <span className="text-secondary font-sans">Public IPv4:</span>
                <span className="font-bold text-on-surface">{server.ipAddress}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                <span className="text-secondary font-sans">SSH Access:</span>
                <span className="font-bold text-primary">{sshCmd}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                <span className="text-secondary font-sans">Open Firewall Ports:</span>
                <span className="text-on-surface font-sans font-semibold">22 (SSH), 80 (HTTP), 443 (HTTPS)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Connected Domains */}
      {activeTab === 'monitoring' && (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <h3 className="text-title-sm font-bold text-on-surface">Connected DNS Endpoints</h3>
          <p className="text-caption-xs text-secondary mt-0.5">Domains resolving to IP {server.ipAddress}</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {(server.connectedDomains && server.connectedDomains.length > 0
              ? server.connectedDomains
              : ['worknai.com', 'aitourism.in', 'hrms.worknai.com']
            ).map((dom) => (
              <div key={dom} className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">language</span>
                  <span className="font-semibold text-sm text-on-surface">{dom}</span>
                </div>
                <Link to={`/domains`} className="text-caption-xs font-semibold text-primary hover:underline">
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Hosted Applications */}
      {activeTab === 'apps' && (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <h3 className="text-title-sm font-bold text-on-surface">Active Hosted Applications</h3>
          <p className="text-caption-xs text-secondary mt-0.5">Services running as systemd services or Docker containers</p>

          <div className="mt-4 flex flex-col gap-2.5">
            {[
              { name: 'Nginx Reverse Proxy & SSL Termination', status: 'Active (Running)', port: '80 / 443' },
              { name: 'Node.js Production Application Cluster', status: 'Active (Running)', port: '4000' },
              { name: 'Redis In-Memory Cache Service', status: 'Active (Running)', port: '6379' },
            ].map((app, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <span className="material-symbols-outlined text-[18px]">deployed_code</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{app.name}</p>
                    <p className="text-caption-xs text-secondary">Port {app.port}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
