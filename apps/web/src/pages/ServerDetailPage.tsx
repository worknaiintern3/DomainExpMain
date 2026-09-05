import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getServerDetail } from '@/features/server-details/serverDetails.reference';
import { ServerDetailData } from '@/features/server-details/serverDetails.types';
import { ServerDetailHeader } from '@/features/server-details/components/ServerDetailHeader';
import { ServerKpiStrip } from '@/features/server-details/components/ServerKpiStrip';
import { ServerRelationshipMap } from '@/features/server-details/components/ServerRelationshipMap';
import { ServerMonitoringBanner } from '@/features/server-details/components/ServerMonitoringBanner';
import { ComputeSpecifications } from '@/features/server-details/components/ComputeSpecifications';
import { HostedApplicationsSection } from '@/features/server-details/components/HostedApplicationsSection';
import { DomainMappingsSection } from '@/features/server-details/components/DomainMappingsSection';
import { BillingSection } from '@/features/server-details/components/BillingSection';
import { ServerEditModal } from '@/features/server-details/components/ServerEditModal';
import { ReminderModal } from '@/features/server-details/components/ReminderModal';

export const ServerDetailPage: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const [detailData, setDetailData] = useState<ServerDetailData>(() =>
    getServerDetail(serverId)
  );

  useEffect(() => {
    setDetailData(getServerDetail(serverId));
  }, [serverId]);

  // Modal interaction states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const handleSaveMetadata = (updated: Partial<ServerDetailData>) => {
    setDetailData((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleSaveReminder = (leadDays: number, email: string) => {
    setDetailData((prev) => ({
      ...prev,
      billing: {
        ...prev.billing,
        notificationLeadDays: leadDays,
        notificationEmail: email,
      },
    }));
  };

  const handleExportSpecs = () => {
    const specsJson = JSON.stringify(detailData, null, 2);
    const blob = new Blob([specsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detailData.hostname}-specs-inventory.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full">
      {/* 1. Context Breadcrumbs & Header Actions Bar */}
      <ServerDetailHeader
        data={detailData}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onOpenReminderModal={() => setIsReminderModalOpen(true)}
        onExportSpecs={handleExportSpecs}
      />

      {/* 2. Top Metric Highlights KPI Cards (4 Bento Cards) */}
      <ServerKpiStrip data={detailData} />

      {/* 3. Infrastructure Relationship Chain */}
      <ServerRelationshipMap nodes={detailData.relationshipNodes} />

      {/* 4. Truthful Server Monitoring Callout Banner */}
      <ServerMonitoringBanner />

      {/* 5. Main 2-Column Workpane Breakdown (2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-unit-lg mb-unit-lg items-start">
        {/* Left Column (Span 2): Hardware Specs & Hosted Applications */}
        <div className="lg:col-span-2 flex flex-col gap-unit-lg">
          {/* Section A: Overview & Hardware Specs */}
          <ComputeSpecifications data={detailData} />

          {/* Section B: Hosted Websites & Applications */}
          <HostedApplicationsSection apps={detailData.hostedApps} />
        </div>

        {/* Right Column (Span 1): Domain DNS Mappings & Billing Renewal */}
        <div className="flex flex-col gap-unit-lg">
          {/* Section C: Connected Domains & DNS Mapping */}
          <DomainMappingsSection mappings={detailData.dnsMappings} />

          {/* Section D: Billing & Renewal Details */}
          <BillingSection billing={detailData.billing} />
        </div>
      </div>

      {/* Interactive Modal Overlays */}
      <ServerEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        data={detailData}
        onSave={handleSaveMetadata}
      />

      <ReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        serverName={detailData.name}
        billing={detailData.billing}
        onSaveReminder={handleSaveReminder}
      />
    </div>
  );
};
