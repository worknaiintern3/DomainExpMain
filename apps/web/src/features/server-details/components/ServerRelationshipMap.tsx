import React from 'react';
import { RelationshipNode } from '../serverDetails.types';

interface ServerRelationshipMapProps {
  nodes: RelationshipNode[];
}

export const ServerRelationshipMap: React.FC<ServerRelationshipMapProps> = ({ nodes }) => {
  return (
    <div className="p-unit-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col gap-unit-md mb-unit-lg border border-outline-variant/30">
      <div className="flex items-center gap-unit-sm">
        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
        <span className="font-caption-xs text-caption-xs text-secondary uppercase tracking-wider font-semibold">
          Infrastructure Relationship Chain
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-unit-xs text-caption-xs font-caption-xs">
        {nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            {index > 0 && (
              <span className="material-symbols-outlined text-outline-variant text-[16px]">
                arrow_forward
              </span>
            )}
            <div
              className={`flex items-center gap-unit-xs px-unit-sm py-unit-xs rounded-lg transition-all ${
                node.isCurrent
                  ? 'bg-primary text-on-primary shadow-sm font-semibold'
                  : node.type === 'domains'
                  ? 'bg-surface-container text-on-surface font-label-mono border border-outline-variant/20'
                  : 'bg-surface-container-high text-on-surface border border-outline-variant/20'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  node.isCurrent ? 'text-on-primary' : 'text-primary'
                }`}
              >
                {node.icon}
              </span>
              <span className={node.type === 'account' ? 'font-label-mono font-medium' : 'font-medium'}>
                {node.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
