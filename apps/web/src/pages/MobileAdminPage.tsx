import React, { useEffect, useState } from 'react';

import {
  createMobileAdminAnnouncement,
  deleteMobileAdminAnnouncement,
  getMobileAdminAnnouncements,
  getMobileAdminAuditLogs,
  getMobileAdminConfig,
  getMobileAdminFeatures,
  getMobileAdminHome,
  getMobileAdminNavigation,
  getMobileAdminVersions,
  updateMobileAdminAnnouncement,
  updateMobileAdminConfig,
  updateMobileAdminFeature,
  updateMobileAdminHome,
  updateMobileAdminNavigation,
  updateMobileAdminVersion,
  type AdminAnnouncement,
  type AdminAuditLog,
  type AdminFeatureFlag,
  type AdminHomeSection,
  type AdminMobileConfig,
  type AdminNavigationItem,
  type AdminVersion,
} from '@/api/mobile-admin';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/common/PageHeader';

type Section = 'branding' | 'features' | 'navigation' | 'home' | 'versions' | 'announcements' | 'audit';
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'branding', label: 'App settings', icon: 'palette' },
  { id: 'features', label: 'Features', icon: 'toggle_on' },
  { id: 'navigation', label: 'Navigation', icon: 'menu' },
  { id: 'home', label: 'Home layout', icon: 'dashboard' },
  { id: 'versions', label: 'Versions', icon: 'system_update' },
  { id: 'announcements', label: 'Announcements', icon: 'campaign' },
  { id: 'audit', label: 'Audit log', icon: 'history' },
];

const fieldClass = 'min-w-0 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface focus:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const cardClass = 'rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-unit-lg shadow-sm';
const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50';
const outlineButtonClass = 'inline-flex min-h-9 items-center justify-center rounded-lg border border-outline-variant px-4 py-2 text-label-md font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isoDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function Field({ label, value, onChange, type = 'text', maxLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; maxLength?: number }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-label-md font-medium text-on-surface">{label}<input className={fieldClass} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} type={type} value={value} /></label>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2 text-label-md font-medium text-on-surface"><input checked={checked} className="h-4 w-4 accent-primary" onChange={(event) => onChange(event.target.checked)} type="checkbox" />{label}</label>;
}

const emptyAnnouncement: Omit<AdminAnnouncement, 'id'> = {
  title: '', message: '', type: 'info', actionUrl: null, actionLabel: null,
  isActive: true, startsAt: null, expiresAt: null,
};

export const MobileAdminPage: React.FC = () => {
  const [section, setSection] = useState<Section>('branding');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<AdminMobileConfig | null>(null);
  const [features, setFeatures] = useState<AdminFeatureFlag[]>([]);
  const [navigation, setNavigation] = useState<AdminNavigationItem[]>([]);
  const [home, setHome] = useState<AdminHomeSection[]>([]);
  const [homeConfigDrafts, setHomeConfigDrafts] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<AdminVersion[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [draftAnnouncement, setDraftAnnouncement] = useState(emptyAnnouncement);
  const [audit, setAudit] = useState<AdminAuditLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // The backend is the authority for the platform role; PublicUser does not contain it.
        const appConfig = await getMobileAdminConfig();
        if (cancelled) return;
        setConfig(appConfig);
        const results = await Promise.allSettled([
          getMobileAdminFeatures(), getMobileAdminNavigation(), getMobileAdminHome(),
          getMobileAdminVersions(), getMobileAdminAnnouncements(), getMobileAdminAuditLogs(),
        ]);
        if (cancelled) return;
        if (results[0]?.status === 'fulfilled') setFeatures(results[0].value);
        if (results[1]?.status === 'fulfilled') setNavigation(results[1].value);
        if (results[2]?.status === 'fulfilled') {
          setHome(results[2].value);
          setHomeConfigDrafts(Object.fromEntries(results[2].value.map((item) => [item.sectionKey, item.configJson ? JSON.stringify(item.configJson, null, 2) : ''])));
        }
        if (results[3]?.status === 'fulfilled') setVersions(results[3].value);
        if (results[4]?.status === 'fulfilled') setAnnouncements(results[4].value);
        if (results[5]?.status === 'fulfilled') setAudit(results[5].value);
        const failed = results.filter((result) => result.status === 'rejected');
        if (failed.length) setError(`${failed.length} admin section${failed.length === 1 ? '' : 's'} could not load. Refresh to retry.`);
      } catch (caught) {
        if (!cancelled) {
          setDenied(caught instanceof ApiError && caught.status === 403);
          setError(errorMessage(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); setNotice(success); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(false); }
  };

  const changeFeature = (key: string, patch: Partial<AdminFeatureFlag>) =>
    setFeatures((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  const changeNavigation = (key: string, patch: Partial<AdminNavigationItem>) =>
    setNavigation((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  const changeHome = (key: string, patch: Partial<AdminHomeSection>) =>
    setHome((items) => items.map((item) => item.sectionKey === key ? { ...item, ...patch } : item));
  const changeVersion = (platform: string, patch: Partial<AdminVersion>) =>
    setVersions((items) => items.map((item) => item.platform === platform ? { ...item, ...patch } : item));
  const changeAnnouncement = (id: string, patch: Partial<AdminAnnouncement>) =>
    setAnnouncements((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  return <div className="flex w-full flex-col gap-unit-lg pb-unit-2xl">
    <PageHeader badge="ADMIN" description="Manage the mobile app experience using the existing platform admin API. Changes are recorded in the audit log." title="Mobile app control center" />
    {loading && <div className={cardClass} role="status">Checking admin access and loading controls…</div>}
    {!loading && denied && <div className={cardClass} role="alert"><h2 className="text-headline-sm font-semibold">Admin access required</h2><p className="mt-2 text-body-sm text-secondary">Only platform admins can manage the mobile app. The API denied this account access.</p></div>}
    {!loading && !denied && !config && <div className={cardClass} role="alert">{error ?? 'App controls are unavailable.'}</div>}
    {config && !denied && <>
      <nav aria-label="Mobile admin sections" className="flex gap-2 overflow-x-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-2">
        {SECTIONS.map((item) => <button aria-current={section === item.id ? 'page' : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-label-md font-semibold transition-colors ${section === item.id ? 'bg-primary text-on-primary' : 'text-secondary hover:bg-surface-container-low hover:text-on-surface'}`} key={item.id} onClick={() => { setSection(item.id); setNotice(null); setError(null); }} type="button"><span className="material-symbols-outlined text-[18px]">{item.icon}</span>{item.label}</button>)}
      </nav>
      {error && <p className="rounded-lg border border-error/30 bg-error/5 p-3 text-body-sm text-error" role="alert">{error}</p>}
      {notice && <p className="rounded-lg border border-healthy-text/30 bg-healthy-bg p-3 text-body-sm text-healthy-text" role="status">{notice}</p>}

      {section === 'branding' && <section className={cardClass} aria-label="App settings"><div className="mb-5"><h2 className="text-headline-sm font-semibold">Branding and maintenance</h2><p className="text-body-sm text-secondary">These settings are delivered to the mobile app at bootstrap.</p></div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save(async () => { setConfig(await updateMobileAdminConfig({ appName: config.appName, logoUrl: config.logoUrl || null, primaryColor: config.primaryColor, secondaryColor: config.secondaryColor, maintenanceMode: config.maintenanceMode, maintenanceMessage: config.maintenanceMessage || null })); }, 'App settings saved.'); }}>
          <Field label="App name" maxLength={100} onChange={(appName) => setConfig({ ...config, appName })} value={config.appName} />
          <Field label="Logo URL" onChange={(logoUrl) => setConfig({ ...config, logoUrl })} value={config.logoUrl ?? ''} />
          <Field label="Primary color" onChange={(primaryColor) => setConfig({ ...config, primaryColor })} type="color" value={config.primaryColor} />
          <Field label="Secondary color" onChange={(secondaryColor) => setConfig({ ...config, secondaryColor })} type="color" value={config.secondaryColor} />
          <div className="sm:col-span-2"><Toggle checked={config.maintenanceMode} label="Maintenance mode" onChange={(maintenanceMode) => setConfig({ ...config, maintenanceMode })} /></div>
          <div className="sm:col-span-2"><Field label="Maintenance message" onChange={(maintenanceMessage) => setConfig({ ...config, maintenanceMessage })} value={config.maintenanceMessage ?? ''} /></div>
          <div className="sm:col-span-2"><button className={buttonClass} disabled={busy} type="submit">Save app settings</button></div>
        </form>
      </section>}

      {section === 'features' && <section className="grid gap-3" aria-label="Mobile feature flags">
        {features.map((feature) => <div className={cardClass} key={feature.key}>
          <div className="mb-3 flex items-center justify-between gap-3"><span className="rounded bg-primary/10 px-2 py-1 font-mono text-caption-xs text-primary">{feature.key}</span><Toggle checked={feature.enabled} label="Enabled" onChange={(enabled) => changeFeature(feature.key, { enabled })} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Feature name" maxLength={100} onChange={(name) => changeFeature(feature.key, { name })} value={feature.name} /><Field label="Minimum app version" onChange={(minAppVersion) => changeFeature(feature.key, { minAppVersion })} value={feature.minAppVersion ?? ''} /><div className="sm:col-span-2"><Field label="Description" onChange={(description) => changeFeature(feature.key, { description })} value={feature.description ?? ''} /></div></div>
          <button className={`${buttonClass} mt-4`} disabled={busy || !feature.name.trim()} onClick={() => void save(async () => { const updated = await updateMobileAdminFeature(feature.key, { name: feature.name, description: feature.description || null, enabled: feature.enabled, minAppVersion: feature.minAppVersion || null }); changeFeature(feature.key, updated); }, `${feature.name} saved.`)} type="button">Save feature</button>
        </div>)}
        {features.length === 0 && <p className={cardClass}>No feature flags returned.</p>}
      </section>}

      {section === 'navigation' && <section className={cardClass} aria-label="Mobile navigation">
        <h2 className="text-headline-sm font-semibold">Navigation items</h2><p className="mb-4 text-body-sm text-secondary">Edit labels, routes, icons, badges, order, and visibility for the app navigation.</p>
        <div className="space-y-3">{navigation.map((item) => <div className="grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 sm:grid-cols-2 xl:grid-cols-3" key={item.key}>
          <Field label="Label" maxLength={50} onChange={(label) => changeNavigation(item.key, { label })} value={item.label} />
          <Field label="Route" maxLength={100} onChange={(route) => changeNavigation(item.key, { route })} value={item.route} />
          <Field label="Icon" maxLength={50} onChange={(icon) => changeNavigation(item.key, { icon })} value={item.icon} />
          <Field label="Badge" onChange={(badge) => changeNavigation(item.key, { badge })} value={item.badge ?? ''} />
          <Field label="Order" onChange={(value) => changeNavigation(item.key, { sortOrder: Number(value) || 0 })} type="number" value={String(item.sortOrder)} />
          <div className="flex items-end pb-2"><Toggle checked={item.enabled} label="Enabled" onChange={(enabled) => changeNavigation(item.key, { enabled })} /></div>
        </div>)}</div>
        <button className={`${buttonClass} mt-4`} disabled={busy || !navigation.length} onClick={() => void save(async () => { setNavigation(await updateMobileAdminNavigation(navigation.map(({ key, label, icon, route, sortOrder, enabled, badge }) => ({ key, label, icon, route, sortOrder, enabled, badge: badge || null })))); }, 'Navigation saved.')} type="button">Save navigation</button>
      </section>}

      {section === 'home' && <section className={cardClass} aria-label="Mobile home layout">
        <h2 className="text-headline-sm font-semibold">Home sections</h2><p className="mb-4 text-body-sm text-secondary">Control the title, order, visibility, and optional JSON configuration of each section.</p>
        <div className="space-y-3">{home.map((item) => <div className="grid gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]" key={item.sectionKey}>
          <Field label={`Title · ${item.sectionKey}`} maxLength={100} onChange={(title) => changeHome(item.sectionKey, { title })} value={item.title} />
          <Field label="Order" onChange={(value) => changeHome(item.sectionKey, { sortOrder: Number(value) || 0 })} type="number" value={String(item.sortOrder)} />
          <div className="flex items-end pb-2"><Toggle checked={item.enabled} label="Enabled" onChange={(enabled) => changeHome(item.sectionKey, { enabled })} /></div>
          <label className="flex flex-col gap-1.5 text-label-md font-medium sm:col-span-3">Section config (JSON object)<textarea className={`${fieldClass} min-h-20 font-mono`} onChange={(event) => setHomeConfigDrafts((drafts) => ({ ...drafts, [item.sectionKey]: event.target.value }))} value={homeConfigDrafts[item.sectionKey] ?? ''} /></label>
        </div>)}</div>
        <button className={`${buttonClass} mt-4`} disabled={busy || !home.length} onClick={() => void save(async () => {
          const sections = home.map(({ sectionKey, title, sortOrder, enabled }) => {
            const raw = homeConfigDrafts[sectionKey]?.trim();
            const configJson: unknown = raw ? JSON.parse(raw) : null;
            if (configJson !== null && (typeof configJson !== 'object' || Array.isArray(configJson))) throw new Error(`${sectionKey} config must be a JSON object.`);
            return { sectionKey, title, sortOrder, enabled, configJson: configJson as Record<string, unknown> | null };
          });
          setHome(await updateMobileAdminHome(sections));
        }, 'Home layout saved.')} type="button">Save home layout</button>
      </section>}

      {section === 'versions' && <section className="grid gap-3" aria-label="App version policies">{versions.map((version) => <div className={cardClass} key={version.platform}><h2 className="mb-4 text-headline-sm font-semibold capitalize">{version.platform} version policy</h2><div className="grid gap-3 sm:grid-cols-2"><Field label="Minimum version" onChange={(minimumVersion) => changeVersion(version.platform, { minimumVersion })} value={version.minimumVersion} /><Field label="Latest version" onChange={(latestVersion) => changeVersion(version.platform, { latestVersion })} value={version.latestVersion} /><Field label="Update URL" onChange={(updateUrl) => changeVersion(version.platform, { updateUrl })} value={version.updateUrl ?? ''} /><Field label="Release notes" onChange={(releaseNotes) => changeVersion(version.platform, { releaseNotes })} value={version.releaseNotes ?? ''} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Toggle checked={version.forceUpdate} label="Force update" onChange={(forceUpdate) => changeVersion(version.platform, { forceUpdate })} /><button className={buttonClass} disabled={busy} onClick={() => void save(async () => { const updated = await updateMobileAdminVersion(version.platform, { minimumVersion: version.minimumVersion, latestVersion: version.latestVersion, forceUpdate: version.forceUpdate, updateUrl: version.updateUrl || null, releaseNotes: version.releaseNotes || null }); changeVersion(version.platform, updated); }, `${version.platform} version saved.`)} type="button">Save version</button></div></div>)}{versions.length === 0 && <p className={cardClass}>No version policies returned.</p>}</section>}

      {section === 'announcements' && <section className="grid gap-4" aria-label="Mobile announcements">
        <form className={cardClass} onSubmit={(event) => { event.preventDefault(); void save(async () => { const created = await createMobileAdminAnnouncement({ ...draftAnnouncement, title: draftAnnouncement.title.trim(), message: draftAnnouncement.message.trim() }); setAnnouncements((items) => [created, ...items]); setDraftAnnouncement(emptyAnnouncement); }, 'Announcement created.'); }}>
          <h2 className="mb-4 text-headline-sm font-semibold">Create announcement</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" maxLength={150} onChange={(title) => setDraftAnnouncement({ ...draftAnnouncement, title })} value={draftAnnouncement.title} />
            <label className="flex flex-col gap-1.5 text-label-md font-medium">Type<select className={fieldClass} onChange={(event) => setDraftAnnouncement({ ...draftAnnouncement, type: event.target.value as AdminAnnouncement['type'] })} value={draftAnnouncement.type}>{['info', 'warning', 'critical', 'promo'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium sm:col-span-2">Message<textarea className={`${fieldClass} min-h-24`} maxLength={1000} onChange={(event) => setDraftAnnouncement({ ...draftAnnouncement, message: event.target.value })} value={draftAnnouncement.message} /></label>
            <Field label="Action URL" onChange={(actionUrl) => setDraftAnnouncement({ ...draftAnnouncement, actionUrl })} value={draftAnnouncement.actionUrl ?? ''} />
            <Field label="Action label" onChange={(actionLabel) => setDraftAnnouncement({ ...draftAnnouncement, actionLabel })} value={draftAnnouncement.actionLabel ?? ''} />
            <Field label="Starts at" onChange={(value) => setDraftAnnouncement({ ...draftAnnouncement, startsAt: isoDateTime(value) })} type="datetime-local" value={localDateTime(draftAnnouncement.startsAt)} />
            <Field label="Expires at" onChange={(value) => setDraftAnnouncement({ ...draftAnnouncement, expiresAt: isoDateTime(value) })} type="datetime-local" value={localDateTime(draftAnnouncement.expiresAt)} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Toggle checked={draftAnnouncement.isActive} label="Active" onChange={(isActive) => setDraftAnnouncement({ ...draftAnnouncement, isActive })} /><button className={buttonClass} disabled={busy || !draftAnnouncement.title.trim() || !draftAnnouncement.message.trim()} type="submit">Publish announcement</button></div>
        </form>
        {announcements.map((item) => <div className={cardClass} key={item.id}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" maxLength={150} onChange={(title) => changeAnnouncement(item.id, { title })} value={item.title} />
            <label className="flex flex-col gap-1.5 text-label-md font-medium">Type<select className={fieldClass} onChange={(event) => changeAnnouncement(item.id, { type: event.target.value as AdminAnnouncement['type'] })} value={item.type}>{['info', 'warning', 'critical', 'promo'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="flex flex-col gap-1.5 text-label-md font-medium sm:col-span-2">Message<textarea className={`${fieldClass} min-h-24`} maxLength={1000} onChange={(event) => changeAnnouncement(item.id, { message: event.target.value })} value={item.message} /></label>
            <Field label="Action URL" onChange={(actionUrl) => changeAnnouncement(item.id, { actionUrl })} value={item.actionUrl ?? ''} />
            <Field label="Action label" onChange={(actionLabel) => changeAnnouncement(item.id, { actionLabel })} value={item.actionLabel ?? ''} />
            <Field label="Starts at" onChange={(value) => changeAnnouncement(item.id, { startsAt: isoDateTime(value) })} type="datetime-local" value={localDateTime(item.startsAt)} />
            <Field label="Expires at" onChange={(value) => changeAnnouncement(item.id, { expiresAt: isoDateTime(value) })} type="datetime-local" value={localDateTime(item.expiresAt)} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Toggle checked={item.isActive} label="Active" onChange={(isActive) => changeAnnouncement(item.id, { isActive })} /><div className="flex gap-2"><button className={outlineButtonClass} disabled={busy} onClick={() => { if (!window.confirm(`Delete announcement “${item.title}”?`)) return; void save(async () => { await deleteMobileAdminAnnouncement(item.id); setAnnouncements((items) => items.filter((entry) => entry.id !== item.id)); }, 'Announcement deleted.'); }} type="button">Delete</button><button className={buttonClass} disabled={busy || !item.title.trim() || !item.message.trim()} onClick={() => void save(async () => { const updated = await updateMobileAdminAnnouncement(item.id, { title: item.title, message: item.message, type: item.type, actionUrl: item.actionUrl || null, actionLabel: item.actionLabel || null, isActive: item.isActive, startsAt: item.startsAt, expiresAt: item.expiresAt }); changeAnnouncement(item.id, updated); }, 'Announcement saved.')} type="button">Save</button></div></div>
        </div>)}
      </section>}

      {section === 'audit' && <section className={cardClass} aria-label="Mobile admin audit log"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-headline-sm font-semibold">Recent admin changes</h2><p className="text-caption-xs text-secondary">The latest 100 changes recorded by the API.</p></div><button className={outlineButtonClass} disabled={busy} onClick={() => void save(async () => { setAudit(await getMobileAdminAuditLogs()); }, 'Audit log refreshed.')} type="button">Refresh</button></div><div className="divide-y divide-outline-variant/40">{audit.map((item) => <div className="flex flex-wrap justify-between gap-2 py-3" key={item.id}><div><p className="text-label-md font-semibold text-on-surface">{item.action.replace(/_/g, ' ')}</p><p className="break-all text-caption-xs text-secondary">{item.target}</p></div><time className="text-caption-xs text-secondary">{new Date(item.createdAt).toLocaleString()}</time></div>)}{audit.length === 0 && <p className="py-4 text-body-sm text-secondary">No admin changes recorded yet.</p>}</div></section>}
    </>}
  </div>;
};
