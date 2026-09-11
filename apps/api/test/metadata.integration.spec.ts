import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  domains,
  workspaces,
  type DatabaseClient,
} from '@domainpulse/database';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresMetadataRepository } from '../src/metadata/metadata.repository';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
} from './test-database';

const describeWithPostgreSql = hasDisposableTestDatabase ? describe : describe.skip;

describeWithPostgreSql('metadata persistence (requires a disposable TEST_DATABASE_URL)', () => {
  const workspaceAId = randomUUID();
  const workspaceBId = randomUUID();
  const domainId = randomUUID();
  let client: DatabaseClient | undefined;
  let repository: PostgresMetadataRepository | undefined;

  const store = () => {
    if (!repository) throw new Error('Metadata repository not initialized');
    return repository;
  };

  beforeAll(async () => {
    client = createDatabaseClient(getDisposableTestConfiguration());
    await migrate(client.database, { migrationsFolder: '../../packages/database/migrations' });
    await client.database.insert(workspaces).values([
      { id: workspaceAId, name: 'Metadata A', slug: `metadata-a-${workspaceAId}` },
      { id: workspaceBId, name: 'Metadata B', slug: `metadata-b-${workspaceBId}` },
    ]);
    await client.database.insert(domains).values({
      domainName: 'Metadata.Example',
      id: domainId,
      normalizedDomainName: 'metadata.example',
      provenance: 'USER_ADDED',
      workspaceId: workspaceAId,
    });
    repository = new PostgresMetadataRepository(client);
  });

  afterAll(async () => {
    if (!client) return;
    await client.database.delete(domains).where(eq(domains.id, domainId));
    await client.database.delete(workspaces).where(eq(workspaces.id, workspaceAId));
    await client.database.delete(workspaces).where(eq(workspaces.id, workspaceBId));
    await client.close();
  });

  it('records first failures with null snapshot provenance and timestamps', async () => {
    const attemptedAt = new Date('2031-01-01T00:00:00Z');
    await store().recordRdapFailure(workspaceAId, domainId, attemptedAt, 'RDAP_LOOKUP_TIMEOUT');
    await store().recordDns(workspaceAId, domainId, attemptedAt, {
      errorCode: 'DNS_RETRIEVAL_FAILED',
      snapshot: {
        aRecords: [], aaaaRecords: [], cnameRecords: [], dsRecords: [], mxRecords: [], nsRecords: [],
        recordErrors: { A: 'DNS_RESOLVER_ERROR' }, txtRecordCount: 0,
      },
      status: 'FAILED',
    });
    await store().recordTlsFailure(workspaceAId, domainId, attemptedAt, 'TLS_CONNECT_TIMEOUT');
    const metadata = await store().read(workspaceAId, domainId);
    for (const source of [metadata.rdap, metadata.dns, metadata.tls]) {
      expect(source).toMatchObject({ provenance: null, retrievedAt: null, lastAttemptStatus: 'FAILED' });
    }
  });

  it('persists successful and partial snapshots with truthful provenance', async () => {
    const attemptedAt = new Date('2031-02-01T00:00:00Z');
    await store().recordRdapSuccess(workspaceAId, domainId, attemptedAt, {
      changedAt: null,
      expiresAt: new Date('2032-02-01T00:00:00Z'),
      nameservers: ['ns1.metadata.example'],
      registeredAt: new Date('2020-02-01T00:00:00Z'),
      registrarIanaId: '100',
      registrarName: 'Metadata Registrar',
      secureDnsDelegationSigned: true,
      sourceUrl: 'https://rdap.example/domain/metadata.example',
      statuses: ['active'],
    });
    await store().recordDns(workspaceAId, domainId, attemptedAt, {
      errorCode: 'DNS_PARTIAL_FAILURE',
      snapshot: {
        aRecords: ['203.0.113.9'], aaaaRecords: [], cnameRecords: [], dsRecords: [], mxRecords: [],
        nsRecords: ['ns1.metadata.example'], recordErrors: { MX: 'DNS_TIMEOUT' }, txtRecordCount: 2,
      },
      status: 'PARTIAL',
    });
    await store().recordTlsSuccess(workspaceAId, domainId, attemptedAt, {
      fingerprint256: 'AA:BB',
      issuerCommonName: 'Metadata CA',
      issuerOrganization: 'Metadata Trust',
      serialNumber: '01',
      subjectAltNames: ['metadata.example'],
      subjectCommonName: 'metadata.example',
      validFrom: new Date('2031-01-01T00:00:00Z'),
      validTo: new Date('2032-01-01T00:00:00Z'),
    });
    const metadata = await store().read(workspaceAId, domainId);
    expect(metadata.rdap).toMatchObject({ provenance: 'RDAP_RETRIEVED', registrarName: 'Metadata Registrar' });
    expect(metadata.dns).toMatchObject({ provenance: 'DNS_RETRIEVED', lastAttemptStatus: 'PARTIAL', txtRecordCount: 2 });
    expect(metadata.tls).toMatchObject({ provenance: 'SSL_RETRIEVED', subjectCommonName: 'metadata.example' });
  });

  it('preserves every prior successful snapshot when later attempts fail', async () => {
    const prior = await store().read(workspaceAId, domainId);
    const failedAt = new Date('2031-03-01T00:00:00Z');
    await store().recordRdapFailure(workspaceAId, domainId, failedAt, 'RDAP_LOOKUP_TIMEOUT');
    await store().recordDns(workspaceAId, domainId, failedAt, {
      errorCode: 'DNS_RETRIEVAL_FAILED',
      snapshot: {
        aRecords: [], aaaaRecords: [], cnameRecords: [], dsRecords: [], mxRecords: [], nsRecords: [],
        recordErrors: { A: 'DNS_TIMEOUT' }, txtRecordCount: 0,
      },
      status: 'FAILED',
    });
    await store().recordTlsFailure(workspaceAId, domainId, failedAt, 'TLS_CONNECTION_FAILED');
    const metadata = await store().read(workspaceAId, domainId);
    expect(metadata.rdap).toMatchObject({
      lastAttemptStatus: 'FAILED',
      provenance: 'RDAP_RETRIEVED',
      registrarName: prior.rdap?.registrarName,
      retrievedAt: prior.rdap?.retrievedAt,
    });
    expect(metadata.dns).toMatchObject({
      aRecords: prior.dns?.aRecords,
      lastAttemptStatus: 'FAILED',
      provenance: 'DNS_RETRIEVED',
      retrievedAt: prior.dns?.retrievedAt,
      txtRecordCount: prior.dns?.txtRecordCount,
    });
    expect(metadata.tls).toMatchObject({
      fingerprint256: prior.tls?.fingerprint256,
      lastAttemptStatus: 'FAILED',
      provenance: 'SSL_RETRIEVED',
      retrievedAt: prior.tls?.retrievedAt,
    });
  });

  it('fails closed across workspace context for domain and metadata reads', async () => {
    await expect(store().findDomain(workspaceBId, domainId)).resolves.toBeUndefined();
    await expect(store().read(workspaceBId, domainId)).resolves.toEqual({ dns: null, rdap: null, tls: null });
  });
});
