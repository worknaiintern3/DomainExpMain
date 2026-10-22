import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PlayStoreSearchPage } from '@/pages/PlayStoreSearchPage';

const { api, inventory } = vi.hoisted(() => ({
  api: {
    getPlayStoreDeveloperApps: vi.fn(),
    searchPlayStoreDevelopers: vi.fn(),
  },
  inventory: {
    createInventory: vi.fn(),
    listInventory: vi.fn(),
  },
}));

vi.mock('@/api/play-store', () => api);
vi.mock('@/api/inventory', () => inventory);

const searchMock = vi.mocked(api.searchPlayStoreDevelopers);
const appsMock = vi.mocked(api.getPlayStoreDeveloperApps);
const listInventoryMock = vi.mocked(inventory.listInventory);
const createInventoryMock = vi.mocked(inventory.createInventory);

describe('PlayStoreSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInventoryMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches automatically after the typing debounce', async () => {
    vi.useFakeTimers();
    searchMock.mockResolvedValue({
      developers: [
        { appCount: 1, id: 'Cars24', name: 'Cars24', sampleApps: [], verified: false },
      ],
      query: 'Cars24',
      total: 1,
    });

    render(<PlayStoreSearchPage />);
    fireEvent.change(screen.getByLabelText('Developer name or ID'), {
      target: { value: 'Cars24' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith('Cars24', 20);
  });

  it('searches developers and lists the apps of the selected developer', async () => {
    searchMock.mockResolvedValue({
      developers: [
        {
          appCount: 2,
          id: 'Google LLC',
          name: 'Google LLC',
          sampleApps: ['Google Chrome'],
          verified: true,
        },
      ],
      query: 'Google LLC',
      total: 1,
    });
    appsMock.mockResolvedValue({
      apps: [
        {
          developerId: 'Google LLC',
          developerName: 'Google LLC',
          id: 'play-com-android-chrome',
          name: 'Google Chrome',
          packageId: 'com.android.chrome',
          playStoreUrl: 'https://play.google.com/store/apps/details?id=com.android.chrome',
          price: 'Free',
          scoreText: '4.4',
        },
      ],
      developerId: 'Google LLC',
      developerName: 'Google LLC',
      total: 1,
    });

    render(<PlayStoreSearchPage />);

    fireEvent.change(screen.getByLabelText('Developer name or ID'), {
      target: { value: 'Google LLC' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search$/ }));

    const developerButton = await screen.findByRole('button', { name: /Google LLC/ });
    expect(searchMock).toHaveBeenCalledWith('Google LLC', 20);

    fireEvent.click(developerButton);

    expect(await screen.findByText('Google Chrome')).toBeInTheDocument();
    expect(appsMock).toHaveBeenCalledWith('Google LLC', 100);
    expect(screen.getByText('com.android.chrome')).toBeInTheDocument();
    expect(screen.getByText('4.4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open on Google Play Store/ })).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=com.android.chrome',
    );
  });

  it('reports an empty result instead of leaving the panel blank', async () => {
    searchMock.mockResolvedValue({
      developers: [],
      query: 'Nobody',
      total: 0,
    });

    render(<PlayStoreSearchPage />);

    fireEvent.change(screen.getByLabelText('Developer name or ID'), {
      target: { value: 'Nobody' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search$/ }));

    expect(await screen.findByText('No developers found for “Nobody”.')).toBeInTheDocument();
  });

  it('keeps the developer list visible when the app request fails', async () => {
    searchMock.mockResolvedValue({
      developers: [
        { appCount: 1, id: 'Cars24', name: 'Cars24', sampleApps: [], verified: false },
      ],
      query: 'Cars24',
      total: 1,
    });
    appsMock.mockRejectedValue(new Error('Play Store is rate limiting requests'));

    render(<PlayStoreSearchPage />);

    fireEvent.change(screen.getByLabelText('Developer name or ID'), {
      target: { value: 'Cars24' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Cars24/ }));

    expect(await screen.findByText('Play Store is rate limiting requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cars24/ })).toBeInTheDocument();
  });

  it('tracks a Play Store app into the application inventory', async () => {
    searchMock.mockResolvedValue({
      developers: [
        { appCount: 1, id: 'Google LLC', name: 'Google LLC', sampleApps: [], verified: true },
      ],
      query: 'Google LLC',
      total: 1,
    });
    appsMock.mockResolvedValue({
      apps: [
        {
          developerId: 'Google LLC',
          developerName: 'Google LLC',
          id: 'play-com-android-chrome',
          name: 'Google Chrome',
          packageId: 'com.android.chrome',
          playStoreUrl: 'https://play.google.com/store/apps/details?id=com.android.chrome',
          price: 'Free',
          scoreText: '4.4',
        },
      ],
      developerId: 'Google LLC',
      developerName: 'Google LLC',
      total: 1,
    });
    createInventoryMock.mockResolvedValue({ id: 'app-1' });

    render(<PlayStoreSearchPage />);
    fireEvent.change(screen.getByLabelText('Developer name or ID'), {
      target: { value: 'Google LLC' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Search$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Google LLC/ }));

    fireEvent.click(await screen.findByRole('button', { name: /Track/ }));

    await waitFor(() => {
      expect(createInventoryMock).toHaveBeenCalledWith('applications', expect.objectContaining({
        kind: 'MOBILE_APPLICATION',
        name: 'Google Chrome',
        primaryUrl: 'https://play.google.com/store/apps/details?id=com.android.chrome',
      }));
    });
    expect(await screen.findByText('Google Chrome was added to Websites & Apps.')).toBeInTheDocument();
    expect(screen.getByText('Tracked')).toBeInTheDocument();
  });
});
