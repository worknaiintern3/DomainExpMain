import React from 'react';
import { DomainRecord } from '../domains.types';
import { DomainRow } from './DomainRow';

interface DomainTableProps {
  domains: DomainRecord[];
  totalCount: number;
  selectedRows: Record<string, boolean>;
  inspectedDomainId: string | null;
  onToggleSelectRow: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onSelectInspect: (domain: DomainRecord) => void;
  onOpenEditModal: (domain: DomainRecord) => void;
}

export const DomainTable: React.FC<DomainTableProps> = ({
  domains,
  totalCount,
  selectedRows,
  inspectedDomainId,
  onToggleSelectRow,
  onToggleSelectAll,
  onSelectInspect,
  onOpenEditModal,
}) => {
  const allSelected =
    domains.length > 0 && domains.every((d) => !!selectedRows[d.id]);

  return (
    <div className="flex-1 w-full bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden min-w-0 border border-outline-variant/40">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low h-8 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider select-none border-b border-outline-variant/30">
              <th className="w-10 px-unit-md py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleSelectAll(e.target.checked)}
                  className="rounded w-4 h-4 text-primary accent-primary cursor-pointer"
                  aria-label="Select all domains"
                />
              </th>
              <th className="px-unit-md py-2 font-semibold">Domain</th>
              <th className="px-unit-md py-2 font-semibold">Registrar</th>
              <th className="px-unit-md py-2 font-semibold">Expiry Date</th>
              <th className="px-unit-md py-2 font-semibold">Days Left</th>
              <th className="px-unit-md py-2 font-semibold">Renewal Cost</th>
              <th className="px-unit-md py-2 text-center font-semibold">Auto-Renew</th>
              <th className="px-unit-md py-2 font-semibold">Status</th>
              <th className="px-unit-md py-2 font-semibold">Project / Tags</th>
              <th className="px-unit-md py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container text-body-sm font-body-sm">
            {domains.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-unit-lg py-12 text-center text-secondary">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-outline">
                      search_off
                    </span>
                    <span className="font-body-md text-body-md font-medium text-on-surface">
                      No domains match the selected filters
                    </span>
                    <span className="font-caption-xs text-caption-xs text-secondary">
                      Try clearing search terms or resetting filter criteria.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              domains.map((domain) => (
                <DomainRow
                  key={domain.id}
                  domain={domain}
                  isSelected={!!selectedRows[domain.id]}
                  isInspected={inspectedDomainId === domain.id}
                  onToggleSelect={onToggleSelectRow}
                  onSelectInspect={onSelectInspect}
                  onOpenEditModal={onOpenEditModal}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer & Pagination */}
      <div className="bg-surface-container-low px-unit-lg py-unit-sm flex flex-col sm:flex-row items-center justify-between gap-unit-sm border-t border-outline-variant/30">
        <div className="flex items-center gap-unit-md text-caption-xs text-secondary font-label-md">
          <span>
            Showing <strong className="text-on-surface font-semibold">1–{domains.length}</strong> of{' '}
            <strong className="text-on-surface font-semibold">{totalCount}</strong> domains
          </span>
          <span className="h-3 w-[1px] bg-outline-variant" />
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select className="h-6 px-1 rounded bg-surface-container-lowest text-on-surface font-label-md text-caption-xs focus:outline-none border border-outline-variant/30 cursor-pointer">
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>
        </div>

        {/* Pagination buttons */}
        <div className="flex items-center gap-unit-xs">
          <button
            className="h-8 px-unit-sm rounded bg-surface-container-lowest text-secondary hover:text-on-surface font-label-md text-caption-xs disabled:opacity-50 transition-colors flex items-center gap-1 border border-outline-variant/30"
            disabled
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
            <span>Previous</span>
          </button>
          <button
            className="w-8 h-8 rounded bg-primary text-on-primary font-label-md text-caption-xs font-semibold shadow-sm"
            type="button"
          >
            1
          </button>
          <button
            className="w-8 h-8 rounded bg-surface-container-lowest text-secondary hover:bg-surface-container font-label-md text-caption-xs border border-outline-variant/30"
            type="button"
          >
            2
          </button>
          <button
            className="w-8 h-8 rounded bg-surface-container-lowest text-secondary hover:bg-surface-container font-label-md text-caption-xs border border-outline-variant/30"
            type="button"
          >
            3
          </button>
          <button
            className="h-8 px-unit-sm rounded bg-surface-container-lowest text-secondary hover:text-on-surface font-label-md text-caption-xs transition-colors flex items-center gap-1 border border-outline-variant/30"
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
