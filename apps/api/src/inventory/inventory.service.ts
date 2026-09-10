import type {
  CreateApplicationRequest,
  CreateCloudResourceRequest,
  CreateDomainRequest,
  CreateEmailAccountRequest,
  CreateProjectRequest,
  CreateProviderAccountRequest,
  CreateServerRequest,
  UpdateApplicationRequest,
  UpdateCloudResourceRequest,
  UpdateDomainRequest,
  UpdateEmailAccountRequest,
  UpdateProjectRequest,
  UpdateProviderAccountRequest,
  UpdateServerRequest,
} from '@domainpulse/contracts';

import { requireInventoryWriteAccess } from './authorization/inventory-authorization';
import { InventoryRecordNotFoundError } from './inventory.errors';
import type {
  CreateInventoryCommand,
  InventoryApplicationService,
  InventoryRecordEnvelope,
  InventoryResourceKind,
  InventoryServicePage,
  InventoryStore,
  PersistInventoryCreateCommand,
  PersistInventoryUpdateCommand,
  UpdateInventoryCommand,
} from './inventory.types';
import {
  normalizeDomainName,
  normalizeInventoryEmail,
  normalizeOptionalHostname,
  normalizeProjectName,
  validateOptionalIpAddress,
} from './normalization/inventory-normalization';
import {
  decodeInventoryCursor,
  encodeInventoryCursor,
} from './pagination/inventory-pagination';
import type { WorkspacePrincipal } from '../workspace-context';

function cleanRequiredText(value: string): string {
  return value.trim();
}

function cleanNullableText(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.trim();
}

function canonicalKey(value: string): string {
  return value.trim().toLowerCase();
}

function nullableDate(value: string | null | undefined): Date | null {
  return value === null || value === undefined ? null : new Date(value);
}

function normalizeEmailCreate(
  input: CreateEmailAccountRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'email-account',
    values: {
      ...normalizeInventoryEmail(input.email),
      label: cleanNullableText(input.label),
      notes: cleanNullableText(input.notes),
    },
  };
}

function normalizeProviderCreate(
  input: CreateProviderAccountRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'provider-account',
    values: {
      externalAccountId: cleanNullableText(input.externalAccountId),
      label: cleanRequiredText(input.label),
      loginEmailAccountId: input.loginEmailAccountId ?? null,
      notes: cleanNullableText(input.notes),
      providerKey: canonicalKey(input.providerKey),
    },
  };
}

function normalizeProjectCreate(
  input: CreateProjectRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'project',
    values: {
      description: cleanNullableText(input.description),
      ...normalizeProjectName(input.name),
    },
  };
}

function normalizeDomainCreate(
  input: CreateDomainRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'domain',
    values: {
      autoRenew: input.autoRenew ?? null,
      dnsProviderAccountId: input.dnsProviderAccountId ?? null,
      ...normalizeDomainName(input.domainName),
      expiresAt: nullableDate(input.expiresAt),
      notes: cleanNullableText(input.notes),
      registeredAt: nullableDate(input.registeredAt),
      registrarProviderAccountId: input.registrarProviderAccountId ?? null,
    },
  };
}

function normalizeServerCreate(
  input: CreateServerRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'server',
    values: {
      hostname: normalizeOptionalHostname(input.hostname) ?? null,
      name: cleanRequiredText(input.name),
      notes: cleanNullableText(input.notes),
      operatingSystem: cleanNullableText(input.operatingSystem),
      primaryIp: validateOptionalIpAddress(input.primaryIp) ?? null,
      providerAccountId: input.providerAccountId ?? null,
      region: cleanNullableText(input.region),
      serverKind:
        input.serverKind === null || input.serverKind === undefined
          ? null
          : canonicalKey(input.serverKind),
    },
  };
}

function normalizeCloudResourceCreate(
  input: CreateCloudResourceRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'cloud-resource',
    values: {
      externalResourceId: cleanNullableText(input.externalResourceId),
      name: cleanRequiredText(input.name),
      notes: cleanNullableText(input.notes),
      providerAccountId: input.providerAccountId,
      region: cleanNullableText(input.region),
      resourceType: canonicalKey(input.resourceType),
    },
  };
}

function normalizeApplicationCreate(
  input: CreateApplicationRequest,
): PersistInventoryCreateCommand {
  return {
    resource: 'application',
    values: {
      kind: input.kind,
      name: cleanRequiredText(input.name),
      notes: cleanNullableText(input.notes),
      primaryDomainId: input.primaryDomainId ?? null,
      primaryUrl: input.primaryUrl ?? null,
      projectId: input.projectId ?? null,
    },
  };
}

function normalizeCreateCommand(
  command: CreateInventoryCommand,
): PersistInventoryCreateCommand {
  switch (command.resource) {
    case 'email-account':
      return normalizeEmailCreate(command.input);
    case 'provider-account':
      return normalizeProviderCreate(command.input);
    case 'project':
      return normalizeProjectCreate(command.input);
    case 'domain':
      return normalizeDomainCreate(command.input);
    case 'server':
      return normalizeServerCreate(command.input);
    case 'cloud-resource':
      return normalizeCloudResourceCreate(command.input);
    case 'application':
      return normalizeApplicationCreate(command.input);
  }
}

function normalizeEmailUpdate(
  input: UpdateEmailAccountRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'email-account',
    values: {
      ...(input.email === undefined
        ? {}
        : normalizeInventoryEmail(input.email)),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.label === undefined
        ? {}
        : { label: cleanNullableText(input.label) }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      updatedAt,
    },
  };
}

function normalizeProviderUpdate(
  input: UpdateProviderAccountRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'provider-account',
    values: {
      ...(input.externalAccountId === undefined
        ? {}
        : { externalAccountId: cleanNullableText(input.externalAccountId) }),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.label === undefined
        ? {}
        : { label: cleanRequiredText(input.label) }),
      ...(input.loginEmailAccountId === undefined
        ? {}
        : { loginEmailAccountId: input.loginEmailAccountId }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      ...(input.providerKey === undefined
        ? {}
        : { providerKey: canonicalKey(input.providerKey) }),
      updatedAt,
    },
  };
}

function normalizeProjectUpdate(
  input: UpdateProjectRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'project',
    values: {
      ...(input.description === undefined
        ? {}
        : { description: cleanNullableText(input.description) }),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.name === undefined ? {} : normalizeProjectName(input.name)),
      updatedAt,
    },
  };
}

function normalizeDomainUpdate(
  input: UpdateDomainRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'domain',
    values: {
      ...(input.autoRenew === undefined ? {} : { autoRenew: input.autoRenew }),
      ...(input.dnsProviderAccountId === undefined
        ? {}
        : { dnsProviderAccountId: input.dnsProviderAccountId }),
      ...(input.domainName === undefined
        ? {}
        : normalizeDomainName(input.domainName)),
      ...(input.expiresAt === undefined
        ? {}
        : { expiresAt: nullableDate(input.expiresAt) }),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      ...(input.registeredAt === undefined
        ? {}
        : { registeredAt: nullableDate(input.registeredAt) }),
      ...(input.registrarProviderAccountId === undefined
        ? {}
        : { registrarProviderAccountId: input.registrarProviderAccountId }),
      updatedAt,
    },
  };
}

function normalizeServerUpdate(
  input: UpdateServerRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'server',
    values: {
      ...(input.hostname === undefined
        ? {}
        : { hostname: normalizeOptionalHostname(input.hostname) ?? null }),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.name === undefined
        ? {}
        : { name: cleanRequiredText(input.name) }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      ...(input.operatingSystem === undefined
        ? {}
        : { operatingSystem: cleanNullableText(input.operatingSystem) }),
      ...(input.primaryIp === undefined
        ? {}
        : { primaryIp: validateOptionalIpAddress(input.primaryIp) ?? null }),
      ...(input.providerAccountId === undefined
        ? {}
        : { providerAccountId: input.providerAccountId }),
      ...(input.region === undefined
        ? {}
        : { region: cleanNullableText(input.region) }),
      ...(input.serverKind === undefined
        ? {}
        : {
            serverKind:
              input.serverKind === null
                ? null
                : canonicalKey(input.serverKind),
          }),
      updatedAt,
    },
  };
}

function normalizeCloudResourceUpdate(
  input: UpdateCloudResourceRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'cloud-resource',
    values: {
      ...(input.externalResourceId === undefined
        ? {}
        : { externalResourceId: cleanNullableText(input.externalResourceId) }),
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.name === undefined
        ? {}
        : { name: cleanRequiredText(input.name) }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      ...(input.providerAccountId === undefined
        ? {}
        : { providerAccountId: input.providerAccountId }),
      ...(input.region === undefined
        ? {}
        : { region: cleanNullableText(input.region) }),
      ...(input.resourceType === undefined
        ? {}
        : { resourceType: canonicalKey(input.resourceType) }),
      updatedAt,
    },
  };
}

function normalizeApplicationUpdate(
  input: UpdateApplicationRequest,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  return {
    resource: 'application',
    values: {
      ...(input.inventoryState === undefined
        ? {}
        : { inventoryState: input.inventoryState }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.name === undefined
        ? {}
        : { name: cleanRequiredText(input.name) }),
      ...(input.notes === undefined
        ? {}
        : { notes: cleanNullableText(input.notes) }),
      ...(input.primaryDomainId === undefined
        ? {}
        : { primaryDomainId: input.primaryDomainId }),
      ...(input.primaryUrl === undefined
        ? {}
        : { primaryUrl: input.primaryUrl }),
      ...(input.projectId === undefined
        ? {}
        : { projectId: input.projectId }),
      updatedAt,
    },
  };
}

function normalizeUpdateCommand(
  command: UpdateInventoryCommand,
  updatedAt: Date,
): PersistInventoryUpdateCommand {
  switch (command.resource) {
    case 'email-account':
      return normalizeEmailUpdate(command.input, updatedAt);
    case 'provider-account':
      return normalizeProviderUpdate(command.input, updatedAt);
    case 'project':
      return normalizeProjectUpdate(command.input, updatedAt);
    case 'domain':
      return normalizeDomainUpdate(command.input, updatedAt);
    case 'server':
      return normalizeServerUpdate(command.input, updatedAt);
    case 'cloud-resource':
      return normalizeCloudResourceUpdate(command.input, updatedAt);
    case 'application':
      return normalizeApplicationUpdate(command.input, updatedAt);
  }
}

export class InventoryService implements InventoryApplicationService {
  constructor(
    private readonly store: InventoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    principal: WorkspacePrincipal,
    command: CreateInventoryCommand,
  ): Promise<InventoryRecordEnvelope> {
    requireInventoryWriteAccess(principal);
    return await this.store.create(
      principal.workspaceId,
      normalizeCreateCommand(command),
    );
  }

  async list(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    query: Parameters<InventoryApplicationService['list']>[2],
  ): Promise<InventoryServicePage> {
    const cursor = decodeInventoryCursor(query.cursor);
    const page = await this.store.list(principal.workspaceId, resource, {
      ...(cursor === undefined ? {} : { cursor }),
      includeArchived: query.includeArchived,
      limit: query.limit,
    });
    return {
      items: page.items,
      nextCursor:
        page.nextCursor === null
          ? null
          : encodeInventoryCursor(page.nextCursor),
    };
  }

  async get(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<InventoryRecordEnvelope> {
    const record = await this.store.findById(
      principal.workspaceId,
      resource,
      id,
    );
    if (!record) {
      throw new InventoryRecordNotFoundError();
    }
    return record;
  }

  async update(
    principal: WorkspacePrincipal,
    id: string,
    command: UpdateInventoryCommand,
  ): Promise<InventoryRecordEnvelope> {
    requireInventoryWriteAccess(principal);
    const record = await this.store.update(
      principal.workspaceId,
      id,
      normalizeUpdateCommand(command, this.now()),
    );
    if (!record) {
      throw new InventoryRecordNotFoundError();
    }
    return record;
  }

  async archive(
    principal: WorkspacePrincipal,
    resource: InventoryResourceKind,
    id: string,
  ): Promise<void> {
    requireInventoryWriteAccess(principal);
    const archived = await this.store.archive(
      principal.workspaceId,
      resource,
      id,
    );
    if (!archived) {
      throw new InventoryRecordNotFoundError();
    }
  }
}
