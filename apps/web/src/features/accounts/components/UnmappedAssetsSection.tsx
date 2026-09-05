import React, { useState } from 'react';
import { UnmappedAsset } from '../accounts.types';

interface UnmappedAssetsSectionProps {
  unmappedAssets: UnmappedAsset[];
  onActionClick: (asset: UnmappedAsset) => void;
}

export const UnmappedAssetsSection: React.FC<UnmappedAssetsSectionProps> = ({
  unmappedAssets,
  onActionClick,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 1000);
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-outline-variant/30">
      {/* Header Bar */}
      <div className="bg-surface-container-low px-unit-lg py-unit-md flex flex-col sm:flex-row sm:items-center justify-between gap-unit-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-unit-md">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
            <span className="material-symbols-outlined text-[22px] text-amber-500">warning</span>
          </div>
          <div>
            <div className="flex items-center gap-unit-sm flex-wrap">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Assets Requiring Mapping
              </h3>
              <span className="inline-flex items-center gap-1 px-unit-xs py-unit-2xs rounded-full bg-amber-50 text-amber-800 font-caption-xs text-caption-xs font-semibold border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {unmappedAssets.length} ASSETS NEED ATTENTION
              </span>
            </div>
            <p className="font-caption-xs text-caption-xs text-secondary mt-0.5">
              Identify domains, servers, or web apps not yet mapped to a responsible email account or project.
            </p>
          </div>
        </div>

        <button
          onClick={handleScan}
          className="h-8 px-unit-sm rounded bg-surface hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-unit-xs transition-colors shadow-sm self-start sm:self-auto border border-outline-variant/20"
          type="button"
        >
          <span
            className={`material-symbols-outlined text-[16px] text-secondary ${
              isScanning ? 'animate-spin' : ''
            }`}
          >
            refresh
          </span>
          <span>{isScanning ? 'Reviewing...' : 'Review Unmapped'}</span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface border-b border-outline-variant/20">
            <tr className="h-9 text-secondary font-caption-xs text-caption-xs uppercase tracking-wider">
              <th className="px-unit-lg font-semibold">Asset Name</th>
              <th className="px-unit-md font-semibold">Asset Type</th>
              <th className="px-unit-md font-semibold">Current Provider</th>
              <th className="px-unit-md font-semibold">Missing Relationship</th>
              <th className="px-unit-lg font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-body-sm text-body-sm text-on-surface">
            {unmappedAssets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-container-low/50 transition-colors h-12">
                <td className="px-unit-lg font-label-mono font-medium text-on-surface">
                  <span>{asset.name}</span>
                  {asset.subtext && (
                    <span className="text-secondary text-caption-xs ml-1">{asset.subtext}</span>
                  )}
                </td>
                <td className="px-unit-md">
                  <span className="px-unit-xs py-unit-2xs rounded bg-surface-container text-secondary text-caption-xs font-medium border border-outline-variant/20">
                    {asset.assetType}
                  </span>
                </td>
                <td className="px-unit-md">
                  <span className="text-on-surface font-medium">{asset.currentProvider}</span>
                </td>
                <td className="px-unit-md">
                  <span className="inline-flex items-center gap-1.5 text-amber-800 text-caption-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {asset.missingRelationship}
                  </span>
                </td>
                <td className="px-unit-lg text-right">
                  <button
                    onClick={() => onActionClick(asset)}
                    className="h-8 px-unit-sm rounded bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary shadow-sm transition-colors cursor-pointer"
                    type="button"
                  >
                    {asset.actionLabel}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
