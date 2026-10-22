// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/client';
import * as availabilityApi from '@/api/server-availability';
import type { ServerAvailabilityRun, ServerAvailabilityTarget } from '@/api/server-availability';
import { ServerAvailabilitySection } from './components/ServerAvailabilitySection';

vi.mock('@/api/server-availability', () => ({
  getServerAvailability: vi.fn(),
  listServerAvailabilityRuns: vi.fn(),
  putServerAvailability: vi.fn(),
  postServerAvailabilityRun: vi.fn(),
}));

const serverId = '00000000-0000-4000-8000-000000000001';

function target(overrides: Partial<ServerAvailabilityTarget> = {}): ServerAvailabilityTarget {
  return {
    id: '00000000-0000-4000-8000-000000000002', serverId,
    enabled: true, addressSource: 'PRIMARY_IP', port: 443, checkIntervalMinutes: 5,
    nextRunAt: '2026-09-28T12:05:00.000Z', lastRunAt: '2026-09-28T12:00:00.000Z',
    lastRunStatus: 'AVAILABLE', currentStatus: 'UP', lastLatencyMs: 42,
    lastFailureCode: null, consecutiveFailures: 0, lastRecoveredAt: null,
    createdAt: '2026-09-28T11:00:00.000Z', updatedAt: '2026-09-28T12:00:00.000Z',
    ...overrides,
  };
}

function run(overrides: Partial<ServerAvailabilityRun> = {}): ServerAvailabilityRun {
  return {
    id: '00000000-0000-4000-8000-000000000003', serverId,
    targetId: '00000000-0000-4000-8000-000000000002', trigger: 'SCHEDULED',
    status: 'AVAILABLE', attemptNo: 1, availableAt: '2026-09-28T12:00:00.000Z',
    startedAt: '2026-09-28T12:00:00.000Z', finishedAt: '2026-09-28T12:00:01.000Z',
    durationMs: 1000, latencyMs: 42, failureCode: null, retryOfRunId: null,
    createdAt: '2026-09-28T12:00:00.000Z', ...overrides,
  };
}

function show(inventoryState: 'TRACKED' | 'ARCHIVED' = 'TRACKED') {
  return render(<ServerAvailabilitySection serverId={serverId} inventoryState={inventoryState} primaryIp="203.0.113.10" hostname="example.test" />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(availabilityApi.getServerAvailability).mockResolvedValue({ configured: false, serverId, currentStatus: 'UNKNOWN' });
  vi.mocked(availabilityApi.listServerAvailabilityRuns).mockResolvedValue({ items: [], nextCursor: null });
});

afterEach(cleanup);

describe('network availability section', () => {
  it('shows an unconfigured UNKNOWN state and default five-minute form without requesting history', async () => {
    show();
    expect(await screen.findByText('Availability checks have not been configured. No network result is available.')).toBeTruthy();
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
    expect((screen.getByLabelText('Check interval (minutes)') as HTMLInputElement).value).toBe('5');
    expect(availabilityApi.listServerAvailabilityRuns).not.toHaveBeenCalled();
  });

  it('shows observed summary separately from history and maps ERROR to UNKNOWN', async () => {
    vi.mocked(availabilityApi.getServerAvailability).mockResolvedValue({ configured: true, target: target({
      lastRunStatus: 'ERROR', currentStatus: 'UNKNOWN', lastLatencyMs: null,
      lastFailureCode: 'WORKER_LEASE_EXPIRED', consecutiveFailures: 2,
    }) });
    vi.mocked(availabilityApi.listServerAvailabilityRuns).mockResolvedValue({ items: [run({
      status: 'ERROR', latencyMs: null, failureCode: 'WORKER_LEASE_EXPIRED',
      trigger: 'RETRY', attemptNo: 2,
    })], nextCursor: null });
    show();
    expect(await screen.findByText('Check worker timed out; availability is unknown')).toBeTruthy();
    expect(screen.getAllByText('UNKNOWN').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('retry · attempt 2')).toBeTruthy();
    expect(screen.queryByText('DOWN')).toBeNull();
    expect(availabilityApi.listServerAvailabilityRuns).toHaveBeenCalledTimes(1);
  });

  it('validates interval and port before creating a target', async () => {
    show();
    await screen.findByText('Availability checks have not been configured. No network result is available.');
    fireEvent.click(screen.getByRole('button', { name: 'Configure monitoring' }));
    expect(screen.getByText(/Port must be a whole number/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('TCP port'), { target: { value: '443' } });
    fireEvent.change(screen.getByLabelText('Check interval (minutes)'), { target: { value: '10081' } });
    fireEvent.click(screen.getByRole('button', { name: 'Configure monitoring' }));
    expect(screen.getByText(/Check interval must be a whole number/)).toBeTruthy();
    expect(availabilityApi.putServerAvailability).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Check interval (minutes)'), { target: { value: '5' } });
    vi.mocked(availabilityApi.putServerAvailability).mockResolvedValue({ configured: true, target: target() });
    fireEvent.click(screen.getByRole('button', { name: 'Configure monitoring' }));
    await waitFor(() => expect(availabilityApi.putServerAvailability).toHaveBeenCalledWith(serverId, {
      enabled: true, checkIntervalMinutes: 5, addressSource: 'PRIMARY_IP', port: 443,
    }));
  });

  it('turns write controls read-only after a 403', async () => {
    show();
    await screen.findByText('Availability checks have not been configured. No network result is available.');
    fireEvent.change(screen.getByLabelText('TCP port'), { target: { value: '443' } });
    vi.mocked(availabilityApi.putServerAvailability).mockRejectedValue(new ApiError({
      detail: 'Availability write access denied', status: 403, title: 'Forbidden',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Configure monitoring' }));
    expect(await screen.findByText('Read-only: owner or admin access is required to change availability monitoring.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Configure monitoring' })).toBeNull();
  });

  it('reports Run Now conflicts without changing observed status', async () => {
    vi.mocked(availabilityApi.getServerAvailability).mockResolvedValue({ configured: true, target: target() });
    vi.mocked(availabilityApi.postServerAvailabilityRun).mockRejectedValue(new ApiError({
      detail: 'An availability run is already queued or running', status: 409, title: 'Conflict',
    }));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Run Now' }));
    expect(await screen.findByText('An availability run is already queued or running')).toBeTruthy();
    expect(screen.getByText('UP')).toBeTruthy();
  });

  it('shows archived servers read-only while retaining their history', async () => {
    vi.mocked(availabilityApi.getServerAvailability).mockResolvedValue({ configured: true, target: target() });
    vi.mocked(availabilityApi.listServerAvailabilityRuns).mockResolvedValue({ items: [run()], nextCursor: null });
    show('ARCHIVED');
    expect(await screen.findByText('Archived servers are read-only and cannot be checked.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Run Now' })).toBeNull();
    expect(await screen.findByText('scheduled · attempt 1')).toBeTruthy();
  });

  it('loads one additional cursor page on demand', async () => {
    vi.mocked(availabilityApi.getServerAvailability).mockResolvedValue({ configured: true, target: target() });
    vi.mocked(availabilityApi.listServerAvailabilityRuns)
      .mockResolvedValueOnce({ items: [run()], nextCursor: 'opaque-next' })
      .mockResolvedValueOnce({ items: [run({ id: '00000000-0000-4000-8000-000000000004', attemptNo: 2, trigger: 'RETRY' })], nextCursor: null });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(availabilityApi.listServerAvailabilityRuns).toHaveBeenCalledWith(serverId, {
      cursor: 'opaque-next', limit: 10,
    }, expect.any(AbortSignal)));
    expect(await screen.findByText('retry · attempt 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('offers retry when the target request fails', async () => {
    vi.mocked(availabilityApi.getServerAvailability)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ configured: false, serverId, currentStatus: 'UNKNOWN' });
    show();
    expect(await screen.findByText('Service unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Availability checks have not been configured. No network result is available.')).toBeTruthy();
  });
});
