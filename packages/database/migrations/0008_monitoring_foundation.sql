CREATE TYPE "public"."alert_event_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."alert_rule_key" AS ENUM('DOMAIN_EXPIRY_CRITICAL', 'DOMAIN_EXPIRY_WARNING', 'TLS_EXPIRY_CRITICAL', 'TLS_EXPIRY_WARNING', 'RETRIEVAL_FAILURE_REPEATED', 'DNS_CHANGED', 'CERT_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('CRITICAL', 'WARNING', 'INFO');--> statement-breakpoint
CREATE TYPE "public"."monitoring_result_status" AS ENUM('SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."monitoring_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."monitoring_run_trigger" AS ENUM('SCHEDULED', 'MANUAL', 'RETRY');--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid,
	"domain_id" uuid NOT NULL,
	"target_id" uuid,
	"dedupe_key" text NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"status" "alert_event_status" DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"acked_at" timestamp with time zone,
	"acked_by_user_id" uuid,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_events_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "alert_events_dedupe_key_not_blank" CHECK (length(btrim("alert_events"."dedupe_key")) > 0),
	CONSTRAINT "alert_events_title_not_blank" CHECK (length(btrim("alert_events"."title")) > 0),
	CONSTRAINT "alert_events_detail_not_blank" CHECK (length(btrim("alert_events"."detail")) > 0),
	CONSTRAINT "alert_events_occurrence_count_positive" CHECK ("alert_events"."occurrence_count" >= 1),
	CONSTRAINT "alert_events_evidence_object" CHECK (jsonb_typeof("alert_events"."evidence") = 'object'),
	CONSTRAINT "alert_events_seen_order" CHECK ("alert_events"."last_seen_at" >= "alert_events"."first_seen_at"),
	CONSTRAINT "alert_events_ack_pair_consistent" CHECK (("alert_events"."acked_at" is null) = ("alert_events"."acked_by_user_id" is null)),
	CONSTRAINT "alert_events_status_consistent" CHECK (
        (
          "alert_events"."status" = 'OPEN'
          and "alert_events"."acked_at" is null
          and "alert_events"."resolved_at" is null
        )
        or
        (
          "alert_events"."status" = 'ACKNOWLEDGED'
          and "alert_events"."acked_at" is not null
          and "alert_events"."resolved_at" is null
        )
        or
        (
          "alert_events"."status" = 'RESOLVED'
          and "alert_events"."resolved_at" is not null
        )
      )
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" "alert_rule_key" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"threshold_days" integer,
	"threshold_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_rules_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "alert_rules_threshold_days_nonnegative" CHECK ("alert_rules"."threshold_days" is null or "alert_rules"."threshold_days" >= 0),
	CONSTRAINT "alert_rules_threshold_count_positive" CHECK ("alert_rules"."threshold_count" is null or "alert_rules"."threshold_count" >= 1),
	CONSTRAINT "alert_rules_threshold_kind_consistent" CHECK (
        (
          "alert_rules"."key" in (
            'DOMAIN_EXPIRY_CRITICAL',
            'DOMAIN_EXPIRY_WARNING',
            'TLS_EXPIRY_CRITICAL',
            'TLS_EXPIRY_WARNING'
          )
          and "alert_rules"."threshold_days" is not null
          and "alert_rules"."threshold_count" is null
        )
        or
        (
          "alert_rules"."key" = 'RETRIEVAL_FAILURE_REPEATED'
          and "alert_rules"."threshold_days" is null
          and "alert_rules"."threshold_count" is not null
        )
        or
        (
          "alert_rules"."key" in ('DNS_CHANGED', 'CERT_CHANGED')
          and "alert_rules"."threshold_days" is null
          and "alert_rules"."threshold_count" is null
        )
      )
);
--> statement-breakpoint
CREATE TABLE "monitoring_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"trigger" "monitoring_run_trigger" NOT NULL,
	"status" "monitoring_run_status" DEFAULT 'QUEUED' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"error_code" text,
	"sources_attempted" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sources_succeeded" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"run_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_runs_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "monitoring_runs_duration_nonnegative" CHECK ("monitoring_runs"."duration_ms" is null or "monitoring_runs"."duration_ms" >= 0),
	CONSTRAINT "monitoring_runs_attempt_positive" CHECK ("monitoring_runs"."attempt_no" >= 1),
	CONSTRAINT "monitoring_runs_idempotency_key_not_blank" CHECK (length(btrim("monitoring_runs"."idempotency_key")) > 0),
	CONSTRAINT "monitoring_runs_error_code_canonical" CHECK ("monitoring_runs"."error_code" is null or "monitoring_runs"."error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "monitoring_runs_sources_allowed" CHECK ("monitoring_runs"."sources_attempted" <@ ARRAY['rdap', 'dns', 'tls']::text[] and "monitoring_runs"."sources_succeeded" <@ "monitoring_runs"."sources_attempted"),
	CONSTRAINT "monitoring_runs_metadata_object" CHECK (jsonb_typeof("monitoring_runs"."run_metadata") = 'object'),
	CONSTRAINT "monitoring_runs_timestamp_order" CHECK (("monitoring_runs"."lease_expires_at" is null or "monitoring_runs"."claimed_at" is null or "monitoring_runs"."lease_expires_at" > "monitoring_runs"."claimed_at") and ("monitoring_runs"."finished_at" is null or "monitoring_runs"."started_at" is null or "monitoring_runs"."finished_at" >= "monitoring_runs"."started_at")),
	CONSTRAINT "monitoring_runs_state_consistent" CHECK (
        (
          "monitoring_runs"."status" = 'QUEUED'
          and "monitoring_runs"."claimed_at" is null
          and "monitoring_runs"."lease_expires_at" is null
          and "monitoring_runs"."started_at" is null
          and "monitoring_runs"."finished_at" is null
          and "monitoring_runs"."duration_ms" is null
        )
        or
        (
          "monitoring_runs"."status" = 'RUNNING'
          and "monitoring_runs"."claimed_at" is not null
          and "monitoring_runs"."lease_expires_at" is not null
          and "monitoring_runs"."started_at" is not null
          and "monitoring_runs"."finished_at" is null
          and "monitoring_runs"."duration_ms" is null
        )
        or
        (
          "monitoring_runs"."status" in ('SUCCESS', 'PARTIAL', 'FAILED')
          and "monitoring_runs"."started_at" is not null
          and "monitoring_runs"."finished_at" is not null
          and "monitoring_runs"."lease_expires_at" is null
        )
      ),
	CONSTRAINT "monitoring_runs_error_status_consistent" CHECK (
        (
          "monitoring_runs"."status" in ('QUEUED', 'RUNNING', 'SUCCESS')
          and "monitoring_runs"."error_code" is null
        )
        or
        (
          "monitoring_runs"."status" in ('PARTIAL', 'FAILED')
          and "monitoring_runs"."error_code" is not null
        )
      )
);
--> statement-breakpoint
CREATE TABLE "monitoring_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"check_interval_minutes" integer DEFAULT 1440 NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" "monitoring_result_status",
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_targets_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "monitoring_targets_workspace_id_domain_id_unique" UNIQUE("workspace_id","id","domain_id"),
	CONSTRAINT "monitoring_targets_interval_bounds" CHECK ("monitoring_targets"."check_interval_minutes" between 60 and 10080),
	CONSTRAINT "monitoring_targets_consecutive_failures_nonnegative" CHECK ("monitoring_targets"."consecutive_failures" >= 0),
	CONSTRAINT "monitoring_targets_last_run_consistent" CHECK (("monitoring_targets"."last_run_at" is null) = ("monitoring_targets"."last_run_status" is null))
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_fk" FOREIGN KEY ("workspace_id","rule_id") REFERENCES "public"."alert_rules"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_target_domain_fk" FOREIGN KEY ("workspace_id","target_id","domain_id") REFERENCES "public"."monitoring_targets"("workspace_id","id","domain_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_acked_by_member_fk" FOREIGN KEY ("workspace_id","acked_by_user_id") REFERENCES "public"."workspace_members"("workspace_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_runs" ADD CONSTRAINT "monitoring_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_runs" ADD CONSTRAINT "monitoring_runs_target_domain_fk" FOREIGN KEY ("workspace_id","target_id","domain_id") REFERENCES "public"."monitoring_targets"("workspace_id","id","domain_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_runs" ADD CONSTRAINT "monitoring_runs_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_targets" ADD CONSTRAINT "monitoring_targets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_targets" ADD CONSTRAINT "monitoring_targets_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_events_workspace_active_dedupe_unique" ON "alert_events" USING btree ("workspace_id","dedupe_key") WHERE "alert_events"."status" in ('OPEN', 'ACKNOWLEDGED');--> statement-breakpoint
CREATE INDEX "alert_events_workspace_status_last_seen_idx" ON "alert_events" USING btree ("workspace_id","status","last_seen_at");--> statement-breakpoint
CREATE INDEX "alert_events_workspace_domain_last_seen_idx" ON "alert_events" USING btree ("workspace_id","domain_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alert_rules_workspace_key_unique" ON "alert_rules" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "monitoring_runs_workspace_target_idempotency_unique" ON "monitoring_runs" USING btree ("workspace_id","target_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "monitoring_runs_queue_due_idx" ON "monitoring_runs" USING btree ("available_at","created_at","id") WHERE "monitoring_runs"."status" = 'QUEUED';--> statement-breakpoint
CREATE INDEX "monitoring_runs_workspace_domain_created_idx" ON "monitoring_runs" USING btree ("workspace_id","domain_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monitoring_targets_workspace_domain_unique" ON "monitoring_targets" USING btree ("workspace_id","domain_id");--> statement-breakpoint
CREATE INDEX "monitoring_targets_due_idx" ON "monitoring_targets" USING btree ("next_run_at","id") WHERE "monitoring_targets"."enabled" and "monitoring_targets"."next_run_at" is not null;--> statement-breakpoint
ALTER TABLE "monitoring_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "monitoring_targets_workspace_isolation"
ON "monitoring_targets"
FOR ALL
USING (
	"workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
	"workspace_id" = "domainpulse"."current_workspace_id"()
);--> statement-breakpoint
ALTER TABLE "monitoring_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "monitoring_runs_workspace_isolation"
ON "monitoring_runs"
FOR ALL
USING (
	"workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
	"workspace_id" = "domainpulse"."current_workspace_id"()
);--> statement-breakpoint
ALTER TABLE "alert_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "alert_rules_workspace_isolation"
ON "alert_rules"
FOR ALL
USING (
	"workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
	"workspace_id" = "domainpulse"."current_workspace_id"()
);--> statement-breakpoint
ALTER TABLE "alert_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "alert_events_workspace_isolation"
ON "alert_events"
FOR ALL
USING (
	"workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
	"workspace_id" = "domainpulse"."current_workspace_id"()
);
