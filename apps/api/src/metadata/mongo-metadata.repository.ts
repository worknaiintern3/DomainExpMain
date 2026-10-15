import { randomUUID } from 'node:crypto';

import type { DnsRetrieval } from './dns/dns.client';
import type {
  MetadataDomainIdentity,
  MetadataStore,
  StoredDomainMetadata,
} from './metadata.types';
import type { RdapSnapshot } from './rdap/rdap.types';
import type { TlsSnapshot } from './tls/tls.client';
import type { DatabaseService } from '../database/database.service';

export class MongoMetadataRepository implements MetadataStore {
  constructor(private readonly database: DatabaseService) {}

  async findDomain(
    workspaceId: string,
    domainId: string,
  ): Promise<MetadataDomainIdentity | undefined> {
    const cols = this.database.collections;
    if (!cols) {
      return undefined;
    }

    const domain = await cols.domains.findOne({ workspaceId, id: domainId });
    if (!domain) {
      return undefined;
    }

    return {
      domainName: domain.domainName,
      id: domain.id,
      normalizedDomainName: domain.normalizedDomainName,
    };
  }

  async read(
    workspaceId: string,
    domainId: string,
  ): Promise<StoredDomainMetadata> {
    const cols = this.database.collections;
    if (!cols) {
      return { dns: null, rdap: null, tls: null };
    }

    const [dns, rdap, tls] = await Promise.all([
      cols.domainDnsMetadata.findOne({ workspaceId, domainId } as any),
      cols.domainRdapMetadata.findOne({ workspaceId, domainId } as any),
      cols.domainTlsMetadata.findOne({ workspaceId, domainId } as any),
    ]);

    return {
      dns: dns as any,
      rdap: rdap as any,
      tls: tls as any,
    };
  }

  async recordDns(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    result: DnsRetrieval,
  ): Promise<void> {
    const cols = this.database.collections;
    if (!cols) {
      return;
    }

    if (result.status === 'FAILED') {
      await (cols.domainDnsMetadata as any).updateOne(
        { workspaceId, domainId },
        {
          $set: {
            domainId,
            lastAttemptedAt: attemptedAt,
            lastAttemptStatus: 'FAILED',
            lastErrorCode: result.errorCode ?? 'DNS_RETRIEVAL_FAILED',
            provenance: null,
            retrievedAt: null,
            updatedAt: attemptedAt,
            workspaceId,
          },
          $setOnInsert: { id: randomUUID() },
        },
        { upsert: true },
      );
      return;
    }

    const values = {
      ...result.snapshot,
      aRecords: [...result.snapshot.aRecords],
      aaaaRecords: [...result.snapshot.aaaaRecords],
      cnameRecords: [...result.snapshot.cnameRecords],
      dsRecords: [...result.snapshot.dsRecords],
      mxRecords: [...result.snapshot.mxRecords],
      nsRecords: [...result.snapshot.nsRecords],
      domainId,
      lastAttemptedAt: attemptedAt,
      lastAttemptStatus: result.status,
      lastErrorCode: result.errorCode,
      provenance: 'DNS_RETRIEVED' as const,
      retrievedAt: attemptedAt,
      updatedAt: attemptedAt,
      workspaceId,
    };

    await (cols.domainDnsMetadata as any).updateOne(
      { workspaceId, domainId },
      { $set: values, $setOnInsert: { id: randomUUID() } },
      { upsert: true },
    );
  }

  async recordRdapSuccess(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    snapshot: RdapSnapshot,
  ): Promise<void> {
    const cols = this.database.collections;
    if (!cols) {
      return;
    }

    const values = {
      ...snapshot,
      domainId,
      lastAttemptedAt: attemptedAt,
      lastAttemptStatus: 'SUCCESS' as const,
      lastErrorCode: null,
      provenance: 'RDAP_RETRIEVED' as const,
      retrievedAt: attemptedAt,
      updatedAt: attemptedAt,
      workspaceId,
    };

    await (cols.domainRdapMetadata as any).updateOne(
      { workspaceId, domainId },
      { $set: values, $setOnInsert: { id: randomUUID() } },
      { upsert: true },
    );
  }

  async recordRdapFailure(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    errorCode: string,
  ): Promise<void> {
    const cols = this.database.collections;
    if (!cols) {
      return;
    }

    const values = {
      domainId,
      lastAttemptedAt: attemptedAt,
      lastAttemptStatus: 'FAILED',
      lastErrorCode: errorCode,
      provenance: null,
      retrievedAt: null,
      updatedAt: attemptedAt,
      workspaceId,
    };

    await (cols.domainRdapMetadata as any).updateOne(
      { workspaceId, domainId },
      { $set: values, $setOnInsert: { id: randomUUID() } },
      { upsert: true },
    );
  }

  async recordTlsSuccess(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    snapshot: TlsSnapshot,
  ): Promise<void> {
    const cols = this.database.collections;
    if (!cols) {
      return;
    }

    const values = {
      ...snapshot,
      domainId,
      lastAttemptedAt: attemptedAt,
      lastAttemptStatus: 'SUCCESS' as const,
      lastErrorCode: null,
      provenance: 'PROBED' as const,
      probedAt: attemptedAt,
      updatedAt: attemptedAt,
      workspaceId,
    };

    await (cols.domainTlsMetadata as any).updateOne(
      { workspaceId, domainId },
      { $set: values, $setOnInsert: { id: randomUUID() } },
      { upsert: true },
    );
  }

  async recordTlsFailure(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    errorCode: string,
  ): Promise<void> {
    const cols = this.database.collections;
    if (!cols) {
      return;
    }

    const values = {
      domainId,
      lastAttemptedAt: attemptedAt,
      lastAttemptStatus: 'FAILED',
      lastErrorCode: errorCode,
      provenance: null,
      probedAt: null,
      updatedAt: attemptedAt,
      workspaceId,
    };

    await (cols.domainTlsMetadata as any).updateOne(
      { workspaceId, domainId },
      { $set: values, $setOnInsert: { id: randomUUID() } },
      { upsert: true },
    );
  }
}
