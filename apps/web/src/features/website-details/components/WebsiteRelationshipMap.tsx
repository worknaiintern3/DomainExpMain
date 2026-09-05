import React from 'react';
import { Link } from 'react-router-dom';
import { WebsiteRelationshipNode } from '../websiteDetails.types';

interface WebsiteRelationshipMapProps {
  nodes: WebsiteRelationshipNode[];
}

export const WebsiteRelationshipMap: React.FC<WebsiteRelationshipMapProps> = ({ nodes }) => {
  return (
    <div className="mt-unit-md bg-surface-container-lowest rounded-xl shadow-sm p-unit-base border border-outline-variant/30">
      <div className="flex items-center justify-between pb-unit-sm">
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
          <span className="font-label-md text-label-md text-on-surface font-semibold tracking-tight uppercase">
            Infrastructure Relationship Map
          </span>
        </div>
        <span className="font-caption-xs text-caption-xs text-secondary font-label-mono">
          Mapped asset relationships
        </span>
      </div>

      <div className="bg-surface-container-low p-unit-md rounded-lg overflow-x-auto border border-outline-variant/20">
        <div className="flex items-center justify-between min-w-[860px] gap-unit-xs">
          {nodes.map((node, index) => {
            const isLast = index === nodes.length - 1;
            const content = (
              <div
                className={`flex flex-col p-unit-sm rounded-lg shadow-sm w-48 shrink-0 transition-transform hover:-translate-y-0.5 border ${
                  node.isActive
                    ? 'bg-gradient-to-br from-surface-container-lowest to-surface-container-low border-primary/40 relative'
                    : 'bg-surface-container-lowest border-outline-variant/20'
                }`}
              >
                {node.isActive && (
                  <div className="absolute top-1.5 right-2">
                    <span className="w-2 h-2 rounded-full bg-primary block" />
                  </div>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-caption-xs text-caption-xs uppercase font-semibold ${
                      node.isActive ? 'text-primary' : 'text-secondary'
                    }`}
                  >
                    {node.title}
                  </span>
                  <span className="material-symbols-outlined text-primary text-[14px]">
                    {node.icon}
                  </span>
                </div>
                <span
                  className={`font-label-md text-label-md font-bold truncate ${
                    node.isActive ? 'text-on-surface' : 'text-on-surface'
                  }`}
                >
                  {node.value}
                </span>
                <span
                  className={`font-caption-xs text-caption-xs mt-0.5 ${
                    node.isActive
                      ? 'text-on-surface-variant font-label-mono'
                      : 'text-primary'
                  }`}
                >
                  {node.badge}
                </span>
              </div>
            );

            return (
              <React.Fragment key={node.title}>
                {node.link ? (
                  <Link to={node.link} className="hover:opacity-90 transition-opacity">
                    {content}
                  </Link>
                ) : (
                  content
                )}
                {!isLast && (
                  <div className="flex items-center text-primary shrink-0">
                    <span className="w-4 h-0.5 bg-secondary-container" />
                    <span className="material-symbols-outlined text-[16px] -ml-1 text-primary">
                      chevron_right
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
