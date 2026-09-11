import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { archiveInventory, getInventory, updateInventory } from '@/api/inventory';
import type { InventoryMetadata, InventoryResource, InventoryResourceMap } from '@/api/types';
import { Button } from '@/components/common/Button';
import { InventoryState, ResourceFormModal, StatePanel, type ResourceConfiguration } from './InventoryWorkspace';

export const InventoryDetail = <R extends InventoryResource>({
  children,
  config,
  id,
}: React.PropsWithChildren<{ config: ResourceConfiguration<R>; id: string }>) => {
  const [record, setRecord] = useState<InventoryResourceMap[R] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void getInventory(config.resource, id, controller.signal).then(setRecord).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : 'Record not found.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [config.resource, id]);

  const changeState = async () => {
    if (!record) return;
    setError(null);
    try {
      if (record.inventoryState === 'TRACKED') {
        await archiveInventory(config.resource, record.id);
        setRecord({ ...record, inventoryState: 'ARCHIVED' });
      } else {
        setRecord(await updateInventory(config.resource, record.id, { inventoryState: 'TRACKED' }));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The record could not be updated.');
    }
  };

  if (loading) return <StatePanel icon="progress_activity" spinning message={`Loading ${config.singular}…`} />;
  if (error && !record) return <StatePanel icon="search_off" message={error} action={<Link className="text-primary font-semibold" to={config.detailBase ?? '/overview'}>Back to inventory</Link>} />;
  if (!record) return null;
  const shape = record as unknown as InventoryMetadata & Record<string, unknown>;

  return (
    <div className="flex flex-col gap-unit-lg">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <Link className="text-caption-xs text-primary font-semibold" to={config.detailBase ?? '/overview'}>← Back to {config.title}</Link>
          <h1 className="text-headline-md font-semibold mt-2">{String(shape[config.fields[0]?.key ?? 'id'])}</h1>
          <div className="flex items-center gap-2 mt-2"><InventoryState state={record.inventoryState} /><span className="text-caption-xs text-secondary">{record.provenance.split('_').join(' ')}</span></div>
        </div>
        <div className="flex gap-2"><Button onClick={() => setEditing(true)}>Edit</Button><Button variant={record.inventoryState === 'TRACKED' ? 'destructive' : 'outline'} onClick={() => void changeState()}>{record.inventoryState === 'TRACKED' ? 'Archive' : 'Restore'}</Button></div>
      </div>
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}
      <section className="rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-sm p-5">
        <h2 className="text-headline-sm font-semibold mb-4">Stored metadata</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {config.fields.map((field) => {
            const value = shape[field.key];
            let output: React.ReactNode = value === null || value === undefined || value === '' ? 'Unknown' : String(value);
            if (field.render) output = field.render(value, shape);
            else if (typeof value === 'boolean') output = value ? 'Enabled' : 'Disabled';
            else if (field.key.endsWith('At') && typeof value === 'string') output = new Date(value).toLocaleString();
            return <div key={field.key} className="rounded-lg bg-surface-container-low p-3 min-w-0"><dt className="text-caption-xs uppercase text-secondary">{field.label}</dt><dd className="text-body-sm text-on-surface mt-1 break-words">{output}</dd></div>;
          })}
          <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-caption-xs uppercase text-secondary">Created</dt><dd className="text-body-sm mt-1">{new Date(record.createdAt).toLocaleString()}</dd></div>
          <div className="rounded-lg bg-surface-container-low p-3"><dt className="text-caption-xs uppercase text-secondary">Updated</dt><dd className="text-body-sm mt-1">{new Date(record.updatedAt).toLocaleString()}</dd></div>
        </dl>
      </section>
      {children}
      {editing && <ResourceFormModal config={config} record={record} onClose={() => setEditing(false)} onSaved={setRecord} />}
    </div>
  );
};
