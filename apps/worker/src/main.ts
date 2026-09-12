import {
  createDatabaseClient,
  parseDatabaseEnvironment,
} from '@domainpulse/database';

import { DnsClient } from '../../api/src/metadata/dns/dns.client';
import { PostgresMetadataRepository } from '../../api/src/metadata/metadata.repository';
import { RdapClient } from '../../api/src/metadata/rdap/rdap.client';
import { TlsClient } from '../../api/src/metadata/tls/tls.client';
import { parseWorkerEnvironment } from './config/worker-env';
import { AlertEvaluator } from './alerts/alert-evaluator';
import { PostgresAlertRepository } from './alerts/alert-repository';
import { MetadataMonitoringExecutor } from './monitoring/monitoring.executor';
import { PostgresMonitoringRepository } from './monitoring/monitoring.repository';
import type { WorkerLogEvent, WorkerLogger } from './monitoring/monitoring.types';
import { MonitoringWorker } from './monitoring/monitoring.worker';

class JsonWorkerLogger implements WorkerLogger {
  error(event: WorkerLogEvent): void {
    process.stderr.write(`${JSON.stringify(event)}\n`);
  }

  info(event: WorkerLogEvent): void {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
}

async function main(): Promise<void> {
  const databaseConfiguration = parseDatabaseEnvironment(process.env);
  const workerConfiguration = parseWorkerEnvironment(process.env);
  const database = createDatabaseClient(databaseConfiguration);
  const store = new PostgresMonitoringRepository(database);
  const executor = new MetadataMonitoringExecutor({
    dns: new DnsClient(),
    metadata: new PostgresMetadataRepository(database),
    rdap: new RdapClient(),
    tls: new TlsClient(),
  });
  const worker = new MonitoringWorker(
    store,
    executor,
    workerConfiguration,
    new JsonWorkerLogger(),
    undefined,
    new AlertEvaluator(new PostgresAlertRepository(database)),
  );
  const shutdown = (): void => {
    void worker.stop();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await worker.start();
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await worker.stop();
  }
}

void main().catch(() => {
  process.stderr.write(`${JSON.stringify({ event: 'monitoring_worker_fatal' })}\n`);
  process.exitCode = 1;
});
