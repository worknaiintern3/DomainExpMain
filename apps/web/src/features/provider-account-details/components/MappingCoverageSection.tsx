import React from 'react';
import { Link } from 'react-router-dom';

interface MappingCoverageSectionProps {
  coverageText: string;
}

export const MappingCoverageSection: React.FC<MappingCoverageSectionProps> = ({ coverageText }) => {
  return (
    <div className="rounded-lg bg-surface-container p-unit-sm flex flex-col sm:flex-row sm:items-center justify-between gap-unit-xs text-caption-xs font-caption-xs text-on-surface border border-outline-variant/30">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[18px]">task_alt</span>
        <span>
          <strong>Relationship Coverage:</strong> {coverageText}
        </span>
      </div>
      <Link
        to="/accounts"
        className="text-primary hover:underline font-medium shrink-0 inline-flex items-center gap-1"
      >
        <span>Inspect Unmapped Queue</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
  );
};
