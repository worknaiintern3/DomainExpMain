import React from 'react';
import { WebsiteRecord } from '../websites.types';
import { WebsiteRow } from './WebsiteRow';

interface WebsiteTableProps {
  websites: WebsiteRecord[];
  totalCount: number;
  selectedRows: Record<string, boolean>;
  inspectedWebsiteId: string | null;
  onToggleSelectRow: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onSelectInspect: (website: WebsiteRecord) => void;
  onOpenEditModal: (website: WebsiteRecord) => void;
}

export const WebsiteTable: React.FC<WebsiteTableProps> = ({
  websites,
  totalCount,
  selectedRows,
  inspectedWebsiteId,
  onToggleSelectRow,
  onToggleSelectAll,
  onSelectInspect,
  onOpenEditModal,
}) => {
  const allSelected =
    websites.length > 0 && websites.every((w) => !!selectedRows[w.id]);
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  return (
    <div className="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/30">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/60 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider h-8 select-none border-b border-outline-variant/30">
              <th className="w-10 px-unit-md text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="rounded w-3.5 h-3.5 bg-surface-container-lowest text-primary accent-primary cursor-pointer"
                  aria-label="Select all websites"
                />
              </th>
              <th className="px-unit-sm font-semibold">Website / App Name</th>
              <th className="px-unit-sm font-semibold">Primary Domain &amp; Route</th>
              <th className="px-unit-sm font-semibold">Environment</th>
              <th className="px-unit-sm font-semibold">Hosted Server</th>
              <th className="px-unit-sm font-semibold">Project</th>
              <th className="px-unit-sm font-semibold">Technology &amp; Port</th>
              <th className="px-unit-sm font-semibold">SSL Status</th>
              <th className="w-16 px-unit-md text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low/60 text-on-surface font-body-sm text-body-sm">
            {websites.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-unit-lg py-12 text-center text-secondary">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-outline">
                      web_asset_off
                    </span>
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      No websites or applications match the selected filters
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Try adjusting your search terms or clearing environment/tech stack filters.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              websites.map((website) => (
                <WebsiteRow
                  key={website.id}
                  website={website}
                  isSelected={!!selectedRows[website.id]}
                  isInspected={inspectedWebsiteId === website.id}
                  onToggleSelect={onToggleSelectRow}
                  onSelectInspect={onSelectInspect}
                  onOpenEditModal={onOpenEditModal}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Compact Footer Pagination & Count Strip */}
      <div className="px-unit-md py-unit-sm bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm border-t border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="font-caption-xs text-caption-xs text-secondary font-mono">
            Showing <strong className="text-on-surface font-semibold">{websites.length}</strong> of{' '}
            <strong className="text-on-surface font-semibold">{totalCount}</strong> tracked entries
          </span>
          <span className="text-outline-variant font-caption-xs text-caption-xs">•</span>
          <span className="font-caption-xs text-caption-xs text-secondary font-mono">
            {selectedCount} selected
          </span>
        </div>

        <div className="flex items-center gap-unit-xs">
          <button
            className="h-7 px-unit-sm rounded bg-surface-container-lowest text-secondary opacity-50 cursor-not-allowed font-label-md text-label-md flex items-center gap-1 border border-outline-variant/30"
            disabled
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            <span>Previous</span>
          </button>
          <div className="flex items-center gap-1">
            <span className="w-7 h-7 rounded bg-primary text-on-primary font-label-mono text-label-mono flex items-center justify-center font-semibold shadow-sm">
              1
            </span>
            <button
              className="w-7 h-7 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-mono text-label-mono flex items-center justify-center transition-colors border border-outline-variant/20"
              type="button"
            >
              2
            </button>
            <button
              className="w-7 h-7 rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-mono text-label-mono flex items-center justify-center transition-colors border border-outline-variant/20"
              type="button"
            >
              3
            </button>
          </div>
          <button
            className="h-7 px-unit-sm rounded bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1 transition-colors border border-outline-variant/30"
            type="button"
          >
            <span>Next</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
};
