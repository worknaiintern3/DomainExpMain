import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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
    render(<MemoryRouter><AlertsTab role="member" /></MemoryRouter>);
    expect(await screen.findAllByText('Default Active')).toHaveLength(7);
    for (const control of screen.getAllByRole('combobox')) expect(control).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /Save Rule/ })) expect(button).toBeDisabled();
    expect(patchAlertRule).not.toHaveBeenCalled();
  });

  it('rejects a negative threshold before saving an expiry rule', async () => {
    patchAlertRule.mockResolvedValue({
      key: 'DOMAIN_EXPIRY_CRITICAL', enabled: true, severity: 'CRITICAL', thresholdDays: 7, thresholdCount: null,
    });
    render(<MemoryRouter><AlertsTab role="owner" /></MemoryRouter>);
    const configure = await screen.findAllByRole('button', { name: /Save Rule/ });
    fireEvent.change(screen.getAllByPlaceholderText('7')[0]!, { target: { value: '-1' } });
    fireEvent.click(configure[0]!);
    expect(screen.getByText(/enter a valid threshold/)).toBeInTheDocument();
    expect(patchAlertRule).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByPlaceholderText('7')[0]!, { target: { value: '7' } });
    fireEvent.click(configure[0]!);
    await waitFor(() => expect(patchAlertRule).toHaveBeenCalledWith('DOMAIN_EXPIRY_CRITICAL', {
      enabled: true, severity: 'CRITICAL', thresholdDays: 7,
    }));
  });
});
