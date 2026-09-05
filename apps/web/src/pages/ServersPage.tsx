import React, { useState, useMemo } from 'react';
import { SERVERS_REFERENCE_DATA } from '@/features/servers/servers.reference';
import { ServerRecord, ServerFilterState } from '@/features/servers/servers.types';
import { ServerHeader } from '@/features/servers/components/ServerHeader';
import { ServerSummaryStrip } from '@/features/servers/components/ServerSummaryStrip';
import { ServerFilterToolbar } from '@/features/servers/components/ServerFilterToolbar';
import { ServerTable } from '@/features/servers/components/ServerTable';
import { ServerInspectorDrawer } from '@/features/servers/components/ServerInspectorDrawer';
import { ServerAddModal } from '@/features/servers/components/ServerAddModal';
import { ServerEmptyState } from '@/features/servers/components/ServerEmptyState';

export const ServersPage: React.FC = () => {
  const initialData = SERVERS_REFERENCE_DATA;
  const [serverList, setServerList] = useState<ServerRecord[]>(initialData.servers);
  const [viewMode, setViewMode] = useState<'fleet' | 'empty'>('fleet');

  // Multi-selection state (defaults to prod-01 per Stitch locked reference)
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({
    'prod-01': true,
  });

  // Inspected server for right drawer (defaults to prod-01 per Stitch reference)
  const [inspectedServerId, setInspectedServerId] = useState<string | null>('prod-01');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerRecord | null>(null);

  // Filter state
  const [filterState, setFilterState] = useState<ServerFilterState>({
    searchQuery: '',
    status: 'All',
    provider: 'Provider: All',
    region: 'Region: Global',
    accountEmail: 'All Accounts',
    os: 'All OS',
    sortBy: 'Renewal Soonest',
  });

  const handleFilterChange = (key: keyof ServerFilterState, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilterState({
      searchQuery: '',
      status: 'All',
      provider: 'Provider: All',
      region: 'Region: Global',
      accountEmail: 'All Accounts',
      os: 'All OS',
      sortBy: 'Renewal Soonest',
    });
  };

  // Filtered and sorted server records
  const filteredServers = useMemo(() => {
    let result = [...serverList];

    // Search query
    if (filterState.searchQuery.trim() !== '') {
      const q = filterState.searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.hostname.toLowerCase().includes(q) ||
          s.provider.toLowerCase().includes(q) ||
          s.accountEmail.toLowerCase().includes(q) ||
          s.ipAddress.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.connectedWebsites.some((w) => w.domain.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filterState.status === 'Active') {
      result = result.filter((s) => s.status === 'active');
    } else if (filterState.status === 'Attention') {
      result = result.filter((s) => s.status === 'attention');
    }

    // Provider filter
    if (filterState.provider !== 'Provider: All') {
      result = result.filter(
        (s) => s.provider.toLowerCase() === filterState.provider.toLowerCase()
      );
    }

    // Region filter
    if (filterState.region !== 'Region: Global') {
      result = result.filter(
        (s) => s.region.toLowerCase() === filterState.region.toLowerCase()
      );
    }

    // Account Email filter
    if (filterState.accountEmail !== 'All Accounts') {
      result = result.filter(
        (s) => s.accountEmail.toLowerCase() === filterState.accountEmail.toLowerCase()
      );
    }

    // OS filter
    if (filterState.os !== 'All OS') {
      result = result.filter(
        (s) => s.osPlatform.toLowerCase() === filterState.os.toLowerCase()
      );
    }

    // Sorting
    if (filterState.sortBy === 'Renewal Soonest') {
      result.sort((a, b) => (a.renewalDaysRemaining ?? 999) - (b.renewalDaysRemaining ?? 999));
    } else if (filterState.sortBy === 'Monthly Cost (High to Low)') {
      result.sort((a, b) => b.monthlyCost - a.monthlyCost);
    } else if (filterState.sortBy === 'Server Name (A-Z)') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (filterState.sortBy === 'Websites Count') {
      result.sort((a, b) => b.hostedWebsitesCount - a.hostedWebsitesCount);
    }

    return result;
  }, [serverList, filterState]);

  const currentlyInspectedServer = useMemo(() => {
    if (!inspectedServerId) return null;
    return serverList.find((s) => s.id === inspectedServerId) || null;
  }, [serverList, inspectedServerId]);

  const handleToggleSelectRow = (id: string) => {
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      filteredServers.forEach((s) => {
        updated[s.id] = true;
      });
    }
    setSelectedRows(updated);
  };

  const handleSelectInspect = (server: ServerRecord) => {
    setInspectedServerId(server.id);
  };

  const handleOpenAddModal = () => {
    setEditingServer(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (server: ServerRecord) => {
    setEditingServer(server);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (data: Partial<ServerRecord>) => {
    if (editingServer) {
      setServerList((prev) =>
        prev.map((s) => (s.id === editingServer.id ? { ...s, ...data } : s))
      );
    } else {
      const newServer: ServerRecord = {
        id: `server-${Date.now()}`,
        name: data.name || 'New VPS Node',
        hostname: data.hostname || 'vps-custom-01',
        provider: data.provider || 'Hostinger',
        providerColor: {
          bg: 'bg-[#673de6]/10',
          text: 'text-[#4c1d95]',
          dot: 'bg-[#673de6]',
        },
        accountName: data.accountName || 'WorknAi Primary Cloud',
        accountEmail: data.accountEmail || 'infra@worknai.com',
        ipAddress: data.ipAddress || '103.21.58.112',
        region: data.region || 'Singapore',
        regionCode: 'SGP-1',
        osPlatform: 'Ubuntu 24.04 LTS',
        computeSpecs: data.computeSpecs || '4 vCPU / 8 GB / 160 GB',
        vcpuCount: data.vcpuCount || 4,
        ramGb: data.ramGb || 8,
        storageGb: data.storageGb || 160,
        storageType: 'NVMe SSD',
        storageProgressPercentage: 20,
        hostedWebsitesCount: 0,
        monthlyCost: data.monthlyCost || 1499,
        monthlyCostFormatted: data.monthlyCostFormatted || '₹1,499',
        annualizedRunRateFormatted: data.annualizedRunRateFormatted || '₹17,988/yr',
        renewalDateFormatted: '18 Oct 2027',
        autoRenew: data.autoRenew ?? true,
        status: 'active',
        statusLabel: 'Inventory: Active',
        connectedWebsites: [],
        notes: data.notes,
      };
      setServerList((prev) => [newServer, ...prev]);
      setInspectedServerId(newServer.id);
    }
  };

  const handleExportFleet = () => {
    const fleetJson = JSON.stringify(serverList, null, 2);
    const blob = new Blob([fleetJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domainpulse-servers-fleet-inventory.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full gap-unit-md">
      {/* 1. Top Heading & Actions */}
      <ServerHeader
        totalCount={initialData.summary.totalServers}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenAddModal={handleOpenAddModal}
        onExport={handleExportFleet}
      />

      {/* 2. Empty State View Toggle */}
      {viewMode === 'empty' ? (
        <ServerEmptyState onOpenAddModal={handleOpenAddModal} />
      ) : (
        <div className="flex flex-col gap-unit-md">
          {/* 3. Summary Metric Strip (6 Bento Tiles) */}
          <ServerSummaryStrip summary={initialData.summary} />

          {/* 4. Main Workpane: Table + Persistent Slide-out Inspection Drawer */}
          <div className="flex flex-col xl:flex-row items-start gap-unit-lg w-full">
            {/* Server Inventory Column */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-unit-md">
              {/* Filter Toolbar */}
              <ServerFilterToolbar
                filterState={filterState}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
                filterOptions={initialData.filterOptions}
                filteredCount={filteredServers.length}
                totalCount={initialData.summary.totalServers}
              />

              {/* Technical Data Table */}
              <ServerTable
                servers={filteredServers}
                totalCount={initialData.summary.totalServers}
                selectedRows={selectedRows}
                inspectedServerId={inspectedServerId}
                onToggleSelectRow={handleToggleSelectRow}
                onToggleSelectAll={handleToggleSelectAll}
                onSelectInspect={handleSelectInspect}
                onOpenEditModal={handleOpenEditModal}
              />
            </div>

            {/* 5. Persistent Master-Detail Slide-Out Inspection Drawer */}
            {currentlyInspectedServer && (
              <ServerInspectorDrawer
                server={currentlyInspectedServer}
                onClose={() => setInspectedServerId(null)}
                onOpenEditModal={handleOpenEditModal}
              />
            )}
          </div>
        </div>
      )}

      {/* 6. Add / Edit Server Modal Overlay */}
      <ServerAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editServer={editingServer}
      />
    </div>
  );
};
