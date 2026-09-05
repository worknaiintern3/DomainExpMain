import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDomainDetail } from '@/features/domain-details/domainDetails.reference';
import { DomainDetailData } from '@/features/domain-details/domainDetails.types';
import { DomainDetailHeader } from '@/features/domain-details/components/DomainDetailHeader';
import { DomainKpiStrip } from '@/features/domain-details/components/DomainKpiStrip';
import { DomainRelationshipMap } from '@/features/domain-details/components/DomainRelationshipMap';
import { RegistrationDetails } from '@/features/domain-details/components/RegistrationDetails';
import { DnsRecordsSection } from '@/features/domain-details/components/DnsRecordsSection';
import { HostingMappingSection } from '@/features/domain-details/components/HostingMappingSection';
import { SslCertificateSection } from '@/features/domain-details/components/SslCertificateSection';
import { ProvenanceSection } from '@/features/domain-details/components/ProvenanceSection';
import { ZoneFileModal } from '@/features/domain-details/components/ZoneFileModal';
import { EditMetadataModal } from '@/features/domain-details/components/EditMetadataModal';
import { TransferChecklistModal } from '@/features/domain-details/components/TransferChecklistModal';

export const DomainDetailPage: React.FC = () => {
  const { domainId } = useParams<{ domainId: string }>();
  const [detailData, setDetailData] = useState<DomainDetailData>(() =>
    getDomainDetail(domainId)
  );

  useEffect(() => {
    setDetailData(getDomainDetail(domainId));
  }, [domainId]);

  // Modal interactive states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isZoneFileModalOpen, setIsZoneFileModalOpen] = useState(false);

  const handleSaveMetadata = (updated: Partial<DomainDetailData>) => {
    setDetailData((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleExportReport = () => {
    const reportJson = JSON.stringify(detailData, null, 2);
    const blob = new Blob([reportJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detailData.domain}-audit-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full">
      {/* 1. Top Context & Header Action Bar */}
      <DomainDetailHeader
        data={detailData}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onOpenTransferModal={() => setIsTransferModalOpen(true)}
        onExportReport={handleExportReport}
      />

      {/* 2. Top Highlights KPI Metric Cards Strip */}
      <DomainKpiStrip data={detailData} />

      {/* 3. Main Grid: Detailed Workspace Breakdown (2/3 + 1/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-unit-lg mb-unit-lg items-start">
        {/* Left Column (Span 2): Operational Details */}
        <div className="xl:col-span-2 flex flex-col gap-unit-lg">
          {/* Section 1: Domain Relationship Map */}
          <DomainRelationshipMap nodes={detailData.relationshipNodes} />

          {/* Section 2: Registration & Registrar Details */}
          <RegistrationDetails data={detailData} />

          {/* Section 3: DNS & Nameserver Infrastructure */}
          <DnsRecordsSection
            data={detailData}
            onOpenZoneFile={() => setIsZoneFileModalOpen(true)}
          />
        </div>

        {/* Right Column (Span 1): Hosting, TLS, and Telemetry Sidecars */}
        <div className="flex flex-col gap-unit-lg">
          {/* Section 4: Hosting & Server Allocation */}
          <HostingMappingSection data={detailData} />

          {/* Section 5: SSL / TLS Certificate */}
          <SslCertificateSection data={detailData} />

          {/* Section 6: Data Provenance Engine */}
          <ProvenanceSection />
        </div>
      </div>

      {/* Interactive Modal Overlays */}
      <EditMetadataModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        data={detailData}
        onSave={handleSaveMetadata}
      />

      <TransferChecklistModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        data={detailData}
      />

      <ZoneFileModal
        isOpen={isZoneFileModalOpen}
        onClose={() => setIsZoneFileModalOpen(false)}
        domain={detailData.domain}
        zoneFileContent={detailData.zoneFileContent}
      />
    </div>
  );
};
