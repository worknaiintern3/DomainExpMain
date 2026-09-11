import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from './client';
import {
  getApplicationDomains,
  getApplicationHostingTargets,
  getCloudResourceHostedApplications,
  getConnections,
  getDependencies,
  getDependents,
  getImmediateRelationships,
  getProjectResources,
  getServerHostedApplications,
} from './read-models';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);
const entityId = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ items: [] });
});

describe('inventory read-model adapters', () => {
  it('maps every reviewed public read model to its fixed API path', async () => {
    const controller = new AbortController();
    await getProjectResources(entityId, controller.signal);
    await getApplicationDomains(entityId, controller.signal);
    await getApplicationHostingTargets(entityId, controller.signal);
    await getServerHostedApplications(entityId, controller.signal);
    await getCloudResourceHostedApplications(entityId, controller.signal);
    await getDependencies('SERVER', entityId, controller.signal);
    await getDependents('DOMAIN', entityId, controller.signal);
    await getConnections('CLOUD_RESOURCE', entityId, controller.signal);
    await getImmediateRelationships('PROJECT', entityId, controller.signal);

    expect(apiRequestMock.mock.calls.map(([path]) => path)).toEqual([
      `/projects/${entityId}/resources`,
      `/applications/${entityId}/domains`,
      `/applications/${entityId}/hosting-targets`,
      `/servers/${entityId}/hosted-applications`,
      `/cloud-resources/${entityId}/hosted-applications`,
      `/inventory-graph/SERVER/${entityId}/dependencies`,
      `/inventory-graph/DOMAIN/${entityId}/dependents`,
      `/inventory-graph/CLOUD_RESOURCE/${entityId}/connections`,
      `/inventory-graph/PROJECT/${entityId}/relationships`,
    ]);
    for (const [, options] of apiRequestMock.mock.calls) {
      expect(options).toMatchObject({ signal: controller.signal });
    }
  });
});
