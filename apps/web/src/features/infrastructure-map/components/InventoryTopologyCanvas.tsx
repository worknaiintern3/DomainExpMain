import React, { useEffect, useMemo, useRef, useState } from 'react';

import type {
  EntityReference,
  GraphEntityKind,
  InventoryRelationship,
  RelationshipType,
} from '@/api/types';
import { Button } from '@/components/common/Button';

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 620;
const NODE_WIDTH = 190;
const NODE_HEIGHT = 72;
const NODE_GAP = 112;
const MIN_SCALE = 0.035;
const MAX_SCALE = 2.5;

const KIND_ORDER: readonly GraphEntityKind[] = [
  'PROJECT',
  'WEBSITE_APPLICATION',
  'DOMAIN',
  'SERVER',
  'CLOUD_RESOURCE',
];

const KIND_APPEARANCE: Record<GraphEntityKind, {
  accent: string;
  fill: string;
  label: string;
  shortLabel: string;
}> = {
  CLOUD_RESOURCE: { accent: '#9333ea', fill: '#faf5ff', label: 'Cloud resource', shortLabel: 'CLOUD' },
  DOMAIN: { accent: '#0284c7', fill: '#f0f9ff', label: 'Domain', shortLabel: 'DOMAIN' },
  PROJECT: { accent: '#4f46e5', fill: '#eef2ff', label: 'Project', shortLabel: 'PROJECT' },
  SERVER: { accent: '#d97706', fill: '#fffbeb', label: 'Server', shortLabel: 'SERVER' },
  WEBSITE_APPLICATION: { accent: '#059669', fill: '#ecfdf5', label: 'Application', shortLabel: 'APP' },
};

export interface TopologyNode extends EntityReference {
  allRelationshipsArchived: boolean;
  key: string;
  label: string;
  x: number;
  y: number;
}

export interface TopologyEdge {
  archived: boolean;
  id: string;
  parallelOffset: number;
  relationshipType: RelationshipType;
  routeOrder: number;
  sourcePortOffset: number;
  sourceKey: string;
  targetPortOffset: number;
  targetKey: string;
}

export interface TopologyGraph {
  edges: TopologyEdge[];
  nodes: TopologyNode[];
}

interface Point {
  x: number;
  y: number;
}

export interface RoutedTopologyEdge {
  bounds: { maxX: number; maxY: number; minX: number; minY: number };
  end: Point;
  labelX: number;
  labelY: number;
  path: string;
  routedAroundObstacle: boolean;
  start: Point;
}

interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

function entityKey(reference: EntityReference): string {
  return `${reference.entityKind}:${reference.entityId}`;
}

function fallbackLabel(reference: EntityReference): string {
  return `${KIND_APPEARANCE[reference.entityKind].label} ${reference.entityId.slice(0, 8)}...`;
}

function displayRelationshipType(value: RelationshipType): string {
  return value.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
}

function truncateLabel(value: string, maxLength = 25): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

export function buildTopologyGraph(
  relationships: readonly InventoryRelationship[],
  labels: ReadonlyMap<string, string>,
): TopologyGraph {
  const references = new Map<string, EntityReference>();
  const hasTrackedRelationship = new Set<string>();
  const rawEdges = relationships.map((relationship) => {
    const sourceKey = entityKey(relationship.source);
    const targetKey = entityKey(relationship.target);
    references.set(sourceKey, relationship.source);
    references.set(targetKey, relationship.target);
    if (relationship.inventoryState === 'TRACKED') {
      hasTrackedRelationship.add(sourceKey);
      hasTrackedRelationship.add(targetKey);
    }
    return {
      archived: relationship.inventoryState === 'ARCHIVED',
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      sourceKey,
      targetKey,
    };
  });

  const sourceGroups = new Map<string, string[]>();
  const targetGroups = new Map<string, string[]>();
  const pairGroups = new Map<string, string[]>();
  for (const edge of rawEdges) {
    const pairKey = `${edge.sourceKey}>${edge.targetKey}`;
    sourceGroups.set(edge.sourceKey, [...(sourceGroups.get(edge.sourceKey) ?? []), edge.id]);
    targetGroups.set(edge.targetKey, [...(targetGroups.get(edge.targetKey) ?? []), edge.id]);
    pairGroups.set(pairKey, [...(pairGroups.get(pairKey) ?? []), edge.id]);
  }
  for (const group of [...sourceGroups.values(), ...targetGroups.values(), ...pairGroups.values()]) {
    group.sort();
  }

  const centeredOffset = (group: readonly string[], edgeId: string, spread: number): number => {
    if (group.length < 2) return 0;
    return ((group.indexOf(edgeId) / (group.length - 1)) - 0.5) * spread;
  };

  const edges: TopologyEdge[] = rawEdges.map((edge, routeOrder) => ({
    ...edge,
    parallelOffset: centeredOffset(
      pairGroups.get(`${edge.sourceKey}>${edge.targetKey}`) ?? [],
      edge.id,
      34,
    ),
    routeOrder,
    sourcePortOffset: centeredOffset(sourceGroups.get(edge.sourceKey) ?? [], edge.id, 40),
    targetPortOffset: centeredOffset(targetGroups.get(edge.targetKey) ?? [], edge.id, 40),
  }));

  const nodes: TopologyNode[] = [];
  for (const [kindIndex, kind] of KIND_ORDER.entries()) {
    const kindReferences = [...references.entries()]
      .filter(([, reference]) => reference.entityKind === kind)
      .sort(([, left], [, right]) => left.entityId.localeCompare(right.entityId));
    const startY = Math.max(92, (VIEW_HEIGHT - (kindReferences.length - 1) * NODE_GAP) / 2);
    for (const [rowIndex, [key, reference]] of kindReferences.entries()) {
      nodes.push({
        ...reference,
        allRelationshipsArchived: !hasTrackedRelationship.has(key),
        key,
        label: labels.get(key) ?? fallbackLabel(reference),
        x: 126 + kindIndex * 237,
        y: startY + rowIndex * NODE_GAP,
      });
    }
  }

  return { edges, nodes };
}

function fitTransform(graph: TopologyGraph): ViewTransform {
  if (graph.nodes.length === 0) return { scale: 1, x: 0, y: 0 };
  const nodesByKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const routes = graph.edges.flatMap((edge) => {
    const source = nodesByKey.get(edge.sourceKey);
    const target = nodesByKey.get(edge.targetKey);
    return source && target ? [routeTopologyEdge(edge, source, target, graph.nodes)] : [];
  });
  const minX = Math.min(
    ...graph.nodes.map((node) => node.x - NODE_WIDTH / 2),
    ...routes.map((route) => route.bounds.minX),
  );
  const maxX = Math.max(
    ...graph.nodes.map((node) => node.x + NODE_WIDTH / 2),
    ...routes.map((route) => route.bounds.maxX),
  );
  const minY = Math.min(
    ...graph.nodes.map((node) => node.y - NODE_HEIGHT / 2),
    ...routes.map((route) => route.bounds.minY),
  );
  const maxY = Math.max(
    ...graph.nodes.map((node) => node.y + NODE_HEIGHT / 2),
    ...routes.map((route) => route.bounds.maxY),
  );
  const contentWidth = Math.max(NODE_WIDTH, maxX - minX);
  const contentHeight = Math.max(NODE_HEIGHT, maxY - minY);
  const scale = Math.max(
    MIN_SCALE,
    Math.min(1.15, (VIEW_WIDTH - 96) / contentWidth, (VIEW_HEIGHT - 96) / contentHeight),
  );
  return {
    scale,
    x: VIEW_WIDTH / 2 - ((minX + maxX) / 2) * scale,
    y: VIEW_HEIGHT / 2 - ((minY + maxY) / 2) * scale,
  };
}

function segmentIntersectsNode(start: Point, end: Point, node: TopologyNode): boolean {
  const margin = 14;
  const left = node.x - NODE_WIDTH / 2 - margin;
  const right = node.x + NODE_WIDTH / 2 + margin;
  const top = node.y - NODE_HEIGHT / 2 - margin;
  const bottom = node.y + NODE_HEIGHT / 2 + margin;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - left, right - start.x, start.y - top, bottom - start.y];
  let minimum = 0;
  let maximum = 1;

  for (let index = 0; index < p.length; index += 1) {
    const denominator = p[index] ?? 0;
    const numerator = q[index] ?? 0;
    if (denominator === 0) {
      if (numerator < 0) return false;
      continue;
    }
    const ratio = numerator / denominator;
    if (denominator < 0) minimum = Math.max(minimum, ratio);
    else maximum = Math.min(maximum, ratio);
    if (minimum > maximum) return false;
  }
  return true;
}

export function routeTopologyEdge(
  edge: TopologyEdge,
  source: TopologyNode,
  target: TopologyNode,
  nodes: readonly TopologyNode[],
): RoutedTopologyEdge {
  const centerDx = target.x - source.x;
  const centerDy = target.y - source.y;
  const horizontal = Math.abs(centerDx) >= Math.abs(centerDy);
  const direction = horizontal
    ? (centerDx >= 0 ? 1 : -1)
    : (centerDy >= 0 ? 1 : -1);
  const start = horizontal
    ? { x: source.x + direction * NODE_WIDTH / 2, y: source.y + edge.sourcePortOffset }
    : { x: source.x + edge.sourcePortOffset, y: source.y + direction * NODE_HEIGHT / 2 };
  const end = horizontal
    ? { x: target.x - direction * NODE_WIDTH / 2, y: target.y + edge.targetPortOffset }
    : { x: target.x + edge.targetPortOffset, y: target.y - direction * NODE_HEIGHT / 2 };
  const blockers = nodes.filter((node) => (
    node.key !== source.key
    && node.key !== target.key
    && segmentIntersectsNode(start, end, node)
  ));

  if (blockers.length > 0) {
    const layer = Math.floor(edge.routeOrder / 2) * 32;
    if (horizontal) {
      const laneY = edge.routeOrder % 2 === 0
        ? Math.min(...nodes.map((node) => node.y - NODE_HEIGHT / 2)) - 60 - layer
        : Math.max(...nodes.map((node) => node.y + NODE_HEIGHT / 2)) + 60 + layer;
      const startExitX = start.x + direction * 46;
      const endExitX = end.x - direction * 46;
      const minX = Math.min(start.x, end.x, startExitX, endExitX);
      const maxX = Math.max(start.x, end.x, startExitX, endExitX);
      return {
        bounds: {
          maxX,
          maxY: Math.max(start.y, end.y, laneY) + 18,
          minX,
          minY: Math.min(start.y, end.y, laneY) - 18,
        },
        end,
        labelX: (startExitX + endExitX) / 2,
        labelY: laneY,
        path: `M ${start.x} ${start.y} C ${start.x + direction * 24} ${start.y} ${startExitX} ${laneY} ${startExitX} ${laneY} L ${endExitX} ${laneY} C ${end.x - direction * 24} ${laneY} ${end.x - direction * 24} ${end.y} ${end.x} ${end.y}`,
        routedAroundObstacle: true,
        start,
      };
    }

    const laneX = edge.routeOrder % 2 === 0
      ? Math.min(...nodes.map((node) => node.x - NODE_WIDTH / 2)) - 60 - layer
      : Math.max(...nodes.map((node) => node.x + NODE_WIDTH / 2)) + 60 + layer;
    const startExitY = start.y + direction * 46;
    const endExitY = end.y - direction * 46;
    return {
      bounds: {
        maxX: Math.max(start.x, end.x, laneX) + 18,
        maxY: Math.max(start.y, end.y, startExitY, endExitY),
        minX: Math.min(start.x, end.x, laneX) - 18,
        minY: Math.min(start.y, end.y, startExitY, endExitY),
      },
      end,
      labelX: laneX,
      labelY: (startExitY + endExitY) / 2,
      path: `M ${start.x} ${start.y} C ${start.x} ${start.y + direction * 24} ${laneX} ${startExitY} ${laneX} ${startExitY} L ${laneX} ${endExitY} C ${laneX} ${end.y - direction * 24} ${end.x} ${end.y - direction * 24} ${end.x} ${end.y}`,
      routedAroundObstacle: true,
      start,
    };
  }

  const startX = start.x;
  const startY = start.y;
  const endX = end.x;
  const endY = end.y;
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const renderedLabel = `${displayRelationshipType(edge.relationshipType).toUpperCase()}${edge.archived ? ' · ARCHIVED' : ''}`;
  const labelWidth = renderedLabel.length * 6.8 + 20;
  const needsLabelClearance = distance < labelWidth + 28;
  const labelSide = edge.routeOrder % 2 === 0 ? -1 : 1;
  const offset = edge.parallelOffset + (needsLabelClearance ? labelSide * (NODE_HEIGHT + 48) : 0);
  const controlX = (startX + endX) / 2 - (dy / distance) * offset;
  const controlY = (startY + endY) / 2 + (dx / distance) * offset;
  const labelX = (startX + 2 * controlX + endX) / 4;
  const labelY = (startY + 2 * controlY + endY) / 4;
  return {
    bounds: {
      maxX: Math.max(startX, endX, controlX, labelX + labelWidth / 2),
      maxY: Math.max(startY, endY, controlY, labelY + 18),
      minX: Math.min(startX, endX, controlX, labelX - labelWidth / 2),
      minY: Math.min(startY, endY, controlY, labelY - 18),
    },
    end,
    labelX,
    labelY,
    path: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    routedAroundObstacle: false,
    start,
  };
}

export const InventoryTopologyCanvas: React.FC<{
  labels: ReadonlyMap<string, string>;
  relationships: readonly InventoryRelationship[];
  resolvingLabels: boolean;
}> = ({ labels, relationships, resolvingLabels }) => {
  const graph = useMemo(() => buildTopologyGraph(relationships, labels), [labels, relationships]);
  const graphIdentity = useMemo(
    () => relationships.map((relationship) => relationship.id).sort().join(':'),
    [relationships],
  );
  const [transform, setTransform] = useState<ViewTransform>(() => fitTransform(graph));
  const [panning, setPanning] = useState(false);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setTransform(fitTransform(graph));
    // Labels do not change layout; only a different loaded relationship set resets the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphIdentity]);

  const nodesByKey = useMemo(
    () => new Map(graph.nodes.map((node) => [node.key, node])),
    [graph.nodes],
  );

  const zoomBy = (factor: number) => {
    setTransform((current) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      return {
        scale,
        x: VIEW_WIDTH / 2 - (VIEW_WIDTH / 2 - current.x) * (scale / current.scale),
        y: VIEW_HEIGHT / 2 - (VIEW_HEIGHT / 2 - current.y) * (scale / current.scale),
      };
    });
  };

  if (relationships.length === 0) {
    return (
      <section aria-labelledby="visual-topology-title" className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center shadow-sm">
        <span aria-hidden="true" className="material-symbols-outlined text-4xl text-outline">hub</span>
        <h2 className="mt-2 text-headline-sm font-semibold text-on-surface" id="visual-topology-title">Visual topology</h2>
        <p className="mt-1 text-body-sm text-secondary">Add a relationship to build a node-edge view from stored inventory.</p>
        <p className="mt-2 text-caption-xs text-secondary">Stored inventory topology — not live monitoring</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="visual-topology-title" className="overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
      <div className="flex flex-col gap-3 border-b border-outline-variant/30 bg-surface-container-low px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-headline-sm font-semibold text-on-surface" id="visual-topology-title">Visual topology</h2>
            <span className="rounded-full border border-outline-variant/60 bg-surface-container-lowest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary">
              {graph.nodes.length} nodes · {graph.edges.length} edges
            </span>
          </div>
          <p className="mt-1 text-caption-xs text-secondary">Showing topology for loaded relationships</p>
          <p className="text-caption-xs text-secondary">Stored inventory topology — not live monitoring</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Topology view controls">
          <Button aria-label="Zoom out" iconLeading="remove" onClick={() => zoomBy(0.8)} size="sm" />
          <span className="min-w-12 text-center text-caption-xs tabular-nums text-secondary" role="status">
            {Math.round(transform.scale * 100)}%
          </span>
          <Button aria-label="Zoom in" iconLeading="add" onClick={() => zoomBy(1.25)} size="sm" />
          <Button iconLeading="fit_screen" onClick={() => setTransform(fitTransform(graph))} size="sm">Fit</Button>
          <Button iconLeading="restart_alt" onClick={() => setTransform({ scale: 1, x: 0, y: 0 })} size="sm">Reset</Button>
        </div>
      </div>

      <div className="relative bg-gradient-to-br from-slate-50 via-white to-indigo-50/60">
        <svg
          aria-label={`Stored infrastructure topology with ${graph.nodes.length} nodes and ${graph.edges.length} relationships. Drag to pan.`}
          className={`h-[28rem] min-h-96 w-full select-none lg:h-[32rem] ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
            setPanning(true);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const rectangle = event.currentTarget.getBoundingClientRect();
            const dx = (event.clientX - drag.x) * (VIEW_WIDTH / Math.max(1, rectangle.width));
            const dy = (event.clientY - drag.y) * (VIEW_HEIGHT / Math.max(1, rectangle.height));
            dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            setTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
          }}
          onPointerUp={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return;
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
            setPanning(false);
          }}
          role="img"
          style={{ touchAction: 'none' }}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        >
          <defs>
            <pattern height="28" id="topology-grid" patternUnits="userSpaceOnUse" width="28">
              <circle cx="1" cy="1" fill="#cbd5e1" opacity="0.42" r="1" />
            </pattern>
            <marker id="topology-arrow" markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="8" refY="4" viewBox="0 0 8 8">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
            </marker>
          </defs>
          <rect fill="url(#topology-grid)" height={VIEW_HEIGHT} width={VIEW_WIDTH} />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            {graph.edges.map((edge) => {
              const source = nodesByKey.get(edge.sourceKey);
              const target = nodesByKey.get(edge.targetKey);
              if (!source || !target) return null;
              const curve = routeTopologyEdge(edge, source, target, graph.nodes);
              const relationshipLabel = displayRelationshipType(edge.relationshipType);
              const renderedEdgeLabel = `${relationshipLabel.toUpperCase()}${edge.archived ? ' · ARCHIVED' : ''}`;
              const labelWidth = renderedEdgeLabel.length * 6.8 + 20;
              return (
                <g key={edge.id} opacity={edge.archived ? 0.48 : 1}>
                  <path
                    d={curve.path}
                    fill="none"
                    markerEnd="url(#topology-arrow)"
                    markerStart={edge.relationshipType === 'CONNECTED_TO' ? 'url(#topology-arrow)' : undefined}
                    stroke={edge.archived ? '#94a3b8' : '#64748b'}
                    strokeDasharray={edge.archived ? '8 7' : undefined}
                    strokeLinecap="round"
                    strokeWidth="2.25"
                  />
                  <rect
                    fill="#ffffff"
                    height="24"
                    rx="12"
                    stroke={edge.archived ? '#cbd5e1' : '#a5b4fc'}
                    width={labelWidth}
                    x={curve.labelX - labelWidth / 2}
                    y={curve.labelY - 12}
                  />
                  <text fill="#475569" fontSize="10" fontWeight="700" textAnchor="middle" x={curve.labelX} y={curve.labelY + 3.5}>
                    {renderedEdgeLabel}
                  </text>
                </g>
              );
            })}

            {graph.nodes.map((node) => {
              const appearance = KIND_APPEARANCE[node.entityKind];
              return (
                <g key={node.key} transform={`translate(${node.x - NODE_WIDTH / 2} ${node.y - NODE_HEIGHT / 2})`}>
                  <title>{node.label} — {appearance.label} — {node.entityId}</title>
                  <rect
                    fill={appearance.fill}
                    height={NODE_HEIGHT}
                    opacity={node.allRelationshipsArchived ? 0.65 : 1}
                    rx="14"
                    stroke={appearance.accent}
                    strokeDasharray={node.allRelationshipsArchived ? '6 5' : undefined}
                    strokeWidth="1.5"
                    width={NODE_WIDTH}
                  />
                  <rect fill={appearance.accent} height={NODE_HEIGHT} rx="14" width="7" />
                  <text fill={appearance.accent} fontSize="9" fontWeight="800" letterSpacing="1.1" x="20" y="23">
                    {appearance.shortLabel}
                  </text>
                  <text fill="#0f172a" fontSize="14" fontWeight="700" x="20" y="44">
                    {truncateLabel(node.label)}
                  </text>
                  <text fill="#64748b" fontFamily="monospace" fontSize="9" x="20" y="59">
                    {node.entityId.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-outline-variant/50 bg-white/90 px-3 py-2 text-[10px] text-slate-600 shadow-sm backdrop-blur">
          Drag canvas to pan · use controls to zoom
          {resolvingLabels && <span className="ml-2 font-semibold text-indigo-700" role="status">Resolving labels...</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-outline-variant/30 px-5 py-3" aria-label="Entity type legend">
        {KIND_ORDER.map((kind) => (
          <span className="inline-flex items-center gap-1.5 text-caption-xs text-secondary" key={kind}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: KIND_APPEARANCE[kind].accent }} />
            {KIND_APPEARANCE[kind].label}
          </span>
        ))}
        {relationships.some((relationship) => relationship.inventoryState === 'ARCHIVED') && (
          <span className="inline-flex items-center gap-1.5 text-caption-xs text-secondary">
            <span className="w-5 border-t-2 border-dashed border-slate-400" /> Archived
          </span>
        )}
      </div>
    </section>
  );
};
