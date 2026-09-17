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
import { AwsAdapter } from './providers/aws/aws.adapter';
import { AWS_PROVIDER_KEY } from './providers/aws/aws.constants';
import { AzureAdapter } from './providers/azure/azure.adapter';
import { AZURE_PROVIDER_KEY } from './providers/azure/azure.constants';
import { CloudflareAdapter } from './providers/cloudflare/cloudflare.adapter';
import { CLOUDFLARE_PROVIDER_KEY } from './providers/cloudflare/cloudflare.constants';
import { GcpAdapter } from './providers/gcp/gcp.adapter';
import { GCP_PROVIDER_KEY } from './providers/gcp/gcp.constants';
import { GoDaddyAdapter } from './providers/godaddy/godaddy.adapter';
import { GODADDY_PROVIDER_KEY } from './providers/godaddy/godaddy.constants';
import { HostingerAdapter } from './providers/hostinger/hostinger.adapter';
import { HOSTINGER_PROVIDER_KEY } from './providers/hostinger/hostinger.constants';
import { NamecheapAdapter } from './providers/namecheap/namecheap.adapter';
import { NAMECHEAP_PROVIDER_KEY } from './providers/namecheap/namecheap.constants';
import { PostgresProviderCloudResourceReconciliationStore } from './providers/reconciliation/provider-cloud-resource-reconciliation.repository';
import { ProviderCloudResourceReconciler, ProviderCloudResourceSyncService } from './providers/reconciliation/provider-cloud-resource-reconciliation.service';
import { PostgresProviderDomainReconciliationStore } from './providers/reconciliation/provider-domain-reconciliation.repository';
import {
  ProviderDomainReconciler,
  ProviderDomainSyncService,
} from './providers/reconciliation/provider-domain-reconciliation.service';
import { ProviderSyncExecutor } from './providers/sync/provider-sync.executor';
import { PostgresProviderSyncRepository } from './providers/sync/provider-sync.repository';
import type { ProviderSyncService } from './providers/sync/provider-sync.types';
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
  // One domain reconciler, reused across every registrar/DNS provider, and
  // (Phase 10I) one cloud-resource reconciler, reused across every cloud VM
  // provider: each abstraction is provider-key-agnostic within its own
  // resource kind, so adding a provider never duplicates that logic. The two
  // are distinct abstractions -- see provider-cloud-resource-reconciliation
  // .service.ts's header comment for why domains and cloud resources cannot
  // share one reconciler -- but both satisfy the same structural
  // `ProviderSyncService` interface, so `ProviderSyncExecutor` dispatches to
  // either kind through a single provider-key-keyed map.
  const domainReconciler = new ProviderDomainReconciler(
    new PostgresProviderDomainReconciliationStore(providerSyncDatabase),
  );
  const cloudResourceReconciler = new ProviderCloudResourceReconciler(
    new PostgresProviderCloudResourceReconciliationStore(providerSyncDatabase),
  );
  const syncServicesByProviderKey = new Map<string, ProviderSyncService>([
    [CLOUDFLARE_PROVIDER_KEY, new ProviderDomainSyncService(new CloudflareAdapter(), domainReconciler)],
    [GODADDY_PROVIDER_KEY, new ProviderDomainSyncService(new GoDaddyAdapter(), domainReconciler)],
    [NAMECHEAP_PROVIDER_KEY, new ProviderDomainSyncService(new NamecheapAdapter(), domainReconciler)],
    [HOSTINGER_PROVIDER_KEY, new ProviderDomainSyncService(new HostingerAdapter(), domainReconciler)],
    [AWS_PROVIDER_KEY, new ProviderCloudResourceSyncService(new AwsAdapter(), cloudResourceReconciler)],
    [GCP_PROVIDER_KEY, new ProviderCloudResourceSyncService(new GcpAdapter(), cloudResourceReconciler)],
    [AZURE_PROVIDER_KEY, new ProviderCloudResourceSyncService(new AzureAdapter(), cloudResourceReconciler)],
  ]);
  const providerSyncWorker = new ProviderSyncWorker(
    new PostgresProviderSyncRepository(providerSyncDatabase),
    new ProviderSyncExecutor(
      syncServicesByProviderKey,
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
