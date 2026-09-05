import React from 'react';
import { DomainDetailData } from '../domainDetails.types';

interface TransferChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DomainDetailData;
}

export const TransferChecklistModal: React.FC<TransferChecklistModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-sm z-50 flex items-center justify-center p-unit-md animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-xl bg-surface-container-lowest rounded-xl shadow-2xl p-unit-xl flex flex-col gap-unit-md border border-outline-variant/40 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-unit-sm border-b border-surface-container">
          <div className="flex flex-col">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">checklist_rtl</span>
              <span>Registrar Transfer Checklist</span>
            </h3>
            <p className="font-caption-xs text-caption-xs text-secondary font-label-mono">
              {data.domain} • EPP Protocol Readiness
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-unit-sm py-unit-xs">
          {/* Item 1: Domain Lock Status */}
          <div className="flex items-start justify-between p-unit-sm bg-surface-container-low rounded-lg border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                1. Registrar Transfer Lock (EPP)
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                Current status: <code className="font-label-mono text-primary">clientTransferProhibited</code>
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-label-md text-caption-xs font-semibold shrink-0">
              Locked
            </span>
          </div>

          {/* Item 2: Auth-Code / EPP Code */}
          <div className="flex items-start justify-between p-unit-sm bg-surface-container-low rounded-lg border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                2. EPP Authorization Code
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                Request auth-info code from {data.registrarName} tenant dashboard.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container text-secondary font-label-md text-caption-xs font-semibold shrink-0">
              Action Required
            </span>
          </div>

          {/* Item 3: WHOIS Privacy */}
          <div className="flex items-start justify-between p-unit-sm bg-surface-container-low rounded-lg border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                3. WHOIS Privacy &amp; Admin Email
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                Admin verification emails routed to <strong className="font-label-mono">{data.registrantEmail}</strong>.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#ecfdf5] text-[#065f46] font-label-md text-caption-xs font-semibold shrink-0">
              Verified
            </span>
          </div>

          {/* Item 4: 60-Day ICANN Lock */}
          <div className="flex items-start justify-between p-unit-sm bg-surface-container-low rounded-lg border border-outline-variant/20">
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                4. ICANN 60-Day Post-Transfer Window
              </span>
              <span className="font-caption-xs text-caption-xs text-secondary mt-0.5">
                Registered on {data.registeredDateFormatted}. Eligible for transfer.
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-[#ecfdf5] text-[#065f46] font-label-md text-caption-xs font-semibold shrink-0">
              Eligible
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end pt-unit-sm border-t border-surface-container">
          <button
            onClick={onClose}
            className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors"
            type="button"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
