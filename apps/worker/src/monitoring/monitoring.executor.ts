import type { DnsClient, DnsRetrieval } from '../../../api/src/metadata/dns/dns.client';
import type { MetadataStore } from '../../../api/src/metadata/metadata.types';
import type { RdapClient } from '../../../api/src/metadata/rdap/rdap.client';
import { RdapRetrievalError } from '../../../api/src/metadata/rdap/rdap.errors';
import type { TlsClient } from '../../../api/src/metadata/tls/tls.client';
import { TlsInspectionError } from '../../../api/src/metadata/tls/tls.errors';

import type {
  ClaimedMonitoringRun,
  MonitoringDomain,
  MonitoringExecutionResult,
  MonitoringRunExecutor,
  MonitoringSource,
} from './monitoring.types';

const SOURCES = ['rdap', 'dns', 'tls'] as const satisfies readonly MonitoringSource[];
const MAX_DURATION_MS = 2_147_483_647;

interface SourceOutcome {
  readonly complete: boolean;
  readonly errorCode: string | null;
  readonly retryable: boolean;
  readonly source: MonitoringSource;
  readonly usable: boolean;
}

export interface MonitoringExecutorDependencies {
  readonly dns: Pick<DnsClient, 'retrieve'>;
  readonly metadata: MetadataStore;
  readonly rdap: Pick<RdapClient, 'retrieve'>;
  readonly tls: Pick<TlsClient, 'retrieve'>;
}

export interface MonitoringExecutorClock {
  readonly monotonicNow: () => number;
  readonly now: () => Date;
}

const systemClock: MonitoringExecutorClock = {
  monotonicNow: performance.now.bind(performance),
  now: () => new Date(),
};

function durationMilliseconds(startedAt: number, finishedAt: number): number {
  return Math.min(MAX_DURATION_MS, Math.max(0, Math.round(finishedAt - startedAt)));
}

function rdapRetryable(error: RdapRetrievalError): boolean {
  return error.code.includes('TIMEOUT') || error.code.includes('NETWORK_ERROR');
}

function tlsRetryable(error: TlsInspectionError): boolean {
  return [
    'TLS_DNS_LOOKUP_FAILED',
    'TLS_CONNECT_TIMEOUT',
    'TLS_CONNECTION_FAILED',
  ].includes(error.code);
}

function dnsRetryable(result: DnsRetrieval): boolean {
  return Object.values(result.snapshot.recordErrors).some(
    (code) => code === 'DNS_TIMEOUT' || code === 'DNS_RESOLVER_ERROR',
  );
}

function failure(
  source: MonitoringSource,
  errorCode: string,
  retryable: boolean,
): SourceOutcome {
  return { complete: false, errorCode, retryable, source, usable: false };
}

function emptyDnsFailure(): DnsRetrieval {
  return {
    errorCode: 'DNS_RETRIEVAL_FAILED',
    snapshot: {
      aRecords: [],
      aaaaRecords: [],
      cnameRecords: [],
      dsRecords: [],
      mxRecords: [],
      nsRecords: [],
      recordErrors: {},
      txtRecordCount: 0,
    },
    status: 'FAILED',
  };
}

export class MetadataMonitoringExecutor implements MonitoringRunExecutor {
  constructor(
    private readonly dependencies: MonitoringExecutorDependencies,
    private readonly clock: MonitoringExecutorClock = systemClock,
  ) {}

  async execute(
    run: ClaimedMonitoringRun,
    domain: MonitoringDomain,
  ): Promise<MonitoringExecutionResult> {
    const startedAt = this.clock.monotonicNow();
    const attemptedAt = this.clock.now();
    const outcomes = await Promise.all([
      this.executeRdap(run, domain, attemptedAt),
      this.executeDns(run, domain, attemptedAt),
      this.executeTls(run, domain, attemptedAt),
    ]);
    const finishedAt = this.clock.now();
    const complete = outcomes.every((outcome) => outcome.complete);
    const usable = outcomes.some((outcome) => outcome.usable);
    const status = complete ? 'SUCCESS' : usable ? 'PARTIAL' : 'FAILED';

    return {
      durationMs: durationMilliseconds(startedAt, this.clock.monotonicNow()),
      errorCode:
        status === 'SUCCESS'
          ? null
          : status === 'PARTIAL'
            ? 'MONITORING_PARTIAL_FAILURE'
            : 'MONITORING_ALL_SOURCES_FAILED',
      finishedAt,
      retryable: outcomes.some((outcome) => !outcome.complete && outcome.retryable),
      sourcesAttempted: SOURCES,
      sourcesSucceeded: outcomes
        .filter((outcome) => outcome.usable)
        .map((outcome) => outcome.source),
      status,
    };
  }

  private async executeRdap(
    run: ClaimedMonitoringRun,
    domain: MonitoringDomain,
    attemptedAt: Date,
  ): Promise<SourceOutcome> {
    let retrieval;
    try {
      retrieval = await this.dependencies.rdap.retrieve(
        domain.normalizedDomainName,
      );
    } catch (error) {
      const code = error instanceof RdapRetrievalError
        ? error.code
        : 'RDAP_UNEXPECTED_ERROR';
      try {
        await this.dependencies.metadata.recordRdapFailure(
          run.workspaceId,
          run.domainId,
          attemptedAt,
          code,
        );
      } catch {
        return failure('rdap', 'METADATA_PERSISTENCE_FAILED', true);
      }
      return failure(
        'rdap',
        code,
        error instanceof RdapRetrievalError && rdapRetryable(error),
      );
    }
    try {
      await this.dependencies.metadata.recordRdapSuccess(
        run.workspaceId,
        run.domainId,
        attemptedAt,
        retrieval.snapshot,
      );
      return { complete: true, errorCode: null, retryable: false, source: 'rdap', usable: true };
    } catch {
      return failure('rdap', 'METADATA_PERSISTENCE_FAILED', true);
    }
  }

  private async executeDns(
    run: ClaimedMonitoringRun,
    domain: MonitoringDomain,
    attemptedAt: Date,
  ): Promise<SourceOutcome> {
    let retrieval: DnsRetrieval;
    try {
      retrieval = await this.dependencies.dns.retrieve(domain.normalizedDomainName);
    } catch {
      retrieval = emptyDnsFailure();
    }
    try {
      await this.dependencies.metadata.recordDns(
        run.workspaceId,
        run.domainId,
        attemptedAt,
        retrieval,
      );
    } catch {
      return failure('dns', 'METADATA_PERSISTENCE_FAILED', true);
    }
    return {
      complete: retrieval.status === 'SUCCESS',
      errorCode: retrieval.errorCode,
      retryable: dnsRetryable(retrieval),
      source: 'dns',
      usable: retrieval.status !== 'FAILED',
    };
  }

  private async executeTls(
    run: ClaimedMonitoringRun,
    domain: MonitoringDomain,
    attemptedAt: Date,
  ): Promise<SourceOutcome> {
    let snapshot;
    try {
      snapshot = await this.dependencies.tls.retrieve(
        domain.normalizedDomainName,
      );
    } catch (error) {
      const code = error instanceof TlsInspectionError
        ? error.code
        : 'TLS_UNEXPECTED_ERROR';
      try {
        await this.dependencies.metadata.recordTlsFailure(
          run.workspaceId,
          run.domainId,
          attemptedAt,
          code,
        );
      } catch {
        return failure('tls', 'METADATA_PERSISTENCE_FAILED', true);
      }
      return failure(
        'tls',
        code,
        error instanceof TlsInspectionError && tlsRetryable(error),
      );
    }
    try {
      await this.dependencies.metadata.recordTlsSuccess(
        run.workspaceId,
        run.domainId,
        attemptedAt,
        snapshot,
      );
      return { complete: true, errorCode: null, retryable: false, source: 'tls', usable: true };
    } catch {
      return failure('tls', 'METADATA_PERSISTENCE_FAILED', true);
    }
  }
}
