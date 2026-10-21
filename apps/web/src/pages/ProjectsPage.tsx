import React, { useMemo, useState } from 'react';

import { archiveInventory, updateInventory } from '@/api/inventory';
import { getProjectResources } from '@/api/read-models';
import type { Project } from '@/api/types';
import { Button } from '@/components/common/Button';
import { PageHeader } from '@/components/common/PageHeader';
import { EntityAssociations } from '@/components/integration/EntityAssociations';
import {
  InventoryState,
  ResourceFormModal,
  StatePanel,
} from '@/components/integration/InventoryWorkspace';
import { projectConfiguration } from '@/features/integration/resource-configs';
import { useCursorInventory } from '@/hooks/useCursorInventory';
import { formatDateTime } from '@/lib/format';

export const ProjectsPage: React.FC = () => {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Project | 'create' | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const list = useCursorInventory('projects', includeArchived);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return list.items;
    return list.items.filter((project) =>
      [project.name, project.description].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [list.items, search]);

  const inspected = list.items.find((project) => project.id === inspectedId) ?? null;
  const associationSources = useMemo(
    () => [{
      context: 'Project resource',
      load: (signal: AbortSignal) => inspectedId
        ? getProjectResources(inspectedId, signal)
        : Promise.resolve({ items: [] }),
    }],
    [inspectedId],
  );

  const changeState = async (project: Project) => {
    if (pendingId) return;
    setActionError(null);
    setPendingId(project.id);
    try {
      if (project.inventoryState === 'TRACKED') {
        await archiveInventory('projects', project.id);
        if (includeArchived) list.markArchived(project.id);
        else list.remove(project.id);
      } else {
        list.upsert(await updateInventory('projects', project.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'The project could not be updated.');
    } finally {
      setPendingId(null);
    }
  };

  const trackedCount = list.items.filter((project) => project.inventoryState === 'TRACKED').length;
  const describedCount = list.items.filter((project) => Boolean(project.description)).length;

  return (
    <div className="flex w-full flex-col gap-unit-md">
      <PageHeader
        actions={<Button variant="primary" iconLeading="add" onClick={() => setEditing('create')}>Add Project</Button>}
        description="Project records group applications, servers, and cloud resources. Resource counts come from the inventory graph and only include tracked relationships."
        badge={`${list.items.length} LOADED`}
        title="Projects"
      />

      <section className="grid grid-cols-2 gap-unit-sm lg:grid-cols-4" aria-label="Loaded project summary">
        {[
          { icon: 'workspaces', label: 'Loaded records', value: list.items.length },
          { icon: 'inventory_2', label: 'Tracked', value: trackedCount },
          { icon: 'archive', label: 'Archived', value: list.items.length - trackedCount },
          { icon: 'notes', label: 'With description', value: describedCount },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-md shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption-xs font-semibold uppercase tracking-wider text-secondary">{item.label}</span>
              <span className="material-symbols-outlined text-[20px] text-primary">{item.icon}</span>
            </div>
            <p className="mt-unit-xs font-label-mono text-headline-md font-semibold text-on-surface">{item.value}</p>
            <p className="mt-1 text-caption-xs text-secondary">Current loaded page only</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col items-start gap-unit-lg xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-unit-sm">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-sm shadow-sm">
            <div className="flex flex-col gap-unit-sm lg:flex-row lg:items-center">
              <label className="relative min-w-[240px] flex-1">
                <span className="sr-only">Filter loaded projects</span>
                <span className="material-symbols-outlined pointer-events-none absolute left-unit-sm top-1/2 -translate-y-1/2 text-[18px] text-secondary">search</span>
                <input
                  className="h-9 w-full rounded-lg border border-outline-variant/30 bg-surface-container-low py-0 pl-9 pr-unit-md text-body-sm text-on-surface focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Filter loaded projects by name or description…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="flex h-9 items-center gap-unit-xs whitespace-nowrap rounded-lg border border-outline-variant/30 bg-surface-container-low px-unit-sm text-caption-xs text-secondary">
                <input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />
                Include archived
              </label>
            </div>
            <div className="mt-unit-sm flex items-center justify-between border-t border-outline-variant/20 pt-unit-xs text-caption-xs text-secondary">
              <span>{visibleProjects.length} shown from {list.items.length} loaded records</span>
              {search && <button className="font-semibold text-primary hover:underline" type="button" onClick={() => setSearch('')}>Clear filter</button>}
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
            {list.loading ? <StatePanel icon="progress_activity" message="Loading projects…" spinning />
              : list.error ? <StatePanel icon="error" message={list.error} action={<Button onClick={list.reload}>Try again</Button>} />
              : visibleProjects.length === 0 ? <StatePanel icon="workspaces" message={search ? 'No loaded projects match this filter.' : 'No project records have been added.'} action={!search ? <Button variant="primary" onClick={() => setEditing('create')}>Add project</Button> : undefined} />
              : <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead><tr className="h-9 border-b border-outline-variant/30 bg-surface-container-low text-caption-xs uppercase tracking-wider text-secondary"><th className="px-unit-sm font-semibold">Project</th><th className="px-unit-sm font-semibold">Description</th><th className="px-unit-sm font-semibold">State</th><th className="px-unit-sm font-semibold">Updated</th><th className="px-unit-sm text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-outline-variant/25 text-body-sm">
                {visibleProjects.map((project) => (
                  <tr key={project.id} className={`${inspectedId === project.id ? 'bg-primary/5' : 'hover:bg-surface-container-low'} transition-colors`}>
                    <td className="px-unit-sm py-unit-sm">
                      <div className="flex min-w-[180px] items-center gap-unit-sm">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary"><span className="material-symbols-outlined text-[18px]">workspaces</span></span>
                        <div className="min-w-0"><p className="truncate font-semibold text-on-surface">{project.name}</p><p className="truncate font-label-mono text-caption-xs text-secondary">{project.id.slice(0, 8)}…</p></div>
                      </div>
                    </td>
                    <td className="max-w-[320px] px-unit-sm py-unit-sm text-secondary"><p className="truncate">{project.description || 'No description'}</p></td>
                    <td className="px-unit-sm py-unit-sm"><InventoryState state={project.inventoryState} /></td>
                    <td className="whitespace-nowrap px-unit-sm py-unit-sm text-caption-xs text-secondary">{formatDateTime(project.updatedAt)}</td>
                    <td className="px-unit-sm py-unit-sm"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setInspectedId(project.id)}>Inspect</Button><Button size="sm" variant="ghost" onClick={() => setEditing(project)}>Edit</Button></div></td>
                  </tr>
                ))}
              </tbody></table></div>}
            <footer className="flex min-h-11 items-center justify-between gap-unit-md border-t border-outline-variant/30 bg-surface-container-low px-unit-md py-unit-xs text-caption-xs text-secondary">
              <span>Search applies to loaded records only.</span>
              {list.nextCursor && <Button disabled={list.loadingMore} onClick={() => void list.loadMore()}>{list.loadingMore ? 'Loading…' : 'Load more'}</Button>}
            </footer>
          </section>
          {(actionError || list.loadMoreError) && <p role="alert" className="text-body-sm text-error">{actionError ?? list.loadMoreError}</p>}
        </div>

        {inspected && (
          <aside className="flex w-full shrink-0 flex-col gap-unit-md rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-unit-lg shadow-md xl:sticky xl:top-unit-md xl:w-[380px]" aria-label={`Inspect ${inspected.name}`}>
            <div className="flex items-start justify-between gap-unit-sm border-b border-outline-variant/25 pb-unit-sm">
              <div className="min-w-0"><p className="truncate text-headline-sm font-semibold text-on-surface">{inspected.name}</p><p className="mt-1 truncate font-label-mono text-caption-xs text-secondary">{inspected.id}</p></div>
              <button className="text-secondary hover:text-on-surface" type="button" aria-label="Close project inspector" onClick={() => setInspectedId(null)}><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <div><InventoryState state={inspected.inventoryState} /></div>
            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm">
              <p className="text-caption-xs text-secondary">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface">{inspected.description || 'No description recorded.'}</p>
            </div>
            <dl className="grid grid-cols-2 gap-unit-xs">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs text-secondary">Created</dt><dd className="mt-1 text-body-sm font-medium text-on-surface">{formatDateTime(inspected.createdAt)}</dd></div>
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-unit-sm"><dt className="text-caption-xs text-secondary">Updated</dt><dd className="mt-1 text-body-sm font-medium text-on-surface">{formatDateTime(inspected.updatedAt)}</dd></div>
            </dl>
            <EntityAssociations sources={associationSources} title="Project resources" />
            <div className="flex gap-unit-xs"><Button className="flex-1" onClick={() => setEditing(inspected)}>Edit</Button><Button className="flex-1" variant={inspected.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} disabled={pendingId === inspected.id} onClick={() => void changeState(inspected)}>{inspected.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
          </aside>
        )}
      </div>

      {editing && <ResourceFormModal config={projectConfiguration} record={editing === 'create' ? undefined : editing} onClose={() => setEditing(null)} onSaved={list.upsert} />}
    </div>
  );
};
