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
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  AlertAcknowledgeResponseSchema,
  AlertEventResponseSchema,
  AlertRuleKeySchema,
  AlertRuleResponseSchema,
  AlertsListQuerySchema,
  ManualMonitoringRunRequestSchema,
  ManualMonitoringRunResponseSchema,
  MonitoringRunResponseSchema,
  MonitoringRunsListQuerySchema,
  MonitoringTargetResponseSchema,
  UpdateAlertRuleRequestSchema,
  UpdateMonitoringTargetRequestSchema,
  type AlertAcknowledgeResponse,
  type AlertEventResponse,
  type AlertRuleResponse,
  type ManualMonitoringRunResponse,
  type MonitoringRunResponse,
  type MonitoringTargetApiResponse,
  type MonitoringTargetResponse,
} from '@domainpulse/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { AccessTokenGuard } from '../auth/http';
import {
  WorkspaceContextGuard,
  type WorkspaceContextRequest,
} from '../workspace-context';
import {
  AlertAcknowledgeForbiddenError,
  AlertNotFoundError,
  ArchivalDomainMonitoringError,
  DisabledTargetManualRunError,
  InvalidMonitoringCursorError,
  InvalidMonitoringInputError,
  MonitoringTargetNotFoundError,
  MonitoringWriteForbiddenError,
} from './monitoring.errors';
import { MonitoringService } from './monitoring.service';
import type {
  AlertEvent,
  AlertRule,
  MonitoringRun,
  MonitoringTarget,
} from './monitoring.types';

const DomainIdParamsSchema = z.object({
  domainId: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});
const AlertIdParamsSchema = z.object({ id: z.uuid() });
const AlertRuleKeyParamsSchema = z.object({ key: AlertRuleKeySchema });

function getPrincipal(request: WorkspaceContextRequest) {
  if (request.workspacePrincipal === undefined) {
    throw new Error('Workspace principal not resolved');
  }
  return request.workspacePrincipal;
}

function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const entries = Object.entries(obj).filter((entry) => entry[1] !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

function parseOrBadRequest<T>(
  schema: z.ZodType<T>,
  data: unknown,
  message: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException(message);
  }
  return result.data;
}

async function executeMonitoringOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MonitoringWriteForbiddenError) {
      throw new ForbiddenException('Monitoring write access denied');
    }
    if (
      error instanceof MonitoringTargetNotFoundError
      || error instanceof AlertNotFoundError
    ) {
      throw new NotFoundException('Monitoring resource not found');
    }
    if (error instanceof AlertAcknowledgeForbiddenError) {
      throw new ConflictException('Alert cannot be acknowledged in its current state');
    }
    if (error instanceof ArchivalDomainMonitoringError) {
      throw new ConflictException('Cannot enable monitoring for archived domain');
    }
    if (error instanceof DisabledTargetManualRunError) {
      throw new ConflictException('Cannot trigger manual run for disabled or unconfigured target');
    }
    if (
      error instanceof InvalidMonitoringCursorError
      || error instanceof InvalidMonitoringInputError
    ) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof z.ZodError) {
      throw new BadRequestException('Invalid request');
    }
    throw error;
  }
}

function presentMonitoringTarget(target: MonitoringTarget): MonitoringTargetResponse {
  return {
    checkIntervalMinutes: target.checkIntervalMinutes,
    consecutiveFailures: target.consecutiveFailures,
    createdAt: target.createdAt.toISOString(),
    domainId: target.domainId,
    enabled: target.enabled,
    id: target.id,
    lastRunAt: target.lastRunAt ? target.lastRunAt.toISOString() : null,
    lastRunStatus: target.lastRunStatus,
    nextRunAt: target.nextRunAt ? target.nextRunAt.toISOString() : null,
    updatedAt: target.updatedAt.toISOString(),
  };
}

function presentMonitoringRun(run: MonitoringRun): MonitoringRunResponse {
  const presented = {
    attemptNo: run.attemptNo,
    createdAt: run.createdAt.toISOString(),
    domainId: run.domainId,
    durationMs: run.durationMs,
    errorCode: run.errorCode,
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    id: run.id,
    sourcesAttempted: [...run.sourcesAttempted],
    sourcesSucceeded: [...run.sourcesSucceeded],
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    status: run.status,
    targetId: run.targetId,
    trigger: run.trigger,
  };
  return MonitoringRunResponseSchema.parse(presented);
}

function presentAlertEvent(event: AlertEvent): AlertEventResponse {
  const presented = {
    ackedAt: event.ackedAt ? event.ackedAt.toISOString() : null,
    ackedByUserId: event.ackedByUserId,
    createdAt: event.createdAt.toISOString(),
    detail: event.detail,
    domainId: event.domainId,
    evidence: event.evidence,
    firstSeenAt: event.firstSeenAt.toISOString(),
    id: event.id,
    lastSeenAt: event.lastSeenAt.toISOString(),
    occurrenceCount: event.occurrenceCount,
    resolvedAt: event.resolvedAt ? event.resolvedAt.toISOString() : null,
    ruleId: event.ruleId,
    severity: event.severity,
    status: event.status,
    targetId: event.targetId,
    title: event.title,
    updatedAt: event.updatedAt.toISOString(),
  };
  return AlertEventResponseSchema.parse(presented);
}

function presentAlertRule(rule: AlertRule): AlertRuleResponse {
  const toIso = (val: any) => {
    if (!val) return new Date().toISOString();
    if (val instanceof Date) return val.toISOString();
    try {
      return new Date(val).toISOString();
    } catch {
      return new Date().toISOString();
    }
  };
  const usesDays = rule.key.includes('_EXPIRY_');
  const usesCount = rule.key === 'RETRIEVAL_FAILURE_REPEATED';

  let validId = rule.id;
  if (
    !validId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      validId,
    )
  ) {
    validId = randomUUID();
  }

  const presented = {
    createdAt: toIso(rule.createdAt),
    enabled: Boolean(rule.enabled),
    id: validId,
    key: rule.key,
    severity: rule.severity || 'WARNING',
    thresholdCount: usesCount ? (rule.thresholdCount ?? 3) : null,
    thresholdDays: usesDays ? (rule.thresholdDays ?? 7) : null,
    updatedAt: toIso(rule.updatedAt),
  };
  return AlertRuleResponseSchema.parse(presented);
}

@Controller('domains')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class MonitoringController {
  constructor(@Inject(MonitoringService) private readonly service: MonitoringService) {}

  @Get(':domainId/monitoring')
  async getTarget(
    @Req() request: WorkspaceContextRequest,
    @Param('domainId') domainIdParam: string | undefined,
    @Param() params: unknown,
  ): Promise<MonitoringTargetApiResponse> {
    const parsed = parseOrBadRequest(DomainIdParamsSchema, params, 'Invalid domain identifier');
    const domainId = domainIdParam || parsed.domainId || parsed.id;
    if (!domainId) throw new BadRequestException('Invalid domain identifier');
    const result = await executeMonitoringOperation(() =>
      this.service.getTarget(getPrincipal(request), domainId),
    );
    if ('configured' in result) {
      return result;
    }
    const target = presentMonitoringTarget(result);
    return { configured: true, target: MonitoringTargetResponseSchema.parse(target) };
  }

  @Put(':domainId/monitoring')
  async configureTarget(
    @Req() request: WorkspaceContextRequest,
    @Param('domainId') domainIdParam: string | undefined,
    @Param() params: unknown,
    @Body() body: unknown,
  ): Promise<MonitoringTargetApiResponse> {
    const parsed = parseOrBadRequest(DomainIdParamsSchema, params, 'Invalid domain identifier');
    const domainId = domainIdParam || parsed.domainId || parsed.id;
    if (!domainId) throw new BadRequestException('Invalid domain identifier');
    const parsedBody = parseOrBadRequest(UpdateMonitoringTargetRequestSchema, body, 'Invalid monitoring target request');
    const input = stripUndefined(parsedBody);
    const target = await executeMonitoringOperation(() =>
      this.service.configureTarget(
        getPrincipal(request),
        domainId,
        input as Parameters<MonitoringService['configureTarget']>[2],
      ),
    );
    const presented = presentMonitoringTarget(target);
    return { configured: true, target: MonitoringTargetResponseSchema.parse(presented) };
  }

  @Get(':domainId/monitoring/runs')
  async listRuns(
    @Req() request: WorkspaceContextRequest,
    @Param('domainId') domainIdParam: string | undefined,
    @Param() params: unknown,
    @Query() query: unknown,
  ): Promise<{ items: MonitoringRunResponse[]; nextCursor: string | null }> {
    const parsed = parseOrBadRequest(DomainIdParamsSchema, params, 'Invalid domain identifier');
    const domainId = domainIdParam || parsed.domainId || parsed.id;
    if (!domainId) throw new BadRequestException('Invalid domain identifier');
    const parsedQuery = parseOrBadRequest(MonitoringRunsListQuerySchema, query, 'Invalid monitoring runs query');
    const cleaned = stripUndefined(parsedQuery);
    const page = await executeMonitoringOperation(() =>
      this.service.listRuns(
        getPrincipal(request),
        domainId,
        cleaned as Parameters<MonitoringService['listRuns']>[2],
      ),
    );
    return {
      items: (page.items as readonly MonitoringRun[]).map(presentMonitoringRun),
      nextCursor: page.nextCursor,
    };
  }

  @Post(':domainId/monitoring/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueManualRun(
    @Req() request: WorkspaceContextRequest,
    @Param('domainId') domainIdParam: string | undefined,
    @Param() params: unknown,
  ): Promise<ManualMonitoringRunResponse> {
    const parsed = parseOrBadRequest(DomainIdParamsSchema, params, 'Invalid domain identifier');
    const domainId = domainIdParam || parsed.domainId || parsed.id;
    if (!domainId) throw new BadRequestException('Invalid domain identifier');
    const rawHeader = request.headers['idempotency-key'];
    const headerValue = typeof rawHeader === 'string' ? rawHeader : rawHeader?.[0];
    const { idempotencyKey } = parseOrBadRequest(
      ManualMonitoringRunRequestSchema,
      { idempotencyKey: headerValue },
      'Invalid Idempotency-Key',
    );
    const result = await executeMonitoringOperation(() =>
      this.service.enqueueManualRun(getPrincipal(request), domainId, idempotencyKey),
    );
    return ManualMonitoringRunResponseSchema.parse(result);
  }
}

@Controller('alerts')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class AlertsController {
  constructor(@Inject(MonitoringService) private readonly service: MonitoringService) {}

  @Get()
  async listAlerts(
    @Req() request: WorkspaceContextRequest,
    @Query() query: unknown,
  ): Promise<{ items: AlertEventResponse[]; nextCursor: string | null }> {
    const parsedQuery = parseOrBadRequest(AlertsListQuerySchema, query, 'Invalid alerts query');
    const cleaned = stripUndefined(parsedQuery);
    const page = await executeMonitoringOperation(() =>
      this.service.listAlerts(
        getPrincipal(request),
        cleaned as Parameters<MonitoringService['listAlerts']>[1],
      ),
    );
    return {
      items: (page.items as readonly AlertEvent[]).map(presentAlertEvent),
      nextCursor: page.nextCursor,
    };
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
  ): Promise<AlertAcknowledgeResponse> {
    const { id } = parseOrBadRequest(AlertIdParamsSchema, params, 'Invalid alert identifier');
    const result = await executeMonitoringOperation(() =>
      this.service.acknowledgeAlert(getPrincipal(request), id),
    );
    const payload = {
      id: result.id,
      status: result.status,
      acknowledgedAt: result.acknowledgedAt.toISOString(),
      acknowledgedByUserId: result.acknowledgedByUserId,
    };
    return AlertAcknowledgeResponseSchema.parse(payload);
  }
}

@Controller('alert-rules')
@UseGuards(AccessTokenGuard, WorkspaceContextGuard)
export class AlertRulesController {
  constructor(@Inject(MonitoringService) private readonly service: MonitoringService) {}

  @Get()
  async listRules(
    @Req() request: WorkspaceContextRequest,
  ): Promise<AlertRuleResponse[]> {
    const rules = await executeMonitoringOperation(() =>
      this.service.listAlertRules(getPrincipal(request)),
    );
    return (rules as readonly AlertRule[]).map(presentAlertRule);
  }

  @Patch(':key')
  async updateRule(
    @Req() request: WorkspaceContextRequest,
    @Param() params: unknown,
    @Body() body: unknown,
  ): Promise<AlertRuleResponse> {
    const { key } = parseOrBadRequest(AlertRuleKeyParamsSchema, params, 'Invalid alert rule key');
    const rawInput = parseOrBadRequest(UpdateAlertRuleRequestSchema, body, 'Invalid alert rule request');
    const stripped = stripUndefined(rawInput);
    const rule = await executeMonitoringOperation(() =>
      this.service.updateAlertRule(
        getPrincipal(request),
        key,
        stripped as Parameters<MonitoringService['updateAlertRule']>[2],
      ),
    );
    return presentAlertRule(rule as AlertRule);
  }
}
