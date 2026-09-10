import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import type { DatabaseTransaction } from '../src/client/database-types';
import {
  cloudResources,
  domains,
  inventoryNodes,
  projects,
  providerAccounts,
  servers,
  websiteApplications,
  workspaces,
} from '../src/schema';

export interface InventoryGraphFixture {
  readonly cloudResourceId: string;
  readonly cloudResourceNodeId: string;
  readonly domainId: string;
  readonly domainNodeId: string;
  readonly projectId: string;
  readonly projectNodeId: string;
  readonly providerAccountId: string;
  readonly serverId: string;
  readonly serverNodeId: string;
  readonly websiteApplicationId: string;
  readonly websiteApplicationNodeId: string;
  readonly workspaceId: string;
}

export async function createInventoryGraphWorkspace(
  transaction: DatabaseTransaction,
  label: string,
): Promise<string> {
  const workspaceId = randomUUID();
  await transaction.insert(workspaces).values({
    id: workspaceId,
    name: `${label} graph workspace`,
    slug: `${label}-${workspaceId}`,
  });
  return workspaceId;
}

async function getNodeId(
  transaction: DatabaseTransaction,
  workspaceId: string,
  entityKind:
    | 'PROJECT'
    | 'DOMAIN'
    | 'SERVER'
    | 'CLOUD_RESOURCE'
    | 'WEBSITE_APPLICATION',
  entityId: string,
): Promise<string> {
  const [node] = await transaction
    .select({ nodeId: inventoryNodes.nodeId })
    .from(inventoryNodes)
    .where(
      and(
        eq(inventoryNodes.workspaceId, workspaceId),
        eq(inventoryNodes.entityKind, entityKind),
        eq(inventoryNodes.entityId, entityId),
      ),
    );
  if (!node) {
    throw new Error('Inventory graph fixture node was not created');
  }
  return node.nodeId;
}

export async function createInventoryGraphFixture(
  transaction: DatabaseTransaction,
  workspaceId: string,
  label: string,
): Promise<InventoryGraphFixture> {
  const providerAccountId = randomUUID();
  const projectId = randomUUID();
  const domainId = randomUUID();
  const serverId = randomUUID();
  const cloudResourceId = randomUUID();
  const websiteApplicationId = randomUUID();

  await transaction.insert(providerAccounts).values({
    id: providerAccountId,
    label: `${label} graph provider`,
    providerKey: 'graph_provider',
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(projects).values({
    id: projectId,
    name: `${label} graph project`,
    normalizedName: `${label} graph project`,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(domains).values({
    domainName: `${label}-${domainId}.example`,
    id: domainId,
    normalizedDomainName: `${label}-${domainId}.example`,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(servers).values({
    id: serverId,
    name: `${label} graph server`,
    providerAccountId,
    provenance: 'USER_ADDED',
    workspaceId,
  });
  await transaction.insert(cloudResources).values({
    id: cloudResourceId,
    name: `${label} graph cloud resource`,
    providerAccountId,
    provenance: 'USER_ADDED',
    resourceType: 'compute',
    workspaceId,
  });
  await transaction.insert(websiteApplications).values({
    id: websiteApplicationId,
    kind: 'WEB_APPLICATION',
    name: `${label} graph application`,
    provenance: 'USER_ADDED',
    workspaceId,
  });

  return {
    cloudResourceId,
    cloudResourceNodeId: await getNodeId(
      transaction,
      workspaceId,
      'CLOUD_RESOURCE',
      cloudResourceId,
    ),
    domainId,
    domainNodeId: await getNodeId(
      transaction,
      workspaceId,
      'DOMAIN',
      domainId,
    ),
    projectId,
    projectNodeId: await getNodeId(
      transaction,
      workspaceId,
      'PROJECT',
      projectId,
    ),
    providerAccountId,
    serverId,
    serverNodeId: await getNodeId(
      transaction,
      workspaceId,
      'SERVER',
      serverId,
    ),
    websiteApplicationId,
    websiteApplicationNodeId: await getNodeId(
      transaction,
      workspaceId,
      'WEBSITE_APPLICATION',
      websiteApplicationId,
    ),
    workspaceId,
  };
}
