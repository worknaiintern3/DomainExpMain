import {
  createDatabaseClient,
  parseDatabaseEnvironment,
  parseProviderCredentialEncryptionEnvironment,
} from '@domainpulse/database';

import { DnsClient } from '../../api/src/metadata/dns/dns.client';
import { PostgresMetadataRepository } from '../../api/src/metadata/metadata.repository';
import { RdapClient } from '../../api/src/metadata/rdap/rdap.client';
import { TlsClient } from '../../api/src/metadata/tls/tls.client';
import { parseProviderSyncWorkerEnvironment } from './config/provider-sync-env';
import { parseWorkerEnvironment } from './config/worker-env';
import { AlertEvaluator } from './alerts/alert-evaluator';
import { PostgresAlertRepository } from './alerts/alert-repository';
import { MetadataMonitoringExecutor } from './monitoring/monitoring.executor';
import { PostgresMonitoringRepository } from './monitoring/monitoring.repository';
import type { WorkerLogEvent, WorkerLogger } from './monitoring/monitoring.types';
import { MonitoringWorker } from './monitoring/monitoring.worker';
import { CloudflareAdapter } from './providers/cloudflare/cloudflare.adapter';
import { CLOUDFLARE_PROVIDER_KEY } from './providers/cloudflare/cloudflare.constants';
import { GoDaddyAdapter } from './providers/godaddy/godaddy.adapter';
import { GODADDY_PROVIDER_KEY } from './providers/godaddy/godaddy.constants';
import { HostingerAdapter } from './providers/hostinger/hostinger.adapter';
import { HOSTINGER_PROVIDER_KEY } from './providers/hostinger/hostinger.constants';
import { NamecheapAdapter } from './providers/namecheap/namecheap.adapter';
import { NAMECHEAP_PROVIDER_KEY } from './providers/namecheap/namecheap.constants';
import { PostgresProviderDomainReconciliationStore } from './providers/reconciliation/provider-domain-reconciliation.repository';
import {
  ProviderDomainReconciler,
  ProviderDomainSyncService,
} from './providers/reconciliation/provider-domain-reconciliation.service';
import { ProviderSyncExecutor } from './providers/sync/provider-sync.executor';
import { PostgresProviderSyncRepository } from './providers/sync/provider-sync.repository';
import { ProviderSyncWorker } from './providers/sync/provider-sync.worker';

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
  const providerSyncConfiguration = parseProviderSyncWorkerEnvironment(process.env);
  const logger = new JsonWorkerLogger();

  // Separate database clients (not a shared pool): each worker's stop()
  // closes its own connection independently of the other, so one worker
  // finishing its shutdown cycle first can never close a pool the other is
  // still using mid-run.
  const monitoringDatabase = createDatabaseClient(databaseConfiguration);
  const store = new PostgresMonitoringRepository(monitoringDatabase);
  const executor = new MetadataMonitoringExecutor({
    dns: new DnsClient(),
    metadata: new PostgresMetadataRepository(monitoringDatabase),
    rdap: new RdapClient(),
    tls: new TlsClient(),
  });
  const monitoringWorker = new MonitoringWorker(
    store,
    executor,
    workerConfiguration,
    logger,
    undefined,
    new AlertEvaluator(new PostgresAlertRepository(monitoringDatabase)),
  );

  const providerSyncDatabase = createDatabaseClient(databaseConfiguration);
  // One reconciler, reused across every provider: reconciliation is
  // provider-key-agnostic (see ProviderDomainReconciler), so adding a
  // registrar here never duplicates that logic.
  const reconciler = new ProviderDomainReconciler(
    new PostgresProviderDomainReconciliationStore(providerSyncDatabase),
  );
  const providerSyncWorker = new ProviderSyncWorker(
    new PostgresProviderSyncRepository(providerSyncDatabase),
    new ProviderSyncExecutor(
      new Map([
        [CLOUDFLARE_PROVIDER_KEY, new ProviderDomainSyncService(new CloudflareAdapter(), reconciler)],
        [GODADDY_PROVIDER_KEY, new ProviderDomainSyncService(new GoDaddyAdapter(), reconciler)],
        [NAMECHEAP_PROVIDER_KEY, new ProviderDomainSyncService(new NamecheapAdapter(), reconciler)],
        [HOSTINGER_PROVIDER_KEY, new ProviderDomainSyncService(new HostingerAdapter(), reconciler)],
      ]),
      parseProviderCredentialEncryptionEnvironment(process.env),
    ),
    providerSyncConfiguration,
    logger,
  );

  const shutdown = (): void => {
    void monitoringWorker.stop();
    void providerSyncWorker.stop();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await Promise.all([monitoringWorker.start(), providerSyncWorker.start()]);
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await Promise.all([monitoringWorker.stop(), providerSyncWorker.stop()]);
  }
}

void main().catch(() => {
  process.stderr.write(`${JSON.stringify({ event: 'worker_fatal' })}\n`);
  process.exitCode = 1;
});
