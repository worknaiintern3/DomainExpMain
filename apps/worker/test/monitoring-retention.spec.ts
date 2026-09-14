import { describe, expect, it, vi } from 'vitest';

import { PostgresMonitoringRepository } from '../src/monitoring/monitoring.repository';
import type { DatabaseClient } from '@domainpulse/database';

function createMockClient(queryMock: ReturnType<typeof vi.fn>) {
  return {
    pool: { query: queryMock },
  } as unknown as DatabaseClient;
}

describe('monitoring retention', () => {
  it('deletes only old terminal runs', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ deletedCount: 2 }] });
    const repo = new PostgresMonitoringRepository(createMockClient(queryMock));
    const now = new Date('2026-06-01T00:00:00.000Z');
    const deleted = await repo.cleanupOldTerminalRuns(now, 30, 100);
    expect(deleted).toBe(2);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const call = queryMock.mock.calls[0];
    if (!call) throw new Error('Retention query was not called');
    const sql = call[0] as string;
    const params = call[1] as unknown[];
    expect(sql).toContain('domainpulse.cleanup_old_terminal_monitoring_runs');
    expect(sql).not.toContain('DELETE FROM');
    const cutoff = params[0] as Date;
    expect(cutoff.getTime()).toBe(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(params[1]).toBe(100);
  });

  it('respects batch size', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ deletedCount: 1 }] });
    const repo = new PostgresMonitoringRepository(createMockClient(queryMock));
    const now = new Date();
    await repo.cleanupOldTerminalRuns(now, 7, 10);
    expect((queryMock.mock.calls[0]?.[1] as unknown[])[1]).toBe(10);
    await repo.cleanupOldTerminalRuns(now, 7, 1000);
    expect((queryMock.mock.calls[1]?.[1] as unknown[])[1]).toBe(1000);
  });

  it('uses only the approved global retention function', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [{ deletedCount: 0 }] });
    const repo = new PostgresMonitoringRepository(createMockClient(queryMock));
    await repo.cleanupOldTerminalRuns(new Date(), 30, 100);
    const sql = queryMock.mock.calls[0]?.[0] as string;
    expect(sql).toContain('domainpulse.cleanup_old_terminal_monitoring_runs');
    expect(sql).not.toContain('monitoring_runs"');
  });

  it('preserves recent terminal runs', async () => {
    const queryMock = vi.fn().mockImplementation((_sql: string, params: unknown[]) => {
      const cutoff = params[0] as Date;
      expect(cutoff).toBeInstanceOf(Date);
      return Promise.resolve({ rows: [{ deletedCount: 0 }] });
    });
    const repo = new PostgresMonitoringRepository(createMockClient(queryMock));
    const now = new Date('2026-06-01T12:00:00.000Z');
    await repo.cleanupOldTerminalRuns(now, 30, 100);
    const cutoff = (queryMock.mock.calls[0]?.[1] as unknown[])[0] as Date;
    expect(cutoff.toISOString()).toBe(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('uses conservative defaults', async () => {
    const { parseWorkerEnvironment } = await import('../src/config/worker-env');
    const config = parseWorkerEnvironment({});
    expect(config.retentionDays).toBe(30);
    expect(config.retentionBatchSize).toBe(100);
    expect(config.maintenanceIntervalMs).toBe(60 * 60 * 1000);
  });
});
