import { z } from 'zod';

const PostgreSqlIntegerSchema = z.number().int().min(0).max(2_147_483_647);
const NullableDateTimeSchema = z.iso.datetime({ offset: true }).nullable();
const ErrorCodeSchema = z.string().regex(/^[A-Z0-9_]{1,64}$/u);
const MetadataSourceSchema = z.enum(['rdap', 'dns', 'tls']);

export const MonitoringResultStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const MonitoringRunTriggerSchema = z.enum([
  'SCHEDULED',
  'MANUAL',
  'RETRY',
]);

export const MonitoringRunStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'PARTIAL',
  'FAILED',
]);

export const AlertRuleKeySchema = z.enum([
  'DOMAIN_EXPIRY_CRITICAL',
  'DOMAIN_EXPIRY_WARNING',
  'TLS_EXPIRY_CRITICAL',
  'TLS_EXPIRY_WARNING',
  'RETRIEVAL_FAILURE_REPEATED',
  'DNS_CHANGED',
  'CERT_CHANGED',
]);

export const AlertSeveritySchema = z.enum([
  'CRITICAL',
  'WARNING',
  'INFO',
]);

export const AlertEventStatusSchema = z.enum([
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
]);

export const CreateMonitoringTargetRequestSchema = z
  .object({
    checkIntervalMinutes: z.number().int().min(60).max(10_080).optional(),
    domainId: z.uuid(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const UpdateMonitoringTargetRequestSchema = z
  .object({
    checkIntervalMinutes: z.number().int().min(60).max(10_080).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one monitoring target field is required',
  });

export const MonitoringTargetResponseSchema = z
  .object({
    checkIntervalMinutes: z.number().int().min(60).max(10_080),
    consecutiveFailures: PostgreSqlIntegerSchema,
    createdAt: z.iso.datetime({ offset: true }),
    domainId: z.uuid(),
    enabled: z.boolean(),
    id: z.uuid(),
    lastRunAt: NullableDateTimeSchema,
    lastRunStatus: MonitoringResultStatusSchema.nullable(),
    nextRunAt: NullableDateTimeSchema,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    ({ lastRunAt, lastRunStatus }) =>
      (lastRunAt === null) === (lastRunStatus === null),
    { message: 'Last run time and status must be present together' },
  );

export const MonitoringTargetNotConfiguredResponseSchema = z
  .object({
    configured: z.literal(false),
    domainId: z.uuid(),
  })
  .strict();

export const MonitoringTargetConfiguredResponseSchema = z
  .object({
    configured: z.literal(true),
    target: MonitoringTargetResponseSchema,
  })
  .strict();

export const MonitoringTargetApiResponseSchema = z.union([
  MonitoringTargetNotConfiguredResponseSchema,
  MonitoringTargetConfiguredResponseSchema,
]);

export const MonitoringRunResponseSchema = z
  .object({
    attemptNo: z.number().int().min(1).max(2_147_483_647),
    createdAt: z.iso.datetime({ offset: true }),
    domainId: z.uuid(),
    durationMs: PostgreSqlIntegerSchema.nullable(),
    errorCode: ErrorCodeSchema.nullable(),
    finishedAt: NullableDateTimeSchema,
    id: z.uuid(),
    sourcesAttempted: z.array(MetadataSourceSchema),
    sourcesSucceeded: z.array(MetadataSourceSchema),
    startedAt: NullableDateTimeSchema,
    status: MonitoringRunStatusSchema,
    targetId: z.uuid(),
    trigger: MonitoringRunTriggerSchema,
  })
  .strict()
  .superRefine((run, context) => {
    const isTerminal = ['SUCCESS', 'PARTIAL', 'FAILED'].includes(run.status);
    const timestampsValid =
      run.status === 'QUEUED'
        ? run.startedAt === null
          && run.finishedAt === null
          && run.durationMs === null
        : run.status === 'RUNNING'
          ? run.startedAt !== null
            && run.finishedAt === null
            && run.durationMs === null
          : run.startedAt !== null && run.finishedAt !== null;
    const errorValid =
      run.status === 'PARTIAL' || run.status === 'FAILED'
        ? run.errorCode !== null
        : run.errorCode === null;
    const attempted = new Set(run.sourcesAttempted);
    const sourcesValid = run.sourcesSucceeded.every((source) =>
      attempted.has(source),
    );
    if (!isTerminal && run.finishedAt !== null) {
      context.addIssue({ code: 'custom', message: 'Active runs cannot be finished' });
    }
    if (!timestampsValid) {
      context.addIssue({ code: 'custom', message: 'Run timestamps do not match status' });
    }
    if (!errorValid) {
      context.addIssue({ code: 'custom', message: 'Run error code does not match status' });
    }
    if (!sourcesValid) {
      context.addIssue({ code: 'custom', message: 'Succeeded sources must be attempted' });
    }
  });

export const MonitoringRunCollectionResponseSchema = z
  .object({
    items: z.array(MonitoringRunResponseSchema),
    nextCursor: z.string().min(1).max(2_048).nullable(),
  })
  .strict();

export const AlertRuleResponseSchema = z
  .object({
    createdAt: z.iso.datetime({ offset: true }),
    enabled: z.boolean(),
    id: z.uuid(),
    key: AlertRuleKeySchema,
    severity: AlertSeveritySchema,
    thresholdCount: z.number().int().min(1).max(2_147_483_647).nullable(),
    thresholdDays: PostgreSqlIntegerSchema.nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((rule, context) => {
    const usesDays = rule.key.includes('_EXPIRY_');
    const usesCount = rule.key === 'RETRIEVAL_FAILURE_REPEATED';
    if (
      (usesDays && (rule.thresholdDays === null || rule.thresholdCount !== null))
      || (usesCount && (rule.thresholdCount === null || rule.thresholdDays !== null))
      || (!usesDays && !usesCount
        && (rule.thresholdDays !== null || rule.thresholdCount !== null))
    ) {
      context.addIssue({ code: 'custom', message: 'Rule threshold does not match key' });
    }
  });

export const AlertRuleCollectionResponseSchema = z
  .object({
    items: z.array(AlertRuleResponseSchema),
  })
  .strict();

export const AlertEventResponseSchema = z
  .object({
    ackedAt: NullableDateTimeSchema,
    ackedByUserId: z.uuid().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    detail: z.string().min(1).max(4_096),
    domainId: z.uuid(),
    evidence: z.record(z.string().min(1).max(64), z.unknown()),
    firstSeenAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    lastSeenAt: z.iso.datetime({ offset: true }),
    occurrenceCount: z.number().int().min(1).max(2_147_483_647),
    resolvedAt: NullableDateTimeSchema,
    ruleId: z.uuid().nullable(),
    severity: AlertSeveritySchema,
    status: AlertEventStatusSchema,
    targetId: z.uuid().nullable(),
    title: z.string().min(1).max(256),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((event, context) => {
    const ackPairValid =
      (event.ackedAt === null) === (event.ackedByUserId === null);
    const statusValid =
      event.status === 'OPEN'
        ? event.ackedAt === null && event.resolvedAt === null
        : event.status === 'ACKNOWLEDGED'
          ? event.ackedAt !== null && event.resolvedAt === null
          : event.resolvedAt !== null;
    if (!ackPairValid) {
      context.addIssue({ code: 'custom', message: 'Alert acknowledgement is incomplete' });
    }
    if (!statusValid) {
      context.addIssue({ code: 'custom', message: 'Alert timestamps do not match status' });
    }
  });

export const AlertEventCollectionResponseSchema = z
  .object({
    items: z.array(AlertEventResponseSchema),
    nextCursor: z.string().min(1).max(2_048).nullable(),
  })
  .strict();

export const ManualMonitoringRunRequestSchema = z
  .object({
    idempotencyKey: z.string().min(1).max(256),
  })
  .strict();

export const ManualMonitoringRunResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.literal('QUEUED'),
    trigger: z.literal('MANUAL'),
    message: z.string(),
  })
  .strict();

export const UpdateAlertRuleRequestSchema = z
  .object({
    enabled: z.boolean().optional(),
    severity: AlertSeveritySchema.optional(),
    thresholdDays: PostgreSqlIntegerSchema.nullable().optional(),
    thresholdCount: z.number().int().min(1).max(2_147_483_647).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one alert rule field is required',
  })
  .superRefine((value, context) => {
    // Threshold validation will be done at service layer with rule key context
    if (value.thresholdDays !== undefined && value.thresholdDays !== null && value.thresholdDays < 0) {
      context.addIssue({ code: 'custom', message: 'thresholdDays must be non-negative' });
    }
    if (value.thresholdCount !== undefined && value.thresholdCount !== null && value.thresholdCount < 1) {
      context.addIssue({ code: 'custom', message: 'thresholdCount must be positive' });
    }
  });

export const AlertAcknowledgeResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.literal('ACKNOWLEDGED'),
    acknowledgedAt: z.iso.datetime({ offset: true }),
    acknowledgedByUserId: z.uuid(),
  })
  .strict();

export const AlertsListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(2_048).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: AlertEventStatusSchema.optional(),
    severity: AlertSeveritySchema.optional(),
    ruleKey: AlertRuleKeySchema.optional(),
    domainId: z.uuid().optional(),
  })
  .strict();

export const MonitoringRunsListQuerySchema = z
  .object({
    cursor: z.string().min(1).max(2_048).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: MonitoringRunStatusSchema.optional(),
    trigger: MonitoringRunTriggerSchema.optional(),
  })
  .strict();

export type MonitoringResultStatus = z.infer<
  typeof MonitoringResultStatusSchema
>;
export type MonitoringRunTrigger = z.infer<typeof MonitoringRunTriggerSchema>;
export type MonitoringRunStatus = z.infer<typeof MonitoringRunStatusSchema>;
export type AlertRuleKey = z.infer<typeof AlertRuleKeySchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type AlertEventStatus = z.infer<typeof AlertEventStatusSchema>;
export type CreateMonitoringTargetRequest = z.infer<
  typeof CreateMonitoringTargetRequestSchema
>;
export type UpdateMonitoringTargetRequest = z.infer<
  typeof UpdateMonitoringTargetRequestSchema
>;
export type MonitoringTargetResponse = z.infer<
  typeof MonitoringTargetResponseSchema
>;
export type MonitoringTargetNotConfiguredResponse = z.infer<
  typeof MonitoringTargetNotConfiguredResponseSchema
>;
export type MonitoringTargetConfiguredResponse = z.infer<
  typeof MonitoringTargetConfiguredResponseSchema
>;
export type MonitoringTargetApiResponse = z.infer<
  typeof MonitoringTargetApiResponseSchema
>;
export type MonitoringRunResponse = z.infer<
  typeof MonitoringRunResponseSchema
>;
export type AlertRuleResponse = z.infer<typeof AlertRuleResponseSchema>;
export type AlertEventResponse = z.infer<typeof AlertEventResponseSchema>;
export type ManualMonitoringRunRequest = z.infer<
  typeof ManualMonitoringRunRequestSchema
>;
export type ManualMonitoringRunResponse = z.infer<
  typeof ManualMonitoringRunResponseSchema
>;
export type UpdateAlertRuleRequest = z.infer<
  typeof UpdateAlertRuleRequestSchema
>;
export type AlertRuleUpdateInput = z.infer<
  typeof UpdateAlertRuleRequestSchema
>;
export type AlertAcknowledgeResponse = z.infer<
  typeof AlertAcknowledgeResponseSchema
>;
export type AlertsListQuery = z.infer<typeof AlertsListQuerySchema>;
export type MonitoringRunsListQuery = z.infer<typeof MonitoringRunsListQuerySchema>;
