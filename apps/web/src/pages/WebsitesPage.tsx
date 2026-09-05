import React, { useState, useMemo } from 'react';
import { WEBSITES_REFERENCE_DATA } from '@/features/websites/websites.reference';
import { WebsiteRecord, WebsiteFilterState } from '@/features/websites/websites.types';
import { WebsiteHeader } from '@/features/websites/components/WebsiteHeader';
import { WebsiteSummaryStrip } from '@/features/websites/components/WebsiteSummaryStrip';
import { WebsiteFilterToolbar } from '@/features/websites/components/WebsiteFilterToolbar';
import { WebsiteTable } from '@/features/websites/components/WebsiteTable';
import { WebsiteInspectorDrawer } from '@/features/websites/components/WebsiteInspectorDrawer';
import { WebsiteAddModal } from '@/features/websites/components/WebsiteAddModal';
import { WebsiteEmptyState } from '@/features/websites/components/WebsiteEmptyState';

export const WebsitesPage: React.FC = () => {
  const initialData = WEBSITES_REFERENCE_DATA;
  const [websiteList, setWebsiteList] = useState<WebsiteRecord[]>(initialData.websites);
  const [viewMode, setViewMode] = useState<'inventory' | 'empty'>('inventory');

  // Multi-selection state
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  // Inspected website for right slide-out drawer (default null until row click)
  const [inspectedWebsiteId, setInspectedWebsiteId] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<WebsiteRecord | null>(null);

  // Filter state
  const [filterState, setFilterState] = useState<WebsiteFilterState>({
    searchQuery: '',
    environment: 'all',
    server: 'all',
    techStack: 'all',
    sslStatus: 'all',
    project: 'all',
    activeChip: null,
  });

  const handleFilterChange = (key: keyof WebsiteFilterState, value: string) => {
    setFilterState((prev) => ({
      ...prev,
      [key]: value,
      activeChip: null, // Clear chip preset when manual filter is selected
    }));
  };

  const handleSelectChipPreset = (chip: 'prod' | 'attention' | 'nextjs') => {
    setFilterState((prev) => {
      if (chip === 'prod') {
        return {
          ...prev,
          environment: 'production',
          activeChip: 'prod',
        };
      }
      if (chip === 'attention') {
        return {
          ...prev,
          sslStatus: 'warning',
          activeChip: 'attention',
        };
      }
      if (chip === 'nextjs') {
        return {
          ...prev,
          techStack: 'next',
          activeChip: 'nextjs',
        };
      }
      return prev;
    });
  };

  const handleResetFilters = () => {
    setFilterState({
      searchQuery: '',
      environment: 'all',
      server: 'all',
      techStack: 'all',
      sslStatus: 'all',
      project: 'all',
      activeChip: null,
    });
  };

  // Filtered dataset
  const filteredWebsites = useMemo(() => {
    let result = [...websiteList];

    // Search query
    if (filterState.searchQuery.trim() !== '') {
      const q = filterState.searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.domain.toLowerCase().includes(q) ||
          w.serverName.toLowerCase().includes(q) ||
          w.serverProvider.toLowerCase().includes(q) ||
          w.project.toLowerCase().includes(q) ||
          w.techStack.toLowerCase().includes(q) ||
          w.serverAccountEmail.toLowerCase().includes(q)
      );
    }

    // Environment filter
    if (filterState.environment !== 'all') {
      result = result.filter(
        (w) => w.environment.toLowerCase() === filterState.environment.toLowerCase()
      );
    }

    // Server filter
    if (filterState.server !== 'all') {
      result = result.filter((w) => {
        if (filterState.server === 'hostinger') return w.serverProvider === 'Hostinger';
        if (filterState.server === 'digitalocean') return w.serverProvider === 'DigitalOcean';
        if (filterState.server === 'vultr') return w.serverProvider === 'Vultr';
        if (filterState.server === 'hetzner') return w.serverProvider === 'Hetzner';
        if (filterState.server === 'staging-node') return w.serverId === 'staging';
        if (filterState.server === 'analytics') return w.serverId === 'analytics';
        return true;
      });
    }

    // Tech Stack filter
    if (filterState.techStack !== 'all') {
      result = result.filter((w) => {
        if (filterState.techStack === 'next') return w.techStack.toLowerCase().includes('next');
        if (filterState.techStack === 'node') return w.techStack.toLowerCase().includes('node');
        if (filterState.techStack === 'react') return w.techStack.toLowerCase().includes('react');
        if (filterState.techStack === 'python') return w.techStack.toLowerCase().includes('python');
        if (filterState.techStack === 'wordpress') return w.techStack.toLowerCase().includes('wordpress');
        return true;
      });
    }

    // SSL Status filter
    if (filterState.sslStatus !== 'all') {
      result = result.filter((w) => w.sslStatus === filterState.sslStatus);
    }

    // Project filter
    if (filterState.project !== 'all') {
      result = result.filter((w) => {
        if (filterState.project === 'worknai') return w.project === 'WorknAi';
        if (filterState.project === 'aibos') return w.project === 'AI BOS';
        if (filterState.project === 'anywork') return w.project === 'AnyWork';
        if (filterState.project === 'legacy') return w.project === 'Legacy';
        if (filterState.project === 'worknai-dev') return w.project === 'WorknAi Dev';
        return true;
      });
    }

    return result;
  }, [websiteList, filterState]);

  const currentlyInspectedWebsite = useMemo(() => {
    if (!inspectedWebsiteId) return null;
    return websiteList.find((w) => w.id === inspectedWebsiteId) || null;
  }, [websiteList, inspectedWebsiteId]);

  const handleToggleSelectRow = (id: string) => {
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      filteredWebsites.forEach((w) => {
        updated[w.id] = true;
      });
    }
    setSelectedRows(updated);
  };

  const handleSelectInspect = (website: WebsiteRecord) => {
    setInspectedWebsiteId((prev) => (prev === website.id ? null : website.id));
  };

  const handleOpenAddModal = () => {
    setEditingWebsite(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (website: WebsiteRecord) => {
    setEditingWebsite(website);
    setIsModalOpen(true);
  };

  const handleModalSubmit = (data: Partial<WebsiteRecord>) => {
    if (editingWebsite) {
      setWebsiteList((prev) =>
        prev.map((w) => (w.id === editingWebsite.id ? { ...w, ...data } : w))
      );
    } else {
      const newWebsite: WebsiteRecord = {
        id: `web-${Date.now()}`,
        name: data.name || 'New Application',
        avatarLetter: data.name ? data.name.charAt(0).toUpperCase() : 'W',
        avatarBgColor: 'bg-primary-fixed',
        avatarTextColor: 'text-primary',
        domain: data.domain || 'app.worknai.com',
        routeNote: data.routeNote || 'Custom service route',
        environment: data.environment || 'Production',
        serverName: data.serverName || 'Production VPS 01',
        serverProvider: data.serverProvider || 'Hostinger',
        serverAccountEmail: data.serverAccountEmail || 'infra@worknai.com',
        serverId: data.serverId || 'prod-01',
        project: data.project || 'WorknAi',
        techStack: data.techStack || 'Next.js 14',
        port: data.port || 3000,
        reverseProxy: data.reverseProxy || 'Nginx',
        sslStatus: data.sslStatus || 'healthy',
        sslLabel: data.sslLabel || 'Valid • 68d',
        sslDetails: data.sslDetails || 'Valid (Stored Record)',
        connectedDomainsCount: 1,
        ipAddress: data.ipAddress || '103.21.58.112',
        notes: data.notes,
      };
      setWebsiteList((prev) => [newWebsite, ...prev]);
      setInspectedWebsiteId(newWebsite.id);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Name',
      'Domain',
      'Environment',
      'Server',
      'Provider',
      'Account Email',
      'Project',
      'Tech Stack',
      'Port',
      'SSL Status',
    ];
    const rows = websiteList.map((w) => [
      w.id,
      `"${w.name}"`,
      w.domain,
      w.environment,
      `"${w.serverName}"`,
      w.serverProvider,
      w.serverAccountEmail,
      w.project,
      `"${w.techStack}"`,
      w.port,
      `"${w.sslLabel}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `domainpulse-websites-inventory.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full gap-unit-md">
      {/* 1. Page Header & Actions */}
      <WebsiteHeader
        totalCount={initialData.summary.totalAssets}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        onOpenAddModal={handleOpenAddModal}
        onExportCsv={handleExportCsv}
      />

      {/* 2. Empty State Toggle */}
      {viewMode === 'empty' ? (
        <WebsiteEmptyState onOpenAddModal={handleOpenAddModal} />
      ) : (
        <div className="flex flex-col gap-unit-md">
          {/* 3. Summary Metric Strip (6 Bento Cards) */}
          <WebsiteSummaryStrip summary={initialData.summary} />

          {/* 4. Main Workpane: Table + Persistent Slide-Out Inspector Drawer */}
          <div className="flex flex-col xl:flex-row items-start gap-unit-lg w-full">
            {/* Table Column */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-unit-md">
              <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
                {/* Filter Toolbar */}
                <WebsiteFilterToolbar
                  filterState={filterState}
                  onFilterChange={handleFilterChange}
                  onSelectChipPreset={handleSelectChipPreset}
                  onResetFilters={handleResetFilters}
                  filterOptions={initialData.filterOptions}
                />

                {/* Dense Enterprise Table */}
                <WebsiteTable
                  websites={filteredWebsites}
                  totalCount={initialData.summary.totalAssets}
                  selectedRows={selectedRows}
                  inspectedWebsiteId={inspectedWebsiteId}
                  onToggleSelectRow={handleToggleSelectRow}
                  onToggleSelectAll={handleToggleSelectAll}
                  onSelectInspect={handleSelectInspect}
                  onOpenEditModal={handleOpenEditModal}
                />
              </div>
            </div>

            {/* 5. Persistent Master-Detail Slide-Out Inspector Drawer */}
            {currentlyInspectedWebsite && (
              <WebsiteInspectorDrawer
                website={currentlyInspectedWebsite}
                onClose={() => setInspectedWebsiteId(null)}
                onOpenEditModal={handleOpenEditModal}
              />
            )}
          </div>

          {/* 6. Informational Monitoring Disclaimer Banner */}
          <div className="p-unit-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-unit-md shadow-sm border border-outline-variant/20">
            <div className="flex items-start sm:items-center gap-unit-sm min-w-0">
              <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0 border border-outline-variant/20">
                <span className="material-symbols-outlined text-[18px]">info</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-unit-xs">
                  <span className="font-label-md text-label-md text-on-surface font-semibold">
                    Website Monitoring
                  </span>
                  <span className="text-outline-variant font-caption-xs text-caption-xs">•</span>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container text-secondary font-label-mono text-[10px] uppercase font-medium border border-outline-variant/20">
                    Not Connected
                  </span>
                </div>
                <p className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                  DomainPulse currently tracks website/application inventory, domain mappings, server relationships and stored SSL information. Live uptime, response-time and application health monitoring requires a connected monitoring integration.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Add / Edit Modal Overlay */}
      <WebsiteAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        editWebsite={editingWebsite}
      />
    </div>
  );
};
