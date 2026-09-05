import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RenewalTableRow, HealthStatus } from '../overview.types';

interface UpcomingRenewalsTableProps {
  renewals: RenewalTableRow[];
}

export const UpcomingRenewalsTable: React.FC<UpcomingRenewalsTableProps> = ({ renewals }) => {
  const [selectedTab, setSelectedTab] = useState<'all' | HealthStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  // Filter rows by tab & search query
  const filteredRows = renewals.filter((row) => {
    const matchesTab = selectedTab === 'all' || row.status === selectedTab;
    const matchesSearch =
      searchQuery.trim() === '' ||
      row.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.registrar.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      filteredRows.forEach((row) => {
        updated[row.id] = true;
      });
    }
    setSelectedRows(updated);
  };

  const handleToggleRow = (id: string) => {
    setSelectedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/40">
      {/* Grid Control Bar */}
      <div className="p-unit-md flex flex-col md:flex-row md:items-center justify-between gap-unit-md bg-surface-container-lowest border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-xs flex-wrap">
          <span className="font-headline-sm text-headline-sm text-[16px] text-on-surface font-semibold mr-unit-xs">
            Upcoming Renewals
          </span>
          <div className="inline-flex p-0.5 bg-surface-container-low rounded-lg border border-outline-variant/30">
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-unit-sm py-1 rounded-md text-caption-xs font-caption-xs transition-all ${
                selectedTab === 'all'
                  ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              All (42)
            </button>
            <button
              onClick={() => setSelectedTab('critical')}
              className={`px-unit-sm py-1 rounded-md text-caption-xs font-caption-xs transition-all ${
                selectedTab === 'critical'
                  ? 'bg-surface-container-lowest text-error font-semibold shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              Critical (2)
            </button>
            <button
              onClick={() => setSelectedTab('warning')}
              className={`px-unit-sm py-1 rounded-md text-caption-xs font-caption-xs transition-all ${
                selectedTab === 'warning'
                  ? 'bg-surface-container-lowest text-amber-700 font-semibold shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              Warning (6)
            </button>
            <button
              onClick={() => setSelectedTab('healthy')}
              className={`px-unit-sm py-1 rounded-md text-caption-xs font-caption-xs transition-all ${
                selectedTab === 'healthy'
                  ? 'bg-surface-container-lowest text-tertiary font-semibold shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              type="button"
            >
              Healthy (34)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-unit-sm">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2.5 text-secondary text-[16px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter domain or registrar..."
              className="h-8 pl-8 pr-3 bg-surface-container-low rounded-lg text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container w-52 border border-outline-variant/30"
            />
          </div>
          <button
            className="h-8 px-unit-sm bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg flex items-center gap-unit-xs transition-colors border border-outline-variant/30"
            type="button"
            title="Filter options"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">filter_list</span>
            <span className="font-caption-xs text-caption-xs font-medium">Filter</span>
          </button>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTab('all');
            }}
            className="h-8 w-8 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg flex items-center justify-center transition-colors border border-outline-variant/30"
            type="button"
            title="Reset Filters"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">refresh</span>
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-8 bg-surface-container-low font-caption-xs text-caption-xs uppercase tracking-wider text-secondary select-none border-b border-outline-variant/30">
              <th className="w-10 px-unit-md py-1">
                <input
                  type="checkbox"
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded accent-primary w-3.5 h-3.5 cursor-pointer"
                  aria-label="Select all rows"
                />
              </th>
              <th className="px-unit-md py-1 font-semibold cursor-pointer hover:text-on-surface">
                <div className="flex items-center gap-unit-2xs">
                  <span>Domain Name</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                </div>
              </th>
              <th className="px-unit-md py-1 font-semibold">Registrar</th>
              <th className="px-unit-md py-1 font-semibold">Expiration Date</th>
              <th className="px-unit-md py-1 font-semibold text-right">Time Remaining</th>
              <th className="px-unit-md py-1 font-semibold text-right">Cost (INR)</th>
              <th className="px-unit-md py-1 font-semibold">Health Status</th>
              <th className="px-unit-md py-1 font-semibold text-right">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm divide-y divide-outline-variant/20">
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className="h-11 hover:bg-surface-container-low transition-colors bg-surface-container-lowest group"
              >
                <td className="px-unit-md py-2">
                  <input
                    type="checkbox"
                    checked={!!selectedRows[row.id]}
                    onChange={() => handleToggleRow(row.id)}
                    className="rounded accent-primary w-3.5 h-3.5 cursor-pointer"
                    aria-label={`Select ${row.domain}`}
                  />
                </td>
                <td className="px-unit-md py-2">
                  <Link to={`/domains/${row.domain}`} className="flex items-center gap-unit-sm">
                    <div
                      className={`w-6 h-6 rounded ${row.initialBgClass} flex items-center justify-center ${row.initialTextClass} font-label-mono text-[11px] font-bold shrink-0`}
                    >
                      {row.initial}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono text-label-mono text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                        {row.domain}
                      </span>
                      <span className="font-caption-xs text-caption-xs text-secondary">
                        Auto-renew:{' '}
                        {row.autoRenew ? (
                          <span className="text-tertiary font-medium">Active</span>
                        ) : (
                          <span className="text-error font-medium">Off</span>
                        )}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-unit-md py-2">
                  <div className="flex items-center gap-unit-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                    <span className="font-caption-xs text-caption-xs font-medium text-on-surface">
                      {row.registrar}
                    </span>
                  </div>
                </td>
                <td className="px-unit-md py-2 font-label-mono text-label-mono text-on-surface-variant">
                  {row.expirationDate}
                </td>
                <td className="px-unit-md py-2 text-right">
                  <span
                    className={`inline-block font-label-mono text-label-mono px-unit-xs py-0.5 rounded ${
                      row.status === 'critical'
                        ? 'text-error font-bold bg-error-container/50'
                        : row.status === 'warning'
                        ? 'text-on-secondary-container font-semibold bg-secondary-container/60'
                        : 'text-secondary'
                    }`}
                  >
                    {row.daysRemaining} days
                  </span>
                </td>
                <td className="px-unit-md py-2 text-right font-label-mono text-label-mono text-on-surface font-medium">
                  {row.costFormatted}
                </td>
                <td className="px-unit-md py-2">
                  {row.status === 'critical' && (
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-error-container text-on-error-container text-caption-xs font-caption-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
                      Critical
                    </span>
                  )}
                  {row.status === 'warning' && (
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-secondary-container text-on-secondary-container text-caption-xs font-caption-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                      Warning
                    </span>
                  )}
                  {row.status === 'healthy' && (
                    <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full bg-surface-container-high text-on-surface text-caption-xs font-caption-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                      Healthy
                    </span>
                  )}
                </td>
                <td className="px-unit-md py-2 text-right">
                  <div className="inline-flex items-center gap-unit-xs">
                    <Link
                      to={`/domains/${row.domain}`}
                      className={`h-7 px-unit-sm rounded font-caption-xs text-caption-xs font-semibold transition-colors flex items-center justify-center ${
                        row.status === 'critical'
                          ? 'bg-primary text-on-primary hover:bg-tertiary shadow-sm'
                          : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      {row.status === 'critical' ? 'Renew' : row.status === 'warning' ? 'Manage' : 'DNS'}
                    </Link>
                    <button
                      className="h-7 w-7 text-secondary hover:text-on-surface rounded flex items-center justify-center hover:bg-surface-container transition-colors"
                      type="button"
                      title="More Options"
                    >
                      <span className="material-symbols-outlined text-[16px]">more_vert</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Pagination / Summary Footer */}
      <div className="h-10 px-unit-md bg-surface-container-low flex items-center justify-between font-caption-xs text-caption-xs text-secondary select-none border-t border-outline-variant/30">
        <div>Showing 1 to {filteredRows.length} of 42 entries</div>
        <div className="flex items-center gap-unit-xs">
          <button
            className="px-2 py-1 rounded bg-surface-container-lowest text-secondary hover:text-on-surface disabled:opacity-50 border border-outline-variant/30"
            disabled
            type="button"
          >
            Previous
          </button>
          <span className="px-2 py-1 rounded bg-primary text-on-primary font-bold">1</span>
          <button
            className="px-2 py-1 rounded bg-surface-container-lowest text-secondary hover:text-on-surface border border-outline-variant/30"
            type="button"
          >
            2
          </button>
          <button
            className="px-2 py-1 rounded bg-surface-container-lowest text-secondary hover:text-on-surface border border-outline-variant/30"
            type="button"
          >
            3
          </button>
          <button
            className="px-2 py-1 rounded bg-surface-container-lowest text-secondary hover:text-on-surface border border-outline-variant/30"
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
