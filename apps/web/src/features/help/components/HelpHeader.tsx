import React from 'react';
import { PRODUCT_METADATA } from '../help.reference';

interface HelpHeaderProps {
  onSearchFocus: () => void;
  onDocumentationClick?: () => void;
}

export const HelpHeader: React.FC<HelpHeaderProps> = ({
  onSearchFocus,
  onDocumentationClick,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-unit-md pb-unit-lg border-b border-surface-container-high/80">
      <div className="flex flex-col">
        <div className="flex items-center gap-unit-sm">
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
            Help &amp; Support
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-mono border border-outline-variant/30">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Knowledge Base</span>
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs max-w-3xl">
          Learn how DomainPulse organizes portfolio data, interprets domain and infrastructure metadata, and helps troubleshoot common portfolio issues.
        </p>
      </div>

      {/* Right Header Badges & Actions */}
      <div className="flex flex-wrap items-center gap-unit-sm">
        <div className="hidden sm:flex items-center gap-unit-xs px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary font-label-mono text-label-mono border border-outline-variant/30">
          <span className="material-symbols-outlined text-[15px] text-tertiary">folder_open</span>
          <span>{PRODUCT_METADATA.workspace}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary font-label-md text-label-md border border-outline-variant/30">
          <span>INR (₹)</span>
          <span className="text-outline">·</span>
          <span className="text-primary font-semibold">Compact</span>
        </div>

        <button
          type="button"
          onClick={onSearchFocus}
          className="h-9 px-unit-md inline-flex items-center gap-unit-xs rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-micro border border-outline-variant/30 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">search</span>
          <span>Search Help</span>
        </button>

        <button
          type="button"
          onClick={onDocumentationClick}
          className="h-9 px-unit-md inline-flex items-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">menu_book</span>
          <span>Documentation</span>
        </button>
      </div>
    </div>
  );
};
