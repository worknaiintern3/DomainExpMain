import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getWebsiteDetail } from '@/features/website-details/websiteDetails.reference';
import { WebsiteDetailData } from '@/features/website-details/websiteDetails.types';
import { WebsiteDetailHeader } from '@/features/website-details/components/WebsiteDetailHeader';
import { WebsiteRibbonStrip } from '@/features/website-details/components/WebsiteRibbonStrip';
import { WebsiteRelationshipMap } from '@/features/website-details/components/WebsiteRelationshipMap';
import { DomainRoutingSection } from '@/features/website-details/components/DomainRoutingSection';
import { HostingSection } from '@/features/website-details/components/HostingSection';
import { SslCertificateSection } from '@/features/website-details/components/SslCertificateSection';
import { DeploymentNotesSection } from '@/features/website-details/components/DeploymentNotesSection';
import { EnvironmentConfigSection } from '@/features/website-details/components/EnvironmentConfigSection';
import { WebsiteMonitoringBanner } from '@/features/website-details/components/WebsiteMonitoringBanner';
import { WebsiteEditModal } from '@/features/website-details/components/WebsiteEditModal';
import { WebsiteSslInspectModal } from '@/features/website-details/components/WebsiteSslInspectModal';

export const WebsiteDetailPage: React.FC = () => {
  const { websiteId } = useParams<{ websiteId: string }>();
  const [detailData, setDetailData] = useState<WebsiteDetailData>(() =>
    getWebsiteDetail(websiteId)
  );

  useEffect(() => {
    setDetailData(getWebsiteDetail(websiteId));
  }, [websiteId]);

  // Modal interaction states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSslModalOpen, setIsSslModalOpen] = useState(false);

  const handleSaveMetadata = (updated: Partial<WebsiteDetailData>) => {
    setDetailData((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  const handleExportRecord = () => {
    const recordJson = JSON.stringify(detailData, null, 2);
    const blob = new Blob([recordJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detailData.id}-inventory-record.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full">
      {/* 1. Context Breadcrumbs & Header Actions Bar */}
      <WebsiteDetailHeader
        data={detailData}
        onOpenEditModal={() => setIsEditModalOpen(true)}
        onExportRecord={handleExportRecord}
      />

      {/* 2. Top Metric Highlights 8-Cell Ribbon Strip */}
      <WebsiteRibbonStrip data={detailData} />

      {/* 3. Full-Width Infrastructure Visual Relationship Chain */}
      <WebsiteRelationshipMap nodes={detailData.relationshipNodes} />

      {/* 4. Main 3-Column Bento Grid Breakdown */}
      <div className="mt-unit-md grid grid-cols-1 lg:grid-cols-3 gap-unit-md items-stretch">
        {/* Card 1: Domain & DNS Routing */}
        <DomainRoutingSection dns={detailData.dns} primaryDomain={detailData.primaryDomain} />

        {/* Card 2: Hosting & Infrastructure */}
        <HostingSection hosting={detailData.hosting} />

        {/* Card 3: SSL & Security Configuration */}
        <SslCertificateSection
          ssl={detailData.ssl}
          onInspectCertificate={() => setIsSslModalOpen(true)}
        />
      </div>

      {/* 5. Bottom Workspace Row: Deployment Notes (2 Cols) & Environment Config (1 Col) */}
      <div className="mt-unit-md grid grid-cols-1 lg:grid-cols-3 gap-unit-md items-stretch">
        <DeploymentNotesSection deployment={detailData.deployment} />
        <EnvironmentConfigSection environmentConfig={detailData.environmentConfig} />
      </div>

      {/* 6. Informational Website Monitoring Disclosure */}
      <WebsiteMonitoringBanner />

      {/* Interactive Modal Overlays */}
      <WebsiteEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        data={detailData}
        onSave={handleSaveMetadata}
      />

      <WebsiteSslInspectModal
        isOpen={isSslModalOpen}
        onClose={() => setIsSslModalOpen(false)}
        ssl={detailData.ssl}
        appName={detailData.name}
      />
    </div>
  );
};
