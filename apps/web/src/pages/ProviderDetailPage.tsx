import React from 'react';
import { useParams } from 'react-router-dom';
import { InventoryDetail } from '@/components/integration/InventoryDetail';
import { providerConfiguration } from '@/features/integration/resource-configs';
export const ProviderDetailPage: React.FC = () => {
  const { accountId = '' } = useParams<{ accountId: string }>();
  return <InventoryDetail config={providerConfiguration} id={accountId}><section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5"><h2 className="text-headline-sm font-semibold">Provider scope</h2><p className="mt-2 text-body-sm text-secondary">The backend exposes stored provider metadata and an optional login email reference. Provider-centric asset totals, billing, invoices, renewal dates, and live synchronization are unavailable and are not inferred.</p></section></InventoryDetail>;
};
