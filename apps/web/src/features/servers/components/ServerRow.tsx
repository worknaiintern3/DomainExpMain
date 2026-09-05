import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServerRecord } from '../servers.types';

interface ServerRowProps {
  server: ServerRecord;
  isSelected: boolean;
  isInspected: boolean;
  onToggleSelect: (id: string) => void;
  onSelectInspect: (server: ServerRecord) => void;
  onOpenEditModal: (server: ServerRecord) => void;
}

export const ServerRow: React.FC<ServerRowProps> = ({
  server,
  isSelected,
  isInspected,
  onToggleSelect,
  onSelectInspect,
  onOpenEditModal,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <tr
      onClick={() => onSelectInspect(server)}
      className={`h-11 transition-colors cursor-pointer group border-b border-surface-container ${
        isInspected
          ? 'bg-primary/5 hover:bg-primary/10'
          : isSelected
          ? 'bg-primary/5 hover:bg-primary/10'
          : server.status === 'attention'
          ? 'bg-amber-500/5 hover:bg-amber-500/10'
          : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-unit-sm text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(server.id)}
          className="w-3.5 h-3.5 rounded bg-surface-container-lowest text-primary accent-primary cursor-pointer"
          aria-label={`Select ${server.name}`}
        />
      </td>

      {/* Server / Hostname */}
      <td className="px-unit-sm py-1.5">
        <div className="flex flex-col min-w-0">
          <span
            className={`font-label-md text-label-md font-semibold truncate ${
              isInspected ? 'text-primary' : 'text-on-surface group-hover:text-primary'
            }`}
          >
            {server.name}
          </span>
          <span className="font-label-mono text-caption-xs text-secondary truncate">
            {server.hostname}
          </span>
        </div>
      </td>

      {/* Provider */}
      <td className="px-unit-sm py-1.5">
        <div
          className={`inline-flex items-center gap-unit-2xs px-unit-xs py-0.5 rounded font-label-md text-caption-xs font-semibold ${server.providerColor.bg} ${server.providerColor.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${server.providerColor.dot}`} />
          <span>{server.provider}</span>
        </div>
      </td>

      {/* Account Email */}
      <td className="px-unit-sm py-1.5">
        <span
          className="font-label-mono text-caption-xs text-on-surface bg-surface-container-low px-unit-xs py-0.5 rounded font-medium truncate block max-w-[140px] border border-outline-variant/20"
          title={server.accountEmail}
        >
          {server.accountEmail}
        </span>
      </td>

      {/* IP Address */}
      <td className="px-unit-sm py-1.5 font-label-mono text-caption-xs text-secondary">
        {server.ipAddress}
      </td>

      {/* Region */}
      <td className="px-unit-sm py-1.5 font-body-sm text-body-sm text-on-surface">
        {server.region}
      </td>

      {/* Compute Specs */}
      <td className="px-unit-sm py-1.5 font-caption-xs text-caption-xs text-secondary whitespace-nowrap">
        {server.computeSpecs}
      </td>

      {/* Hosted Websites */}
      <td className="px-unit-sm py-1.5">
        <span className="inline-block px-unit-xs py-0.5 rounded-full bg-surface-container-high text-primary font-caption-xs text-caption-xs font-semibold">
          {server.hostedWebsitesCount} {server.hostedWebsitesCount === 1 ? 'Site' : 'Sites'}
        </span>
      </td>

      {/* Monthly Cost */}
      <td className="px-unit-sm py-1.5 font-label-mono text-body-sm font-semibold text-on-surface">
        {server.monthlyCostFormatted}
        <span className="text-secondary font-normal text-caption-xs">/mo</span>
      </td>

      {/* Renewal Date */}
      <td className="px-unit-sm py-1.5">
        {server.status === 'attention' ? (
          <span className="inline-flex items-center gap-1 font-label-mono text-caption-xs font-bold text-amber-800 bg-amber-100 px-unit-xs py-0.5 rounded border border-amber-200">
            <span className="material-symbols-outlined text-[12px]">warning</span> 7 days
          </span>
        ) : (
          <span className="font-label-mono text-caption-xs text-secondary">
            {server.renewalDateFormatted}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-unit-sm py-1.5">
        {server.status === 'attention' ? (
          <div className="inline-flex items-center gap-1.5 px-unit-xs py-0.5 rounded-full bg-amber-50 text-amber-800 font-caption-xs text-caption-xs font-medium border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Needs Attention</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-unit-xs py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-caption-xs text-caption-xs font-medium border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Inventory: Active</span>
          </div>
        )}
      </td>

      {/* Actions */}
      <td className="w-12 px-unit-sm py-1.5 text-right relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          type="button"
          title="Server actions"
        >
          <span className="material-symbols-outlined text-[16px]">more_vert</span>
        </button>

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 text-left z-30 divide-y divide-surface-container border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/servers/${server.id}`);
                  }}
                  className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    visibility
                  </span>
                  View Details
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenEditModal(server);
                  }}
                  className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
                  Edit Server
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSelectInspect(server);
                  }}
                  className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">hub</span>
                  Inspect Mappings
                </button>
              </div>
            </div>
          </>
        )}
      </td>
    </tr>
  );
};
