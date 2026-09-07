import React from 'react';
import { PRODUCT_METADATA } from '../help.reference';

export const ProductMetadataFooter: React.FC = () => {
  return (
    <div className="w-full bg-surface-container-low rounded-xl px-unit-md py-unit-sm shadow-micro border border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-unit-sm">
      <div className="flex flex-wrap items-center gap-unit-md font-label-mono text-caption-xs text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Product:</span>
          <span className="text-on-surface font-semibold">{PRODUCT_METADATA.product}</span>
        </div>
        <span className="text-outline-variant">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Workspace:</span>
          <span className="text-on-surface font-medium">{PRODUCT_METADATA.workspace}</span>
        </div>
        <span className="text-outline-variant">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Build:</span>
          <span className="text-on-surface">{PRODUCT_METADATA.build}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-unit-md font-label-mono text-caption-xs text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Data Sources:</span>
          <span className="text-on-surface font-medium">{PRODUCT_METADATA.dataSources}</span>
        </div>
        <span className="text-outline-variant">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Pricing:</span>
          <span className="text-on-surface font-medium">{PRODUCT_METADATA.pricing}</span>
        </div>
        <span className="text-outline-variant">•</span>
        <div className="flex items-center gap-1.5">
          <span className="text-outline">Monitoring:</span>
          <span className="text-secondary font-medium">{PRODUCT_METADATA.monitoring}</span>
        </div>
      </div>
    </div>
  );
};
