import React, { useState, useMemo } from 'react';
import {
  EMAIL_GROUPS_REFERENCE_DATA,
  UNMAPPED_ASSETS_REFERENCE_DATA,
} from '@/features/accounts/accounts.reference';
import {
  EmailGroup,
  ProviderAccount,
  UnmappedAsset,
  AccountsFilterState,
} from '@/features/accounts/accounts.types';
import { AccountsHeader } from '@/features/accounts/components/AccountsHeader';
import { AccountsSummaryStrip } from '@/features/accounts/components/AccountsSummaryStrip';
import { AccountsToolbar } from '@/features/accounts/components/AccountsToolbar';
import { EmailGroupCard } from '@/features/accounts/components/EmailGroupCard';
import { AccountsFlatTable } from '@/features/accounts/components/AccountsFlatTable';
import { UnmappedAssetsSection } from '@/features/accounts/components/UnmappedAssetsSection';
import { AccountsTopologyBanner } from '@/features/accounts/components/AccountsTopologyBanner';
import { AccountInspectorDrawer } from '@/features/accounts/components/AccountInspectorDrawer';
import { AccountAddModal } from '@/features/accounts/components/AccountAddModal';
import { AccountsEmptyState } from '@/features/accounts/components/AccountsEmptyState';

export const AccountsPage: React.FC = () => {
  const [emailGroups, setEmailGroups] = useState<EmailGroup[]>(EMAIL_GROUPS_REFERENCE_DATA);
  const [unmappedAssets, setUnmappedAssets] = useState<UnmappedAsset[]>(UNMAPPED_ASSETS_REFERENCE_DATA);

  // Filters and view switch
  const [filterState, setFilterState] = useState<AccountsFilterState>({
    searchQuery: '',
    provider: 'all',
    assetType: 'all',
    project: 'all',
    viewMode: 'grouped',
  });

  // Modal & Drawer states
  const [inspectedAccount, setInspectedAccount] = useState<ProviderAccount | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<ProviderAccount | null>(null);
  const [defaultEmail, setDefaultEmail] = useState<string | undefined>();
  const [defaultProvider, setDefaultProvider] = useState<string | undefined>();

  const handleFilterChange = (key: keyof AccountsFilterState, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilterState({
      searchQuery: '',
      provider: 'all',
      assetType: 'all',
      project: 'all',
      viewMode: 'grouped',
    });
  };

  // Filtered dataset
  const filteredGroups = useMemo(() => {
    const q = filterState.searchQuery.toLowerCase().trim();

    return emailGroups
      .map((grp) => {
        const matchesEmail = !q || grp.email.toLowerCase().includes(q) || grp.subtitle.toLowerCase().includes(q);

        const filteredAccounts = grp.providerAccounts.filter((acc) => {
          // Query matching
          const matchesQuery =
            matchesEmail ||
            !q ||
            acc.providerCompany.toLowerCase().includes(q) ||
            acc.accountName.toLowerCase().includes(q) ||
            acc.accountId.toLowerCase().includes(q) ||
            acc.sampleAssets.some((s) => s.toLowerCase().includes(q));

          // Provider dropdown
          const matchesProvider =
            filterState.provider === 'all' ||
            acc.providerCompany.toLowerCase() === filterState.provider.toLowerCase();

          // Asset Type dropdown
          const matchesAssetType =
            filterState.assetType === 'all' ||
            (filterState.assetType === 'domains' && acc.domainsCount > 0) ||
            (filterState.assetType === 'servers' && (acc.serversCount > 0 || (acc.workersCount || 0) > 0)) ||
            (filterState.assetType === 'websites' && acc.websitesCount > 0);

          // Project dropdown
          const matchesProject =
            filterState.project === 'all' ||
            (acc.project && acc.project.toLowerCase() === filterState.project.toLowerCase());

          return matchesQuery && matchesProvider && matchesAssetType && matchesProject;
        });

        return {
          ...grp,
          providerAccounts: filteredAccounts,
        };
      })
      .filter((grp) => grp.providerAccounts.length > 0);
  }, [emailGroups, filterState]);

  const allFilteredAccounts = useMemo(() => {
    return filteredGroups.flatMap((g) => g.providerAccounts);
  }, [filteredGroups]);

  // Actions
  const handleExportCsv = () => {
    const rows = [
      ['Provider Company', 'Account Name', 'Account ID', 'Associated Email', 'Domains', 'Servers', 'Websites', 'Mapping Status', 'Estimated Cost'],
      ...allFilteredAccounts.map((a) => [
        a.providerCompany,
        a.accountName,
        a.accountId,
        a.accountEmail,
        String(a.domainsCount),
        String(a.serversCount),
        String(a.websitesCount),
        a.mappingStatusLabel,
        a.estimatedCostMonthly || 'N/A',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'domainpulse_accounts_inventory.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAddModal = (email?: string, provider?: string) => {
    setEditAccount(null);
    setDefaultEmail(email);
    setDefaultProvider(provider);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (account: ProviderAccount) => {
    setEditAccount(account);
    setIsAddModalOpen(true);
  };

  const handleSaveAccount = (data: Partial<ProviderAccount>) => {
    if (editAccount) {
      // Edit existing
      setEmailGroups((prev) =>
        prev.map((grp) => ({
          ...grp,
          providerAccounts: grp.providerAccounts.map((acc) =>
            acc.id === editAccount.id ? { ...acc, ...data } : acc
          ),
        }))
      );
    } else {
      // Add new
      const targetEmail = data.accountEmail || 'domains@worknai.com';
      const newAcc: ProviderAccount = {
        id: `acc-${Date.now()}`,
        providerCompany: data.providerCompany || 'Custom Provider',
        accountName: data.accountName || 'New Linked Account',
        accountId: data.accountId || `ID-${Math.floor(1000 + Math.random() * 9000)}`,
        accountEmail: targetEmail,
        logoLetter: data.logoLetter || 'CP',
        logoBgColor: 'bg-primary-fixed',
        logoTextColor: 'text-primary',
        mappingStatus: 'mapped',
        mappingStatusLabel: 'User Mapped',
        domainsCount: 1,
        serversCount: 0,
        websitesCount: 0,
        sampleAssets: ['Mapped Asset (New)'],
        project: data.project || 'WorknAi',
        notes: data.notes,
      };

      setEmailGroups((prev) => {
        const existingGroup = prev.find((g) => g.email.toLowerCase() === targetEmail.toLowerCase());
        if (existingGroup) {
          return prev.map((g) =>
            g.id === existingGroup.id
              ? {
                  ...g,
                  providerCount: g.providerCount + 1,
                  linkedAssetsCount: g.linkedAssetsCount + 1,
                  providerAccounts: [newAcc, ...g.providerAccounts],
                }
              : g
          );
        } else {
          const newGroup: EmailGroup = {
            id: `grp-${Date.now()}`,
            email: targetEmail,
            icon: '@',
            iconBgColor: 'bg-primary-fixed',
            iconTextColor: 'text-primary',
            subtitle: 'User mapped provider email group',
            providerCount: 1,
            linkedAssetsCount: 1,
            badgeText: '1 Provider Account • 1 Linked Asset',
            providerAccounts: [newAcc],
          };
          return [newGroup, ...prev];
        }
      });
    }
  };

  const handleUnmappedAssetAction = (asset: UnmappedAsset) => {
    handleOpenAddModal('infra@worknai.com', asset.currentProvider);
    setUnmappedAssets((prev) => prev.filter((a) => a.id !== asset.id));
  };

  // Computed summary metrics
  const computedSummary = useMemo(() => {
    const allAccounts = emailGroups.flatMap((g) => g.providerAccounts);
    const totalDomains = allAccounts.reduce((sum, a) => sum + a.domainsCount, 0);
    const totalServers = allAccounts.reduce((sum, a) => sum + a.serversCount, 0);

    return {
      managedEmailsCount: emailGroups.length,
      managedEmailsSubtext: `${emailGroups.length} Primary Groups`,
      providerAccountsCount: allAccounts.length,
      providerAccountsSubtext: 'Across 6 Core Vendors',
      domainsLinkedCount: totalDomains,
      domainsLinkedSubtext: `${totalDomains} Provider Records`,
      serversLinkedCount: totalServers,
      serversLinkedSubtext: '4 Cloud Hosts',
      unmappedAssetsCount: unmappedAssets.length,
      unmappedAssetsSubtext: 'Action Needed',
    };
  }, [emailGroups, unmappedAssets]);

  return (
    <div className="flex flex-col gap-unit-lg w-full">
      {/* 1. Header Section */}
      <AccountsHeader
        onExportCsv={handleExportCsv}
        onOpenLinkAccountModal={() => handleOpenAddModal()}
        onOpenAddEmailModal={() => handleOpenAddModal('admin@worknai.com')}
      />

      {/* 2. Summary Metric Strip */}
      <AccountsSummaryStrip summary={computedSummary} />

      {/* 3. Search and Control Toolbar */}
      <AccountsToolbar
        filterState={filterState}
        onFilterChange={handleFilterChange}
        providerCount={allFilteredAccounts.length}
        emailGroupCount={filteredGroups.length}
      />

      {/* 4. Accounts Feed: Grouped Feed or Flat Table */}
      {filteredGroups.length === 0 ? (
        <AccountsEmptyState onReset={handleResetFilters} />
      ) : filterState.viewMode === 'grouped' ? (
        <div className="flex flex-col gap-unit-md">
          {filteredGroups.map((group) => (
            <EmailGroupCard
              key={group.id}
              group={group}
              onInspectAccount={(acc) => setInspectedAccount(acc)}
              onManageGroup={(grp) => handleOpenAddModal(grp.email)}
            />
          ))}
        </div>
      ) : (
        <AccountsFlatTable
          accounts={allFilteredAccounts}
          onInspect={(acc) => setInspectedAccount(acc)}
        />
      )}

      {/* 5. Unmapped Assets Section */}
      {unmappedAssets.length > 0 && (
        <UnmappedAssetsSection
          unmappedAssets={unmappedAssets}
          onActionClick={handleUnmappedAssetAction}
        />
      )}

      {/* 6. Topology Quick-Nav Banner */}
      <AccountsTopologyBanner />

      {/* 7. Inspector Drawer */}
      <AccountInspectorDrawer
        account={inspectedAccount}
        onClose={() => setInspectedAccount(null)}
        onEdit={(acc) => {
          setInspectedAccount(null);
          handleOpenEditModal(acc);
        }}
      />

      {/* 8. Add/Edit Account Modal */}
      <AccountAddModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditAccount(null);
        }}
        onSubmit={handleSaveAccount}
        editAccount={editAccount}
        defaultEmail={defaultEmail}
        defaultProvider={defaultProvider}
      />
    </div>
  );
};
