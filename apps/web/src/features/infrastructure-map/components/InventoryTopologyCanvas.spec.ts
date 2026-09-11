import { describe, expect, it } from 'vitest';

import type { EntityReference, InventoryRelationship, RelationshipType } from '@/api/types';
import { buildTopologyGraph, routeTopologyEdge } from './InventoryTopologyCanvas';

const application: EntityReference = { entityId: '00000000-0000-4000-8000-000000000001', entityKind: 'WEBSITE_APPLICATION' };
const domain: EntityReference = { entityId: '00000000-0000-4000-8000-000000000002', entityKind: 'DOMAIN' };
const server: EntityReference = { entityId: '00000000-0000-4000-8000-000000000003', entityKind: 'SERVER' };
const cloud: EntityReference = { entityId: '00000000-0000-4000-8000-000000000004', entityKind: 'CLOUD_RESOURCE' };
const project: EntityReference = { entityId: '00000000-0000-4000-8000-000000000005', entityKind: 'PROJECT' };

function relationship(
  id: number,
  relationshipType: RelationshipType,
  source: EntityReference,
  target: EntityReference,
  inventoryState: InventoryRelationship['inventoryState'] = 'TRACKED',
): InventoryRelationship {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    id: `00000000-0000-4000-8001-${String(id).padStart(12, '0')}`,
    inventoryState,
    notes: null,
    provenance: 'USER_ADDED',
    relationshipType,
    source,
    target,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('real inventory topology graph', () => {
  const relationships = [
    relationship(1, 'GROUPS', project, application),
    relationship(2, 'HOSTED_ON', application, server),
    relationship(3, 'USES_DOMAIN', application, domain),
    relationship(4, 'DEPENDS_ON', server, cloud),
    relationship(5, 'ROUTES_TO', domain, application),
    relationship(6, 'CONNECTED_TO', cloud, server, 'ARCHIVED'),
  ];

  it('renders exactly the loaded real edges and supports every relationship type', () => {
    const graph = buildTopologyGraph(relationships, new Map());

    expect(graph.edges).toHaveLength(relationships.length);
    expect(graph.edges.map((edge) => edge.relationshipType)).toEqual([
      'GROUPS', 'HOSTED_ON', 'USES_DOMAIN', 'DEPENDS_ON', 'ROUTES_TO', 'CONNECTED_TO',
    ]);
    expect(graph.edges.at(-1)).toMatchObject({ archived: true });
  });

  it('deduplicates nodes by public kind and entity id and applies hydrated labels', () => {
    const applicationKey = `${application.entityKind}:${application.entityId}`;
    const graph = buildTopologyGraph(relationships, new Map([[applicationKey, 'Customer portal']]));

    expect(graph.nodes).toHaveLength(5);
    expect(graph.nodes.find((node) => node.key === applicationKey)).toMatchObject({
      entityId: application.entityId,
      entityKind: 'WEBSITE_APPLICATION',
      label: 'Customer portal',
    });
    expect(graph.nodes.every((node) => !('nodeId' in node))).toBe(true);
  });

  it('routes the Application to Server edge around the unrelated Domain node', () => {
    const graph = buildTopologyGraph([
      relationship(2, 'USES_DOMAIN', application, domain),
      relationship(1, 'HOSTED_ON', application, server),
    ], new Map());
    const hostedOn = graph.edges.find((edge) => edge.relationshipType === 'HOSTED_ON');
    const usesDomain = graph.edges.find((edge) => edge.relationshipType === 'USES_DOMAIN');
    const applicationNode = graph.nodes.find((node) => node.entityId === application.entityId);
    const domainNode = graph.nodes.find((node) => node.entityId === domain.entityId);
    const serverNode = graph.nodes.find((node) => node.entityId === server.entityId);
    expect(hostedOn && usesDomain && applicationNode && domainNode && serverNode).toBeTruthy();
    if (!hostedOn || !usesDomain || !applicationNode || !domainNode || !serverNode) return;

    const hostedRoute = routeTopologyEdge(hostedOn, applicationNode, serverNode, graph.nodes);
    const domainRoute = routeTopologyEdge(usesDomain, applicationNode, domainNode, graph.nodes);

    expect(hostedOn).toMatchObject({
      sourceKey: `${application.entityKind}:${application.entityId}`,
      targetKey: `${server.entityKind}:${server.entityId}`,
    });
    expect(usesDomain).toMatchObject({
      sourceKey: `${application.entityKind}:${application.entityId}`,
      targetKey: `${domain.entityKind}:${domain.entityId}`,
    });
    expect(hostedRoute.routedAroundObstacle).toBe(true);
    expect(Math.abs(hostedRoute.labelY - domainNode.y)).toBeGreaterThan(36);
    expect(hostedRoute.end.x).toBeLessThan(serverNode.x);
    expect(hostedRoute.path).not.toBe(domainRoute.path);
    expect(domainRoute.labelY).toBeLessThan(applicationNode.y - 36);
    expect(graph).toMatchObject({ edges: { length: 2 }, nodes: { length: 3 } });
  });

  it('returns a truthful empty graph when no relationships are loaded', () => {
    expect(buildTopologyGraph([], new Map())).toEqual({ edges: [], nodes: [] });
  });
});
