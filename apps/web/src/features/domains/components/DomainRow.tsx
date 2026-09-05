import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DomainRecord } from '../domains.types';

interface DomainRowProps {
  domain: DomainRecord;
  isSelected: boolean;
  isInspected: boolean;
  onToggleSelect: (id: string) => void;
  onSelectInspect: (domain: DomainRecord) => void;
  onOpenEditModal: (domain: DomainRecord) => void;
}

export const DomainRow: React.FC<DomainRowProps> = ({
  domain,
  isSelected,
  isInspected,
  onToggleSelect,
  onSelectInspect,
  onOpenEditModal,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleRowClick = () => {
    onSelectInspect(domain);
  };

  const getTldBadgeBg = (tld: string) => {
    switch (tld.toUpperCase()) {
      case '.COM':
        return 'bg-error-container/40 text-error';
      case '.IN':
        return 'bg-error-container/40 text-error';
      case '.AI':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-surface-container text-secondary';
    }
  };

  return (
    <tr
      onClick={handleRowClick}
      className={`transition-colors cursor-pointer group border-b border-surface-container ${
        isInspected
          ? 'bg-primary/5 hover:bg-surface-container/60'
          : isSelected
          ? 'bg-primary/5 hover:bg-surface-container/60'
          : 'hover:bg-surface-container-low bg-surface-container-lowest'
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-unit-md py-2.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect(domain.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded w-4 h-4 text-primary accent-primary cursor-pointer"
          aria-label={`Select ${domain.domain}`}
        />
      </td>

      {/* Domain */}
      <td className="px-unit-md py-2.5">
        <div className="flex items-center gap-unit-sm">
          <div
            className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-label-mono font-bold shrink-0 ${getTldBadgeBg(
              domain.tldBadge
            )}`}
          >
            {domain.tldBadge}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-on-surface font-label-mono text-body-sm group-hover:text-primary transition-colors truncate">
                {domain.domain}
              </span>
              {domain.isPrimary && (
                <span
                  className="material-symbols-outlined text-[14px] text-primary shrink-0"
                  title="Primary Domain"
                >
                  verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-caption-xs text-secondary font-label-mono">
              <span className="text-emerald-700">{domain.sslStatusText}</span>
              <span>•</span>
              <span className="truncate">{domain.dnsProviderText}</span>
            </div>
          </div>
        </div>
      </td>

      {/* Registrar */}
      <td className="px-unit-md py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${domain.registrarDotColor} shrink-0`} />
          <span className="text-on-surface font-label-md text-label-md">{domain.registrar}</span>
        </div>
      </td>

      {/* Expiry Date */}
      <td className="px-unit-md py-2.5 font-label-mono text-caption-xs text-on-surface">
        {domain.expiryDateFormatted}
      </td>

      {/* Days Left */}
      <td className="px-unit-md py-2.5">
        {domain.status === 'critical' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-error font-label-mono text-caption-xs font-bold animate-pulse">
            {domain.daysRemaining} days
          </span>
        ) : domain.status === 'warning' ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-label-mono text-caption-xs font-semibold">
            {domain.daysRemaining} days
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-mono text-caption-xs">
            {domain.daysRemaining} days
          </span>
        )}
      </td>

      {/* Renewal Cost */}
      <td className="px-unit-md py-2.5 font-label-mono text-on-surface font-semibold text-caption-xs">
        {domain.renewalCostFormatted}
      </td>

      {/* Auto-Renew */}
      <td className="px-unit-md py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        {domain.autoRenew ? (
          <div
            className="inline-flex w-7 h-4 rounded-full bg-primary-container relative cursor-pointer items-center justify-end p-0.5"
            title="Auto-Renew: On"
          >
            <div className="w-3 h-3 rounded-full bg-on-primary shadow-sm" />
          </div>
        ) : (
          <div
            className="inline-flex w-7 h-4 rounded-full bg-outline-variant relative cursor-pointer items-center p-0.5"
            title="Auto-Renew: Off"
          >
            <div className="w-3 h-3 rounded-full bg-surface-container-lowest shadow-sm" />
          </div>
        )}
      </td>

      {/* Status */}
      <td className="px-unit-md py-2.5">
        {domain.status === 'critical' ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-error-container/60 text-error text-caption-xs font-label-md font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-error" /> Critical
          </span>
        ) : domain.status === 'warning' ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-caption-xs font-label-md font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Warning
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-caption-xs font-label-md font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Healthy
          </span>
        )}
      </td>

      {/* Project / Tags */}
      <td className="px-unit-md py-2.5">
        <span className="inline-block px-2 py-0.5 rounded bg-surface-container text-primary font-label-mono text-caption-xs font-medium">
          {domain.projectTag}
        </span>
      </td>

      {/* Actions */}
      <td className="px-unit-md py-2.5 text-right relative">
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {domain.status === 'critical' && (
            <Link
              to={`/domains/${domain.domain}`}
              className="px-2 py-1 rounded bg-primary text-on-primary text-caption-xs font-label-md font-semibold shadow-sm hover:bg-primary-container transition-colors"
            >
              Review Renewal
            </Link>
          )}

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
              type="button"
              title="Row actions"
            >
              <span className="material-symbols-outlined text-[18px]">more_vert</span>
            </button>

            {/* Action Popover Menu */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded-lg shadow-xl py-1 text-left z-30 divide-y divide-surface-container border border-outline-variant/30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(`/domains/${domain.domain}`);
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
                        onOpenEditModal(domain);
                      }}
                      className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        edit
                      </span>
                      Edit Domain
                    </button>
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        notifications
                      </span>
                      Set Reminder
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(`/domains/${domain.domain}`);
                      }}
                      className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        dns
                      </span>
                      Check DNS
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        navigate(`/domains/${domain.domain}`);
                      }}
                      className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-on-surface hover:bg-surface-container flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        fingerprint
                      </span>
                      Check WHOIS
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full px-unit-md py-1.5 text-caption-xs font-label-md text-error hover:bg-error-container/30 flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};
