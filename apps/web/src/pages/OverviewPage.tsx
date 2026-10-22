import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getInventorySummary, listAllInventory, type InventorySummary } from '@/api/inventory';
import { getAlertsSummary } from '@/api/monitoring';
import { listProviderConnections } from '@/api/provider-connections';
import { useAuth } from '@/auth/AuthContext';

interface OverviewTile {
  href: string | null;
  label: string;
  value: number;
}

interface ProviderConnectionHealth {
  connected: number;
  failedSync: number;
  needsAttention: number;
  total: number;
}

function hasCompleteSummary(summary: InventorySummary): summary is Required<InventorySummary> {
  return (
    typeof summary.projects === 'number' &&
    typeof summary.providerAccounts === 'number' &&
    typeof summary.emailAccounts === 'number' &&
    typeof summary.cloudResources === 'number'
  );
}

function buildTiles(summary: InventorySummary): OverviewTile[] {
  const tiles: OverviewTile[] = [
    { href: '/domains', label: 'Domains', value: summary.domains },
    { href: '/servers', label: 'Servers', value: summary.servers },
    { href: '/websites', label: 'Applications', value: summary.applications },
  ];
  // The Mongo backend only supplies the three inventory totals above. Its
  // cloudResources value is currently hard-coded to zero, so only show the
  // remaining totals when the full summary contract is available.
  if (hasCompleteSummary(summary)) {
    tiles.push(
      { href: '/projects', label: 'Projects', value: summary.projects },
      { href: '/accounts', label: 'Provider accounts', value: summary.providerAccounts },
      { href: '/accounts', label: 'Email accounts', value: summary.emailAccounts },
      { href: '/cloud-resources', label: 'Cloud resources', value: summary.cloudResources },
    );
  }
  return tiles;
}

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const [tiles, setTiles] = useState<OverviewTile[] | null>(null);
  const [summaryIncomplete, setSummaryIncomplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openAlerts, setOpenAlerts] = useState<number | null>(null);
  const [connectionHealth, setConnectionHealth] = useState<ProviderConnectionHealth | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const summary = await getInventorySummary(controller.signal);
        if (controller.signal.aborted) return;
        setTiles(buildTiles(summary));
        setSummaryIncomplete(!hasCompleteSummary(summary));
        if (!hasCompleteSummary(summary)) {
          const resources = ['projects', 'provider-accounts', 'email-accounts', 'cloud-resources'] as const;
          const keys = ['projects', 'providerAccounts', 'emailAccounts', 'cloudResources'] as const;
          const results = await Promise.allSettled(resources.map((resource) => listAllInventory(resource, { signal: controller.signal })));
          if (controller.signal.aborted) return;
          // This backend currently returns a placeholder zero for cloud resources.
          const completed: InventorySummary = { ...summary, cloudResources: undefined };
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') completed[keys[index]!] = result.value.length;
          });
          setTiles(buildTiles(completed));
          setSummaryIncomplete(!hasCompleteSummary(completed));
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : 'The inventory summary could not be loaded.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getAlertsSummary(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setOpenAlerts(result.open);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOpenAlerts(null);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listProviderConnections(controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        const items = page.items;
        setConnectionHealth({
          connected: items.filter((item) => item.connectionStatus === 'CONNECTED').length,
          failedSync: items.filter((item) => item.syncStatus === 'FAILED').length,
          needsAttention: items.filter(
            (item) => item.connectionStatus === 'DISCONNECTED' || item.validationStatus === 'INVALID',
          ).length,
          total: items.length,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setConnectionHealth(null);
      });
    return () => controller.abort();
  }, []);

  const totalItems = useMemo(
    () => (tiles ?? []).reduce((total, tile) => total + tile.value, 0),
    [tiles],
  );
  const greeting = user?.displayName?.trim() || user?.email || 'there';

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-surface-container-lowest p-unit-lg shadow-sm sm:p-unit-xl" aria-label="Workspace welcome">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-primary/5 lg:block" aria-hidden="true" />
        <div className="relative flex flex-col gap-unit-lg lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-caption-xs font-semibold uppercase tracking-wider text-primary"><span className="material-symbols-outlined text-[14px]">space_dashboard</span> Workspace overview</span>
            <h1 className="mt-unit-md text-headline-md font-semibold leading-tight tracking-tight text-on-surface sm:text-display-lg-mobile">Welcome, {greeting}</h1>
            <p className="mt-unit-xs text-body-md text-secondary">Your domains, infrastructure, applications, alerts, and connected services in one place.</p>
            <p className="mt-unit-xs text-caption-xs text-secondary">Workspace-wide totals across every connected inventory collection.</p>
          </div>
          <div className="flex flex-wrap gap-unit-sm">
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" to="/domains"><span className="material-symbols-outlined text-[18px]">add</span>Add domain</Link>
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" to="/activities"><span className="material-symbols-outlined text-[18px]">history</span>Recent activity</Link>
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center text-body-sm text-secondary">
          Loading workspace inventory…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-5" role="alert">
          <p className="font-semibold text-error">Inventory summary unavailable</p>
          <p className="mt-1 text-body-sm text-secondary">{error}</p>
        </div>
      )}

      {!loading && !error && tiles !== null && totalItems === 0 && (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">{summaryIncomplete ? 'No tracked domains, servers, or applications' : 'Your inventory is empty'}</h2>
          <p className="mt-2 text-body-sm text-secondary">{summaryIncomplete ? 'Other inventory totals are unavailable from this backend.' : 'Add a domain, server, application, or account to begin mapping this workspace.'}</p>
          <Link className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary" to="/domains">
            Add your first domain
          </Link>
        </div>
      )}

      {!loading && !error && tiles !== null && totalItems > 0 && (
        <section aria-labelledby="inventory-summary-title">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="inventory-summary-title" className="font-title-md text-title-md font-semibold text-on-surface">Connected inventory</h2>
              <p className="text-caption-xs text-secondary">{summaryIncomplete ? 'Tracked domains, servers, and applications in this workspace. Other totals are unavailable from this backend.' : 'Exact workspace-wide totals, not a bounded page count.'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-unit-sm sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => {
              const icon = ({ Domains: 'language', Servers: 'dns', Applications: 'web', Projects: 'workspaces', 'Provider accounts': 'account_tree', 'Email accounts': 'alternate_email', 'Cloud resources': 'cloud' } as Record<string, string>)[tile.label] ?? 'inventory_2';
              const contents = (
                <>
                  <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><span className="material-symbols-outlined text-[20px]">{icon}</span></span><span className="material-symbols-outlined text-[17px] text-outline">arrow_forward</span></div>
                  <p className="mt-unit-md text-display-lg-mobile font-semibold tabular-nums leading-none text-on-surface">{tile.value}</p>
                  <p className="mt-unit-xs text-label-md font-medium text-secondary">{tile.label}</p>
                </>
              );
              return tile.href ? (
                <Link key={tile.label} to={tile.href} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-md shadow-micro transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  {contents}
                </Link>
              ) : (
                <div key={tile.label} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
                  {contents}
                  <p className="mt-2 text-caption-xs text-outline">Supporting API · no dedicated view</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-unit-md lg:grid-cols-2">
      {openAlerts !== null && (
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-label="Alerts summary">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-headline-sm font-semibold"><span className="material-symbols-outlined text-warning-text">notifications_active</span>Alerts</h2>
            <Link to="/alerts" className="text-caption-xs font-semibold text-primary hover:underline">View alerts</Link>
          </div>
          <p className="mt-2 text-body-sm text-secondary">
            {openAlerts === 0 ? 'No open alerts.' : `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}.`}
          </p>
        </section>
      )}

      {connectionHealth !== null && (
        <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-label="Provider connection health">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-headline-sm font-semibold"><span className="material-symbols-outlined text-primary">lan</span>Provider connection health</h2>
            <Link to="/accounts" className="text-caption-xs font-semibold text-primary hover:underline">Manage connections</Link>
          </div>
          <p className="mt-2 text-body-sm text-secondary">
            {connectionHealth.total === 0
              ? 'No live provider connections have been set up yet.'
              : `${connectionHealth.connected} of ${connectionHealth.total} live provider connection${connectionHealth.total === 1 ? '' : 's'} connected.`}
          </p>
          {connectionHealth.needsAttention > 0 && (
            <p className="mt-1 text-caption-xs text-error">
              {connectionHealth.needsAttention} connection{connectionHealth.needsAttention === 1 ? '' : 's'} disconnected or failing credential validation.
            </p>
          )}
          {connectionHealth.failedSync > 0 && (
            <p className="mt-1 text-caption-xs text-error">
              {connectionHealth.failedSync} connection{connectionHealth.failedSync === 1 ? '' : 's'} with a failed sync.
            </p>
          )}
          <p className="mt-1 text-caption-xs text-secondary">
            Live credential connections, distinct from the manually tracked &quot;Provider accounts&quot; inventory above.
          </p>
        </section>
      )}
      </div>

      <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm" aria-labelledby="workspace-tools-heading">
        <div className="mb-unit-md"><h2 className="text-headline-sm font-semibold text-on-surface" id="workspace-tools-heading">Explore your workspace</h2><p className="text-caption-xs text-secondary">Direct access to the tools shared with your mobile app.</p></div>
        <div className="grid grid-cols-1 gap-unit-sm sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: 'travel_explore', label: 'Domain intelligence', href: '/domain-intelligence', detail: 'WHOIS, DNS, SSL and history' },
            { icon: 'notifications_active', label: 'Notifications', href: '/notifications', detail: 'Reminders and delivery history' },
            { icon: 'play_store', label: 'Google Play Console', href: '/google-play', detail: 'Your published Android apps' },
            { icon: 'hub', label: 'Infrastructure map', href: '/infrastructure-map', detail: 'Connected assets and relationships' },
          ].map((tool) => <Link className="group flex items-center gap-unit-sm rounded-lg border border-outline-variant/30 bg-surface-container-low p-unit-sm transition-colors hover:border-primary/30 hover:bg-primary/5" key={tool.href} to={tool.href}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-primary"><span className="material-symbols-outlined text-[20px]">{tool.icon}</span></span><span className="min-w-0 flex-1"><span className="block text-label-md font-semibold text-on-surface">{tool.label}</span><span className="block truncate text-caption-xs text-secondary">{tool.detail}</span></span><span className="material-symbols-outlined text-[17px] text-outline group-hover:text-primary">chevron_right</span></Link>)}
        </div>
      </section>

      <aside className="rounded-xl border border-primary/20 bg-primary/5 p-unit-md text-caption-xs text-secondary">
        Domain pricing is available through supported registrar APIs on the Price Comparison page.
        DNS and TLS metadata is available per domain (see each domain&apos;s detail page) and is not aggregated workspace-wide on this overview.
        Purchases, billing, and automatic renewals are handled externally by your registrars and are not managed by DomainPulse.
        No operational status is inferred on this overview.
      </aside>
    </div>
  );
};
