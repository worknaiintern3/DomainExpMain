export type InfrastructureNodeType =
  | 'email'
  | 'provider'
  | 'domain'
  | 'website'
  | 'server'
  | 'project';

export type RelationshipType =
  | 'owns'
  | 'manages'
  | 'resolves_to'
  | 'hosts'
  | 'contains'
  | 'attached_to';

export interface NodeMetadata {
  providerCompany?: string;
  accountOwnerEmail?: string;
  specs?: string;
  storage?: string;
  monthlyCost?: string;
  region?: string;
  ipAddress?: string;
  targetRoute?: string;
  statusText?: string;
  port?: string;
  framework?: string;
  isPrimaryNode?: boolean;
  upstreamNodeId?: string;
  upstreamNodeLabel?: string;
  upstreamNodeSubtext?: string;
  downstreamItems?: Array<{
    id: string;
    title: string;
    subtext: string;
    port?: string;
    color?: string;
  }>;
  associatedDomains?: string[];
  associatedProjects?: string[];
  incompleteMapping?: boolean;
  notes?: string;
}

export interface InfrastructureNode {
  id: string;
  nodeType: InfrastructureNodeType;
  label: string;
  title: string;
  subtext: string;
  categoryLabel: string;
  categoryColor: string;
  badgeTextColor: string;
  dotColor: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  metadata: NodeMetadata;
}

export interface InfrastructureEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: RelationshipType;
  path: string;
  isDashed?: boolean;
  isActive?: boolean;
}

export type GraphFilterType =
  | 'all'
  | 'email'
  | 'provider'
  | 'domain'
  | 'website'
  | 'server'
  | 'project';

export interface GraphSummaryMetrics {
  totalAssetsCount: number;
  weeklyGrowthLabel: string;
  relationshipClustersCount: number;
  bottleneckNodeName: string;
  bottleneckWebsitesCount: number;
  orphanedAssetsCount: number;
  orphanedPercentageLabel: string;
}

export interface NewRelationshipForm {
  sourceType: InfrastructureNodeType;
  sourceId: string;
  targetType: InfrastructureNodeType;
  targetId: string;
  relationshipType: RelationshipType;
  notes: string;
}
