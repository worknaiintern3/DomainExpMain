import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResourceFormModal } from '@/components/integration/InventoryWorkspace';
import { applicationConfiguration } from '@/features/integration/resource-configs';

const { createInventory } = vi.hoisted(() => ({
  createInventory: vi.fn(),
}));

vi.mock('@/api/inventory', () => ({
  archiveInventory: vi.fn(),
  createInventory,
  updateInventory: vi.fn(),
}));

vi.mock('@/preferences/PreferencesContext', () => ({
  usePreferences: () => ({ portfolio: { defaultAutoRenew: 'unknown' } }),
}));

function renderApplicationForm() {
  render(
    <ResourceFormModal
      config={applicationConfiguration}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
}

function fillApplicationForm() {
  fireEvent.change(screen.getByLabelText(/^Name$/u), {
    target: { value: 'Example Public Website' },
  });
  fireEvent.change(screen.getByLabelText(/^Primary URL/u), {
    target: { value: 'https://example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Notes/u), {
    target: { value: 'Public demo website used for application probe testing.' },
  });
}

describe('ResourceFormModal application kind', () => {
  beforeEach(() => {
    createInventory.mockReset();
    createInventory.mockResolvedValue({});
  });

  it('submits WEBSITE when the visible default kind is left untouched', async () => {
    renderApplicationForm();
    fillApplicationForm();

    expect(screen.getByLabelText(/^Kind$/u)).toHaveValue('WEBSITE');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createInventory).toHaveBeenCalledWith('applications', {
      kind: 'WEBSITE',
      name: 'Example Public Website',
      notes: 'Public demo website used for application probe testing.',
      primaryDomainId: null,
      primaryUrl: 'https://example.com',
      projectId: null,
    }));
  });

  it('still submits a different selected application kind', async () => {
    renderApplicationForm();
    fillApplicationForm();
    fireEvent.change(screen.getByLabelText(/^Kind$/u), {
      target: { value: 'API' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createInventory).toHaveBeenCalledWith(
      'applications',
      expect.objectContaining({ kind: 'API' }),
    ));
  });
});
