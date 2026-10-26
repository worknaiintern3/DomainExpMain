import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudResourcesPage } from '@/pages/CloudResourcesPage';
import { ProjectsPage } from '@/pages/ProjectsPage';

const { inventory, readModels } = vi.hoisted(() => ({
  inventory: {
    archiveInventory: vi.fn(),
    listInventory: vi.fn(),
    updateInventory: vi.fn(),
  },
  readModels: {
    getCloudResourceHostedApplications: vi.fn(),
    getProjectResources: vi.fn(),
  },
}));

vi.mock('@/api/inventory', () => inventory);
vi.mock('@/api/read-models', () => readModels);
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ sessionScopeKey: 'test-session' }),
}));
vi.mock('@/preferences/PreferencesContext', () => ({
  usePreferences: () => ({ general: { rowsPerPage: 50 } }),
}));
vi.mock('@/features/provider-accounts/useProviderLabels', () => ({
  useProviderLabels: () => new Map([['provider-1', 'Amazon Web Services']]),
}));

const project = {
  createdAt: '2026-10-01T10:00:00.000Z',
  description: 'Production workloads',
  id: 'project-1',
  inventoryState: 'TRACKED',
  name: 'Platform',
  provenance: 'USER_ADDED',
  updatedAt: '2026-10-20T10:00:00.000Z',
};

const cloudResource = {
  createdAt: '2026-10-01T10:00:00.000Z',
  externalResourceId: 'i-1234567890',
  id: 'cloud-1',
  inventoryState: 'TRACKED',
  name: 'api-prod-1',
  notes: null,
  providerAccountId: 'provider-1',
  provenance: 'PROVIDER_API',
  region: 'ap-south-1',
  resourceType: 'INSTANCE',
  updatedAt: '2026-10-20T10:00:00.000Z',
};

describe('inventory backend pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readModels.getProjectResources).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(readModels.getCloudResourceHostedApplications).mockResolvedValue({ items: [], nextCursor: null });
  });

  it('lists projects and opens the project resource inspector', async () => {
    vi.mocked(inventory.listInventory).mockResolvedValue({ items: [project], nextCursor: null });

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Production workloads')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));

    expect(await screen.findByText('Project resources')).toBeInTheDocument();
    expect(readModels.getProjectResources).toHaveBeenCalledWith('project-1', expect.anything());
  });

  it('lists cloud resources with provider labels and hosted applications', async () => {
    vi.mocked(inventory.listInventory).mockResolvedValue({ items: [cloudResource], nextCursor: null });

    render(
      <MemoryRouter>
        <CloudResourcesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('api-prod-1')).toBeInTheDocument();
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'ap-south-1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inspect' }));

    expect(await screen.findByText('Hosted applications')).toBeInTheDocument();
    expect(readModels.getCloudResourceHostedApplications).toHaveBeenCalledWith('cloud-1', expect.anything());
  });
});
