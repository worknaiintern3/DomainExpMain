import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WebsiteRecord } from '../websites.types';

interface WebsiteRowProps {
  website: WebsiteRecord;
  isSelected: boolean;
  isInspected: boolean;
  onToggleSelect: (id: string) => void;
  onSelectInspect: (website: WebsiteRecord) => void;
  onOpenEditModal: (website: WebsiteRecord) => void;
}

export const WebsiteRow: React.FC<WebsiteRowProps> = ({
  website,
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
      onClick={() => onSelectInspect(website)}
      className={`h-11 transition-colors cursor-pointer group border-b border-surface-container ${
        isInspected
          ? 'bg-primary/5 hover:bg-primary/10'
          : isSelected
          ? 'bg-primary/5 hover:bg-primary/10'
          : website.sslStatus === 'warning'
          ? 'bg-error-container/10 hover:bg-error-container/20'
          : website.sslStatus === 'expiring'
          ? 'bg-amber-500/5 hover:bg-amber-500/10'
          : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-unit-md text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(website.id)}
          className="rounded w-3.5 h-3.5 bg-surface-container-lowest text-primary accent-primary cursor-pointer"
          aria-label={`Select ${website.name}`}
        />
      </td>

      {/* Website / App Name */}
      <td className="px-unit-sm py-1.5">
        <div className="flex items-center gap-unit-xs min-w-0">
          <div
            className={`w-6 h-6 rounded ${website.avatarBgColor} ${website.avatarTextColor} flex items-center justify-center shrink-0 font-bold font-mono text-[11px] border border-outline-variant/20`}
          >
            {website.avatarLetter}
          </div>
          <span
            className={`font-label-md text-label-md font-semibold truncate ${
              isInspected ? 'text-primary' : 'text-on-surface group-hover:text-primary'
            }`}
          >
            {website.name}
          </span>
        </div>
      </td>

      {/* Primary Domain & Route */}
      <td className="px-unit-sm py-1.5">
        <div className="flex flex-col min-w-0">
          <span className="font-label-mono text-label-mono text-on-surface font-medium truncate">
            {website.domain}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary font-mono truncate">
            {website.routeNote}
          </span>
        </div>
      </td>

      {/* Environment */}
      <td className="px-unit-sm py-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full font-caption-xs text-caption-xs font-medium border ${
            website.environment === 'Production'
              ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary/20'
              : website.environment === 'Staging'
              ? 'bg-tertiary-container/30 text-tertiary border-tertiary/20'
              : 'bg-secondary-container text-on-secondary-container border-secondary/20'
          }`}
        >
          {website.environment}
        </span>
      </td>

      {/* Hosted Server */}
      <td className="px-unit-sm py-1.5">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-unit-2xs text-secondary">
            <span className="material-symbols-outlined text-[15px] text-secondary">
              {website.serverProvider === 'DigitalOcean' ? 'cloud' : 'dns'}
            </span>
            <span className="font-caption-xs text-caption-xs text-on-surface truncate font-medium">
              {website.serverName}
            </span>
            <span className="font-caption-xs text-caption-xs text-secondary">
              ({website.serverProvider})
            </span>
          </div>
          <span className="font-caption-xs text-[10px] text-secondary font-mono pl-4 truncate">
            {website.serverAccountEmail}
          </span>
        </div>
      </td>

      {/* Project */}
      <td className="px-unit-sm py-1.5">
        <span className="font-label-md text-label-md text-on-surface-variant font-medium">
          {website.project}
        </span>
      </td>

      {/* Technology & Port */}
      <td className="px-unit-sm py-1.5">
        <div className="flex items-center gap-unit-2xs">
          <span className="font-label-md text-label-md text-on-surface font-medium whitespace-nowrap">
            {website.techStack}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-surface-container font-label-mono text-[10px] text-secondary border border-outline-variant/20 font-semibold">
            :{website.port}
          </span>
        </div>
      </td>

      {/* SSL Status */}
      <td className="px-unit-sm py-1.5">
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
            website.sslStatus === 'warning'
              ? 'bg-error-container text-on-error-container border-error/30'
              : website.sslStatus === 'expiring'
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-surface-container-high text-on-secondary-fixed border-outline-variant/30'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              website.sslStatus === 'warning'
                ? 'bg-error'
                : website.sslStatus === 'expiring'
                ? 'bg-amber-600'
                : 'bg-primary-container'
            }`}
          />
          <span className="font-caption-xs text-caption-xs font-medium font-mono whitespace-nowrap">
            {website.sslLabel}
          </span>
        </div>
      </td>

      {/* Row Action Menu */}
      <td className="w-16 px-unit-md py-1.5 text-right relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
          title="Manage App"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 text-left z-30 divide-y divide-surface-container border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate(`/websites/${website.id}`);
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
                    onOpenEditModal(website);
                  }}
                  className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">edit</span>
                  Edit Mappings
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSelectInspect(website);
                  }}
                  className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
                  Inspect Asset
                </button>
              </div>
            </div>
          </>
        )}
      </td>
    </tr>
  );
};
