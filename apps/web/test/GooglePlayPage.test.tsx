import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GooglePlayPage } from '@/pages/GooglePlayPage';

const { api, useAuth } = vi.hoisted(() => ({
  api: {
    disconnectGooglePlay: vi.fn(),
    getGooglePlayApps: vi.fn(),
    getGooglePlayStatus: vi.fn(),
    refreshGooglePlayToken: vi.fn(),
    startGooglePlayAuth: vi.fn(),
    verifyGooglePlayDeveloperAccount: vi.fn(),
  },
  useAuth: vi.fn(),
}));

vi.mock('@/api/google-play', () => api);
vi.mock('@/auth/AuthContext', () => ({ useAuth }));

const statusMock = vi.mocked(api.getGooglePlayStatus);
const appsMock = vi.mocked(api.getGooglePlayApps);
const verifyMock = vi.mocked(api.verifyGooglePlayDeveloperAccount);

describe('GooglePlayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: { email: 'owner@example.com', displayName: 'Owner' },
    });
    appsMock.mockResolvedValue({
      apps: [],
      developerAccount: { id: '5700313618786177705' },
      googleAccount: { email: 'dev@example.com' },
      success: true,
    });
  });

  it('offers the connect action without requesting apps while disconnected', async () => {
    statusMock.mockResolvedValue({ connected: false });

    render(<GooglePlayPage />);

    expect(await screen.findByRole('button', { name: /Connect Google Play Console/ })).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(appsMock).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Developer account ID')).not.toBeInTheDocument();
  });

  it('asks for the developer account id when the connection has none', async () => {
    statusMock.mockResolvedValue({
      connected: true,
      googleAccount: { email: 'dev@example.com' },
    });

    render(<GooglePlayPage />);

    expect(await screen.findByLabelText('Developer account ID')).toBeInTheDocument();
    expect(screen.getByText('dev@example.com')).toBeInTheDocument();
    expect(screen.getByText('Not verified yet')).toBeInTheDocument();
    expect(appsMock).not.toHaveBeenCalled();
  });

  it('lists the published apps of a verified developer account', async () => {
    statusMock.mockResolvedValue({
      connected: true,
      developerAccount: { id: '5700313618786177705' },
      googleAccount: { email: 'dev@example.com' },
    });
    appsMock.mockResolvedValue({
      apps: [
        {
          appName: 'WorknAi',
          packageName: 'com.worknai.app',
          playStoreUrl: 'https://play.google.com/store/apps/details?id=com.worknai.app',
        },
      ],
      developerAccount: { id: '5700313618786177705' },
      googleAccount: { email: 'dev@example.com' },
      success: true,
    });

    render(<GooglePlayPage />);

    expect(await screen.findByText('WorknAi')).toBeInTheDocument();
    expect(screen.getByText('com.worknai.app')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.worknai.app',
    );
    expect(appsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the connection usable when the app list fails', async () => {
    statusMock.mockResolvedValue({
      connected: true,
      developerAccount: { id: '5700313618786177705' },
      googleAccount: { email: 'dev@example.com' },
    });
    appsMock.mockRejectedValue(new Error('Play Developer API is unavailable'));

    render(<GooglePlayPage />);

    expect(await screen.findByText('Play Developer API is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh access token/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/ })).toBeInTheDocument();
  });

  it('opens the Google consent screen in a new tab', async () => {
    statusMock.mockResolvedValue({ connected: false });
    api.startGooglePlayAuth.mockResolvedValue({
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
      state: 'state-1',
    });
    const openSpy = vi
      .spyOn(window, 'open')
      .mockReturnValue({ opener: null } as unknown as Window);

    render(<GooglePlayPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Connect Google Play Console/ }));

    await waitFor(() => expect(api.startGooglePlayAuth).toHaveBeenCalledTimes(1));
    expect(openSpy).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
      '_blank',
    );
    openSpy.mockRestore();
  });

  it('verifies a developer account and reloads the connection', async () => {
    statusMock
      .mockResolvedValueOnce({
        connected: true,
        googleAccount: { email: 'dev@example.com' },
      })
      .mockResolvedValueOnce({
        connected: true,
        developerAccount: { id: '123' },
        googleAccount: { email: 'dev@example.com' },
      });
    verifyMock.mockResolvedValue({
      developerAccountId: '123',
      googleAccountEmail: 'dev@example.com',
      verified: true,
    });

    render(<GooglePlayPage />);

    fireEvent.change(await screen.findByLabelText('Developer account ID'), {
      target: { value: ' 123 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Verify developer account/ }));

    await waitFor(() => expect(verifyMock).toHaveBeenCalledWith('123'));
    expect(await screen.findByText('Developer account 123 verified.')).toBeInTheDocument();
    await waitFor(() => expect(statusMock).toHaveBeenCalledTimes(2));
  });
});
