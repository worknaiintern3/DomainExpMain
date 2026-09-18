import { randomUUID } from 'node:crypto';

import {
  createDatabaseClient,
  domains,
  encryptProviderCredential,
  providerAccounts,
  providerConnections,
  providerResourceLinks,
  workspaces,
  type DatabaseClient,
  type ProviderCredentialKeyStore,
} from '@domainpulse/database';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { GoDaddyAdapter } from '../src/providers/godaddy/godaddy.adapter';
import { GODADDY_PROVIDER_KEY } from '../src/providers/godaddy/godaddy.constants';
import { HostingerAdapter } from '../src/providers/hostinger/hostinger.adapter';
import { HOSTINGER_PROVIDER_KEY } from '../src/providers/hostinger/hostinger.constants';
import { NamecheapAdapter } from '../src/providers/namecheap/namecheap.adapter';
import { NAMECHEAP_PROVIDER_KEY } from '../src/providers/namecheap/namecheap.constants';
import type { ProviderAdapter, DomainDiscoveryCapability } from '../src/providers/provider-adapter.types';
import { PostgresProviderDomainReconciliationStore } from '../src/providers/reconciliation/provider-domain-reconciliation.repository';
import { ProviderDomainReconciler, ProviderDomainSyncService } from '../src/providers/reconciliation/provider-domain-reconciliation.service';
import { ProviderSyncExecutor } from '../src/providers/sync/provider-sync.executor';
import type { ClaimedProviderSyncRun } from '../src/providers/sync/provider-sync.types';
import {
  getDisposableTestConfiguration,
  hasDisposableTestDatabase,
  resolveMigrationsFolder,
} from './alert-integration-helpers';

const describeWithPostgres = hasDisposableTestDatabase ? describe : describe.skip;

const keyStore: ProviderCredentialKeyStore = {
  activeVersion: 1,
  keys: new Map([[1, Buffer.alloc(32, 9)]]),
};

function fakeJsonResponse(value: unknown): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return new Response(JSON.stringify(value), { headers });
}

function fakeXmlResponse(body: string): Response {
  const headers = new Headers({ 'content-type': 'text/xml' });
  return new Response(body, { headers });
}

interface ProviderFixture {
  readonly adapter: ProviderAdapter & DomainDiscoveryCapability;
  readonly authType: 'GODADDY_PAT' | 'NAMECHEAP_API_KEY' | 'HOSTINGER_API_TOKEN';
  readonly credential: string;
  readonly providerKey: string;
}

const godaddyFixture: ProviderFixture = {
  adapter: new GoDaddyAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse([{ domain: 'godaddy-e2e.example', domainId: 42, status: 'ACTIVE' }])) as typeof fetch,
  }),
  authType: 'GODADDY_PAT',
  credential: 'fake-godaddy-pat',
  providerKey: GODADDY_PROVIDER_KEY,
};

const namecheapFixture: ProviderFixture = {
  adapter: new NamecheapAdapter({
    fetchImplementation: (async () =>
      fakeXmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors></Errors>
  <CommandResponse Type="namecheap.domains.getList">
    <DomainGetListResult><Domain ID="7" Name="namecheap-e2e.example" Created="01/01/2020" Expires="01/01/2030" IsExpired="false" IsLocked="false" AutoRenew="true" WhoisGuard="ENABLED" IsPremium="false" IsOurDNS="true"/></DomainGetListResult>
    <Paging><TotalItems>1</TotalItems><CurrentPage>1</CurrentPage><PageSize>100</PageSize></Paging>
  </CommandResponse>
</ApiResponse>`)) as typeof fetch,
  }),
  authType: 'NAMECHEAP_API_KEY',
  credential: JSON.stringify({
    apiKey: 'fake-key',
    apiUser: 'fake-user',
    clientIp: '203.0.113.5',
    userName: 'fake-user',
  }),
  providerKey: NAMECHEAP_PROVIDER_KEY,
};

const hostingerFixture: ProviderFixture = {
  adapter: new HostingerAdapter({
    fetchImplementation: (async () =>
      fakeJsonResponse([{ domain: 'hostinger-e2e.example', id: 9, status: 'active' }])) as typeof fetch,
  }),
  authType: 'HOSTINGER_API_TOKEN',
  credential: 'fake-hostinger-token',
  providerKey: HOSTINGER_PROVIDER_KEY,
};

describeWithPostgres(
  'provider adapter dispatch — real PostgreSQL (GoDaddy, Namecheap, Hostinger)',
  () => {
    let client: DatabaseClient | undefined;
    let reconciler: ProviderDomainReconciler | undefined;
    const workspaceId = randomUUID();

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Dispatch test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
      await client.database.insert(workspaces).values({
        id: workspaceId,
        name: 'Provider Dispatch Test',
        slug: `provider-dispatch-${workspaceId}`,
      });
      reconciler = new ProviderDomainReconciler(
        new PostgresProviderDomainReconciliationStore(client),
      );
    });

    afterAll(async () => {
      if (!client) return;
      await client.database.delete(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
      await client.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
      await client.database.delete(domains).where(eq(domains.workspaceId, workspaceId));
      await client.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
      await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      await client.close();
    });

    it.each([
      ['GoDaddy', godaddyFixture, 'godaddy-e2e.example'],
      ['Namecheap', namecheapFixture, 'namecheap-e2e.example'],
      ['Hostinger', hostingerFixture, 'hostinger-e2e.example'],
    ] as const)(
      '%s: a claimed sync dispatches to its own adapter, discovers, and reconciles into real Postgres',
      async (_label, fixture, expectedDomain) => {
        const providerAccountId = randomUUID();
        const connectionId = randomUUID();
        const now = new Date();

        await getClient().database.insert(providerAccounts).values({
          id: providerAccountId,
          label: `${fixture.providerKey} test account`,
          provenance: 'USER_ADDED',
          providerKey: fixture.providerKey,
          workspaceId,
        });
        const encrypted = encryptProviderCredential(
          fixture.credential,
          { connectionId, workspaceId },
          keyStore,
        );
        await getClient().database.insert(providerConnections).values({
          authType: fixture.authType,
          credentialMask: 'test-mask',
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerAccountId,
          workspaceId,
        });

        const syncService = new ProviderDomainSyncService(fixture.adapter, reconciler!);
        const executor = new ProviderSyncExecutor(
          new Map([[fixture.providerKey, syncService]]),
          keyStore,
        );
        const run: ClaimedProviderSyncRun = {
          attemptNo: 1,
          connectionId,
          idempotencyKey: 'a'.repeat(64),
          leaseExpiresAt: new Date(now.getTime() + 300_000),
          runId: randomUUID(),
          workspaceId,
        };

        const result = await executor.execute(run, {
          connectionStatus: 'CONNECTED',
          encryptedCiphertext: encrypted.ciphertextBase64,
          encryptionAuthTag: encrypted.authTagBase64,
          encryptionIv: encrypted.ivBase64,
          id: connectionId,
          keyVersion: encrypted.keyVersion,
          providerKey: fixture.providerKey,
          workspaceId,
        });

        expect(result).toMatchObject({ itemsCreated: 1, status: 'SUCCESS' });

        const persistedDomains = await getClient().database
          .select()
          .from(domains)
          .where(
            and(
              eq(domains.workspaceId, workspaceId),
              eq(domains.normalizedDomainName, expectedDomain),
            ),
          );
        expect(persistedDomains).toHaveLength(1);
        expect(persistedDomains[0]).toMatchObject({ provenance: 'PROVIDER_API' });

        const links = await getClient().database
          .select()
          .from(providerResourceLinks)
          .where(eq(providerResourceLinks.connectionId, connectionId));
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({ status: 'ACTIVE' });
      },
    );
  },
);
