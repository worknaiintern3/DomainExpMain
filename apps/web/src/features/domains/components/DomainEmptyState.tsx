import React from 'react';

interface DomainEmptyStateProps {
  onOpenAddModal: () => void;
}

export const DomainEmptyState: React.FC<DomainEmptyStateProps> = ({ onOpenAddModal }) => {
  return (
    <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm p-unit-2xl flex flex-col items-center justify-center text-center my-unit-sm border border-outline-variant/40 animate-in fade-in zoom-in-95 duration-150">
      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-primary mb-unit-md shadow-inner">
        <span className="material-symbols-outlined text-[32px]">folder_open</span>
      </div>
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
        Your domain portfolio is empty
      </h3>
      <p className="font-body-md text-body-md text-secondary max-w-md mt-unit-xs mb-unit-lg leading-relaxed">
        Add your first domain to start tracking renewal dates, DNS/SSL information, WHOIS details and portfolio costs across your domain portfolio.
      </p>
      <div className="flex items-center gap-unit-sm flex-wrap justify-center">
        <button
          onClick={onOpenAddModal}
          className="h-9 px-unit-lg rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm transition-colors flex items-center gap-unit-xs"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add Your First Domain</span>
        </button>
        <button
          className="h-9 px-unit-lg rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center gap-unit-xs border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">cloud_upload</span>
          <span>Import CSV</span>
        </button>
      </div>
    </div>
  );
};
