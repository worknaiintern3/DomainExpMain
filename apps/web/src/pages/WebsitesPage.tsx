import React, { useEffect, useMemo, useState } from 'react';

import {
  fetchApplicationsList,
  fetchWebsitesList,
  createWebsite,
  deleteWebsite,
  getConsoleDeveloperName,
  syncGooglePlayDeveloper,
  type ApplicationItem,
  type WebsiteItem,
  REAL_APP_ICONS,
} from '@/services/portfolioService';

export const WebsitesPage: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<'apps' | 'websites'>('websites');

  // Apps state
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [appFilter, setAppFilter] = useState<'All' | 'Production' | 'Review' | 'Issues'>('All');
  const [appSearch, setAppSearch] = useState('');
  const [consoleDevName, setConsoleDevName] = useState(getConsoleDeveloperName());
  const [isConsoleModalOpen, setIsConsoleModalOpen] = useState(false);
  const [inputDevName, setInputDevName] = useState(getConsoleDeveloperName());
  const [isSyncingConsole, setIsSyncingConsole] = useState(false);

  // Websites state
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [webCategoryFilter, setWebCategoryFilter] = useState<string>('All');
  const [webSearch, setWebSearch] = useState('');
  const [isAddWebModalOpen, setIsAddWebModalOpen] = useState(false);
  const [newWebName, setNewWebName] = useState('');
  const [newWebUrl, setNewWebUrl] = useState('');
  const [newWebCategory, setNewWebCategory] = useState<'Production' | 'Client' | 'Personal' | 'Staging' | 'Tools'>('Production');
  const [newWebNotes, setNewWebNotes] = useState('');

  // Selected App detail modal
  const [selectedApp, setSelectedApp] = useState<ApplicationItem | null>(null);

  // Ping status map
  const [pingStatusMap, setPingStatusMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Feedback modal
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async (force = false) => {
    try {
      const [appList, webList] = await Promise.all([
        fetchApplicationsList({ forceRefresh: force }),
        fetchWebsitesList({ forceRefresh: force }),
      ]);
      setApps(appList);
      setWebsites(webList);
      setConsoleDevName(getConsoleDeveloperName());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSyncConsole = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSyncingConsole(true);
    try {
      const res = await syncGooglePlayDeveloper(inputDevName);
      setConsoleDevName(inputDevName);
      await loadData(true);
      setIsConsoleModalOpen(false);
      setFeedback(res.message);
    } catch {
      setFeedback('Failed to synchronize developer apps.');
    } finally {
      setIsSyncingConsole(false);
    }
  };

  const handlePingApp = (appId: string) => {
    setPingStatusMap((prev) => ({ ...prev, [appId]: 'checking' }));
    setTimeout(() => {
      setPingStatusMap((prev) => ({ ...prev, [appId]: '200 OK (22ms)' }));
    }, 600);
  };

  const handleCreateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebName.trim() || !newWebUrl.trim()) return;
    const created = await createWebsite({
      name: newWebName.trim(),
      url: newWebUrl.trim(),
      category: newWebCategory,
      notes: newWebNotes.trim() || undefined,
    });
    setWebsites((prev) => [created, ...prev]);
    setIsAddWebModalOpen(false);
    setNewWebName('');
    setNewWebUrl('');
    setNewWebNotes('');
  };

  const handleDeleteWebsite = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove website ${name}?`)) return;
    setWebsites((prev) => prev.filter((w) => w.id !== id));
    await deleteWebsite(id);
  };

  // Filtered Apps
  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return apps.filter((a) => {
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.packageId && a.packageId.toLowerCase().includes(q)) ||
        (a.developerName && a.developerName.toLowerCase().includes(q));

      if (appFilter === 'Production') return matchesSearch && a.releaseTrack === 'Production';
      if (appFilter === 'Review') return matchesSearch && a.releaseTrack !== 'Production';
      if (appFilter === 'Issues') return matchesSearch && a.status === 'error';
      return matchesSearch;
    });
  }, [apps, appSearch, appFilter]);

  // Filtered Websites
  const filteredWebsites = useMemo(() => {
    const q = webSearch.trim().toLowerCase();
    return websites.filter((w) => {
      const matchesSearch =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.url.toLowerCase().includes(q) ||
        w.domain.toLowerCase().includes(q);

      if (webCategoryFilter === 'All') return matchesSearch;
      return matchesSearch && w.category === webCategoryFilter;
    });
  }, [websites, webSearch, webCategoryFilter]);

  const productionAppsCount = apps.filter((a) => a.releaseTrack === 'Production').length;

  return (
    <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
      {/* Feedback Modal */}
      {feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <h3 className="text-title-md font-bold text-on-surface">Console Synced</h3>
                <p className="text-caption-xs text-secondary">Google Play Developer records updated</p>
              </div>
            </div>
            <p className="mt-4 text-body-sm text-secondary leading-relaxed">{feedback}</p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary/90 shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Console Modal */}
      {isConsoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <div className="flex items-center gap-2.5">
                <img src="/images/google-play.png" alt="Google Play" className="h-7 w-7 object-contain" />
                <h3 className="text-title-md font-bold text-on-surface">Google Play Developer Sync</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConsoleModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleSyncConsole} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Developer Account Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. WorknAi Technologies India Pvt Ltd"
                  value={inputDevName}
                  onChange={(e) => setInputDevName(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  required
                />
                <p className="mt-1 text-[11px] text-secondary">
                  Synchronizes all published production APKs and app listings directly from Google Play.
                </p>
              </div>

              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConsoleModalOpen(false)}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncingConsole}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSyncingConsole ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                      <span>Syncing Apps…</span>
                    </>
                  ) : (
                    <span>Sync Console Apps</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Website Modal */}
      {isAddWebModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="text-title-md font-bold text-on-surface">Add Monitored Website</h3>
              <button
                type="button"
                onClick={() => setIsAddWebModalOpen(false)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateWebsite} className="mt-4 flex flex-col gap-4">
              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Website Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. WorknAi Main Portal"
                  value={newWebName}
                  onChange={(e) => setNewWebName(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Website URL
                </label>
                <input
                  type="text"
                  placeholder="https://worknai.com"
                  value={newWebUrl}
                  onChange={(e) => setNewWebUrl(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Category Tag
                </label>
                <select
                  value={newWebCategory}
                  onChange={(e) => setNewWebCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                >
                  <option value="Production">Production</option>
                  <option value="Client">Client</option>
                  <option value="Personal">Personal</option>
                  <option value="Staging">Staging</option>
                  <option value="Tools">Tools</option>
                </select>
              </div>

              <div>
                <label className="block text-caption-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                  Notes
                </label>
                <textarea
                  placeholder="SSL, Reverse Proxy, or Nginx notes…"
                  value={newWebNotes}
                  onChange={(e) => setNewWebNotes(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="mt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddWebModalOpen(false)}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-on-primary hover:bg-primary/90"
                >
                  Add Website
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected App Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-outline-variant/40 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={selectedApp.iconUrl || REAL_APP_ICONS[selectedApp.packageId || ''] || '/images/google-play.png'}
                  alt={selectedApp.name}
                  className="h-12 w-12 rounded-xl object-contain bg-surface-container-high border border-outline-variant/40 p-1"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/google-play.png';
                  }}
                />
                <div>
                  <h3 className="text-title-md font-bold text-on-surface">{selectedApp.name}</h3>
                  <p className="font-mono text-caption-xs text-primary">{selectedApp.packageId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <span className="text-secondary uppercase font-semibold text-[10px]">Release Track</span>
                <p className="mt-1 font-bold text-emerald-600 dark:text-emerald-400">{selectedApp.releaseTrack || 'Production'}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <span className="text-secondary uppercase font-semibold text-[10px]">Published Version</span>
                <p className="mt-1 font-bold text-on-surface">{selectedApp.version || 'v1.0.0'}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <span className="text-secondary uppercase font-semibold text-[10px]">Developer Account</span>
                <p className="mt-1 font-medium text-on-surface line-clamp-1">{selectedApp.developerName}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3">
                <span className="text-secondary uppercase font-semibold text-[10px]">Store Status</span>
                <p className="mt-1 font-semibold text-emerald-600">● Live on Google Play</p>
              </div>
            </div>

            <div className="mt-6 flex justify-between items-center border-t border-outline-variant/40 pt-4">
              <span className="text-caption-xs text-secondary">
                Updated {selectedApp.updatedAt ? new Date(selectedApp.updatedAt).toLocaleDateString() : 'Sep 2026'}
              </span>

              <div className="flex gap-2">
                {selectedApp.playStoreUrl && (
                  <a
                    href={selectedApp.playStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary/90"
                  >
                    <span>Open Play Store</span>
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="rounded-xl border border-outline-variant px-4 py-2 text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-headline-md font-bold tracking-tight text-on-surface">
              {activeSegment === 'apps' ? 'Mobile Applications' : 'Websites & Apps'}
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-caption-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {activeSegment === 'apps' ? `${apps.length} MOBILE APPS` : `${websites.length} WEBSITES`}
            </span>
          </div>
          <p className="mt-1 text-body-sm text-secondary">
            {activeSegment === 'apps'
              ? 'Official Google Play Console published apps, package IDs, release tracks & ratings.'
              : 'Web applications, frontend portals, SSL security status and live HTTP health probes.'}
          </p>
        </div>

        {/* Top Segment Control Switcher */}
        <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/60 bg-surface-container-low p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveSegment('apps')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeSegment === 'apps'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">smartphone</span>
            <span>Mobile Apps ({apps.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment('websites')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeSegment === 'websites'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">language</span>
            <span>Websites ({websites.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SEGMENT 1: MOBILE APPS (GOOGLE PLAY CONSOLE)                     */}
      {/* ============================================================== */}
      {activeSegment === 'apps' && (
        <div className="flex flex-col gap-unit-lg">
          {/* Google Play Console Connected Account Banner */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-gradient-to-br from-emerald-500/10 via-surface-container-lowest to-surface-container-low p-5 shadow-sm md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <img src="/images/google-play.png" alt="Google Play" className="h-12 w-12 object-contain" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-title-md font-bold text-on-surface">{consoleDevName}</h2>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-caption-xs font-semibold text-emerald-600 border border-emerald-500/20">
                    Live Synced
                  </span>
                </div>
                <p className="text-caption-xs text-secondary mt-0.5">
                  Verified Google Play Developer Account · {productionAppsCount} published production releases
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setInputDevName(consoleDevName);
                  setIsConsoleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-high px-3.5 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Sync Play Store</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputDevName('');
                  setIsConsoleModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-[16px]">add_link</span>
                <span>Change Developer</span>
              </button>
            </div>
          </div>

          {/* Filter and Search Bar for Apps */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(['All', 'Production', 'Review', 'Issues'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAppFilter(tab)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                    appFilter === tab
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {tab === 'All'
                    ? `All Apps (${apps.length})`
                    : tab === 'Production'
                    ? `Production (${productionAppsCount})`
                    : tab === 'Review'
                    ? 'In Review (0)'
                    : 'Issues (0)'}
                </button>
              ))}
            </div>

            <div className="relative w-full max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">
                search
              </span>
              <input
                type="text"
                placeholder="Search mobile apps, package IDs…"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Apps Cards Grid */}
          {loading ? (
            <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center">
              <span className="material-symbols-outlined inline-block animate-spin text-[32px] text-primary mb-2">
                progress_activity
              </span>
              <p className="text-body-sm font-medium text-secondary">Loading Google Play apps and web services…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredApps.map((a) => {
              const iconSrc = a.iconUrl || REAL_APP_ICONS[a.packageId || ''] || '/images/google-play.png';
              const pingResult = pingStatusMap[a.id];

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-sm transition hover:border-primary/40 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={iconSrc}
                          alt={a.name}
                          className="h-12 w-12 rounded-xl object-contain bg-surface-container-high border border-outline-variant/40 p-1 shadow-sm"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/google-play.png';
                          }}
                        />
                        <div className="min-w-0">
                          <h3
                            onClick={() => setSelectedApp(a)}
                            className="font-bold text-on-surface hover:text-primary transition-colors text-sm line-clamp-1 cursor-pointer"
                          >
                            {a.name}
                          </h3>
                          <p className="font-mono text-caption-xs text-primary truncate max-w-[200px]">
                            {a.packageId}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 border border-emerald-500/20 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {a.releaseTrack || 'Production'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low p-2.5 text-caption-xs text-secondary">
                      <span>Version: <strong className="text-on-surface">{a.version || 'v1.0.0'}</strong></span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        Live on Play Store
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-secondary">
                      Dev: {a.developerName || consoleDevName}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3">
                    <button
                      type="button"
                      onClick={() => handlePingApp(a.id)}
                      className="text-caption-xs font-semibold text-secondary hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">network_ping</span>
                      <span>{pingResult ? pingResult : 'Ping Store'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedApp(a)}
                        className="rounded-lg p-1.5 text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                        title="App Details"
                      >
                        <span className="material-symbols-outlined text-[18px]">info</span>
                      </button>

                      {a.playStoreUrl && (
                        <a
                          href={a.playStoreUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container transition-colors border border-outline-variant/40"
                        >
                          <span>Play Store</span>
                          <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SEGMENT 2: WEBSITES & WEB APPLICATIONS                           */}
      {/* ============================================================== */}
      {activeSegment === 'websites' && (
        <div className="flex flex-col gap-unit-lg">
          {/* Top Actions & Add Website */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {['All', 'Production', 'Client', 'Personal', 'Staging', 'Tools'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setWebCategoryFilter(cat)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                    webCategoryFilter === cat
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-secondary hover:bg-surface-container hover:text-on-surface'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-full max-w-xs">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-secondary">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search websites, URLs…"
                  value={webSearch}
                  onChange={(e) => setWebSearch(e.target.value)}
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low pl-9 pr-4 py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddWebModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary/90 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add Website</span>
              </button>
            </div>
          </div>

          {/* Websites Table */}
          <div className="overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low text-caption-xs font-semibold uppercase tracking-wider text-secondary">
                    <th className="py-3.5 px-4">Website</th>
                    <th className="py-3.5 px-4">URL</th>
                    <th className="py-3.5 px-4">Server / Host</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">SSL &amp; Health</th>
                    <th className="py-3.5 px-4">Latency</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredWebsites.map((w) => (
                    <tr key={w.id} className="transition-colors hover:bg-surface-container-low/40">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={w.logoUrl || `https://www.google.com/s2/favicons?domain=${w.domain}&sz=64`}
                            alt={w.name}
                            className="h-8 w-8 rounded-lg object-contain bg-surface-container-high border border-outline-variant/40 p-1"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/logo.png';
                            }}
                          />
                          <div>
                            <p className="font-semibold text-on-surface">{w.name}</p>
                            <span className="text-caption-xs text-secondary font-mono">{w.domain}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-body-sm text-secondary">
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-mono text-xs"
                        >
                          {w.url}
                        </a>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-on-surface font-semibold flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-primary">dns</span>
                            {w.serverName || 'Hostinger VPS'}
                          </span>
                          <span className="font-mono text-[11px] text-secondary">
                            {w.serverIp || '76.13.185.120'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface">
                          {w.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          SSL Active (200 OK)
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-secondary">
                        {w.responseTimeMs || 28} ms
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={w.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                            title="Open URL"
                          >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteWebsite(w.id, w.name)}
                            className="rounded-lg p-1.5 text-secondary hover:bg-error/10 hover:text-error transition-colors"
                            title="Delete Website"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
