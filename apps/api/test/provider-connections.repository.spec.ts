import { randomUUID } from 'node:crypto';

import { providerConnections, providerSyncRuns } from '@domainpulse/database';
import { describe, expect, it, vi } from 'vitest';

import { InvalidProviderAccountError } from '../src/provider-connections/provider-connections.errors';
import {
  PostgresProviderConnectionsRepository,
  type ProviderConnectionsDatabaseHost,
} from '../src/provider-connections/provider-connections.repository';

const workspaceId = randomUUID();
const providerAccountId = randomUUID();
const connectionId = randomUUID();
const now = new Date('2036-02-03T04:05:06.000Z');

/**
 * A minimal fake Drizzle transaction supporting exactly the chains
 * `createConnection` uses: one `select().from().where().limit()` lookup of
 * the provider account, and `insert(<table>).values().returning()` for the
 * connection row and the INITIAL sync run row.
 */
function fakeTransaction(options: {
  accountRow?: { label: string; providerKey: string };
  insertedConnectionId?: string;
}) {
  return {
    insert: vi.fn().mockImplementation((table: unknown) => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(
          table === providerConnections
            ? [{ id: options.insertedConnectionId ?? connectionId }]
            : table === providerSyncRuns
              ? [{ id: randomUUID() }]
              : [],
        ),
      }),
    })),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(options.accountRow ? [options.accountRow] : []),
        }),
      }),
    }),
  };
}

function hostReturning(transaction: ReturnType<typeof fakeTransaction>): ProviderConnectionsDatabaseHost {
  return {
    withWorkspaceContext: vi.fn(async (_workspaceId: string, operation: (tx: unknown) => Promise<unknown>) =>
      operation(transaction)),
  } as unknown as ProviderConnectionsDatabaseHost;
}

const createInput = {
  authType: 'CLOUDFLARE_API_TOKEN' as const,
  credentialMask: '••••1234',
  encryptedCiphertext: 'ZmFrZQ==',
  encryptionAuthTag: 'ZmFrZWZha2VmYWtlZmFrZQ==',
  encryptionIv: 'ZmFrZWZha2VmYWs=',
  id: connectionId,
  keyVersion: 1,
  providerAccountId,
  validatedAt: now,
};

describe('PostgresProviderConnectionsRepository.createConnection', () => {
  it('rejects when the provider account does not exist (or belongs to another workspace)', async () => {
    const transaction = fakeTransaction({});
    const repository = new PostgresProviderConnectionsRepository(hostReturning(transaction));

    await expect(
      repository.createConnection(workspaceId, createInput, now),
    ).rejects.toBeInstanceOf(InvalidProviderAccountError);
    // Never inserts a connection row for an account it couldn't validate.
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it('rejects a provider account that is not a Cloudflare account', async () => {
    const transaction = fakeTransaction({ accountRow: { label: 'AWS prod', providerKey: 'aws' } });
    const repository = new PostgresProviderConnectionsRepository(hostReturning(transaction));

    await expect(
      repository.createConnection(workspaceId, createInput, now),
    ).rejects.toBeInstanceOf(InvalidProviderAccountError);
    expect(transaction.insert).not.toHaveBeenCalled();
  });

  it('succeeds for a valid, workspace-owned Cloudflare provider account', async () => {
    const transaction = fakeTransaction({
      accountRow: { label: 'Cloudflare - primary', providerKey: 'cloudflare' },
    });
    const repository = new PostgresProviderConnectionsRepository(hostReturning(transaction));

    const result = await repository.createConnection(workspaceId, createInput, now);

    expect(result).toMatchObject({
      id: connectionId,
      providerAccountLabel: 'Cloudflare - primary',
      providerType: 'cloudflare',
    });
    // Inserts both the connection row and the INITIAL sync run.
    expect(transaction.insert).toHaveBeenCalledTimes(2);
    expect(transaction.insert).toHaveBeenCalledWith(providerConnections);
    expect(transaction.insert).toHaveBeenCalledWith(providerSyncRuns);
  });

  it.each([
    ['GODADDY_PAT', 'godaddy'],
    ['NAMECHEAP_API_KEY', 'namecheap'],
    ['HOSTINGER_API_TOKEN', 'hostinger'],
    ['DIGITALOCEAN_API_TOKEN', 'digitalocean'],
    ['HETZNER_API_TOKEN', 'hetzner'],
    ['VULTR_API_KEY', 'vultr'],
    ['LINODE_API_TOKEN', 'linode'],
    ['AWS_ACCESS_KEY', 'aws'],
    ['GCP_SERVICE_ACCOUNT_KEY', 'gcp'],
    ['AZURE_CLIENT_CREDENTIALS', 'azure'],
  ] as const)('succeeds for a valid, workspace-owned %s account and stamps the matching providerType', async (authType, providerKey) => {
    const transaction = fakeTransaction({
      accountRow: { label: `${providerKey} - primary`, providerKey },
    });
    const repository = new PostgresProviderConnectionsRepository(hostReturning(transaction));

    const result = await repository.createConnection(
      workspaceId,
      { ...createInput, authType },
      now,
    );

    expect(result).toMatchObject({ authType, providerType: providerKey });
  });

  it.each([
    ['GODADDY_PAT', 'namecheap'],
    ['NAMECHEAP_API_KEY', 'hostinger'],
    ['HOSTINGER_API_TOKEN', 'cloudflare'],
    ['CLOUDFLARE_API_TOKEN', 'godaddy'],
    ['DIGITALOCEAN_API_TOKEN', 'hetzner'],
    ['HETZNER_API_TOKEN', 'vultr'],
    ['VULTR_API_KEY', 'linode'],
    ['LINODE_API_TOKEN', 'digitalocean'],
    ['DIGITALOCEAN_API_TOKEN', 'cloudflare'],
    ['AWS_ACCESS_KEY', 'gcp'],
    ['GCP_SERVICE_ACCOUNT_KEY', 'azure'],
    ['AZURE_CLIENT_CREDENTIALS', 'aws'],
    // Cross-family: a cloud/VPS/registrar auth type must never attach to a
    // provider account from a different family.
    ['AWS_ACCESS_KEY', 'cloudflare'],
    ['CLOUDFLARE_API_TOKEN', 'aws'],
    ['AWS_ACCESS_KEY', 'digitalocean'],
    ['DIGITALOCEAN_API_TOKEN', 'aws'],
    ['GCP_SERVICE_ACCOUNT_KEY', 'hetzner'],
    ['VULTR_API_KEY', 'azure'],
  ] as const)('rejects %s against a mismatched %s provider account, never attaching across providers', async (authType, mismatchedProviderKey) => {
    const transaction = fakeTransaction({
      accountRow: { label: 'Mismatched account', providerKey: mismatchedProviderKey },
    });
    const repository = new PostgresProviderConnectionsRepository(hostReturning(transaction));

    await expect(
      repository.createConnection(workspaceId, { ...createInput, authType }, now),
    ).rejects.toBeInstanceOf(InvalidProviderAccountError);
    expect(transaction.insert).not.toHaveBeenCalled();
  });
});
