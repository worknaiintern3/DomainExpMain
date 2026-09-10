import {
  InventoryIdParamsSchema,
  InventoryListQuerySchema,
  type ApplicationResponse,
  type CloudResourceResponse,
  type DomainResponse,
  type EmailAccountResponse,
  type ProjectResponse,
  type ProviderAccountResponse,
  type ServerResponse,
} from '@domainpulse/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';

import {
  InvalidInventoryCursorError,
  InvalidInventoryInputError,
  InvalidInventoryReferenceError,
  InventoryConflictError,
  InventoryRecordNotFoundError,
  InventoryWriteForbiddenError,
} from '../inventory.errors';
import type {
  CreateInventoryCommand,
  InventoryApplicationService,
  InventoryRecordEnvelope,
  InventoryResourceKind,
  InventoryServicePage,
  UpdateInventoryCommand,
} from '../inventory.types';
import type {
  WorkspaceContextRequest,
  WorkspacePrincipal,
} from '../../workspace-context';

export type PublicInventoryRecord =
  | EmailAccountResponse
  | ProviderAccountResponse
  | ProjectResponse
  | DomainResponse
  | ServerResponse
  | CloudResourceResponse
  | ApplicationResponse;

export interface PublicInventoryPage {
  readonly items: readonly PublicInventoryRecord[];
  readonly nextCursor: string | null;
}

function parseRequest<T>(
  schema: z.ZodType<T>,
  input: unknown,
  failureMessage: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException(failureMessage);
  }
  return result.data;
}

function getWorkspacePrincipal(
  request: WorkspaceContextRequest,
): WorkspacePrincipal {
  if (!request.workspacePrincipal) {
    throw new UnauthorizedException('Authentication required');
  }
  return request.workspacePrincipal;
}

export async function executeInventoryOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InventoryWriteForbiddenError) {
      throw new ForbiddenException('Inventory write access denied');
    }
    if (error instanceof InventoryRecordNotFoundError) {
      throw new NotFoundException('Inventory record not found');
    }
    if (error instanceof InventoryConflictError) {
      throw new ConflictException(
        'Inventory record conflicts with an existing record',
      );
    }
    if (error instanceof InvalidInventoryReferenceError) {
      throw new BadRequestException('Invalid inventory reference');
    }
    if (error instanceof InvalidInventoryCursorError) {
      throw new BadRequestException('Invalid inventory cursor');
    }
    if (error instanceof InvalidInventoryInputError) {
      throw new BadRequestException('Invalid inventory input');
    }
    throw error;
  }
}

function metadata(record: InventoryRecordEnvelope['record']) {
  return {
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    inventoryState: record.inventoryState,
    provenance: record.provenance,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function presentInventoryRecord(
  result: InventoryRecordEnvelope,
): PublicInventoryRecord {
  switch (result.resource) {
    case 'email-account':
      return {
        ...metadata(result.record),
        email: result.record.email,
        label: result.record.label,
        notes: result.record.notes,
      };
    case 'provider-account':
      return {
        ...metadata(result.record),
        externalAccountId: result.record.externalAccountId,
        label: result.record.label,
        loginEmailAccountId: result.record.loginEmailAccountId,
        notes: result.record.notes,
        providerKey: result.record.providerKey,
      };
    case 'project':
      return {
        ...metadata(result.record),
        description: result.record.description,
        name: result.record.name,
      };
    case 'domain':
      return {
        ...metadata(result.record),
        autoRenew: result.record.autoRenew,
        dnsProviderAccountId: result.record.dnsProviderAccountId,
        domainName: result.record.domainName,
        expiresAt: result.record.expiresAt?.toISOString() ?? null,
        notes: result.record.notes,
        registeredAt: result.record.registeredAt?.toISOString() ?? null,
        registrarProviderAccountId: result.record.registrarProviderAccountId,
      };
    case 'server':
      return {
        ...metadata(result.record),
        hostname: result.record.hostname,
        name: result.record.name,
        notes: result.record.notes,
        operatingSystem: result.record.operatingSystem,
        primaryIp: result.record.primaryIp,
        providerAccountId: result.record.providerAccountId,
        region: result.record.region,
        serverKind: result.record.serverKind,
      };
    case 'cloud-resource':
      return {
        ...metadata(result.record),
        externalResourceId: result.record.externalResourceId,
        name: result.record.name,
        notes: result.record.notes,
        providerAccountId: result.record.providerAccountId,
        region: result.record.region,
        resourceType: result.record.resourceType,
      };
    case 'application':
      return {
        ...metadata(result.record),
        kind: result.record.kind,
        name: result.record.name,
        notes: result.record.notes,
        primaryDomainId: result.record.primaryDomainId,
        primaryUrl: result.record.primaryUrl,
        projectId: result.record.projectId,
      };
  }
}

export class InventoryResourceHttpHandler<TCreate, TUpdate> {
  constructor(
    private readonly service: InventoryApplicationService,
    private readonly resource: InventoryResourceKind,
    private readonly createSchema: z.ZodType<TCreate>,
    private readonly updateSchema: z.ZodType<TUpdate>,
    private readonly createCommand: (input: TCreate) => CreateInventoryCommand,
    private readonly updateCommand: (input: TUpdate) => UpdateInventoryCommand,
  ) {}

  async create(
    request: WorkspaceContextRequest,
    body: unknown,
  ): Promise<PublicInventoryRecord> {
    const principal = getWorkspacePrincipal(request);
    const input = parseRequest(
      this.createSchema,
      body,
      'Invalid inventory create request',
    );
    const result = await executeInventoryOperation(() =>
      this.service.create(principal, this.createCommand(input)),
    );
    return presentInventoryRecord(result);
  }

  async list(
    request: WorkspaceContextRequest,
    query: unknown,
  ): Promise<PublicInventoryPage> {
    const principal = getWorkspacePrincipal(request);
    const parsedQuery = parseRequest(
      InventoryListQuerySchema,
      query,
      'Invalid inventory list request',
    );
    const page = await executeInventoryOperation(() =>
      this.service.list(principal, this.resource, parsedQuery),
    );
    return this.presentPage(page);
  }

  async get(
    request: WorkspaceContextRequest,
    params: unknown,
  ): Promise<PublicInventoryRecord> {
    const principal = getWorkspacePrincipal(request);
    const { id } = parseRequest(
      InventoryIdParamsSchema,
      params,
      'Invalid inventory record identifier',
    );
    const result = await executeInventoryOperation(() =>
      this.service.get(principal, this.resource, id),
    );
    return presentInventoryRecord(result);
  }

  async update(
    request: WorkspaceContextRequest,
    params: unknown,
    body: unknown,
  ): Promise<PublicInventoryRecord> {
    const principal = getWorkspacePrincipal(request);
    const { id } = parseRequest(
      InventoryIdParamsSchema,
      params,
      'Invalid inventory record identifier',
    );
    const input = parseRequest(
      this.updateSchema,
      body,
      'Invalid inventory update request',
    );
    const result = await executeInventoryOperation(() =>
      this.service.update(principal, id, this.updateCommand(input)),
    );
    return presentInventoryRecord(result);
  }

  async archive(
    request: WorkspaceContextRequest,
    params: unknown,
  ): Promise<void> {
    const principal = getWorkspacePrincipal(request);
    const { id } = parseRequest(
      InventoryIdParamsSchema,
      params,
      'Invalid inventory record identifier',
    );
    await executeInventoryOperation(() =>
      this.service.archive(principal, this.resource, id),
    );
  }

  private presentPage(page: InventoryServicePage): PublicInventoryPage {
    return {
      items: page.items.map(presentInventoryRecord),
      nextCursor: page.nextCursor,
    };
  }
}
