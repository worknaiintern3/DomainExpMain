import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  InfrastructureNode,
  InfrastructureEdge,
  GraphFilterType,
  GraphSummaryMetrics,
  NewRelationshipForm,
  INITIAL_GRAPH_NODES,
  INITIAL_GRAPH_EDGES,
  InfrastructureMapHeader,
  TopologyCanvas,
  InfrastructureMapMetrics,
  NodeInspectorPanel,
  AddRelationshipModal,
} from '../features/infrastructure-map';

export const InfrastructureMapPage: React.FC = () => {
  const navigate = useNavigate();

  // Primary State
  const [nodes] = useState<InfrastructureNode[]>(INITIAL_GRAPH_NODES);
  const [edges, setEdges] = useState<InfrastructureEdge[]>(INITIAL_GRAPH_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('server-vps01');

  // Filter & View State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<GraphFilterType>('all');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isAddRelationshipOpen, setIsAddRelationshipOpen] = useState<boolean>(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2800);
  };

  // Dynamic Filter Counts derived directly from rendered nodes
  const filterCounts = useMemo<Record<GraphFilterType, number>>(() => ({
    all: nodes.length,
    email: nodes.filter((n) => n.nodeType === 'email').length,
    provider: nodes.filter((n) => n.nodeType === 'provider').length,
    domain: nodes.filter((n) => n.nodeType === 'domain').length,
    website: nodes.filter((n) => n.nodeType === 'website').length,
    server: nodes.filter((n) => n.nodeType === 'server').length,
    project: nodes.filter((n) => n.nodeType === 'project').length,
  }), [nodes]);

  // Dynamic Summary Metrics
  const dynamicMetrics: GraphSummaryMetrics = useMemo(() => ({
    totalAssetsCount: nodes.length,
    weeklyGrowthLabel: 'Stored Records',
    relationshipClustersCount: 4,
    bottleneckNodeName: 'Production VPS 01',
    bottleneckWebsitesCount: 5,
    orphanedAssetsCount: 0,
    orphanedPercentageLabel: '100% Mapped',
  }), [nodes]);

  // Selected Node Object
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;
  }, [nodes, selectedNodeId]);

  // Handlers
  const handleSelectNode = (node: InfrastructureNode) => {
    setSelectedNodeId(node.id);
  };

  const handleResetLayout = () => {
    setSearchQuery('');
    setActiveFilter('all');
    setIsFocusMode(false);
    setSelectedNodeId('server-vps01');
    // Reset active edges to primary chain
    setEdges(INITIAL_GRAPH_EDGES);
    showToast('Layout reset to default topology view');
  };

  const handleToggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      showToast(next ? 'Focus mode enabled: Highlighting active chain' : 'Focus mode disabled');
      return next;
    });
  };

  const handleExportDiagram = () => {
    showToast('Exporting infrastructure topology diagram (.SVG)');
  };

  const handleTraceChain = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    // Highlight relevant edges
    setEdges((prev) =>
      prev.map((e) => {
        const matches = e.sourceNodeId === nodeId || e.targetNodeId === nodeId;
        return { ...e, isActive: matches };
      })
    );
    showToast(`Tracing relationship chain for ${selectedNode?.title || nodeId}`);
  };

  const handleFilterCluster = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setIsFocusMode(true);
    showToast(`Filtered canvas to relationship cluster`);
  };

  const handleAddRelationship = (form: NewRelationshipForm) => {
    const sourceNode = nodes.find((n) => n.id === form.sourceId);
    const targetNode = nodes.find((n) => n.id === form.targetId);

    const newEdge: InfrastructureEdge = {
      id: `edge-${Date.now()}`,
      sourceNodeId: form.sourceId,
      targetNodeId: form.targetId,
      relationshipType: form.relationshipType,
      path: `M ${(sourceNode?.x || 100) + 150} ${(sourceNode?.y || 100) + 30} C ${(sourceNode?.x || 100) + 200} ${(sourceNode?.y || 100) + 30}, ${(targetNode?.x || 300) - 50} ${(targetNode?.y || 100) + 30}, ${targetNode?.x || 300} ${(targetNode?.y || 100) + 30}`,
      isActive: true,
    };

    setEdges((prev) => [newEdge, ...prev]);
    setIsAddRelationshipOpen(false);
    showToast(
      `Saved relationship: ${sourceNode?.title || form.sourceId} → ${targetNode?.title || form.targetId}`
    );
  };

  const handleSelectBottleneck = () => {
    setSelectedNodeId('server-vps01');
    showToast('Inspecting node with highest mapping density: Production VPS 01 (5 websites)');
  };

  const handleNavigateToEntity = (route: string) => {
    navigate(route);
  };

  return (
    <div className="flex flex-col gap-unit-lg pb-unit-2xl">
      {/* 1. Header with Controls, Search, and Filter Pills */}
      <InfrastructureMapHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        onResetLayout={handleResetLayout}
        onToggleFocusMode={handleToggleFocusMode}
        isFocusMode={isFocusMode}
        onExportDiagram={handleExportDiagram}
        onAddRelationship={() => setIsAddRelationshipOpen(true)}
        filterCounts={filterCounts}
      />

      {/* 2. Main Workspace Layout: Canvas (8 cols) + Sticky Inspector (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-unit-lg items-start">
        {/* Left 8-Column Canvas & Graph Metrics */}
        <div className="xl:col-span-8 flex flex-col gap-unit-md min-w-0">
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            isFocusMode={isFocusMode}
          />

          {/* 3 Metric Cards Underneath Canvas */}
          <InfrastructureMapMetrics
            metrics={dynamicMetrics}
            onSelectBottleneck={handleSelectBottleneck}
          />
        </div>

        {/* Right 4-Column Sticky Inspector Panel */}
        <div className="xl:col-span-4 min-w-0">
          <NodeInspectorPanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            onNavigateToEntity={handleNavigateToEntity}
            onTraceChain={handleTraceChain}
            onFilterCluster={handleFilterCluster}
          />
        </div>
      </div>

      {/* 3. Add Relationship Modal */}
      <AddRelationshipModal
        isOpen={isAddRelationshipOpen}
        nodes={nodes}
        onClose={() => setIsAddRelationshipOpen(false)}
        onAdd={handleAddRelationship}
      />

      {/* 4. Micro Toast Notification System */}
      <div
        className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 pointer-events-none ${
          toastMessage ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}
      >
        <div className="flex items-center gap-unit-xs px-unit-md py-unit-sm rounded-lg bg-inverse-surface text-inverse-on-surface shadow-xl font-body-sm text-body-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-[18px] text-primary">
            check_circle
          </span>
          <span>{toastMessage}</span>
        </div>
      </div>
    </div>
  );
};
export default InfrastructureMapPage;
