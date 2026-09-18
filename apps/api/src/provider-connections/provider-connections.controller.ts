import {
  CreateProviderConnectionApiRequestSchema,
  ManualProviderSyncResponseSchema,
  ProviderConnectionCollectionResponseSchema,
  ProviderConnectionDisconnectResponseSchema,
  ProviderConnectionSummaryResponseSchema,
  ProviderConnectionValidateResponseSchema,
  ProviderSyncRunCollectionResponseSchema,
  ReplaceProviderConnectionCredentialRequestSchema,
  type ManualProviderSyncResponse,
  type ProviderConnectionCollectionResponse,
  type ProviderConnectionDisconnectResponse,
  type ProviderConnectionSummaryResponse,
  type ProviderConnectionValidateResponse,
  type ProviderSyncRunCollectionResponse,
} from '@domainpulse/contracts';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AccessTokenGuard } from '../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../workspace-context';
import {
  InvalidIdempotencyKeyError,
  InvalidProviderAccountError,
  ProviderConnectionAlreadyExistsError,
  ProviderConnectionDisconnectedError,
  ProviderConnectionNotFoundError,
  ProviderConnectionSyncInProgressError,
  ProviderConnectionWriteForbiddenError,
  ProviderCredentialValidationFailedError,
  ProviderValidationAttemptFailedError,
} from './provider-connections.errors';
import { ProviderConnectionsService } from './provider-connections.service';
import type {
  ProviderConnectionSummary,
  ProviderSyncRunSummary,
} from './provider-connections.types';

const ConnectionIdParamsSchema = z.object({ id: z.uuid() });
const SyncRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function getPrincipal(request: WorkspaceContextRequest) {
  if (request.workspacePrincipal === undefined) {
    throw new Error('Workspace principal not resolved');
  }
  return request.workspacePrincipal;
}

function parseOrBadRequest<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException(message);
  }
  return result.data;
}

async function executeProviderConnectionOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ProviderConnectionWriteForbiddenError) {
      throw new ForbiddenException('Provider connection write access denied');
    }
    if (error instanceof ProviderConnectionNotFoundError) {
      throw new NotFoundException('Provider connection not found');
    }
    if (error instanceof ProviderConnectionAlreadyExistsError) {
      throw new ConflictException('A connection already exists for this provider account');
    }
    if (error instanceof ProviderConnectionDisconnectedError) {
      throw new ConflictException('Provider connection is disconnected; reconnect required');
    }
    if (error instanceof ProviderConnectionSyncInProgressError) {
      throw new ConflictException('A provider sync is already in progress for this connection');
    }
    if (error instanceof ProviderCredentialValidationFailedError) {
      // Canonical code kept in the detail text (never raw upstream body/message)
      // so the UI can distinguish AUTH_INVALID / PERMISSION_DENIED / etc.
      throw new BadRequestException(
        `Provider credential validation failed (${error.validationErrorCode})`,
      );
    }
    if (error instanceof ProviderValidationAttemptFailedError) {
      // The validation *attempt* failed for a transient/upstream reason; the
      // previously persisted VALID/INVALID state was deliberately left
      // untouched by the service. 409 (already used elsewhere in this
      // controller for "can't complete against current state") keeps this
      // under the existing Problem Details convention -- any 5xx status
      // has its `detail` blanked by the shared filter, which would drop the
      // safe code the UI needs to distinguish this from other outcomes.
      throw new ConflictException(
        `Provider credential validation attempt failed (${error.providerErrorCode})`,
      );
    }
    if (error instanceof InvalidProviderAccountError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof InvalidIdempotencyKeyError) {
      throw new BadRequestException('Invalid or missing Idempotency-Key header');
    }
    if (error instanceof z.ZodError) {
      throw new BadRequestException('Invalid request');
    }
    throw error;
  }
}

function presentConnection(connection: ProviderConnectionSummary): ProviderConnectionSummaryResponse {
  const presented = {
    authType: connection.authType,
    connectionStatus: connection.connectionStatus,
    createdAt: connection.createdAt.toISOString(),
    credentialMask: connection.credentialMask,
    disconnectedAt: connection.disconnectedAt ? connection.disconnectedAt.toISOString() : null,
    id: connection.id,
    lastSyncAt: connection.lastSyncAt ? connection.lastSyncAt.toISOString() : null,
    lastValidatedAt: connection.lastValidatedAt ? connection.lastValidatedAt.toISOString() : null,
    nextSyncAt: connection.nextSyncAt ? connection.nextSyncAt.toISOString() : null,
    providerAccountId: connection.providerAccountId,
    providerAccountLabel: connection.providerAccountLabel,
    providerType: connection.providerType,
    syncStatus: connection.syncStatus,
    updatedAt: connection.updatedAt.toISOString(),
    validationErrorCode: connection.validationErrorCode,
    validationStatus: connection.validationStatus,
  };
  return ProviderConnectionSummaryResponseSchema.parse(presented);
}

function presentSyncRun(run: ProviderSyncRunSummary) {
  return {
    attemptNo: run.attemptNo,
    createdAt: run.createdAt.toISOString(),
    durationMs: run.durationMs,
    errorCode: run.errorCode,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    id: run.id,
    itemsCreated: run.itemsCreated,
    itemsDiscovered: run.itemsDiscovered,
    itemsMissing: run.itemsMissing,
    itemsUnchanged: run.itemsUnchanged,
    itemsUpdated: run.itemsUpdated,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    status: run.status,
    trigger: run.trigger,
  };
}

@Controller('provider-connections')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class ProviderConnectionsController {
  constructor(
    @Inject(ProviderConnectionsService) private readonly service: ProviderConnectionsService,
  ) {}

  @Get()
  async list(
    @Req() request: WorkspaceContextRequest,
  ): Promise<ProviderConnectionCollectionResponse> {
    const items = await executeProviderConnectionOperation(() =>
      this.service.listConnections(getPrincipal(request)),
    );
    return ProviderConnectionCollectionResponseSchema.parse({
      items: items.map(presentConnection),
    });
  }

  @Get(':id')
  async get(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
  ): Promise<ProviderConnectionSummaryResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const connection = await executeProviderConnectionOperation(() =>
      this.service.getConnection(getPrincipal(request), id),
    );
    return presentConnection(connection);
  }

  @Post()
  async create(
    @Req() request: WorkspaceContextRequest,
    @Body() body: unknown,
  ): Promise<ProviderConnectionSummaryResponse> {
    const parsed = parseOrBadRequest(
      CreateProviderConnectionApiRequestSchema,
      body,
      'Invalid provider connection request',
    );
    const connection = await executeProviderConnectionOperation(() =>
      this.service.createConnection(getPrincipal(request), parsed),
    );
    return presentConnection(connection);
  }

  @Post(':id/validate')
  async validate(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
  ): Promise<ProviderConnectionValidateResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const outcome = await executeProviderConnectionOperation(() =>
      this.service.validateConnection(getPrincipal(request), id),
    );
    return ProviderConnectionValidateResponseSchema.parse(outcome);
  }

  @Put(':id/credentials')
  async replaceCredential(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ): Promise<ProviderConnectionSummaryResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const { credential } = parseOrBadRequest(
      ReplaceProviderConnectionCredentialRequestSchema,
      body,
      'Invalid credential replacement request',
    );
    const connection = await executeProviderConnectionOperation(() =>
      this.service.replaceCredential(getPrincipal(request), id, credential),
    );
    return presentConnection(connection);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async manualSync(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
  ): Promise<ManualProviderSyncResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const rawHeader = request.headers['idempotency-key'];
    const headerValue = typeof rawHeader === 'string' ? rawHeader : rawHeader?.[0];
    const result = await executeProviderConnectionOperation(() =>
      this.service.enqueueManualSync(getPrincipal(request), id, headerValue),
    );
    return ManualProviderSyncResponseSchema.parse(result);
  }

  @Get(':id/sync-runs')
  async listSyncRuns(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Query() query: unknown,
  ): Promise<ProviderSyncRunCollectionResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const { limit } = parseOrBadRequest(SyncRunsQuerySchema, query, 'Invalid sync runs query');
    const runs = await executeProviderConnectionOperation(() =>
      this.service.listSyncRuns(getPrincipal(request), id, limit),
    );
    return ProviderSyncRunCollectionResponseSchema.parse({
      items: runs.map(presentSyncRun),
    });
  }

  @Post(':id/disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
  ): Promise<ProviderConnectionDisconnectResponse> {
    const { id } = parseOrBadRequest(ConnectionIdParamsSchema, params, 'Invalid connection identifier');
    const result = await executeProviderConnectionOperation(() =>
      this.service.disconnect(getPrincipal(request), id),
    );
    return ProviderConnectionDisconnectResponseSchema.parse(result);
  }
}
