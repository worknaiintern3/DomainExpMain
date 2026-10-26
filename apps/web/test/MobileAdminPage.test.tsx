import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/client';
import { MobileAdminPage } from '@/pages/MobileAdminPage';

const { api } = vi.hoisted(() => ({
  api: {
    getMobileAdminConfig: vi.fn(), updateMobileAdminConfig: vi.fn(),
    getMobileAdminFeatures: vi.fn(), updateMobileAdminFeature: vi.fn(),
    getMobileAdminNavigation: vi.fn(), updateMobileAdminNavigation: vi.fn(),
    getMobileAdminHome: vi.fn(), updateMobileAdminHome: vi.fn(),
    getMobileAdminVersions: vi.fn(), updateMobileAdminVersion: vi.fn(),
    getMobileAdminAnnouncements: vi.fn(), createMobileAdminAnnouncement: vi.fn(),
    updateMobileAdminAnnouncement: vi.fn(), deleteMobileAdminAnnouncement: vi.fn(),
    getMobileAdminAuditLogs: vi.fn(),
  },
}));
vi.mock('@/api/mobile-admin', () => api);

describe('MobileAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getMobileAdminConfig.mockResolvedValue({
      id: 'config', appName: 'DomainPulse', logoUrl: null,
      primaryColor: '#2563EB', secondaryColor: '#1E293B',
      maintenanceMode: false, maintenanceMessage: null,
    });
    api.getMobileAdminFeatures.mockResolvedValue([]);
    api.getMobileAdminNavigation.mockResolvedValue([]);
    api.getMobileAdminHome.mockResolvedValue([]);
    api.getMobileAdminVersions.mockResolvedValue([]);
    api.getMobileAdminAnnouncements.mockResolvedValue([]);
    api.getMobileAdminAuditLogs.mockResolvedValue([]);
  });

  it('does not load admin data after the server rejects access', async () => {
    api.getMobileAdminConfig.mockRejectedValue(new ApiError({ detail: 'Forbidden', status: 403, title: 'Forbidden' }));
    render(<MobileAdminPage />);
    expect(await screen.findByText('Admin access required')).toBeInTheDocument();
    expect(api.getMobileAdminFeatures).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save app settings' })).not.toBeInTheDocument();
  });

  it('saves edited settings through the admin API', async () => {
    api.updateMobileAdminConfig.mockImplementation(async (body) => ({ id: 'config', ...body }));
    render(<MobileAdminPage />);
    fireEvent.change(await screen.findByLabelText('App name'), { target: { value: 'DomainExp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save app settings' }));
    await waitFor(() => expect(api.updateMobileAdminConfig).toHaveBeenCalledWith(expect.objectContaining({ appName: 'DomainExp' })));
    expect(await screen.findByText('App settings saved.')).toBeInTheDocument();
  });
});
