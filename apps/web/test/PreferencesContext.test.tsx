import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/client';
import { PreferencesProvider, usePreferences } from '@/preferences/PreferencesContext';

const getSettings = vi.hoisted(() => vi.fn());
const saveGeneralSettings = vi.hoisted(() => vi.fn());

vi.mock('@/api/settings', () => ({
  getSettings,
  saveGeneralSettings,
  saveDiscoverySettings: vi.fn(),
  savePortfolioSettings: vi.fn(),
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    status: 'authenticated',
    sessionScopeKey: 'user-1:session-1',
    user: { id: 'user-1', displayName: 'Test User' },
  }),
}));

function PreferenceEditor() {
  const { general, saveGeneral, status } = usePreferences();
  return <div>
    <span data-testid="status">{status}</span>
    <span data-testid="timezone">{general.timezone}</span>
    <button onClick={() => void saveGeneral({ ...general, timezone: 'UTC' })}>Save timezone</button>
  </div>;
}

beforeEach(() => {
  localStorage.clear();
  getSettings.mockReset();
  saveGeneralSettings.mockReset();
  getSettings.mockRejectedValue(new ApiError({
    detail: 'Not found',
    status: 404,
    title: 'Not found',
  }));
});

describe('preferences with this backend', () => {
  it('saves preferences per user on this device when the settings endpoint is absent', async () => {
    const first = render(<PreferencesProvider><PreferenceEditor /></PreferencesProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Save timezone' }));
    await waitFor(() => expect(screen.getByTestId('timezone')).toHaveTextContent('UTC'));
    expect(saveGeneralSettings).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('domainpulse:preferences:user-1') ?? '{}').general.timezone).toBe('UTC');

    first.unmount();
    render(<PreferencesProvider><PreferenceEditor /></PreferencesProvider>);
    await waitFor(() => expect(screen.getByTestId('timezone')).toHaveTextContent('UTC'));
  });
});
