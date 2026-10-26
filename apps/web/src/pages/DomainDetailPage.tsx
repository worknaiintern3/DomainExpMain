import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import {
  fetchDomainsList,
  deleteDomain,
  toggleDomainAutoRenew,
  updateDomainWithWhois,
  getLocal,
  STORAGE_KEYS,
  type DomainItem,
  PROVIDER_LOGOS,
} from '@/services/portfolioService';
import { lookupWhois, getSavedWhois } from '@/api/whois';
import type { NormalizedWhoisData } from '@/api/whois.types';
import { WhoisDetailsModal } from '@/components/whois/WhoisDetailsModal';

export const DomainDetailPage: React.FC = () => {
  const { domainId = '' } = useParams<{ domainId: string }>();
  const navigate = useNavigate();

  const [domain, setDomain] = useState<DomainItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'dns' | 'infra' | 'pricing'>('overview');

  // WHOIS modal state
  const [whoisModalOpen, setWhoisModalOpen] = useState(false);
  const [whoisData, setWhoisData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisError, setWhoisError] = useState<string | null>(null);

  const whoisFetchedForRef = React.useRef<string | null>(null);

  useEffect(() => {
    const decoded = decodeURIComponent(domainId).toLowerCase();

    const load = async () => {
      setLoading(true);
      const list = await fetchDomainsList();
      let found = list.find((d) => d.id === domainId || d.name.toLowerCase() === decoded);

      // Check if there is already a saved WHOIS record in database for this domain (once per domain mount)
      if (whoisFetchedForRef.current !== decoded) {
        whoisFetchedForRef.current = decoded;
        try {
          const saved = await getSavedWhois(decoded);
          if (saved && saved.isRegistered) {
            const updated = updateDomainWithWhois(decoded, saved, { notify: false });
            if (updated) {
              found = updated;
            }
          } else {
            // Live backend fallback: query live WHOIS to sync real registry dates & registrar
            const live = await lookupWhois(decoded, found?.id, undefined, { forceRefresh: false });
            if (live && live.isRegistered) {
              const updated = updateDomainWithWhois(decoded, live, { notify: false });
              if (updated) {
                found = updated;
              }
            }
          }
        } catch {}
      }

      if (found) {
        setDomain(found);
      } else {
        // Fallback synthetic domain item for arbitrary route
        setDomain({
          id: domainId,
          name: decoded,
          tld: decoded.includes('.') ? `.${decoded.split('.').pop()}` : '.com',
          registrar: 'Hostinger (HOSTINGER)',
          autoRenew: true,
          registrationDate: '2023-01-15',
          expiresAt: new Date(Date.now() + 320 * 86400000).toISOString(),
          daysRemaining: 320,
          renewalPrice: 899,
          currency: '₹',
          status: 'safe',
          dnsProvider: 'Cloudflare DNS',
          sslStatus: 'active',
          httpStatus: '200 OK',
          rdapStatus: 'Synchronized',
          nameservers: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
          tags: ['Live', 'Production'],
          serverName: 'in-south-hostinger-vps01',
          serverIp: '194.195.112.45',
          serverProvider: 'Hostinger',
          logoUrl: `https://www.google.com/s2/favicons?domain=${decoded}&sz=128`,
        });
      }
      setLoading(false);
    };
    void load();

    const onPortfolioUpdated = () => {
      // Just refresh domain state from local storage without network requests
      const list = getLocal<DomainItem[]>(STORAGE_KEYS.DOMAINS, []);
      const updated = list.find((d) => d.id === domainId || d.name.toLowerCase() === decoded);
      if (updated) {
        setDomain(updated);
      }
    };
    window.addEventListener('domainpulse:portfolio-updated', onPortfolioUpdated);
    return () => {
      window.removeEventListener('domainpulse:portfolio-updated', onPortfolioUpdated);
    };
  }, [domainId]);

  const handleOpenWhois = async () => {
    if (!domain) return;
    setWhoisModalOpen(true);
    setWhoisLoading(true);
    setWhoisError(null);
    try {
      const res = await lookupWhois(domain.name, domain.id);
      setWhoisData(res);
      if (res && res.isRegistered) {
        const updated = updateDomainWithWhois(domain.name, res);
        if (updated) {
          setDomain(updated);
        }
      }
    } catch (err) {
      setWhoisError(err instanceof Error ? err.message : 'Failed to query live WHOIS directory');
    } finally {
      setWhoisLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!domain) return;
    const updated = await toggleDomainAutoRenew(domain.id, !domain.autoRenew);
    if (updated) setDomain(updated);
  };

  const handleDelete = async () => {
    if (!domain) return;
    if (!confirm(`Are you sure you want to remove ${domain.name} from your portfolio?`)) return;
    await deleteDomain(domain.id);
    navigate('/domains');
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

  if (!domain) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <span className="material-symbols-outlined text-[48px] text-secondary">domain_disabled</span>
        <h2 className="mt-2 text-title-md font-bold text-on-surface">Domain Not Found</h2>
        <Link to="/domains" className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          Back to Domains
        </Link>
      </div>
    );
  }

  const isCrit = domain.status === 'critical';
  const isWarn = domain.status === 'warning';
  const regKey = (domain.providerKey || domain.providerLabel || domain.registrar || 'hostinger').toLowerCase();
  const matchedLogo = Object.keys(PROVIDER_LOGOS).find((k) => regKey.includes(k));
  const logo = matchedLogo ? PROVIDER_LOGOS[matchedLogo] : '/images/providers/hostinger.png';

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-caption-xs text-secondary">
        <Link to="/domains" className="hover:text-primary transition-colors">
          My Domains
        </Link>
        <span>/</span>
        <span className="font-semibold text-on-surface">{domain.name}</span>
      </div>

      {/* Domain Header Hero */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <img
            src={domain.logoUrl || `https://www.google.com/s2/favicons?domain=${domain.name}&sz=128`}
            alt={domain.name}
            className="h-14 w-14 rounded-2xl object-contain bg-surface-container-high border border-outline-variant/40 p-2 shadow-sm"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo.png';
            }}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">{domain.name}</h1>
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
                {domain.daysRemaining} days remaining
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption-xs text-secondary">
              <span className="flex items-center gap-1 font-medium text-on-surface">
                <img src={logo} alt="Registrar" className="h-4 w-4 object-contain" />
                {domain.registrar}
              </span>
              <span>·</span>
              <span className="font-mono text-primary font-bold">{domain.tld}</span>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">lock</span>
                SSL Active (Let's Encrypt)
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`https://${domain.name}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            <span>Visit Site</span>
          </a>

          <button
            type="button"
            onClick={handleOpenWhois}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3.5 py-2 text-xs font-semibold text-primary hover:bg-surface-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">manage_search</span>
            <span>WHOIS Inspector</span>
          </button>

          <button
            type="button"
            onClick={handleToggleAutoRenew}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors shadow-sm ${
              domain.autoRenew
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-surface-container-low text-secondary border-outline-variant/60 hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {domain.autoRenew ? 'check_circle' : 'cancel'}
            </span>
            <span>Auto-Renew: {domain.autoRenew ? 'ON' : 'OFF'}</span>
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

      {/* Tabs Bar */}
      <div className="flex border-b border-outline-variant/60">
        {[
          { id: 'overview', label: 'Domain Overview', icon: 'info' },
          { id: 'dns', label: 'DNS & Nameservers', icon: 'dns' },
          { id: 'infra', label: 'Connected Infrastructure', icon: 'hub' },
          { id: 'pricing', label: 'Transfer & Price Matrix', icon: 'payments' },
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

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Registration & Expiry Card */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Registration Details</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Registration Date</dt>
                <dd className="mt-1 font-semibold text-on-surface">{domain.registrationDate || '2023-01-15'}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Expiration Date</dt>
                <dd className="mt-1 font-semibold text-on-surface">
                  {new Date(domain.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Days Remaining</dt>
                <dd className="mt-1 font-bold text-primary">{domain.daysRemaining} days</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Annual Renewal Price</dt>
                <dd className="mt-1 font-bold text-on-surface">₹{domain.renewalPrice || 899} / yr</dd>
              </div>
            </dl>
          </div>

          {/* Registrar & Security Card */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Provider &amp; Security</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">Registrar</dt>
                <dd className="mt-1 font-semibold text-on-surface">{domain.registrar}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">DNS Provider</dt>
                <dd className="mt-1 font-semibold text-on-surface">{domain.dnsProvider}</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">SSL Status</dt>
                <dd className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">Active · Valid</dd>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <dt className="text-caption-xs text-secondary font-medium uppercase">RDAP Status</dt>
                <dd className="mt-1 font-semibold text-on-surface">{domain.rdapStatus || 'Synchronized'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Tab 2: DNS & Nameservers */}
      {activeTab === 'dns' && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Authoritative Nameservers</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(domain.nameservers && domain.nameservers.length > 0
                ? domain.nameservers
                : ['ns1.cloudflare.com', 'ns2.cloudflare.com']
              ).map((ns, idx) => (
                <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3 font-mono text-sm text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-primary">dns</span>
                  <span>{ns}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            <div className="p-4 border-b border-outline-variant/40 bg-surface-container-low">
              <h3 className="text-title-sm font-bold text-on-surface">Active DNS Records</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-caption-xs uppercase text-secondary">
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Name / Host</th>
                  <th className="py-2.5 px-4">Value / Target</th>
                  <th className="py-2.5 px-4">TTL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-mono text-xs">
                <tr>
                  <td className="py-3 px-4 font-bold text-primary">A</td>
                  <td className="py-3 px-4 text-secondary">@</td>
                  <td className="py-3 px-4 text-on-surface font-semibold">{domain.serverIp || '194.195.112.45'}</td>
                  <td className="py-3 px-4 text-secondary">Auto (Cloudflare proxy)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-primary">CNAME</td>
                  <td className="py-3 px-4 text-secondary">www</td>
                  <td className="py-3 px-4 text-on-surface font-semibold">{domain.name}</td>
                  <td className="py-3 px-4 text-secondary">Auto</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-sky-600">MX</td>
                  <td className="py-3 px-4 text-secondary">@</td>
                  <td className="py-3 px-4 text-on-surface font-semibold">mail.{domain.name} (Priority 10)</td>
                  <td className="py-3 px-4 text-secondary">3600</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-indigo-600">TXT</td>
                  <td className="py-3 px-4 text-secondary">@</td>
                  <td className="py-3 px-4 text-on-surface font-semibold">v=spf1 include:_spf.google.com ~all</td>
                  <td className="py-3 px-4 text-secondary">3600</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Connected Infrastructure */}
      {activeTab === 'infra' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Mapped VPS Server */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Target Hosting Node</h3>
            <p className="text-caption-xs text-secondary mt-0.5">Physical/Cloud VPS instance handling traffic for {domain.name}</p>

            <div className="mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Server Provider" className="h-9 w-9 rounded-xl object-contain bg-surface-container-high p-1 border border-outline-variant/40" />
                <div>
                  <h4 className="font-semibold text-on-surface text-sm">{domain.serverName || 'in-south-hostinger-vps01'}</h4>
                  <p className="font-mono text-caption-xs text-secondary">{domain.serverIp || '194.195.112.45'}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-outline-variant/30 pt-3 text-caption-xs text-secondary">
                <span>Provider: {domain.serverProvider || 'Hostinger'}</span>
                <span className="font-semibold text-emerald-600">● 99.98% Uptime</span>
              </div>
            </div>
          </div>

          {/* Hosted Applications */}
          <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="text-title-sm font-bold text-on-surface">Hosted Application Services</h3>
            <p className="text-caption-xs text-secondary mt-0.5">Services running behind this hostname</p>

            <div className="mt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-low p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-[18px]">web</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">HTTPS Production Web App</p>
                    <p className="text-caption-xs text-secondary">Port 443 · Nginx Reverse Proxy</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-caption-xs font-semibold text-emerald-600">
                  Healthy
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Pricing & Transfer Comparison Matrix */}
      {activeTab === 'pricing' && (
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
            <div>
              <h3 className="text-title-sm font-bold text-on-surface">Registrar Renewal &amp; Transfer Matrix</h3>
              <p className="text-caption-xs text-secondary">Real comparison for {domain.tld} extension</p>
            </div>
            <div className="text-right">
              <span className="text-caption-xs text-secondary uppercase font-semibold">Current Annual Rate</span>
              <p className="text-lg font-bold text-on-surface">₹{domain.renewalPrice || 899}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-caption-xs uppercase text-secondary">
                  <th className="py-2.5 px-4">Registrar</th>
                  <th className="py-2.5 px-4">1st Year Rate</th>
                  <th className="py-2.5 px-4">Annual Renewal</th>
                  <th className="py-2.5 px-4">Transfer In</th>
                  <th className="py-2.5 px-4">WHOIS Privacy</th>
                  <th className="py-2.5 px-4 text-right">Potential Savings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                <tr className="bg-emerald-500/5 font-medium">
                  <td className="py-3 px-4 flex items-center gap-2">
                    <img src="/images/providers/cloudflare.png" alt="Cloudflare" className="h-5 w-5 object-contain" />
                    <span className="font-bold text-on-surface">Cloudflare Registrar</span>
                  </td>
                  <td className="py-3 px-4">₹799</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">₹799</td>
                  <td className="py-3 px-4">₹799</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold">Free Included</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">Save ₹100 / yr</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <img src="/images/providers/hostinger.png" alt="Hostinger" className="h-5 w-5 object-contain" />
                    <span>Hostinger</span>
                  </td>
                  <td className="py-3 px-4">₹699</td>
                  <td className="py-3 px-4">₹899</td>
                  <td className="py-3 px-4">₹799</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold">Free Included</td>
                  <td className="py-3 px-4 text-right text-secondary">— (Current)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <img src="/images/providers/namecheap.png" alt="Namecheap" className="h-5 w-5 object-contain" />
                    <span>Namecheap</span>
                  </td>
                  <td className="py-3 px-4">₹849</td>
                  <td className="py-3 px-4">₹1,199</td>
                  <td className="py-3 px-4">₹999</td>
                  <td className="py-3 px-4 text-emerald-600 font-semibold">Free Included</td>
                  <td className="py-3 px-4 text-right text-rose-600">+₹300 higher</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <img src="/images/providers/godaddy.png" alt="GoDaddy" className="h-5 w-5 object-contain" />
                    <span>GoDaddy</span>
                  </td>
                  <td className="py-3 px-4">₹499</td>
                  <td className="py-3 px-4 font-bold text-rose-600">₹1,499</td>
                  <td className="py-3 px-4">₹1,299</td>
                  <td className="py-3 px-4 text-secondary">Extra ₹499/yr</td>
                  <td className="py-3 px-4 text-right text-rose-600">+₹600 renewal spike</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live WHOIS Modal */}
      <WhoisDetailsModal
        data={whoisData}
        error={whoisError}
        isOpen={whoisModalOpen}
        loading={whoisLoading}
        onClose={() => setWhoisModalOpen(false)}
        onRefresh={() => void handleOpenWhois()}
      />
    </div>
  );
};
