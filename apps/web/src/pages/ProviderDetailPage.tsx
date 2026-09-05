import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  getProviderAccountDetail,
  ProviderAccountDetail,
  ProviderAccountHeader,
  AccountRelationshipMap,
  ProviderAccountKpiStrip,
  OwnedServersSection,
  LinkedDomainsSection,
  AssociatedProjectsSection,
  MappingCoverageSection,
  AccountBillingSection,
  AccountNotesSection,
  ProviderAccountEditModal,
} from '@/features/provider-account-details';

export const ProviderDetailPage: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const [account, setAccount] = useState<ProviderAccountDetail>(() =>
    getProviderAccountDetail(accountId)
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Update record if route params change
  useEffect(() => {
    setAccount(getProviderAccountDetail(accountId));
  }, [accountId]);

  const handleUpdateAccount = (updatedFields: Partial<ProviderAccountDetail>) => {
    setAccount((prev) => {
      const updated = {
        ...prev,
        ...updatedFields,
        relationshipNodes: prev.relationshipNodes.map((node) => {
          if (
            (node.label === 'Provider Account' || node.label === 'Account Label') &&
            updatedFields.accountName
          ) {
            return { ...node, value: updatedFields.accountName };
          }
          if (node.label === 'Registered Email' && updatedFields.accountEmail) {
            return { ...node, value: updatedFields.accountEmail };
          }
          return node;
        }),
      };
      return updated;
    });
  };

  const handleUpdateNotes = (newNotes: string) => {
    setAccount((prev) => ({
      ...prev,
      notes: newNotes,
    }));
  };

  const handleExportSheet = () => {
    const exportData = {
      internalRecordId: account.accountId,
      accountName: account.accountName,
      providerCompany: account.providerCompany,
      accountEmail: account.accountEmail,
      accountType: account.accountType,
      accountScope: account.accountScope,
      status: account.mappingStatusLabel,
      kpis: account.kpis,
      ownedServers: account.ownedServers,
      linkedDomains: account.linkedDomains,
      associatedProjects: account.associatedProjects,
      billing: account.billing,
      notes: account.notes,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${account.accountName.toLowerCase().replace(/\s+/g, '-')}-record.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-unit-md w-full pb-unit-2xl">
      {/* Header with breadcrumbs & primary action buttons */}
      <ProviderAccountHeader
        account={account}
        onEditClick={() => setIsEditModalOpen(true)}
        onExportClick={handleExportSheet}
      />

      {/* Visual Relationship Map: Email -> Provider -> Provider Account -> Servers -> Apps -> Domains */}
      <AccountRelationshipMap nodes={account.relationshipNodes} />

      {/* 6-Card KPI Strip */}
      <ProviderAccountKpiStrip kpis={account.kpis} />

      {/* Main 12-Column Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-md items-start">
        {/* Left 8-Column Area: Servers, Domains, Projects, Coverage */}
        <div className="xl:col-span-8 flex flex-col gap-unit-md">
          <OwnedServersSection servers={account.ownedServers} />
          <LinkedDomainsSection domains={account.linkedDomains} />
          <AssociatedProjectsSection projects={account.associatedProjects} />
          <MappingCoverageSection coverageText={account.coverageText} />
        </div>

        {/* Right 4-Column Area: Billing, Invoices & Notes */}
        <div className="xl:col-span-4 flex flex-col gap-unit-md">
          <AccountBillingSection billing={account.billing} />
          <AccountNotesSection
            account={account}
            onUpdateNotes={handleUpdateNotes}
          />
        </div>
      </div>

      {/* Edit Metadata Modal */}
      <ProviderAccountEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        account={account}
        onSave={handleUpdateAccount}
      />
    </div>
  );
};

export default ProviderDetailPage;
