import React from 'react';
import { ServerRecord } from '../servers.types';
import { ServerRow } from './ServerRow';

interface ServerTableProps {
  servers: ServerRecord[];
  totalCount: number;
  selectedRows: Record<string, boolean>;
  inspectedServerId: string | null;
  onToggleSelectRow: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onSelectInspect: (server: ServerRecord) => void;
  onOpenEditModal: (server: ServerRecord) => void;
}

export const ServerTable: React.FC<ServerTableProps> = ({
  servers,
  totalCount,
  selectedRows,
  inspectedServerId,
  onToggleSelectRow,
  onToggleSelectAll,
  onSelectInspect,
  onOpenEditModal,
}) => {
  const allSelected =
    servers.length > 0 && servers.every((s) => !!selectedRows[s.id]);
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/30">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low h-8 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-outline-variant/30">
              <th className="w-10 px-unit-sm text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                  aria-label="Select all servers"
                />
              </th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Server / Hostname</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Provider</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Account Email</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">IP Address</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Region</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Specs</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Websites</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Cost</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Renewal</th>
              <th className="px-unit-sm py-unit-2xs font-semibold">Status</th>
              <th className="w-12 px-unit-sm py-unit-2xs text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container/60 font-body-sm text-body-sm text-on-surface">
            {servers.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-unit-lg py-12 text-center text-secondary">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-outline">
                      dns
                    </span>
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      No servers match the selected filters
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Try adjusting search terms or clearing provider/region filters.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              servers.map((server) => (
                <ServerRow
                  key={server.id}
                  server={server}
                  isSelected={!!selectedRows[server.id]}
                  isInspected={inspectedServerId === server.id}
                  onToggleSelect={onToggleSelectRow}
                  onSelectInspect={onSelectInspect}
                  onOpenEditModal={onOpenEditModal}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dense Table Footer Navigation */}
      <div className="h-10 px-unit-md bg-surface-container-low flex items-center justify-between font-caption-xs text-caption-xs text-secondary border-t border-outline-variant/30">
        <div className="flex items-center gap-unit-md">
          <span>
            Showing <strong className="text-on-surface font-semibold">{servers.length} of {totalCount}</strong> servers
          </span>
          <span className="hidden sm:inline">
            Selected: <strong className="text-on-surface font-semibold">{selectedCount} {selectedCount === 1 ? 'server' : 'servers'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-unit-xs">
          <button
            className="px-unit-xs py-1 rounded bg-surface-container-lowest text-secondary opacity-50 cursor-not-allowed border border-outline-variant/30"
            disabled
            type="button"
          >
            Previous
          </button>
          <span className="w-6 h-6 flex items-center justify-center rounded bg-primary text-on-primary font-semibold shadow-sm">
            1
          </span>
          <button
            className="px-unit-xs py-1 rounded bg-surface-container-lowest text-secondary opacity-50 cursor-not-allowed border border-outline-variant/30"
            disabled
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
