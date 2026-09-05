import React, { useState, useRef } from 'react';
import {
  InfrastructureNode,
  InfrastructureEdge,
  GraphFilterType,
} from '../infrastructureMap.types';

interface TopologyCanvasProps {
  nodes: InfrastructureNode[];
  edges: InfrastructureEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: InfrastructureNode) => void;
  activeFilter: GraphFilterType;
  searchQuery: string;
  isFocusMode: boolean;
}

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  activeFilter,
  searchQuery,
  isFocusMode,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setZoom((z) => Math.min(Number((z + 0.15).toFixed(2)), 1.6));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(Number((z - 0.15).toFixed(2)), 0.6));
  };

  const handleRecenter = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only initiate pan if clicking the viewport background
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const isNodeDimmed = (node: InfrastructureNode) => {
    // Search Query matching
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLabel = node.label.toLowerCase().includes(q);
      const matchTitle = node.title.toLowerCase().includes(q);
      const matchSubtext = node.subtext.toLowerCase().includes(q);
      const matchProvider = node.metadata.providerCompany?.toLowerCase().includes(q);
      const matchIP = node.metadata.ipAddress?.toLowerCase().includes(q);
      const matchEmail = node.metadata.accountOwnerEmail?.toLowerCase().includes(q);
      if (!matchLabel && !matchTitle && !matchSubtext && !matchProvider && !matchIP && !matchEmail) {
        return true;
      }
    }

    // Filter pill matching
    if (activeFilter !== 'all' && node.nodeType !== activeFilter) {
      return true;
    }

    // Focus mode dimming (dims everything except selected node & directly connected chain)
    if (isFocusMode && selectedNodeId) {
      const isConnected = edges.some(
        (e) =>
          (e.sourceNodeId === selectedNodeId && e.targetNodeId === node.id) ||
          (e.targetNodeId === selectedNodeId && e.sourceNodeId === node.id)
      );
      if (node.id !== selectedNodeId && !isConnected && node.metadata.upstreamNodeId !== selectedNodeId) {
        return true;
      }
    }

    return false;
  };

  return (
    <div className="relative w-full h-[760px] bg-surface-container-lowest rounded-xl shadow-micro border border-outline-variant/30 overflow-hidden flex flex-col select-none">
      {/* Canvas Top Bar */}
      <div className="h-10 px-unit-md bg-surface-container-low flex items-center justify-between z-20 border-b border-outline-variant/30">
        <div className="flex items-center gap-unit-sm">
          <span className="font-caption-xs text-caption-xs uppercase tracking-wider text-secondary font-semibold">
            Topology Canvas
          </span>
          <span className="font-caption-xs text-caption-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium border border-outline-variant/20">
            Stored Relationship Records
          </span>
        </div>

        {/* Zoom & Viewport Controls */}
        <div className="flex items-center gap-unit-xs">
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">zoom_in</span>
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">zoom_out</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Canvas"
            className="w-7 h-7 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-colors shadow-xs border border-outline-variant/30 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">filter_center_focus</span>
          </button>

          <span className="text-secondary text-[12px] px-1 font-label-mono text-label-mono min-w-[40px] text-right font-medium">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Interactive Graph Viewport */}
      <div
        id="canvasViewport"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 w-full h-full overflow-hidden bg-[#fbfcff] cursor-grab active:cursor-grabbing"
      >
        {/* Subtle Radial Dot Grid Backdrop */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            transform: `translate(${panOffset.x % 20}px, ${panOffset.y % 20}px)`,
          }}
        />

        {/* Zoom & Pan Transform Container */}
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            width: '1600px',
            height: '1200px',
          }}
          className="relative"
        >
          {/* SVG Graph Connectors Layer */}
          <svg
            className="absolute inset-0 w-[1600px] h-[1200px] pointer-events-none z-0"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="activeGrad" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#3525cd" stopOpacity="0.9" />
              </linearGradient>

              <marker
                id="arrow"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="7"
                refY="5"
                viewBox="0 0 10 10"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
              </marker>

              <marker
                id="arrowActive"
                markerHeight="6"
                markerWidth="6"
                orient="auto-start-reverse"
                refX="7"
                refY="5"
                viewBox="0 0 10 10"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3525cd" />
              </marker>
            </defs>

            {edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                stroke={edge.isActive ? '#3525cd' : '#94a3b8'}
                strokeWidth={edge.isActive ? 2 : 1.75}
                strokeDasharray={edge.isDashed ? '4 3' : undefined}
                markerEnd={edge.isActive ? 'url(#arrowActive)' : 'url(#arrow)'}
              />
            ))}
          </svg>

          {/* Graph Nodes Layer */}
          <div className="relative w-[1600px] h-[1200px] z-10">
            {nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isDimmed = isNodeDimmed(node);

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${node.width}px`,
                  }}
                  className={`graph-node absolute p-unit-xs rounded-lg bg-surface-container-lowest shadow-micro cursor-pointer transition-all hover:-translate-y-0.5 border ${
                    isSelected
                      ? 'ring-2 ring-primary ring-offset-2 shadow-md border-primary'
                      : 'border-outline-variant/30 hover:shadow-md'
                  } ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${node.dotColor}`} />
                      <span
                        className={`font-caption-xs text-caption-xs font-bold uppercase tracking-wider ${node.badgeTextColor}`}
                      >
                        {node.categoryLabel}
                      </span>
                    </div>

                    {node.metadata.isPrimaryNode && (
                      <span className="font-caption-xs text-caption-xs px-1.5 py-0.2 rounded bg-surface-container text-secondary font-semibold">
                        Inventory Record
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <div
                    className={`${
                      node.nodeType === 'server'
                        ? 'font-headline-sm text-headline-sm font-semibold'
                        : 'font-label-mono text-label-mono font-semibold'
                    } text-on-surface truncate`}
                  >
                    {node.title}
                  </div>

                  {/* Subtext */}
                  <div className="font-caption-xs text-caption-xs text-secondary mt-0.5 truncate">
                    {node.subtext}
                  </div>

                  {/* Special Server Specs Box */}
                  {node.metadata.specs && (
                    <div className="mt-2 pt-1 flex items-center justify-between font-caption-xs text-caption-xs text-secondary bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant/20">
                      <span>{node.metadata.specs}</span>
                      <span className="font-semibold text-primary">
                        {node.metadata.monthlyCost}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Canvas Footer Bar */}
      <div className="p-unit-sm bg-surface-container-low flex flex-wrap items-center justify-between text-secondary font-caption-xs text-caption-xs border-t border-outline-variant/30">
        <div className="flex items-center gap-unit-md">
          <span className="flex items-center gap-1.5 font-medium text-on-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" /> 4 Relationship Clusters
          </span>
          <span>Showing {nodes.length} nodes, {edges.length} directional link bindings</span>
        </div>
        <div className="flex items-center gap-unit-xs">
          <span className="material-symbols-outlined text-[14px] text-primary">touch_app</span>
          <span>Click any node to inspect relationship details</span>
        </div>
      </div>
    </div>
  );
};
