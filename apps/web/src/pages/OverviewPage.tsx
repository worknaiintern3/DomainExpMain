import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listInventory } from '@/api/inventory';
import { useAuth } from '@/auth/AuthContext';

interface OverviewSummary {
  hasMore: boolean;
  href: string | null;
  label: string;
  loaded: number;
}

const PAGE_LIMIT = 25;

export const OverviewPage: React.FC = () => {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<OverviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const options = { limit: PAGE_LIMIT, signal: controller.signal };
        const [domains, servers, applications, projects, providers, emails, cloud] = await Promise.all([
          listInventory('domains', options),
          listInventory('servers', options),
          listInventory('applications', options),
          listInventory('projects', options),
          listInventory('provider-accounts', options),
          listInventory('email-accounts', options),
          listInventory('cloud-resources', options),
        ]);
        if (controller.signal.aborted) return;
        setSummaries([
          { hasMore: domains.nextCursor !== null, href: '/domains', label: 'Domains', loaded: domains.items.length },
          { hasMore: servers.nextCursor !== null, href: '/servers', label: 'Servers', loaded: servers.items.length },
          { hasMore: applications.nextCursor !== null, href: '/websites', label: 'Applications', loaded: applications.items.length },
          { hasMore: projects.nextCursor !== null, href: null, label: 'Projects', loaded: projects.items.length },
          { hasMore: providers.nextCursor !== null, href: '/accounts', label: 'Provider accounts', loaded: providers.items.length },
          { hasMore: emails.nextCursor !== null, href: '/accounts', label: 'Email accounts', loaded: emails.items.length },
          { hasMore: cloud.nextCursor !== null, href: null, label: 'Cloud resources', loaded: cloud.items.length },
        ]);
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

  const loadedItems = useMemo(
    () => summaries.reduce((total, summary) => total + summary.loaded, 0),
    [summaries],
  );
  const greeting = user?.displayName?.trim() || user?.email || 'there';

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <div className="flex flex-col">
        <h1 className="font-headline-sm text-headline-sm font-semibold leading-tight text-on-surface">
          Welcome, {greeting}
        </h1>
        <p className="mt-0.5 font-caption-xs text-caption-xs text-secondary">
          A bounded snapshot of the first {PAGE_LIMIT} records in each connected inventory collection.
        </p>
      </div>

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

      {!loading && !error && loadedItems === 0 && (
        <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">Your inventory is empty</h2>
          <p className="mt-2 text-body-sm text-secondary">Add a domain, server, application, or account to begin mapping this workspace.</p>
          <Link className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary" to="/domains">
            Add your first domain
          </Link>
        </div>
      )}

      {!loading && !error && loadedItems > 0 && (
        <section aria-labelledby="inventory-summary-title">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="inventory-summary-title" className="font-title-md text-title-md font-semibold text-on-surface">Connected inventory</h2>
              <p className="text-caption-xs text-secondary">Counts describe only the bounded pages loaded here, not workspace-wide totals.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaries.map((summary) => {
              const contents = (
                <>
                  <p className="text-caption-xs font-semibold uppercase tracking-wide text-secondary">{summary.label}</p>
                  <p className="mt-2 text-headline-sm font-semibold text-on-surface">{summary.loaded}</p>
                  <p className="mt-1 text-caption-xs text-secondary">
                    {summary.hasMore ? `First ${summary.loaded} loaded · more available` : `${summary.loaded} loaded · page complete`}
                  </p>
                </>
              );
              return summary.href ? (
                <Link key={summary.label} to={summary.href} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm transition-colors hover:bg-surface-container-low">
                  {contents}
                </Link>
              ) : (
                <div key={summary.label} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
                  {contents}
                  <p className="mt-2 text-caption-xs text-outline">Supporting API · no dedicated view</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <aside className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-body-sm text-secondary">
        Renewal, health, pricing, DNS, TLS, monitoring, and billing analytics are not connected yet. No operational status is inferred on this overview.
      </aside>
    </div>
  );
};
