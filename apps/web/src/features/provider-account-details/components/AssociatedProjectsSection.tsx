import React from 'react';
import { AssociatedProjectRecord } from '../providerAccountDetails.types';

interface AssociatedProjectsSectionProps {
  projects: AssociatedProjectRecord[];
}

export const AssociatedProjectsSection: React.FC<AssociatedProjectsSectionProps> = ({ projects }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between mb-unit-sm">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">folder_special</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
            Associated Projects
          </h2>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary">
          {projects.length} {projects.length === 1 ? 'Product Scope' : 'Product Scopes'}
        </span>
      </div>

      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-sm">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-unit-xs">
                  <span className="font-label-md text-label-md font-semibold text-on-surface">
                    {proj.name}
                  </span>
                  <span className="font-caption-xs text-caption-xs text-primary font-mono font-medium">
                    {proj.linkedAssetsCount} Linked Assets
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {proj.description}
                </p>
              </div>

              {proj.mappedServers.length > 0 && (
                <div className="flex items-center gap-unit-xs mt-unit-sm flex-wrap">
                  <span className="font-caption-xs text-caption-xs text-secondary">Servers:</span>
                  {proj.mappedServers.map((srv, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-caption-xs text-caption-xs"
                    >
                      {srv}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-unit-md text-center text-secondary text-body-sm bg-surface-container-low rounded-lg">
          No project associations recorded for this provider account.
        </div>
      )}
    </div>
  );
};
