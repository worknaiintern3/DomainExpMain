import React, { useState, useMemo } from 'react';
import { DOMAINS_REFERENCE_DATA } from '@/features/domains/domains.reference';
import { DomainRecord, DomainFilterState } from '@/features/domains/domains.types';
import { DomainHeader } from '@/features/domains/components/DomainHeader';
import { DomainSummaryStrip } from '@/features/domains/components/DomainSummaryStrip';
import { DomainBulkActionBar } from '@/features/domains/components/DomainBulkActionBar';
import { DomainFilterToolbar } from '@/features/domains/components/DomainFilterToolbar';
import { DomainTable } from '@/features/domains/components/DomainTable';
import { DomainInspectorDrawer } from '@/features/domains/components/DomainInspectorDrawer';
import { DomainEmptyState } from '@/features/domains/components/DomainEmptyState';
import { DomainAddModal } from '@/features/domains/components/DomainAddModal';

export const DomainsPage: React.FC = () => {
  const initialData = DOMAINS_REFERENCE_DATA;
  const [domainList, setDomainList] = useState<DomainRecord[]>(initialData.domains);
  const [viewMode, setViewMode] = useState<'live' | 'empty'>('live');

  // Multi-selection state (preset 3 selected to match locked Stitch reference)
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({
    'worknai-com': true,
    'worknai-in': true,
    'anywork-ai': true,
  });

  // Inspected domain for right drawer (defaults to worknai.com per Stitch reference)
  const [inspectedDomainId, setInspectedDomainId] = useState<string | null>('worknai-com');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<DomainRecord | null>(null);

  // Filter state
  const [filterState, setFilterState] = useState<DomainFilterState>({
    searchQuery: '',
    status: 'All Statuses (42)',
    registrar: 'All Registrars',
    tld: 'All Extensions',
    autoRenew: 'Auto-Renew: All',
    tag: 'All Tags',
    sortBy: 'Expiry Soonest',
  });

  const handleFilterChange = (key: keyof DomainFilterState, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilterState({
      searchQuery: '',
      status: 'All Statuses (42)',
      registrar: 'All Registrars',
      tld: 'All Extensions',
      autoRenew: 'Auto-Renew: All',
      tag: 'All Tags',
      sortBy: 'Expiry Soonest',
    });
  };

  // Filtered and sorted domain records
  const filteredDomains = useMemo(() => {
    let result = [...domainList];

    // Search query
    if (filterState.searchQuery.trim() !== '') {
      const q = filterState.searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.domain.toLowerCase().includes(q) ||
          d.registrar.toLowerCase().includes(q) ||
          d.projectTag.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterState.status !== 'All Statuses (42)') {
      if (filterState.status.startsWith('Critical')) {
        result = result.filter((d) => d.status === 'critical');
      } else if (filterState.status.startsWith('Warning')) {
        result = result.filter((d) => d.status === 'warning');
      } else if (filterState.status.startsWith('Healthy')) {
        result = result.filter((d) => d.status === 'healthy');
      }
    }

    // Registrar filter
    if (filterState.registrar !== 'All Registrars') {
      const regName = filterState.registrar.split(' ')[0];
      result = result.filter((d) =>
        d.registrar.toLowerCase().includes(regName.toLowerCase())
      );
    }

    // TLD filter
    if (filterState.tld !== 'All Extensions') {
      const ext = filterState.tld.split(' ')[0].toLowerCase();
      result = result.filter((d) => d.domain.toLowerCase().endsWith(ext));
    }

    // Auto-Renew filter
    if (filterState.autoRenew === 'Enabled (31)') {
      result = result.filter((d) => d.autoRenew);
    } else if (filterState.autoRenew === 'Disabled (11)') {
      result = result.filter((d) => !d.autoRenew);
    }

    // Tag filter
    if (filterState.tag !== 'All Tags') {
      result = result.filter(
        (d) => d.projectTag.toLowerCase() === filterState.tag.toLowerCase()
      );
    }

    // Sorting
    if (filterState.sortBy === 'Expiry Soonest') {
      result.sort((a, b) => a.daysRemaining - b.daysRemaining);
    } else if (filterState.sortBy === 'Expiry Latest') {
      result.sort((a, b) => b.daysRemaining - a.daysRemaining);
    } else if (filterState.sortBy === 'Renewal Cost (High to Low)') {
      result.sort((a, b) => b.renewalCost - a.renewalCost);
    } else if (filterState.sortBy === 'Renewal Cost (Low to High)') {
      result.sort((a, b) => a.renewalCost - b.renewalCost);
    } else if (filterState.sortBy === 'Domain Name (A-Z)') {
      result.sort((a, b) => a.domain.localeCompare(b.domain));
    }

    return result;
  }, [domainList, filterState]);

  // Selected domains info
  const selectedDomainNames = useMemo(() => {
    return domainList
      .filter((d) => !!selectedRows[d.id])
      .map((d) => d.domain);
  }, [domainList, selectedRows]);

  const currentlyInspectedDomain = useMemo(() => {
    if (!inspectedDomainId) return null;
    return domainList.find((d) => d.id === inspectedDomainId) || null;
  }, [domainList, inspectedDomainId]);

  const handleToggleSelectRow = (id: string) => {
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      filteredDomains.forEach((d) => {
        updated[d.id] = true;
      });
    }
    setSelectedRows(updated);
  };

  const handleClearSelection = () => {
    setSelectedRows({});
  };

  const handleSelectInspect = (domain: DomainRecord) => {
    setInspectedDomainId(domain.id);
  };

  const handleOpenAddModal = () => {
    setEditingDomain(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (domain: DomainRecord) => {
    setEditingDomain(domain);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (data: Partial<DomainRecord>) => {
    if (editingDomain) {
      setDomainList((prev) =>
        prev.map((d) => (d.id === editingDomain.id ? { ...d, ...data } : d))
      );
    } else {
      const newDomain: DomainRecord = {
        id: `domain-${Date.now()}`,
        domain: data.domain || 'example.com',
        tldBadge: `.${(data.domain || 'com').split('.').pop()?.toUpperCase()}`,
        sslStatusText: 'SSL OK',
        dnsProviderText: 'Custom DNS',
        registrar: data.registrar || 'GoDaddy',
        registrarDotColor: 'bg-emerald-500',
        expiryDateFormatted: '18 Dec 2027',
        daysRemaining: 365,
        renewalCost: data.renewalCost || 1299,
        renewalCostFormatted: data.renewalCostFormatted || '₹1,299',
        autoRenew: data.autoRenew ?? true,
        status: 'healthy',
        projectTag: data.projectTag || 'General',
        nameservers: ['ns1.custom.com', 'ns2.custom.com'],
        sslProvider: 'Let’s Encrypt',
        whoisPrivacy: true,
        notes: data.notes,
      };
      setDomainList((prev) => [newDomain, ...prev]);
      setInspectedDomainId(newDomain.id);
    }
  };

  return (
    <div className="flex flex-col w-full gap-unit-md">
      {/* 1. Top Action & Title Header */}
      <DomainHeader
        totalActiveCount={initialData.summary.totalCount}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenAddModal={handleOpenAddModal}
      />

      {/* 2. Empty State Toggle View */}
      {viewMode === 'empty' ? (
        <DomainEmptyState onOpenAddModal={handleOpenAddModal} />
      ) : (
        <div className="flex flex-col gap-unit-md">
          {/* 3. Compact Portfolio Summary Strip */}
          <DomainSummaryStrip summary={initialData.summary} />

          {/* 4. Contextual Bulk Action Bar (Active when rows are selected) */}
          <DomainBulkActionBar
            selectedCount={selectedDomainNames.length}
            selectedDomainNames={selectedDomainNames}
            onClearSelection={handleClearSelection}
          />

          {/* 5. Search & Advanced Filters Toolbar */}
          <DomainFilterToolbar
            filterState={filterState}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            filterOptions={initialData.filterOptions}
            filteredCount={filteredDomains.length}
            totalCount={initialData.summary.totalCount}
          />

          {/* 6. Main Data Table & Details Drawer Split View */}
          <div className="relative flex flex-col lg:flex-row gap-unit-md items-start">
            <DomainTable
              domains={filteredDomains}
              totalCount={initialData.summary.totalCount}
              selectedRows={selectedRows}
              inspectedDomainId={inspectedDomainId}
              onToggleSelectRow={handleToggleSelectRow}
              onToggleSelectAll={handleToggleSelectAll}
              onSelectInspect={handleSelectInspect}
              onOpenEditModal={handleOpenEditModal}
            />

            {/* 7. Persistent Right-Side Domain Details Drawer */}
            {currentlyInspectedDomain && (
              <DomainInspectorDrawer
                domain={currentlyInspectedDomain}
                onClose={() => setInspectedDomainId(null)}
                onOpenEditModal={handleOpenEditModal}
              />
            )}
          </div>
        </div>
      )}

      {/* 8. Add / Edit Domain Modal Overlay */}
      <DomainAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editDomain={editingDomain}
      />
    </div>
  );
};
