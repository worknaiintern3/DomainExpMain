import { apiRequest } from './client';
import type {
  DomainMetadataResponse,
  DomainMetadataSource,
  RefreshDomainMetadataResponse,
} from './types';

export function getDomainMetadata(
  domainId: string,
  signal?: AbortSignal,
): Promise<DomainMetadataResponse> {
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/metadata`, { signal });
}

export function refreshDomainMetadata(
  domainId: string,
  sources?: readonly DomainMetadataSource[],
): Promise<RefreshDomainMetadataResponse> {
  return apiRequest(`/domains/${encodeURIComponent(domainId)}/metadata/refresh`, {
    body: sources ? { sources } : {},
    method: 'POST',
  });
}
