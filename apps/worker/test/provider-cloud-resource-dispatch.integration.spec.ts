import { generateKeyPairSync, randomUUID } from 'node:crypto';

import {
  cloudResources,
  createDatabaseClient,
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

import { AwsAdapter } from '../src/providers/aws/aws.adapter';
import { AWS_PROVIDER_KEY } from '../src/providers/aws/aws.constants';
import { AzureAdapter } from '../src/providers/azure/azure.adapter';
import { AZURE_PROVIDER_KEY } from '../src/providers/azure/azure.constants';
import type { CloudResourceDiscoveryCapability } from '../src/providers/cloud-resource-adapter.types';
import { GcpAdapter } from '../src/providers/gcp/gcp.adapter';
import { GCP_PROVIDER_KEY } from '../src/providers/gcp/gcp.constants';
import type { ProviderAdapter } from '../src/providers/provider-adapter.types';
import { PostgresProviderCloudResourceReconciliationStore } from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.repository';
import { ProviderCloudResourceReconciler, ProviderCloudResourceSyncService } from '../src/providers/reconciliation/provider-cloud-resource-reconciliation.service';
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
  keys: new Map([[1, Buffer.alloc(32, 7)]]),
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
}

function xmlResponse(body: string): Response {
  return new Response(body, { headers: { 'content-type': 'text/xml' } });
}

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2_048 });
const gcpPrivateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

interface CloudFixture {
  readonly adapter: ProviderAdapter & CloudResourceDiscoveryCapability;
  readonly authType: 'AWS_ACCESS_KEY' | 'GCP_SERVICE_ACCOUNT_KEY' | 'AZURE_CLIENT_CREDENTIALS';
  readonly credential: string;
  readonly externalResourceId: string;
  readonly providerKey: string;
}

const awsFixture: CloudFixture = {
  adapter: new AwsAdapter({
    fetchImplementation: (async () =>
      xmlResponse(`<?xml version="1.0"?>
<DescribeInstancesResponse>
  <reservationSet><item><instancesSet><item>
    <instanceId>i-e2e-aws</instanceId>
    <imageId>ami-0abc</imageId>
    <instanceState><code>16</code><name>running</name></instanceState>
    <instanceType>t3.micro</instanceType>
    <launchTime>2026-01-01T00:00:00.000Z</launchTime>
    <placement><availabilityZone>us-east-1a</availabilityZone></placement>
    <privateIpAddress>10.0.0.5</privateIpAddress>
    <ipAddress>1.2.3.4</ipAddress>
  </item></instancesSet></item></reservationSet>
</DescribeInstancesResponse>`)) as typeof fetch,
  }),
  authType: 'AWS_ACCESS_KEY',
  credential: JSON.stringify({ accessKeyId: 'AKIAEXAMPLE12345678', regions: ['us-east-1'], secretAccessKey: 'fake-secret' }),
  externalResourceId: 'i-e2e-aws',
  providerKey: AWS_PROVIDER_KEY,
};

const gcpFixture: CloudFixture = {
  adapter: new GcpAdapter({
    fetchImplementation: (async (_url: unknown, init?: { body?: unknown }) => {
      // First call: OAuth token mint (form body with grant_type=jwt-bearer). Second call: aggregatedList.
      const isTokenCall = typeof init?.body === 'string' && init.body.includes('grant_type');
      if (isTokenCall) {
        return jsonResponse({ access_token: 'fake-gcp-access-token', expires_in: 3_600, token_type: 'Bearer' });
      }
      return jsonResponse({
        items: {
          'zones/us-central1-a': {
            instances: [{
              creationTimestamp: '2026-01-01T00:00:00.000-08:00',
              id: '999',
              labels: {},
              machineType: 'https://www.googleapis.com/compute/v1/projects/e2e/zones/us-central1-a/machineTypes/n1-standard-1',
              name: 'e2e-gcp-vm',
              networkInterfaces: [{ networkIP: '10.0.0.9' }],
              status: 'RUNNING',
              zone: 'https://www.googleapis.com/compute/v1/projects/e2e/zones/us-central1-a',
            }],
          },
        },
      });
    }) as typeof fetch,
  }),
  authType: 'GCP_SERVICE_ACCOUNT_KEY',
  credential: JSON.stringify({ clientEmail: 'sa@e2e-project.iam.gserviceaccount.com', privateKey: gcpPrivateKeyPem, projectId: 'e2e-project' }),
  externalResourceId: '999',
  providerKey: GCP_PROVIDER_KEY,
};

const azureFixture: CloudFixture = {
  adapter: new AzureAdapter({
    fetchImplementation: (async (_url: unknown, init?: { body?: unknown }) => {
      const isTokenCall = typeof init?.body === 'string' && init.body.includes('grant_type');
      if (isTokenCall) {
        return jsonResponse({ access_token: 'fake-arm-token', expires_in: 3_600, token_type: 'Bearer' });
      }
      return jsonResponse({
        value: [{
          id: '/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/e2e-rg/providers/Microsoft.Compute/virtualMachines/e2e-vm',
          location: 'eastus',
          name: 'e2e-vm',
          properties: { hardwareProfile: { vmSize: 'Standard_D2s_v3' }, provisioningState: 'Succeeded' },
          tags: {},
        }],
      });
    }) as typeof fetch,
  }),
  authType: 'AZURE_CLIENT_CREDENTIALS',
  credential: JSON.stringify({
    clientId: '22222222-2222-2222-2222-222222222222',
    clientSecret: 'fake-client-secret',
    subscriptionId: '33333333-3333-3333-3333-333333333333',
    tenantId: '11111111-1111-1111-1111-111111111111',
  }),
  externalResourceId: '/subscriptions/33333333-3333-3333-3333-333333333333/resourceGroups/e2e-rg/providers/Microsoft.Compute/virtualMachines/e2e-vm',
  providerKey: AZURE_PROVIDER_KEY,
};

describeWithPostgres(
  'cloud resource provider dispatch — real PostgreSQL (AWS, GCP, Azure)',
  () => {
    let client: DatabaseClient | undefined;
    let reconciler: ProviderCloudResourceReconciler | undefined;
    const workspaceId = randomUUID();

    const getClient = (): DatabaseClient => {
      if (!client) throw new Error('Cloud dispatch test client was not initialized');
      return client;
    };

    beforeAll(async () => {
      client = createDatabaseClient(getDisposableTestConfiguration());
      await migrate(client.database, { migrationsFolder: resolveMigrationsFolder() });
      await client.database.insert(workspaces).values({
        id: workspaceId,
        name: 'Cloud Dispatch Test',
        slug: `cloud-dispatch-${workspaceId}`,
      });
      reconciler = new ProviderCloudResourceReconciler(
        new PostgresProviderCloudResourceReconciliationStore(client),
      );
    });

    afterAll(async () => {
      if (!client) return;
      await client.database.delete(providerResourceLinks).where(eq(providerResourceLinks.workspaceId, workspaceId));
      await client.database.delete(cloudResources).where(eq(cloudResources.workspaceId, workspaceId));
      await client.database.delete(providerConnections).where(eq(providerConnections.workspaceId, workspaceId));
      await client.database.delete(providerAccounts).where(eq(providerAccounts.workspaceId, workspaceId));
      await client.database.delete(workspaces).where(eq(workspaces.id, workspaceId));
      await client.close();
    });

    it.each([
      ['AWS', awsFixture],
      ['GCP', gcpFixture],
      ['Azure', azureFixture],
    ] as const)(
      '%s: a claimed sync dispatches only to its own adapter, discovers, and persists a real cloud_resources row',
      async (_label, fixture) => {
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
        const encrypted = encryptProviderCredential(fixture.credential, { connectionId, workspaceId }, keyStore);
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

        const syncService = new ProviderCloudResourceSyncService(fixture.adapter, reconciler!);
        // Wrong-provider isolation is exercised in the same call: only
        // `fixture.providerKey` is registered, so if the executor ever
        // dispatched a claim to the wrong adapter, this map would have no
        // entry for it and the run would fail with UNKNOWN_PROVIDER_ERROR
        // instead of persisting the fixture's expected resource.
        const executor = new ProviderSyncExecutor(new Map([[fixture.providerKey, syncService]]), keyStore);
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

        const persisted = await getClient().database
          .select()
          .from(cloudResources)
          .where(and(
            eq(cloudResources.workspaceId, workspaceId),
            eq(cloudResources.providerAccountId, providerAccountId),
            eq(cloudResources.externalResourceId, fixture.externalResourceId),
          ));
        expect(persisted).toHaveLength(1);
        expect(persisted[0]).toMatchObject({ provenance: 'PROVIDER_API' });

        const links = await getClient().database
          .select()
          .from(providerResourceLinks)
          .where(eq(providerResourceLinks.connectionId, connectionId));
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({ status: 'ACTIVE' });
      },
    );

    it('a claim for a connection whose stored providerKey is not registered in the dispatch map fails safely without ever calling any adapter or writing any row', async () => {
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();
      const encrypted = encryptProviderCredential(awsFixture.credential, { connectionId, workspaceId }, keyStore);
      await getClient().database.insert(providerAccounts).values({
        id: providerAccountId, label: 'Mismatched account', provenance: 'USER_ADDED', providerKey: AWS_PROVIDER_KEY, workspaceId,
      });
      await getClient().database.insert(providerConnections).values({
        authType: 'AWS_ACCESS_KEY',
        credentialMask: 'test-mask',
        encryptedCiphertext: encrypted.ciphertextBase64,
        encryptionAuthTag: encrypted.authTagBase64,
        encryptionIv: encrypted.ivBase64,
        id: connectionId,
        keyVersion: encrypted.keyVersion,
        providerAccountId,
        workspaceId,
      });

      // Only the GCP service is registered -- a connection claiming to be
      // "aws" must never fall through to GCP's adapter.
      const gcpOnlyService = new ProviderCloudResourceSyncService(gcpFixture.adapter, reconciler!);
      const executor = new ProviderSyncExecutor(new Map([[GCP_PROVIDER_KEY, gcpOnlyService]]), keyStore);
      const run: ClaimedProviderSyncRun = {
        attemptNo: 1,
        connectionId,
        idempotencyKey: 'b'.repeat(64),
        leaseExpiresAt: new Date(Date.now() + 300_000),
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
        providerKey: AWS_PROVIDER_KEY,
        workspaceId,
      });

      expect(result).toMatchObject({ errorCode: 'UNKNOWN_PROVIDER_ERROR', status: 'FAILED' });
      const persisted = await getClient().database.select().from(cloudResources).where(
        eq(cloudResources.providerAccountId, providerAccountId),
      );
      expect(persisted).toHaveLength(0);
    });

    it('repeated dispatch for the same connection never duplicates rows or links', async () => {
      const providerAccountId = randomUUID();
      const connectionId = randomUUID();
      await getClient().database.insert(providerAccounts).values({
        id: providerAccountId, label: 'AWS repeat account', provenance: 'USER_ADDED', providerKey: AWS_PROVIDER_KEY, workspaceId,
      });
      const encrypted = encryptProviderCredential(awsFixture.credential, { connectionId, workspaceId }, keyStore);
      await getClient().database.insert(providerConnections).values({
        authType: 'AWS_ACCESS_KEY',
        credentialMask: 'test-mask',
        encryptedCiphertext: encrypted.ciphertextBase64,
        encryptionAuthTag: encrypted.authTagBase64,
        encryptionIv: encrypted.ivBase64,
        id: connectionId,
        keyVersion: encrypted.keyVersion,
        providerAccountId,
        workspaceId,
      });
      const syncService = new ProviderCloudResourceSyncService(awsFixture.adapter, reconciler!);
      const executor = new ProviderSyncExecutor(new Map([[AWS_PROVIDER_KEY, syncService]]), keyStore);
      const connection = {
        connectionStatus: 'CONNECTED' as const,
        encryptedCiphertext: encrypted.ciphertextBase64,
        encryptionAuthTag: encrypted.authTagBase64,
        encryptionIv: encrypted.ivBase64,
        id: connectionId,
        keyVersion: encrypted.keyVersion,
        providerKey: AWS_PROVIDER_KEY,
        workspaceId,
      };

      await executor.execute(
        { attemptNo: 1, connectionId, idempotencyKey: 'c'.repeat(64), leaseExpiresAt: new Date(Date.now() + 300_000), runId: randomUUID(), workspaceId },
        connection,
      );
      await executor.execute(
        { attemptNo: 1, connectionId, idempotencyKey: 'd'.repeat(64), leaseExpiresAt: new Date(Date.now() + 300_000), runId: randomUUID(), workspaceId },
        connection,
      );

      const persisted = await getClient().database.select().from(cloudResources).where(
        eq(cloudResources.providerAccountId, providerAccountId),
      );
      expect(persisted).toHaveLength(1);
      const links = await getClient().database.select().from(providerResourceLinks).where(
        eq(providerResourceLinks.connectionId, connectionId),
      );
      expect(links).toHaveLength(1);
    });
  },
);
