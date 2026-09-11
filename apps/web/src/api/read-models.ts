import { apiRequest } from './client';
import type {
  AssociatedEntity,
  EntityReference,
  GraphEntityKind,
  ImmediateRelationship,
  ItemCollection,
} from './types';

type DependencySourceKind = 'WEBSITE_APPLICATION' | 'SERVER' | 'CLOUD_RESOURCE';
type DependencyTargetKind = Exclude<GraphEntityKind, 'PROJECT'>;
type ConnectionKind = 'SERVER' | 'CLOUD_RESOURCE';

function readCollection<T>(path: string, signal?: AbortSignal): Promise<ItemCollection<T>> {
  return apiRequest(path, { signal });
}

function graphPath(kind: GraphEntityKind, id: string, view: string): string {
  return `/inventory-graph/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/${view}`;
}

export function getProjectResources(id: string, signal?: AbortSignal) {
  return readCollection<AssociatedEntity>(`/projects/${encodeURIComponent(id)}/resources`, signal);
}

export function getApplicationDomains(id: string, signal?: AbortSignal) {
  return readCollection<AssociatedEntity>(`/applications/${encodeURIComponent(id)}/domains`, signal);
}

export function getApplicationHostingTargets(id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(`/applications/${encodeURIComponent(id)}/hosting-targets`, signal);
}

export function getServerHostedApplications(id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(`/servers/${encodeURIComponent(id)}/hosted-applications`, signal);
}

export function getCloudResourceHostedApplications(id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(`/cloud-resources/${encodeURIComponent(id)}/hosted-applications`, signal);
}

export function getDependencies(kind: DependencySourceKind, id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(graphPath(kind, id, 'dependencies'), signal);
}

export function getDependents(kind: DependencyTargetKind, id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(graphPath(kind, id, 'dependents'), signal);
}

export function getConnections(kind: ConnectionKind, id: string, signal?: AbortSignal) {
  return readCollection<EntityReference>(graphPath(kind, id, 'connections'), signal);
}

export function getImmediateRelationships(kind: GraphEntityKind, id: string, signal?: AbortSignal) {
  return readCollection<ImmediateRelationship>(graphPath(kind, id, 'relationships'), signal);
}
