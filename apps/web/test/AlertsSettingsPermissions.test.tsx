import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsTab } from '@/features/settings/components/tabs/AlertsTab';

const { listAlertRules, patchAlertRule } = vi.hoisted(() => ({
  listAlertRules: vi.fn(),
  patchAlertRule: vi.fn(),
}));
vi.mock('@/api/monitoring', () => ({ listAlertRules, patchAlertRule }));

describe('Alerts Settings permissions and configuration', () => {
  beforeEach(() => {
    listAlertRules.mockReset().mockResolvedValue([]);
    patchAlertRule.mockReset();
  });

  it('does not offer writes to workspace members', async () => {
    render(<AlertsTab role="member" />);
    expect(await screen.findAllByText('Not configured')).toHaveLength(7);
    expect(screen.getByText(/Read-only: owner\/admin access/u)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(patchAlertRule).not.toHaveBeenCalled();
  });

  it('requires a threshold before creating an expiry rule', async () => {
    patchAlertRule.mockResolvedValue({
      key: 'DOMAIN_EXPIRY_CRITICAL', enabled: true, severity: 'INFO', thresholdDays: 7, thresholdCount: null,
    });
    render(<AlertsTab role="owner" />);
    const configure = await screen.findAllByRole('button', { name: 'Configure' });
    fireEvent.click(configure[0]!);
    expect(screen.getByRole('alert')).toHaveTextContent('enter a valid threshold');
    expect(patchAlertRule).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByPlaceholderText('e.g. 7')[0]!, { target: { value: '7' } });
    fireEvent.click(configure[0]!);
    await waitFor(() => expect(patchAlertRule).toHaveBeenCalledWith('DOMAIN_EXPIRY_CRITICAL', {
      enabled: true, severity: 'INFO', thresholdDays: 7,
    }));
  });
});
