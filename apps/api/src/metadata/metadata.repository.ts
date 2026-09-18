import {
  domainDnsMetadata,
  domainRdapMetadata,
  domains,
  domainTlsMetadata,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';

import type { DnsRetrieval } from './dns/dns.client';
import type {
  MetadataDatabaseHost,
  MetadataStore,
  StoredDomainMetadata,
} from './metadata.types';
import type { RdapSnapshot } from './rdap/rdap.types';
import type { TlsSnapshot } from './tls/tls.client';

export class PostgresMetadataRepository implements MetadataStore {
  constructor(private readonly database: MetadataDatabaseHost) {}

  async findDomain(workspaceId: string, domainId: string) {
    return await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      const [domain] = await transaction
        .select({
          domainName: domains.domainName,
          id: domains.id,
          normalizedDomainName: domains.normalizedDomainName,
        })
        .from(domains)
        .where(and(eq(domains.workspaceId, workspaceId), eq(domains.id, domainId)))
        .limit(1);
      return domain;
    });
  }

  async read(workspaceId: string, domainId: string): Promise<StoredDomainMetadata> {
    return await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      const [rdapRows, dnsRows, tlsRows] = await Promise.all([
        transaction.select().from(domainRdapMetadata).where(and(
          eq(domainRdapMetadata.workspaceId, workspaceId),
          eq(domainRdapMetadata.domainId, domainId),
        )).limit(1),
        transaction.select().from(domainDnsMetadata).where(and(
          eq(domainDnsMetadata.workspaceId, workspaceId),
          eq(domainDnsMetadata.domainId, domainId),
        )).limit(1),
        transaction.select().from(domainTlsMetadata).where(and(
          eq(domainTlsMetadata.workspaceId, workspaceId),
          eq(domainTlsMetadata.domainId, domainId),
        )).limit(1),
      ]);
      return {
        dns: dnsRows[0] ?? null,
        rdap: rdapRows[0] ?? null,
        tls: tlsRows[0] ?? null,
      };
    });
  }

  async recordRdapSuccess(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    snapshot: RdapSnapshot,
  ): Promise<void> {
    await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      const values = {
        ...snapshot,
        nameservers: [...snapshot.nameservers],
        statuses: [...snapshot.statuses],
        domainId,
        lastAttemptedAt: attemptedAt,
        lastAttemptStatus: 'SUCCESS' as const,
        lastErrorCode: null,
        provenance: 'RDAP_RETRIEVED' as const,
        retrievedAt: attemptedAt,
        updatedAt: attemptedAt,
        workspaceId,
      };
      await transaction.insert(domainRdapMetadata).values(values).onConflictDoUpdate({
        target: [domainRdapMetadata.workspaceId, domainRdapMetadata.domainId],
        set: values,
      });
    });
  }

  async recordRdapFailure(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    errorCode: string,
  ): Promise<void> {
    await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      await transaction.insert(domainRdapMetadata).values({
        domainId,
        lastAttemptedAt: attemptedAt,
        lastAttemptStatus: 'FAILED',
        lastErrorCode: errorCode,
        provenance: null,
        retrievedAt: null,
        updatedAt: attemptedAt,
        workspaceId,
      }).onConflictDoUpdate({
        target: [domainRdapMetadata.workspaceId, domainRdapMetadata.domainId],
        set: {
          lastAttemptedAt: attemptedAt,
          lastAttemptStatus: 'FAILED',
          lastErrorCode: errorCode,
          updatedAt: attemptedAt,
        },
      });
    });
  }

  async recordDns(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    result: DnsRetrieval,
  ): Promise<void> {
    await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      if (result.status === 'FAILED') {
        await transaction.insert(domainDnsMetadata).values({
          domainId,
          lastAttemptedAt: attemptedAt,
          lastAttemptStatus: 'FAILED',
          lastErrorCode: result.errorCode ?? 'DNS_RETRIEVAL_FAILED',
          provenance: null,
          retrievedAt: null,
          updatedAt: attemptedAt,
          workspaceId,
        }).onConflictDoUpdate({
          target: [domainDnsMetadata.workspaceId, domainDnsMetadata.domainId],
          set: {
            lastAttemptedAt: attemptedAt,
            lastAttemptStatus: 'FAILED',
            lastErrorCode: result.errorCode ?? 'DNS_RETRIEVAL_FAILED',
            updatedAt: attemptedAt,
          },
        });
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
      await transaction.insert(domainDnsMetadata).values(values).onConflictDoUpdate({
        target: [domainDnsMetadata.workspaceId, domainDnsMetadata.domainId],
        set: values,
      });
    });
  }

  async recordTlsSuccess(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    snapshot: TlsSnapshot,
  ): Promise<void> {
    await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      const values = {
        ...snapshot,
        subjectAltNames: [...snapshot.subjectAltNames],
        domainId,
        lastAttemptedAt: attemptedAt,
        lastAttemptStatus: 'SUCCESS' as const,
        lastErrorCode: null,
        provenance: 'SSL_RETRIEVED' as const,
        retrievedAt: attemptedAt,
        updatedAt: attemptedAt,
        workspaceId,
      };
      await transaction.insert(domainTlsMetadata).values(values).onConflictDoUpdate({
        target: [domainTlsMetadata.workspaceId, domainTlsMetadata.domainId],
        set: values,
      });
    });
  }

  async recordTlsFailure(
    workspaceId: string,
    domainId: string,
    attemptedAt: Date,
    errorCode: string,
  ): Promise<void> {
    await this.database.withWorkspaceContext(workspaceId, async (transaction) => {
      await transaction.insert(domainTlsMetadata).values({
        domainId,
        lastAttemptedAt: attemptedAt,
        lastAttemptStatus: 'FAILED',
        lastErrorCode: errorCode,
        provenance: null,
        retrievedAt: null,
        updatedAt: attemptedAt,
        workspaceId,
      }).onConflictDoUpdate({
        target: [domainTlsMetadata.workspaceId, domainTlsMetadata.domainId],
        set: {
          lastAttemptedAt: attemptedAt,
          lastAttemptStatus: 'FAILED',
          lastErrorCode: errorCode,
          updatedAt: attemptedAt,
        },
      });
    });
  }
}
