import React from 'react';

interface AccountsHeaderProps {
  onExportCsv: () => void;
  onOpenLinkAccountModal: () => void;
  onOpenAddEmailModal: () => void;
}

export const AccountsHeader: React.FC<AccountsHeaderProps> = ({
  onExportCsv,
  onOpenLinkAccountModal,
  onOpenAddEmailModal,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md">
      <div className="flex flex-col gap-unit-2xs">
        <div className="flex items-center gap-unit-xs">
          <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Accounts &amp; Emails
          </h1>
          <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-on-surface-variant font-label-mono text-label-mono font-medium text-[10px] uppercase">
            INVENTORY
          </span>
        </div>
        <p className="font-body-md text-body-md text-secondary">
          Organize registrar, hosting and cloud provider accounts by email and connected assets.
        </p>
      </div>

      <div className="flex items-center gap-unit-sm shrink-0 flex-wrap">
        <button
          onClick={onExportCsv}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">download</span>
          <span>Export CSV</span>
        </button>
        <button
          onClick={onOpenLinkAccountModal}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">link</span>
          <span>Link New Account</span>
        </button>
        <button
          onClick={onOpenAddEmailModal}
          className="h-9 px-unit-md flex items-center gap-unit-xs rounded-lg bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary shadow-sm transition-colors"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Email</span>
        </button>
      </div>
    </div>
  );
};
