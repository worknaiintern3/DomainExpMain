import React from 'react';
import { AccountRelationshipNode } from '../providerAccountDetails.types';

interface AccountRelationshipMapProps {
  nodes: AccountRelationshipNode[];
}

export const AccountRelationshipMap: React.FC<AccountRelationshipMapProps> = ({ nodes }) => {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-unit-md shadow-sm border border-outline-variant/30">
      <div className="flex items-center justify-between pb-unit-xs">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-[16px]">account_tree</span>
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            ACCOUNT RELATIONSHIP MAP
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary font-mono px-2 py-0.5 rounded bg-surface-container-low">
          Mapped Asset Relationships
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-unit-xs mt-unit-xs">
        {nodes.map((node, index) => {
          const isHighlight = node.isActive;
          return (
            <div
              key={index}
              className={`flex flex-col p-unit-xs px-unit-sm rounded-lg transition-colors ${
                isHighlight
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-surface-container-low hover:bg-surface-container'
              }`}
            >
              <span
                className={`font-caption-xs text-caption-xs truncate ${
                  isHighlight ? 'text-primary font-medium' : 'text-secondary'
                }`}
              >
                {node.label}
              </span>
              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                <span
                  className={`material-symbols-outlined text-[14px] shrink-0 ${
                    node.iconColor || (isHighlight ? 'text-primary' : 'text-secondary')
                  }`}
                >
                  {node.icon}
                </span>
                <span
                  className={`truncate font-semibold ${
                    node.label.includes('Email') || node.label.includes('Domain') || node.label.includes('Nodes')
                      ? 'font-label-mono text-label-mono'
                      : 'font-label-md text-label-md'
                  } ${isHighlight ? 'text-primary' : 'text-on-surface'}`}
                  title={node.value}
                >
                  {node.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
