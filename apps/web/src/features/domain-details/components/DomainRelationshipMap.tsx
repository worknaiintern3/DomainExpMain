import React from 'react';
import { Link } from 'react-router-dom';
import { DomainRelationshipNode } from '../domainDetails.types';

interface DomainRelationshipMapProps {
  nodes: DomainRelationshipNode[];
}

export const DomainRelationshipMap: React.FC<DomainRelationshipMapProps> = ({ nodes }) => {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between mb-unit-md">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold uppercase tracking-tight">
            DOMAIN RELATIONSHIP MAP
          </h2>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary px-unit-xs py-unit-2xs bg-surface-container rounded font-label-mono border border-outline-variant/20">
          Mapped Asset Relationships
        </span>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-unit-lg leading-relaxed">
        Dependency hierarchy routing graph from registration credentials to edge DNS, hosting server, and workspace project endpoints.
      </p>

      {/* Visual Flow Horizontal Strip */}
      <div className="bg-surface-container-low rounded-xl p-unit-md overflow-x-auto border border-outline-variant/20">
        <div className="flex items-center justify-between min-w-[860px] gap-unit-xs">
          {nodes.map((node, index) => {
            const isLast = index === nodes.length - 1;
            const nodeContent = (
              <div
                className={`flex flex-col items-center text-center p-unit-sm rounded-lg shadow-sm shrink-0 transition-transform ${
                  node.isCenterpiece
                    ? 'bg-primary text-on-primary w-36 shadow-md scale-105 border-0 ring-2 ring-primary/30'
                    : 'bg-surface-container-lowest text-on-surface w-32 border border-outline-variant/30 hover:border-primary/40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-unit-xs ${
                    node.isCenterpiece
                      ? 'bg-on-primary/20 text-on-primary'
                      : 'bg-surface-container text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{node.icon}</span>
                </div>
                <span
                  className={`font-caption-xs text-caption-xs uppercase font-semibold ${
                    node.isCenterpiece ? 'text-on-primary/80' : 'text-secondary'
                  }`}
                >
                  {node.label}
                </span>
                <span
                  className={`font-label-mono text-label-mono text-[11px] font-semibold truncate w-full mt-0.5 ${
                    node.isCenterpiece ? 'text-on-primary font-bold' : 'text-on-surface'
                  }`}
                  title={node.value}
                >
                  {node.value}
                </span>
                <span
                  className={`text-[9px] mt-unit-2xs px-1.5 py-0.5 rounded-full font-medium ${
                    node.isCenterpiece
                      ? 'text-on-primary bg-on-primary/20'
                      : node.provenance === 'DNS Retrieved'
                      ? 'text-[#065f46] bg-[#ecfdf5]'
                      : node.provenance === 'RDAP Retrieved'
                      ? 'text-primary bg-surface-container'
                      : 'text-tertiary bg-surface-container'
                  }`}
                >
                  {node.tag}
                </span>
              </div>
            );

            return (
              <React.Fragment key={node.step}>
                {node.linkTo ? (
                  <Link to={node.linkTo} className="block group">
                    {nodeContent}
                  </Link>
                ) : (
                  nodeContent
                )}

                {!isLast && (
                  <span className="material-symbols-outlined text-secondary-fixed-dim text-[18px] shrink-0">
                    trending_flat
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
