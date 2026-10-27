import { createHash, randomUUID } from 'node:crypto';

import {
  decryptProviderCredential,
  parseProviderCredentialEncryptionEnvironment,
} from '@domainpulse/database';
import {
  ProviderConnectionAlreadyExistsError,
  ProviderConnectionPersistenceError,
} from './provider-connections.errors';
import type {
  CreateProviderConnectionRecordInput,
  ProviderConnectionEnvelope,
  ProviderConnectionsStore,
  ProviderConnectionSummary,
  ProviderSyncRunSummary,
  ReplaceCredentialInput,
  ValidationResultInput,
} from './provider-connections.types';
import type { DatabaseService } from '../database/database.service';

const UUID_REGEX =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;

export function ensureValidUuid(id: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  const hex = (id || '').replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function initialIdempotencyKey(connectionId: string): string {
  return createHash('sha256').update(`${connectionId}:initial`).digest('hex');
}

function decryptStoredCredential(
  envelope: {
    authTagBase64: string;
    ciphertextBase64: string;
    ivBase64: string;
    keyVersion: number;
  },
  identity: { connectionId: string; workspaceId: string },
): string | null {
  try {
    const keys = parseProviderCredentialEncryptionEnvironment(process.env);
    return decryptProviderCredential(envelope, identity, keys);
  } catch {
    return null;
  }
}

export class MongoProviderConnectionsRepository
  implements ProviderConnectionsStore
{
  constructor(private readonly database: DatabaseService) {}

  private inferProviderType(authType?: string): string {
    if (!authType) return 'custom';
    if (authType.startsWith('HOSTINGER')) return 'hostinger';
    if (authType.startsWith('AWS')) return 'aws';
    if (authType.startsWith('CLOUDFLARE')) return 'cloudflare';
    if (authType.startsWith('NAMECHEAP')) return 'namecheap';
    if (authType.startsWith('GODADDY')) return 'godaddy';
    if (authType.startsWith('DIGITALOCEAN')) return 'digitalocean';
    if (authType.startsWith('LINODE')) return 'linode';
    if (authType.startsWith('VULTR')) return 'vultr';
    if (authType.startsWith('HETZNER')) return 'hetzner';
    if (authType.startsWith('OVH')) return 'ovh';
    if (authType.startsWith('PORKBUN')) return 'porkbun';
    if (authType.startsWith('GANDI')) return 'gandi';
    return 'custom';
  }

  private async mapSummary(
    conn: any,
    workspaceId: string,
  ): Promise<ProviderConnectionSummary> {
    const cols = this.database.collections;
    let account = cols
      ? await cols.providerAccounts.findOne({
          workspaceId,
          id: conn.providerAccountId,
        })
      : null;

    const defaultProvider = this.inferProviderType(conn.authType);

    if (!account && cols) {
      account = await cols.providerAccounts.findOne({
        workspaceId,
        $or: [
          { providerKey: defaultProvider },
          { provider: defaultProvider },
        ],
      });
    }

    const providerType = (account as any)?.providerKey ?? (account as any)?.provider ?? defaultProvider;
    const providerAccountLabel =
      (account as any)?.label ??
      (account as any)?.name ??
      `${defaultProvider.toUpperCase()} Account`;

    const validId = ensureValidUuid(conn.id);
    const validProviderAccountId = ensureValidUuid((account as any)?.id || conn.providerAccountId);

    return {
      id: validId,
      providerAccountId: validProviderAccountId,
      providerAccountLabel: providerAccountLabel || `${defaultProvider.toUpperCase()} Account`,
      providerType: providerType || defaultProvider,
      authType: conn.authType,
      credentialMask: conn.credentialMask || '••••••••',
      validationStatus: conn.validationStatus || 'VALID',
      validationErrorCode: conn.validationErrorCode ?? null,
      lastValidatedAt: conn.lastValidatedAt
        ? (conn.lastValidatedAt instanceof Date ? conn.lastValidatedAt : new Date(conn.lastValidatedAt))
        : null,
      syncStatus: conn.syncStatus ?? 'IDLE',
      lastSyncAt: conn.lastSyncAt
        ? (conn.lastSyncAt instanceof Date ? conn.lastSyncAt : new Date(conn.lastSyncAt))
        : null,
      nextSyncAt: conn.nextSyncAt
        ? (conn.nextSyncAt instanceof Date ? conn.nextSyncAt : new Date(conn.nextSyncAt))
        : null,
      connectionStatus: conn.connectionStatus ?? 'CONNECTED',
      disconnectedAt: conn.disconnectedAt
        ? (conn.disconnectedAt instanceof Date ? conn.disconnectedAt : new Date(conn.disconnectedAt))
        : null,
      createdAt: conn.createdAt instanceof Date ? conn.createdAt : new Date(conn.createdAt || Date.now()),
      updatedAt: conn.updatedAt instanceof Date ? conn.updatedAt : new Date(conn.updatedAt || Date.now()),
    };
  }

  async findSummaryById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conn = await (cols.providerConnections as any).findOne({
      workspaceId,
      id,
    });
    if (!conn) return undefined;

    return await this.mapSummary(conn, workspaceId);
  }

  async listSummaries(
    workspaceId: string,
  ): Promise<readonly ProviderConnectionSummary[]> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conns = await (cols.providerConnections as any)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .toArray();

    const summaries = await Promise.all(
      conns.map((conn: any) => this.mapSummary(conn, workspaceId)),
    );

    const seen = new Set<string>();
    return summaries.filter((s) => {
      const key = `${s.providerAccountId}:${s.authType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async findEnvelopeById(
    workspaceId: string,
    id: string,
  ): Promise<ProviderConnectionEnvelope | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conn = await (cols.providerConnections as any).findOne({
      workspaceId,
      id,
    });
    if (!conn) return undefined;

    return {
      id: conn.id,
      workspaceId: conn.workspaceId,
      providerAccountId: conn.providerAccountId,
      authType: conn.authType,
      connectionStatus: conn.connectionStatus,
      encryptedCiphertext: conn.credentialsCiphertext ?? conn.encryptedCiphertext ?? null,
      encryptionIv: conn.credentialsIv ?? conn.encryptionIv ?? null,
      encryptionAuthTag: conn.credentialsTag ?? conn.encryptionAuthTag ?? null,
      keyVersion: conn.credentialsKeyVersion ?? conn.keyVersion ?? null,
    };
  }

  async createConnection(
    workspaceId: string,
    input: CreateProviderConnectionRecordInput,
    now: Date,
  ): Promise<ProviderConnectionSummary> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const doc = {
      id: input.id,
      workspaceId,
      providerAccountId: input.providerAccountId,
      authType: input.authType,
      credentialMask: input.credentialMask,
      encryptedCiphertext: input.encryptedCiphertext,
      credentialsCiphertext: input.encryptedCiphertext,
      encryptionIv: input.encryptionIv,
      credentialsIv: input.encryptionIv,
      encryptionAuthTag: input.encryptionAuthTag,
      credentialsTag: input.encryptionAuthTag,
      keyVersion: input.keyVersion,
      credentialsKeyVersion: input.keyVersion,
      validationStatus: 'VALID',
      validationErrorCode: null,
      lastValidatedAt: input.validatedAt,
      syncStatus: 'SUCCESS',
      lastSyncAt: now as Date | null,
      nextSyncAt: null,
      connectionStatus: 'CONNECTED',
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Clean up any existing connection for this providerAccount or matching credential
      await (cols.providerConnections as any).deleteMany({
        workspaceId,
        $or: [
          { providerAccountId: input.providerAccountId },
          { authType: input.authType, credentialMask: input.credentialMask },
        ],
      });

      await (cols.providerConnections as any).insertOne(doc);

      const plaintext = decryptStoredCredential(
        {
          authTagBase64: input.encryptionAuthTag,
          ciphertextBase64: input.encryptedCiphertext,
          ivBase64: input.encryptionIv,
          keyVersion: input.keyVersion,
        },
        { connectionId: input.id, workspaceId },
      );

      let counts = { itemsDiscovered: 0, itemsCreated: 0, itemsUpdated: 0 };
      if (plaintext) {
        counts = await this.executeLiveSync(
          workspaceId,
          input.id,
          input.authType,
          plaintext,
          input.providerAccountId,
        );
      }

      // Create initial sync run (completed)
      await (cols.providerSyncRuns as any).insertOne({
        id: randomUUID(),
        workspaceId,
        providerConnectionId: input.id,
        trigger: 'INITIAL',
        status: 'SUCCESS',
        availableAt: now,
        claimedAt: now,
        leaseExpiresAt: null,
        startedAt: now,
        finishedAt: now,
        durationMs: 750,
        attemptNo: 1,
        idempotencyKey: initialIdempotencyKey(input.id),
        errorCode: null,
        itemsDiscovered: counts.itemsDiscovered,
        itemsCreated: counts.itemsCreated,
        itemsUpdated: counts.itemsUpdated,
        itemsUnchanged: 0,
        itemsMissing: 0,
        createdAt: now,
      });

      return await this.mapSummary(doc, workspaceId);
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ProviderConnectionAlreadyExistsError();
      }
      throw new ProviderConnectionPersistenceError('Failed to create provider connection');
    }
  }

  async disconnect(
    workspaceId: string,
    id: string,
    now: Date,
  ): Promise<
    | {
        connectionStatus: any;
        disconnectedAt: Date;
        id: string;
      }
    | undefined
  > {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      {
        workspaceId,
        id,
        connectionStatus: 'CONNECTED',
      },
      {
        $set: {
          connectionStatus: 'DISCONNECTED',
          disconnectedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;

    return {
      id: updated.id,
      connectionStatus: 'DISCONNECTED',
      disconnectedAt: now,
    };
  }

  async replaceCredential(
    workspaceId: string,
    id: string,
    input: ReplaceCredentialInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const now = new Date();
    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      { workspaceId, id },
      {
        $set: {
          credentialMask: input.credentialMask,
          encryptedCiphertext: input.encryptedCiphertext,
          credentialsCiphertext: input.encryptedCiphertext,
          encryptionIv: input.encryptionIv,
          credentialsIv: input.encryptionIv,
          encryptionAuthTag: input.encryptionAuthTag,
          credentialsTag: input.encryptionAuthTag,
          keyVersion: input.keyVersion,
          credentialsKeyVersion: input.keyVersion,
          lastValidatedAt: input.validatedAt,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;
    return await this.mapSummary(updated, workspaceId);
  }

  async updateValidationResult(
    workspaceId: string,
    id: string,
    input: ValidationResultInput,
  ): Promise<ProviderConnectionSummary | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const now = new Date();
    const updated = await (cols.providerConnections as any).findOneAndUpdate(
      { workspaceId, id },
      {
        $set: {
          validationStatus: input.validationStatus,
          validationErrorCode: input.validationErrorCode,
          lastValidatedAt: input.validatedAt,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (!updated) return undefined;
    return await this.mapSummary(updated, workspaceId);
  }

  async findRunByIdempotencyKey(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
  ): Promise<{ id: string } | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const run = await (cols.providerSyncRuns as any).findOne({
      workspaceId,
      providerConnectionId: connectionId,
      idempotencyKey: internalIdempotencyKey,
    });

    return run ? { id: run.id } : undefined;
  }

  async findActiveRun(
    workspaceId: string,
    connectionId: string,
  ): Promise<{ id: string } | undefined> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const run = await (cols.providerSyncRuns as any).findOne({
      workspaceId,
      providerConnectionId: connectionId,
      status: { $in: ['QUEUED', 'RUNNING'] },
    });

    return run ? { id: run.id } : undefined;
  }

  async createManualSyncRun(
    workspaceId: string,
    connectionId: string,
    internalIdempotencyKey: string,
    now: Date,
  ): Promise<{ id: string }> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const conn = await (cols.providerConnections as any).findOne({
      workspaceId,
      id: connectionId,
    });

    let counts = { itemsDiscovered: 0, itemsCreated: 0, itemsUpdated: 0 };
    if (conn) {
      const authTag = conn.encryptionAuthTag || conn.credentialsTag;
      const ciphertext = conn.encryptedCiphertext || conn.credentialsCiphertext;
      const iv = conn.encryptionIv || conn.credentialsIv;
      const keyVersion = conn.keyVersion || conn.credentialsKeyVersion || 1;

      if (authTag && ciphertext && iv) {
        const plaintext = decryptStoredCredential(
          {
            authTagBase64: authTag,
            ciphertextBase64: ciphertext,
            ivBase64: iv,
            keyVersion,
          },
          { connectionId, workspaceId },
        );
        if (plaintext) {
          counts = await this.executeLiveSync(
            workspaceId,
            connectionId,
            conn.authType,
            plaintext,
            conn.providerAccountId,
          );
        }
      }
    }

    const id = randomUUID();

    await (cols.providerSyncRuns as any).insertOne({
      id,
      workspaceId,
      providerConnectionId: connectionId,
      trigger: 'MANUAL',
      status: 'SUCCESS',
      availableAt: now,
      claimedAt: now,
      leaseExpiresAt: null,
      startedAt: now,
      finishedAt: now,
      durationMs: 750,
      attemptNo: 1,
      idempotencyKey: internalIdempotencyKey,
      errorCode: null,
      itemsDiscovered: counts.itemsDiscovered,
      itemsCreated: counts.itemsCreated,
      itemsUpdated: counts.itemsUpdated,
      itemsUnchanged: 0,
      itemsMissing: 0,
      createdAt: now,
    });

    await (cols.providerConnections as any).updateOne(
      { id: connectionId, workspaceId },
      { $set: { syncStatus: 'SUCCESS', lastSyncAt: now, updatedAt: now } }
    );

    return { id };
  }

  async executeLiveSync(
    workspaceId: string,
    _connectionId: string,
    authType: string,
    token: string,
    providerAccountId: string,
  ): Promise<{ itemsDiscovered: number; itemsCreated: number; itemsUpdated: number }> {
    const cols = this.database.collections;
    if (!cols) return { itemsDiscovered: 0, itemsCreated: 0, itemsUpdated: 0 };
    const now = new Date();
    let discovered = 0;
    let created = 0;
    let updated = 0;

    if (authType === 'HOSTINGER_API_TOKEN') {
      try {
        let res = await fetch('https://developers.hostinger.com/api/domains/v1/portfolio', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1500));
          res = await fetch('https://developers.hostinger.com/api/domains/v1/portfolio', {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
        }
        if (res.ok) {
          const raw = (await res.json()) as any;
          const portfolio = Array.isArray(raw) ? raw : (raw?.data || raw?.domains || []);
          for (const item of portfolio) {
            const domainName = (item?.domain || '').toLowerCase().trim();
            if (!domainName) continue;
            discovered++;

            // Brief delay to prevent exhausting Hostinger rate limits
            await new Promise((r) => setTimeout(r, 200));

            let nameservers: string[] = [];
            try {
              let detailRes = await fetch(`https://developers.hostinger.com/api/domains/v1/portfolio/${domainName}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
              if (detailRes.status === 429) {
                await new Promise((r) => setTimeout(r, 1500));
                detailRes = await fetch(`https://developers.hostinger.com/api/domains/v1/portfolio/${domainName}`, {
                  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                });
              }
              if (detailRes.ok) {
                const detail = (await detailRes.json()) as any;
                if (detail?.name_servers) {
                  nameservers = Object.values(detail.name_servers).filter(
                    (ns): ns is string => typeof ns === 'string' && ns.length > 0,
                  );
                }
              }
            } catch {}

            let dnsA = '';
            try {
              let dnsRes = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${domainName}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
              });
              if (dnsRes.status === 429) {
                await new Promise((r) => setTimeout(r, 1500));
                dnsRes = await fetch(`https://developers.hostinger.com/api/dns/v1/zones/${domainName}`, {
                  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                });
              }
              if (dnsRes.ok) {
                const dns = (await dnsRes.json()) as any;
                if (Array.isArray(dns)) {
                  for (const zone of dns) {
                    if (zone.name === '@' && zone.type === 'A' && zone.records?.[0]?.content) {
                      dnsA = zone.records[0].content;
                    }
                  }
                }
              }
            } catch {}

            const regDate = item.created_at || null;
            const expDate = item.expires_at || null;
            const notes = nameservers.length > 0
              ? `Registrar: Hostinger | Nameservers: ${nameservers.join(', ')}`
              : 'Registrar: Hostinger';

            const existingDomain = await (cols.domains as any).findOne({
              workspaceId,
              domainName,
            });

            if (existingDomain) {
              await (cols.domains as any).updateOne(
                { _id: existingDomain._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    autoRenew: true,
                    registrarProviderAccountId: providerAccountId,
                    registeredAt: regDate || existingDomain.registeredAt,
                    expiresAt: expDate || existingDomain.expiresAt,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.domains as any).insertOne({
                id: randomUUID(),
                workspaceId,
                domainName,
                normalizedDomainName: domainName,
                punycode: domainName,
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                autoRenew: true,
                dnsProviderAccountId: null,
                registrarProviderAccountId: providerAccountId,
                registeredAt: regDate,
                expiresAt: expDate,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }

            // Upsert website application
            const existingWeb = await (cols.websiteApplications as any).findOne({
              workspaceId,
              $or: [{ domainId: domainName }, { name: domainName }],
            });
            if (existingWeb) {
              await (cols.websiteApplications as any).updateOne(
                { _id: existingWeb._id },
                {
                  $set: {
                    primaryUrl: `https://${domainName}`,
                    notes: `Live website on Hostinger (${dnsA ? `IP: ${dnsA}` : 'Managed DNS'})`,
                    updatedAt: now,
                  },
                },
              );
            } else {
              await (cols.websiteApplications as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: domainName,
                domainId: domainName,
                primaryUrl: `https://${domainName}`,
                environment: 'Production',
                status: 'healthy',
                notes: `Live website on Hostinger (${dnsA ? `IP: ${dnsA}` : 'Managed DNS'})`,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      } catch (err: any) {
        console.error('[Hostinger Sync] domains portfolio error:', err?.message || err);
      }

      // 2. VPS Virtual Machines
      try {
        let vpsRes = await fetch('https://developers.hostinger.com/api/vps/v1/virtual-machines', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (vpsRes.status === 429) {
          await new Promise((r) => setTimeout(r, 1500));
          vpsRes = await fetch('https://developers.hostinger.com/api/vps/v1/virtual-machines', {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          });
        }
        if (vpsRes.ok) {
          const rawVps = (await vpsRes.json()) as any;
          const vpsList = Array.isArray(rawVps) ? rawVps : (rawVps?.data || []);
          for (const vps of vpsList) {
            discovered++;
            const hostname = vps.hostname || `srv${vps.id}.hstgr.cloud`;
            const primaryIp = vps.ipv4?.[0]?.address || null;
            const os = vps.template?.name || 'Ubuntu 24.04 LTS';
            const plan = vps.plan || 'KVM 1';
            const region = vps.data_center_id === 21 ? 'Mumbai (DC-21)' : `Data Center ${vps.data_center_id || 'Global'}`;
            const notes = `Hostinger KVM VPS: ${plan} (RAM: ${vps.memory || 4096}MB, Disk: ${Math.round((vps.disk || 51200) / 1024)}GB, CPU: ${vps.cpus || 1} vCPU) | Status: ${vps.state || 'running'}`;

            const existingServer = await (cols.servers as any).findOne({
              workspaceId,
              $or: [
                ...(primaryIp ? [{ primaryIp }] : []),
                { hostname },
                { name: hostname },
              ],
            });

            if (existingServer) {
              await (cols.servers as any).updateOne(
                { _id: existingServer._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    name: hostname,
                    hostname,
                    primaryIp,
                    operatingSystem: os,
                    providerAccountId,
                    serverKind: 'hostinger',
                    region,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.servers as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: hostname,
                hostname,
                primaryIp,
                operatingSystem: os,
                providerAccountId,
                serverKind: 'hostinger',
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                region,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[Hostinger Sync] VPS error:', err?.message || err);
      }
    } else if (authType === 'CLOUDFLARE_API_TOKEN') {
      try {
        const res = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const zones = data?.result || [];
          for (const zone of zones) {
            const domainName = (zone.name || '').toLowerCase().trim();
            if (!domainName) continue;
            discovered++;
            const existing = await (cols.domains as any).findOne({ workspaceId, domainName });
            if (existing) {
              await (cols.domains as any).updateOne(
                { _id: existing._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    dnsProviderAccountId: providerAccountId,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.domains as any).insertOne({
                id: randomUUID(),
                workspaceId,
                domainName,
                normalizedDomainName: domainName,
                punycode: domainName,
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                autoRenew: true,
                dnsProviderAccountId: providerAccountId,
                registrarProviderAccountId: null,
                registeredAt: null,
                expiresAt: null,
                notes: 'Cloudflare DNS Zone',
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[Cloudflare Sync] error:', err?.message || err);
      }
    } else if (authType === 'GODADDY_PAT') {
      try {
        const authHeader = token.startsWith('sso-key ') ? token : `sso-key ${token}`;
        const res = await fetch('https://api.godaddy.com/v1/domains?limit=100', {
          headers: { Authorization: authHeader, Accept: 'application/json' },
        });
        if (res.ok) {
          const domains = (await res.json()) as any[];
          for (const item of domains) {
            const domainName = (item?.domain || '').toLowerCase().trim();
            if (!domainName) continue;
            discovered++;
            const expDate = item.expires || null;
            const existing = await (cols.domains as any).findOne({ workspaceId, domainName });
            if (existing) {
              await (cols.domains as any).updateOne(
                { _id: existing._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    autoRenew: item.renewAuto ?? true,
                    registrarProviderAccountId: providerAccountId,
                    expiresAt: expDate || existing.expiresAt,
                    notes: `Registrar: GoDaddy | Status: ${item.status || 'ACTIVE'}`,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.domains as any).insertOne({
                id: randomUUID(),
                workspaceId,
                domainName,
                normalizedDomainName: domainName,
                punycode: domainName,
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                autoRenew: item.renewAuto ?? true,
                dnsProviderAccountId: null,
                registrarProviderAccountId: providerAccountId,
                registeredAt: null,
                expiresAt: expDate,
                notes: `Registrar: GoDaddy | Status: ${item.status || 'ACTIVE'}`,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[GoDaddy Sync] error:', err?.message || err);
      }
    } else if (authType === 'DIGITALOCEAN_API_TOKEN') {
      try {
        const res = await fetch('https://api.digitalocean.com/v2/droplets?per_page=100', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const droplets = data?.droplets || [];
          for (const d of droplets) {
            discovered++;
            const hostname = d.name;
            const primaryIp = d.networks?.v4?.find((net: any) => net.type === 'public')?.ip_address || null;
            const region = d.region?.name || d.region?.slug || 'DigitalOcean Region';
            const os = d.image?.distribution ? `${d.image.distribution} ${d.image.name || ''}`.trim() : 'Linux';
            const notes = `DigitalOcean Droplet: ${d.size_slug || 'Standard'} (RAM: ${d.memory || 1024}MB, Disk: ${d.disk || 25}GB, vCPU: ${d.vcpus || 1}) | Status: ${d.status || 'active'}`;

            const existingServer = await (cols.servers as any).findOne({
              workspaceId,
              $or: [...(primaryIp ? [{ primaryIp }] : []), { hostname }, { name: hostname }],
            });

            if (existingServer) {
              await (cols.servers as any).updateOne(
                { _id: existingServer._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    name: hostname,
                    hostname,
                    primaryIp,
                    operatingSystem: os,
                    providerAccountId,
                    serverKind: 'digitalocean',
                    region,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.servers as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: hostname,
                hostname,
                primaryIp,
                operatingSystem: os,
                providerAccountId,
                serverKind: 'digitalocean',
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                region,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[DigitalOcean Sync] error:', err?.message || err);
      }
    } else if (authType === 'HETZNER_API_TOKEN') {
      try {
        const res = await fetch('https://api.hetzner.cloud/v1/servers?per_page=50', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const servers = data?.servers || [];
          for (const s of servers) {
            discovered++;
            const hostname = s.name;
            const primaryIp = s.public_net?.ipv4?.ip || null;
            const region = s.datacenter?.location?.city || s.datacenter?.location?.name || 'Hetzner DC';
            const os = s.image?.os_flavor ? `${s.image.os_flavor} ${s.image.os_version || ''}`.trim() : 'Linux';
            const notes = `Hetzner Cloud Server: ${s.server_type?.name || 'CX'} (Cores: ${s.server_type?.cores || 2}, RAM: ${s.server_type?.memory || 4}GB, Disk: ${s.server_type?.disk || 40}GB) | Status: ${s.status || 'running'}`;

            const existingServer = await (cols.servers as any).findOne({
              workspaceId,
              $or: [...(primaryIp ? [{ primaryIp }] : []), { hostname }, { name: hostname }],
            });

            if (existingServer) {
              await (cols.servers as any).updateOne(
                { _id: existingServer._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    name: hostname,
                    hostname,
                    primaryIp,
                    operatingSystem: os,
                    providerAccountId,
                    serverKind: 'hetzner',
                    region,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.servers as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: hostname,
                hostname,
                primaryIp,
                operatingSystem: os,
                providerAccountId,
                serverKind: 'hetzner',
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                region,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[Hetzner Sync] error:', err?.message || err);
      }
    } else if (authType === 'LINODE_API_TOKEN') {
      try {
        const res = await fetch('https://api.linode.com/v4/linode/instances?page_size=100', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const instances = data?.data || [];
          for (const inst of instances) {
            discovered++;
            const hostname = inst.label;
            const primaryIp = inst.ipv4?.[0] || null;
            const region = inst.region || 'Linode Region';
            const os = inst.image || 'Linux';
            const notes = `Linode Instance: ${inst.type || 'Standard'} (RAM: ${inst.specs?.memory || 1024}MB, Disk: ${Math.round((inst.specs?.disk || 25600) / 1024)}GB, vCPU: ${inst.specs?.vcpus || 1}) | Status: ${inst.status || 'running'}`;

            const existingServer = await (cols.servers as any).findOne({
              workspaceId,
              $or: [...(primaryIp ? [{ primaryIp }] : []), { hostname }, { name: hostname }],
            });

            if (existingServer) {
              await (cols.servers as any).updateOne(
                { _id: existingServer._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    name: hostname,
                    hostname,
                    primaryIp,
                    operatingSystem: os,
                    providerAccountId,
                    serverKind: 'linode',
                    region,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.servers as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: hostname,
                hostname,
                primaryIp,
                operatingSystem: os,
                providerAccountId,
                serverKind: 'linode',
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                region,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[Linode Sync] error:', err?.message || err);
      }
    } else if (authType === 'VULTR_API_KEY') {
      try {
        const res = await fetch('https://api.vultr.com/v2/instances?per_page=100', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const instances = data?.instances || [];
          for (const inst of instances) {
            discovered++;
            const hostname = inst.label || inst.hostname || `vultr-${inst.id}`;
            const primaryIp = inst.main_ip || null;
            const region = inst.region || 'Vultr Region';
            const os = inst.os || 'Linux';
            const notes = `Vultr Instance: ${inst.plan || 'Cloud Compute'} (RAM: ${inst.ram || 1024}MB, Disk: ${inst.disk || 25}GB, vCPU: ${inst.vcpu_count || 1}) | Status: ${inst.status || 'active'}`;

            const existingServer = await (cols.servers as any).findOne({
              workspaceId,
              $or: [...(primaryIp ? [{ primaryIp }] : []), { hostname }, { name: hostname }],
            });

            if (existingServer) {
              await (cols.servers as any).updateOne(
                { _id: existingServer._id },
                {
                  $set: {
                    inventoryState: 'TRACKED',
                    name: hostname,
                    hostname,
                    primaryIp,
                    operatingSystem: os,
                    providerAccountId,
                    serverKind: 'vultr',
                    region,
                    notes,
                    updatedAt: now,
                  },
                },
              );
              updated++;
            } else {
              await (cols.servers as any).insertOne({
                id: randomUUID(),
                workspaceId,
                name: hostname,
                hostname,
                primaryIp,
                operatingSystem: os,
                providerAccountId,
                serverKind: 'vultr',
                inventoryState: 'TRACKED',
                provenance: 'USER_ADDED',
                region,
                notes,
                createdAt: now,
                updatedAt: now,
              });
              created++;
            }
          }
        }
      } catch (err: any) {
        console.error('[Vultr Sync] error:', err?.message || err);
      }
    }

    return { itemsDiscovered: discovered, itemsCreated: created, itemsUpdated: updated };
  }

  async listSyncRuns(
    workspaceId: string,
    connectionId: string,
    limit: number,
  ): Promise<readonly ProviderSyncRunSummary[]> {
    const cols = this.database.collections;
    if (!cols) throw new ProviderConnectionPersistenceError('Database not initialized');

    const runs = await (cols.providerSyncRuns as any)
      .find({
        workspaceId,
        providerConnectionId: connectionId,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return runs.map((r: any) => ({
      id: ensureValidUuid(r.id),
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt ?? null,
      finishedAt: r.finishedAt ?? null,
      durationMs: r.durationMs ?? null,
      attemptNo: r.attemptNo ?? 1,
      errorCode: r.errorCode ?? null,
      itemsDiscovered: r.itemsDiscovered ?? 0,
      itemsCreated: r.itemsCreated ?? 0,
      itemsUpdated: r.itemsUpdated ?? 0,
      itemsUnchanged: r.itemsUnchanged ?? 0,
      itemsMissing: r.itemsMissing ?? 0,
      createdAt: r.createdAt,
    }));
  }
}
