import React from 'react';
import { InfrastructureNode, InfrastructureEdge } from '../infrastructureMap.types';

interface NodeInspectorPanelProps {
  node: InfrastructureNode | null;
  nodes?: InfrastructureNode[];
  edges?: InfrastructureEdge[];
  onNavigateToEntity: (route: string) => void;
  onTraceChain: (nodeId: string) => void;
  onFilterCluster: (nodeId: string) => void;
}

export const NodeInspectorPanel: React.FC<NodeInspectorPanelProps> = ({
  node,
  nodes = [],
  edges = [],
  onNavigateToEntity,
  onTraceChain,
  onFilterCluster,
}) => {
  if (!node) {
    return (
      <div className="rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 p-unit-lg flex flex-col items-center justify-center text-center gap-unit-sm min-h-[360px]">
        <span className="material-symbols-outlined text-[32px] text-secondary">
          touch_app
        </span>
        <h3 className="font-label-md text-on-surface font-semibold">
          Select any node to inspect
        </h3>
        <p className="font-caption-xs text-secondary max-w-xs">
          Click any email, provider account, domain, server, or application node on the canvas to inspect mapped upstream and downstream bindings.
        </p>
      </div>
    );
  }

  const getCategoryBadgeClass = () => {
    switch (node.nodeType) {
      case 'server':
        return 'bg-amber-100 text-amber-800';
      case 'email':
        return 'bg-purple-100 text-purple-800';
      case 'provider':
        return 'bg-indigo-100 text-indigo-800';
      case 'domain':
        return 'bg-sky-100 text-sky-800';
      case 'website':
        return 'bg-emerald-100 text-emerald-800';
      case 'project':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-surface-container text-secondary';
    }
  };

  // Dynamic incoming and outgoing edge computation
  const incomingEdges = edges.filter((e) => e.targetNodeId === node.id);
  const upstreamNodes = incomingEdges
    .map((e) => nodes.find((n) => n.id === e.sourceNodeId))
    .filter(Boolean) as InfrastructureNode[];

  const outgoingEdges = edges.filter((e) => e.sourceNodeId === node.id);
  const downstreamNodes = outgoingEdges
    .map((e) => nodes.find((n) => n.id === e.targetNodeId))
    .filter(Boolean) as InfrastructureNode[];

  const downstreamCount = node.metadata.downstreamItems?.length || downstreamNodes.length;
  const associatedDomains = node.metadata.associatedDomains || [];
  const associatedProjects = node.metadata.associatedProjects || [];

  return (
    <div
      id="inspectorPanel"
      className="rounded-xl bg-surface-container-lowest shadow-micro border border-outline-variant/30 p-unit-lg flex flex-col gap-unit-md sticky top-[calc(var(--header-height)+1.5rem)]"
    >
      {/* 1. Header Section */}
      <div className="flex flex-col gap-unit-xs">
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full font-caption-xs text-caption-xs font-semibold ${getCategoryBadgeClass()}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${node.dotColor}`} />
            <span>{node.categoryLabel}</span>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-caption-xs text-caption-xs font-semibold border border-outline-variant/20">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            {node.metadata.statusText || 'Mapped Record • Inventory'}
          </span>
        </div>

        <div className="flex items-start justify-between gap-unit-sm mt-1">
          <div className="flex flex-col min-w-0">
            <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight truncate">
              {node.title}
            </h2>
            <span className="font-label-mono text-label-mono text-primary font-medium mt-0.5 truncate">
              {node.metadata.ipAddress || node.subtext}
            </span>
          </div>

          <button
            type="button"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-secondary hover:text-on-surface cursor-pointer shrink-0"
            title="Node options"
          >
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metadata & Specs Grid */}
      <div className="grid grid-cols-2 gap-unit-sm p-unit-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
        {/* Provider */}
        <div className="flex flex-col gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            Provider
          </span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">dns</span>
            <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
              {node.metadata.providerCompany || (node.nodeType === 'project' ? 'Internal Project' : 'Hostinger')}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary truncate">
            {node.metadata.upstreamNodeLabel || (node.nodeType === 'project' ? 'WorknAi Portfolio' : 'WorknAi Main Account')}
          </span>
        </div>

        {/* Account Owner */}
        <div className="flex flex-col gap-unit-2xs">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            Account Owner
          </span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">mail</span>
            <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
              {node.metadata.accountOwnerEmail || 'infra@worknai.com'}
            </span>
          </div>
          <span className="font-caption-xs text-caption-xs text-secondary">Cloud Ops Org</span>
        </div>

        {/* Compute Specs / Framework */}
        <div className="flex flex-col gap-unit-2xs pt-unit-xs border-t border-surface-container/40">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            {node.nodeType === 'server' ? 'Compute Specs' : node.nodeType === 'project' ? 'Entity Type' : 'Type / Runtime'}
          </span>
          <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
            {node.metadata.specs || node.metadata.framework || (node.nodeType === 'project' ? 'Core Project' : 'Managed Infrastructure')}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            {node.metadata.storage || (node.nodeType === 'project' ? 'Active Scope' : 'Standard Storage')}
          </span>
        </div>

        {/* Monthly Cost & Region */}
        <div className="flex flex-col gap-unit-2xs pt-unit-xs border-t border-surface-container/40">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            Monthly Cost &amp; Region
          </span>
          <span className="font-body-sm text-body-sm font-semibold text-primary">
            {node.metadata.monthlyCost || 'Included in Plan'}
          </span>
          <span className="font-caption-xs text-caption-xs text-secondary">
            {node.metadata.region || 'Default Region'}
          </span>
        </div>
      </div>

      {/* 3. Monitoring Notice (Explicitly Not Connected for Servers & Compute Nodes) */}
      {node.nodeType === 'server' && (
        <div className="p-unit-sm rounded-lg bg-surface-container-low flex flex-col gap-unit-2xs border border-outline-variant/20">
          <div className="flex items-center justify-between">
            <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
              Monitoring
            </span>
            <span className="font-caption-xs text-caption-xs px-2 py-0.5 rounded bg-surface-container text-secondary font-medium">
              Not Connected
            </span>
          </div>
          <p className="font-caption-xs text-caption-xs text-secondary">
            Runtime monitoring requires a connected monitoring integration.
          </p>
        </div>
      )}

      {/* 4. Connected Upstream Chain */}
      <div className="flex flex-col gap-unit-xs">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold tracking-wider">
            Connected Upstream Chain
          </span>
          <span className="font-caption-xs text-caption-xs text-primary font-medium">
            {upstreamNodes.length === 1 ? '1 Hop' : upstreamNodes.length > 1 ? `${upstreamNodes.length} Hops` : 'Root'}
          </span>
        </div>

        {upstreamNodes.length > 0 ? (
          upstreamNodes.map((uNode) => (
            <div
              key={uNode.id}
              className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20"
            >
              <div className="flex items-center gap-unit-sm min-w-0">
                <div className="w-7 h-7 rounded bg-[#e0e7ff] text-[#4f46e5] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px]">account_tree</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                    {uNode.title}
                  </span>
                  <span className="font-caption-xs text-caption-xs text-secondary font-label-mono truncate">
                    {uNode.subtext || uNode.categoryLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onTraceChain(uNode.id)}
                className="text-primary hover:text-tertiary transition-colors cursor-pointer"
                title="Trace Upstream"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
              </button>
            </div>
          ))
        ) : node.metadata.upstreamNodeLabel ? (
          <div className="p-unit-sm rounded-lg bg-surface-container-low flex items-center justify-between border border-outline-variant/20">
            <div className="flex items-center gap-unit-sm min-w-0">
              <div className="w-7 h-7 rounded bg-[#e0e7ff] text-[#4f46e5] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px]">account_tree</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                  {node.metadata.upstreamNodeLabel}
                </span>
                <span className="font-caption-xs text-caption-xs text-secondary font-label-mono truncate">
                  {node.metadata.upstreamNodeSubtext || 'Stored Upstream Reference'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onTraceChain(node.id)}
              className="text-primary hover:text-tertiary transition-colors cursor-pointer"
              title="Trace Upstream"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-surface-container-low text-secondary font-caption-xs text-caption-xs border border-outline-variant/20">
            Root Entity (No upstream dependencies mapped)
          </div>
        )}
      </div>

      {/* 5. Connected Downstream (Hosted Websites & Apps) */}
      <div className="flex flex-col gap-unit-xs">
        <div className="flex items-center justify-between">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold tracking-wider">
            Connected Downstream ({downstreamCount} {downstreamCount === 1 ? 'Item' : 'Items'})
          </span>
          <span className="font-caption-xs text-caption-xs px-1.5 py-0.2 rounded bg-surface-container text-secondary font-mono">
            {downstreamCount} {downstreamCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="flex flex-col gap-unit-xs max-h-[220px] overflow-y-auto pr-1">
          {node.metadata.downstreamItems && node.metadata.downstreamItems.length > 0 ? (
            node.metadata.downstreamItems.map((item) => (
              <div
                key={item.id}
                className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between border border-outline-variant/20"
              >
                <div className="flex items-center gap-unit-xs min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                      {item.title}
                    </span>
                    <span className="font-label-mono text-caption-xs text-secondary truncate">
                      {item.subtext}
                    </span>
                  </div>
                </div>
                {item.port && (
                  <span className="font-caption-xs text-caption-xs text-secondary shrink-0 font-label-mono">
                    {item.port}
                  </span>
                )}
              </div>
            ))
          ) : downstreamNodes.length > 0 ? (
            downstreamNodes.map((dNode) => (
              <div
                key={dNode.id}
                className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between border border-outline-variant/20"
              >
                <div className="flex items-center gap-unit-xs min-w-0">
                  <span className={`w-2 h-2 rounded-full ${dNode.dotColor} shrink-0`} />
                  <div className="flex flex-col min-w-0">
                    <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                      {dNode.title}
                    </span>
                    <span className="font-label-mono text-caption-xs text-secondary truncate">
                      {dNode.subtext || dNode.categoryLabel}
                    </span>
                  </div>
                </div>
                {dNode.metadata.port && (
                  <span className="font-caption-xs text-caption-xs text-secondary shrink-0 font-label-mono">
                    {dNode.metadata.port}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="p-2 rounded-lg bg-surface-container-low text-secondary font-caption-xs text-caption-xs border border-outline-variant/20">
              Terminal Node (No downstream assets mapped)
            </div>
          )}
        </div>
      </div>

      {/* 6. Associated Domains & Projects */}
      <div className="grid grid-cols-2 gap-unit-sm">
        <div className="flex flex-col gap-1 p-unit-xs rounded bg-surface-container-low border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            Associated Domains ({associatedDomains.length})
          </span>
          {associatedDomains.length > 0 ? (
            associatedDomains.map((d) => (
              <span key={d} className="font-label-mono text-caption-xs font-medium text-on-surface truncate">
                {d}
              </span>
            ))
          ) : (
            <span className="font-caption-xs text-caption-xs text-secondary">None mapped</span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-unit-xs rounded bg-surface-container-low border border-outline-variant/20">
          <span className="font-caption-xs text-caption-xs uppercase text-secondary font-semibold">
            Projects ({associatedProjects.length})
          </span>
          {associatedProjects.length > 0 ? (
            associatedProjects.map((p) => (
              <span key={p} className="font-body-sm text-body-sm font-semibold text-on-surface truncate">
                {p}
              </span>
            ))
          ) : (
            <span className="font-caption-xs text-caption-xs text-secondary">None mapped</span>
          )}
        </div>
      </div>

      {/* 7. Action Buttons Cluster */}
      <div className="flex flex-col gap-unit-xs mt-auto pt-unit-xs">
        {node.nodeType !== 'project' ? (
          <button
            type="button"
            onClick={() => onNavigateToEntity(node.metadata.targetRoute || '/servers')}
            className="w-full h-9 px-unit-md flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span>View Full Details Page</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigateToEntity('/overview')}
            className="w-full h-9 px-unit-md flex items-center justify-center gap-unit-xs rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-tertiary transition-colors shadow-micro cursor-pointer font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            <span>View Portfolio Overview</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-unit-xs">
          <button
            type="button"
            onClick={() => onTraceChain(node.id)}
            className="h-8 px-unit-sm flex items-center justify-center gap-1 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-caption-xs text-caption-xs font-semibold cursor-pointer border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">alt_route</span>
            <span>Trace Chain</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterCluster(node.id)}
            className="h-8 px-unit-sm flex items-center justify-center gap-1 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-caption-xs text-caption-xs font-semibold cursor-pointer border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            <span>Filter Cluster</span>
          </button>
        </div>
      </div>
    </div>
  );
};
