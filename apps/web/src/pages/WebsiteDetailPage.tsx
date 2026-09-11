import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { archiveInventory, getInventory, updateInventory } from '@/api/inventory';
import {
  getApplicationDomains,
  getApplicationHostingTargets,
  getImmediateRelationships,
} from '@/api/read-models';
import type { Application, EntityReference } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/common/Button';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import {
  applicationConfiguration,
  graphKindResource,
} from '@/features/integration/resource-configs';

interface DisplayAssociation extends EntityReference {
  context: string;
  label: string;
}

const kindLabel = (kind: Application['kind']) => kind.split('_').join(' ');

function recordLabel(record: Record<string, unknown>, reference: EntityReference) {
  for (const key of ['domainName', 'name', 'label']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  return reference.entityKind.split('_').join(' ');
}

const DetailCell: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, mono, value }) => (
  <div className="min-w-0 rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-unit-sm">
    <dt className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{label}</dt>
    <dd className={`mt-unit-2xs break-words text-body-sm text-on-surface ${mono ? 'font-label-mono text-caption-xs' : ''}`}>{value}</dd>
  </div>
);

const ApplicationAssociations: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const { sessionScopeKey } = useAuth();
  const [items, setItems] = useState<DisplayAssociation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setItems([]);

    void (async () => {
      const [domains, hostingTargets, relationships] = await Promise.all([
        getApplicationDomains(applicationId, controller.signal),
        getApplicationHostingTargets(applicationId, controller.signal),
        getImmediateRelationships('WEBSITE_APPLICATION', applicationId, controller.signal),
      ]);
      const unique = new Map<string, { context: string; reference: EntityReference }>();
      domains.items.forEach((reference) => unique.set(`${reference.entityKind}:${reference.entityId}`, { context: 'Domain mapping', reference }));
      hostingTargets.items.forEach((reference) => unique.set(`${reference.entityKind}:${reference.entityId}`, { context: 'Hosting target', reference }));
      relationships.items.forEach((relationship) => {
        const reference = relationship.entity;
        const key = `${reference.entityKind}:${reference.entityId}`;
        if (!unique.has(key)) unique.set(key, { context: `${relationship.direction.toLowerCase()} ${relationship.relationshipType.split('_').join(' ')}`, reference });
      });

      const pending = [...unique.values()];
      const hydrated: DisplayAssociation[] = [];
      let index = 0;
      const worker = async () => {
        while (index < pending.length && !controller.signal.aborted) {
          const entry = pending[index++];
          if (!entry) continue;
          const resource = graphKindResource(entry.reference.entityKind);
          if (!resource) {
            hydrated.push({ ...entry.reference, context: entry.context, label: entry.reference.entityKind.split('_').join(' ') });
            continue;
          }
          try {
            const record = await getInventory(resource, entry.reference.entityId, controller.signal);
            hydrated.push({ ...entry.reference, context: entry.context, label: recordLabel(record as unknown as Record<string, unknown>, entry.reference) });
          } catch {
            if (!controller.signal.aborted) hydrated.push({ ...entry.reference, context: entry.context, label: `${entry.reference.entityKind.split('_').join(' ')} unavailable` });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, () => worker()));
      if (active && !controller.signal.aborted) setItems(hydrated);
    })().catch((requestError: unknown) => {
      if (active && !controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Application mappings could not be loaded.');
    }).finally(() => {
      if (active && !controller.signal.aborted) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [applicationId, sessionScopeKey]);

  const grouped = useMemo(() => ({
    domains: items.filter((item) => item.context === 'Domain mapping'),
    hosting: items.filter((item) => item.context === 'Hosting target'),
    relationships: items.filter((item) => item.context !== 'Domain mapping' && item.context !== 'Hosting target'),
  }), [items]);

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
      <div className="flex items-center justify-between gap-unit-sm">
        <div><p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Inventory graph</p><h2 className="mt-1 text-headline-sm font-semibold text-on-surface">Application mappings</h2></div>
        <span className="rounded bg-surface-container-high px-2 py-1 font-label-mono text-caption-xs font-semibold text-primary">{items.length} RELATED</span>
      </div>
      {loading ? <p className="mt-unit-md text-body-sm text-secondary">Loading domain, hosting, and relationship read models…</p>
        : error ? <p role="alert" className="mt-unit-md text-body-sm text-error">{error}</p>
        : items.length === 0 ? <div className="mt-unit-md rounded-lg bg-surface-container-low p-unit-lg text-center"><span className="material-symbols-outlined text-3xl text-outline">account_tree</span><p className="mt-2 text-body-sm text-secondary">No tracked mappings are available for this application.</p></div>
        : <div className="mt-unit-md grid grid-cols-1 gap-unit-sm lg:grid-cols-3">
          {([
            ['Domains', grouped.domains],
            ['Hosting targets', grouped.hosting],
            ['Other relationships', grouped.relationships],
          ] as const).map(([label, entries]) => (
            <div key={label} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-md">
              <h3 className="text-label-md font-semibold text-on-surface">{label}</h3>
              {entries.length === 0 ? <p className="mt-2 text-caption-xs text-secondary">None mapped</p> : <ul className="mt-unit-sm space-y-unit-xs">{entries.map((entry) => <li key={`${entry.entityKind}:${entry.entityId}`} className="rounded-lg bg-surface-container-lowest p-unit-sm"><p className="truncate text-body-sm font-semibold text-on-surface">{entry.label}</p><p className="mt-0.5 text-caption-xs text-secondary">{entry.entityKind.split('_').join(' ')} · {entry.context}</p></li>)}</ul>}
            </div>
          ))}
        </div>}
    </section>
  );
};

export const WebsiteDetailPage: React.FC = () => {
  const { websiteId = '' } = useParams<{ websiteId: string }>();
  const [record, setRecord] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setRecord(null);
    setLoading(true);
    setError(null);
    void getInventory('applications', websiteId, controller.signal).then((application) => {
      if (active) setRecord(application);
    }).catch((requestError: unknown) => {
      if (active && !controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Application not found.');
    }).finally(() => {
      if (active && !controller.signal.aborted) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [websiteId]);

  const changeState = async () => {
    if (!record) return;
    setError(null);
    try {
      if (record.inventoryState === 'TRACKED') {
        await archiveInventory('applications', record.id);
        setRecord({ ...record, inventoryState: 'ARCHIVED' });
      } else {
        setRecord(await updateInventory('applications', record.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The application could not be updated.');
    }
  };

  const exportRecord = () => {
    if (!record) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${record.id}-application-record.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <StatePanel icon="progress_activity" spinning message="Loading application record…" />;
  if (!record) return <StatePanel icon="search_off" message={error ?? 'Application not found.'} action={<Link className="font-semibold text-primary" to="/websites">Back to websites &amp; apps</Link>} />;
  const canOpenUrl = record.primaryUrl ? /^https?:\/\//i.test(record.primaryUrl) : false;

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <div className="flex flex-wrap items-center gap-unit-xs">
        <Link className="text-label-md text-secondary transition-colors hover:text-primary" to="/websites">Websites &amp; Apps</Link>
        <span className="material-symbols-outlined text-[14px] text-secondary">chevron_right</span>
        <span className="text-label-md font-semibold text-on-surface">{record.name}</span>
      </div>

      <header className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-tertiary to-surface-variant" />
        <div className="flex flex-col gap-unit-lg md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-caption-xs font-mono uppercase tracking-wider text-secondary">Application inventory record</p>
            <div className="mt-1 flex flex-wrap items-center gap-unit-sm"><h1 className="text-headline-md font-bold tracking-tight text-on-surface">{record.name}</h1><InventoryState state={record.inventoryState} /><span className="rounded-full border border-outline-variant/30 bg-surface-container px-2 py-1 text-[11px] font-semibold text-secondary">{kindLabel(record.kind)}</span></div>
            <p className="mt-unit-xs break-all font-label-mono text-caption-xs text-secondary">Record ID: {record.id}</p>
          </div>
          <div className="flex flex-wrap gap-unit-xs">
            {canOpenUrl && <a className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-label-md font-medium text-on-primary shadow-sm" href={record.primaryUrl ?? undefined} rel="noreferrer" target="_blank"><span className="material-symbols-outlined text-[16px]">open_in_new</span>Open URL</a>}
            <Button iconLeading="tune" onClick={() => setEditing(true)}>Edit</Button>
            <Button variant={record.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} onClick={() => void changeState()}>{record.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button>
            <Button variant="ghost" iconLeading="ios_share" aria-label="Export application record" onClick={exportRecord} />
          </div>
        </div>
      </header>

      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}

      <dl className="grid grid-cols-2 gap-unit-2xs rounded-xl border border-outline-variant/30 bg-surface-container-low p-unit-xs shadow-sm md:grid-cols-3 lg:grid-cols-6">
        <DetailCell label="Kind" value={kindLabel(record.kind)} />
        <DetailCell label="Primary URL" value={record.primaryUrl ?? 'Not set'} mono />
        <DetailCell label="Project record" value={record.projectId ?? 'Not mapped'} mono />
        <DetailCell label="Primary domain" value={record.primaryDomainId ?? 'Not mapped'} mono />
        <DetailCell label="Provenance" value={record.provenance.split('_').join(' ')} />
        <DetailCell label="Last updated" value={new Date(record.updatedAt).toLocaleString()} />
      </dl>

      <div className="grid grid-cols-1 gap-unit-md lg:grid-cols-3">
        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm lg:col-span-2">
          <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Stored metadata</p>
          <h2 className="mt-1 text-headline-sm font-semibold text-on-surface">Application configuration</h2>
          <dl className="mt-unit-md grid grid-cols-1 gap-unit-sm md:grid-cols-2">
            <DetailCell label="Name" value={record.name} />
            <DetailCell label="Application kind" value={kindLabel(record.kind)} />
            <DetailCell label="Primary URL" value={record.primaryUrl ?? 'Not set'} mono />
            <DetailCell label="Inventory state" value={record.inventoryState === 'TRACKED' ? 'Tracked' : 'Archived'} />
          </dl>
        </section>
        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-sm">
          <p className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">Record notes</p>
          <h2 className="mt-1 text-headline-sm font-semibold text-on-surface">Notes &amp; lifecycle</h2>
          <p className="mt-unit-md whitespace-pre-wrap text-body-sm text-on-surface">{record.notes ?? 'No notes have been stored.'}</p>
          <dl className="mt-unit-md space-y-unit-sm border-t border-outline-variant/25 pt-unit-md"><div><dt className="text-caption-xs uppercase text-secondary">Created</dt><dd className="mt-1 text-body-sm">{new Date(record.createdAt).toLocaleString()}</dd></div><div><dt className="text-caption-xs uppercase text-secondary">Updated</dt><dd className="mt-1 text-body-sm">{new Date(record.updatedAt).toLocaleString()}</dd></div></dl>
        </section>
      </div>

      <ApplicationAssociations applicationId={record.id} />

      <div className="flex items-start gap-unit-sm rounded-xl border border-outline-variant/20 bg-surface-container-low p-unit-md"><span className="material-symbols-outlined text-[18px] text-primary">info</span><p className="text-caption-xs text-secondary">DomainPulse currently shows stored application metadata and database-backed graph mappings. Runtime health, environment, technology detection, ports, repositories, SSL, deployment status, and uptime monitoring are not connected.</p></div>
      {editing && <ResourceFormModal config={applicationConfiguration} record={record} onClose={() => setEditing(false)} onSaved={setRecord} />}
    </div>
  );
};
