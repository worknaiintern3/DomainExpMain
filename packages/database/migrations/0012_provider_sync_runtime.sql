CREATE TYPE "public"."provider_resource_link_status" AS ENUM('ACTIVE', 'MISSING_FROM_PROVIDER');--> statement-breakpoint
CREATE TYPE "public"."provider_sync_run_status" AS ENUM('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."provider_sync_run_trigger" AS ENUM('INITIAL', 'MANUAL', 'SCHEDULED', 'RETRY');--> statement-breakpoint
CREATE TABLE "provider_resource_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"entity_kind" "graph_entity_kind" NOT NULL,
	"external_resource_type" text NOT NULL,
	"external_resource_id" text NOT NULL,
	"status" "provider_resource_link_status" DEFAULT 'ACTIVE' NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"missing_since" timestamp with time zone,
	"external_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_resource_links_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "provider_resource_links_workspace_connection_external_unique" UNIQUE("workspace_id","connection_id","external_resource_type","external_resource_id"),
	CONSTRAINT "provider_resource_links_entity_kind_allowed" CHECK ("provider_resource_links"."entity_kind" in ('DOMAIN', 'SERVER', 'CLOUD_RESOURCE')),
	CONSTRAINT "provider_resource_links_external_resource_type_canonical" CHECK (char_length("provider_resource_links"."external_resource_type") <= 64 and "provider_resource_links"."external_resource_type" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "provider_resource_links_external_resource_id_bounds" CHECK (length(btrim("provider_resource_links"."external_resource_id")) > 0 and char_length("provider_resource_links"."external_resource_id") <= 1024),
	CONSTRAINT "provider_resource_links_metadata_object" CHECK (jsonb_typeof("provider_resource_links"."external_metadata") = 'object'),
	CONSTRAINT "provider_resource_links_metadata_bounded" CHECK (octet_length("provider_resource_links"."external_metadata"::text) <= 16384),
	CONSTRAINT "provider_resource_links_seen_before_synced" CHECK ("provider_resource_links"."last_seen_at" <= "provider_resource_links"."last_synced_at"),
	CONSTRAINT "provider_resource_links_status_consistent" CHECK (
        ("provider_resource_links"."status" = 'ACTIVE' and "provider_resource_links"."missing_since" is null)
        or
        (
          "provider_resource_links"."status" = 'MISSING_FROM_PROVIDER'
          and "provider_resource_links"."missing_since" is not null
          and "provider_resource_links"."last_seen_at" <= "provider_resource_links"."missing_since"
          and "provider_resource_links"."missing_since" <= "provider_resource_links"."last_synced_at"
        )
      )
);
--> statement-breakpoint
CREATE TABLE "provider_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"trigger" "provider_sync_run_trigger" NOT NULL,
	"status" "provider_sync_run_status" DEFAULT 'QUEUED' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"items_discovered" integer DEFAULT 0 NOT NULL,
	"items_created" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"items_unchanged" integer DEFAULT 0 NOT NULL,
	"items_missing" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_detail" text,
	"summary_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_sync_runs_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "provider_sync_runs_workspace_connection_idempotency_unique" UNIQUE("workspace_id","connection_id","idempotency_key"),
	CONSTRAINT "provider_sync_runs_duration_nonnegative" CHECK ("provider_sync_runs"."duration_ms" is null or "provider_sync_runs"."duration_ms" >= 0),
	CONSTRAINT "provider_sync_runs_attempt_positive" CHECK ("provider_sync_runs"."attempt_no" >= 1),
	CONSTRAINT "provider_sync_runs_idempotency_key_internal_hash" CHECK ("provider_sync_runs"."idempotency_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "provider_sync_runs_items_nonnegative" CHECK (
        "provider_sync_runs"."items_discovered" >= 0
        and "provider_sync_runs"."items_created" >= 0
        and "provider_sync_runs"."items_updated" >= 0
        and "provider_sync_runs"."items_unchanged" >= 0
        and "provider_sync_runs"."items_missing" >= 0
      ),
	CONSTRAINT "provider_sync_runs_error_code_canonical" CHECK ("provider_sync_runs"."error_code" is null or "provider_sync_runs"."error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "provider_sync_runs_error_detail_paired" CHECK (
        ("provider_sync_runs"."error_code" is null and "provider_sync_runs"."error_detail" is null)
        or (
          "provider_sync_runs"."error_code" is not null
          and "provider_sync_runs"."error_detail" is not null
          and length(btrim("provider_sync_runs"."error_detail")) > 0
          and char_length("provider_sync_runs"."error_detail") <= 2048
        )
      ),
	CONSTRAINT "provider_sync_runs_metadata_object" CHECK (jsonb_typeof("provider_sync_runs"."summary_metadata") = 'object'),
	CONSTRAINT "provider_sync_runs_metadata_bounded" CHECK (octet_length("provider_sync_runs"."summary_metadata"::text) <= 16384),
	CONSTRAINT "provider_sync_runs_timestamp_order" CHECK (("provider_sync_runs"."lease_expires_at" is null or "provider_sync_runs"."claimed_at" is null or "provider_sync_runs"."lease_expires_at" > "provider_sync_runs"."claimed_at") and ("provider_sync_runs"."finished_at" is null or "provider_sync_runs"."started_at" is null or "provider_sync_runs"."finished_at" >= "provider_sync_runs"."started_at")),
	CONSTRAINT "provider_sync_runs_state_consistent" CHECK (
        (
          "provider_sync_runs"."status" = 'QUEUED'
          and "provider_sync_runs"."claimed_at" is null
          and "provider_sync_runs"."lease_expires_at" is null
          and "provider_sync_runs"."started_at" is null
          and "provider_sync_runs"."finished_at" is null
          and "provider_sync_runs"."duration_ms" is null
        )
        or
        (
          "provider_sync_runs"."status" = 'RUNNING'
          and "provider_sync_runs"."claimed_at" is not null
          and "provider_sync_runs"."lease_expires_at" is not null
          and "provider_sync_runs"."started_at" is not null
          and "provider_sync_runs"."finished_at" is null
          and "provider_sync_runs"."duration_ms" is null
        )
        or
        (
          "provider_sync_runs"."status" in ('SUCCESS', 'PARTIAL', 'FAILED')
          and "provider_sync_runs"."started_at" is not null
          and "provider_sync_runs"."finished_at" is not null
          and "provider_sync_runs"."lease_expires_at" is null
        )
      ),
	CONSTRAINT "provider_sync_runs_error_status_consistent" CHECK (
        (
          "provider_sync_runs"."status" in ('QUEUED', 'RUNNING', 'SUCCESS')
          and "provider_sync_runs"."error_code" is null
        )
        or
        (
          "provider_sync_runs"."status" in ('PARTIAL', 'FAILED')
          and "provider_sync_runs"."error_code" is not null
        )
      )
);
--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "sync_interval_minutes" integer DEFAULT 1440 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_resource_links" ADD CONSTRAINT "provider_resource_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_resource_links" ADD CONSTRAINT "provider_resource_links_connection_fk" FOREIGN KEY ("workspace_id","connection_id") REFERENCES "public"."provider_connections"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_resource_links" ADD CONSTRAINT "provider_resource_links_node_fk" FOREIGN KEY ("workspace_id","node_id","entity_kind") REFERENCES "public"."inventory_nodes"("workspace_id","node_id","entity_kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_runs" ADD CONSTRAINT "provider_sync_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_sync_runs" ADD CONSTRAINT "provider_sync_runs_connection_fk" FOREIGN KEY ("workspace_id","connection_id") REFERENCES "public"."provider_connections"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "provider_resource_links_workspace_connection_status_idx" ON "provider_resource_links" USING btree ("workspace_id","connection_id","status");--> statement-breakpoint
CREATE INDEX "provider_resource_links_workspace_node_idx" ON "provider_resource_links" USING btree ("workspace_id","node_id");--> statement-breakpoint
CREATE INDEX "provider_sync_runs_queue_due_idx" ON "provider_sync_runs" USING btree ("available_at","created_at","id") WHERE "provider_sync_runs"."status" = 'QUEUED';--> statement-breakpoint
CREATE INDEX "provider_sync_runs_workspace_connection_created_idx" ON "provider_sync_runs" USING btree ("workspace_id","connection_id","created_at");--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_sync_interval_bounds" CHECK ("provider_connections"."sync_interval_minutes" between 60 and 10080);
--> statement-breakpoint
ALTER TABLE "provider_sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provider_sync_runs_workspace_isolation" ON "provider_sync_runs" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "provider_resource_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provider_resource_links_workspace_isolation" ON "provider_resource_links" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
CREATE FUNCTION "domainpulse"."schedule_due_provider_sync_runs"(
	"p_now" timestamp with time zone,
	"p_limit" integer
)
RETURNS TABLE (
	"run_id" uuid,
	"workspace_id" uuid,
	"connection_id" uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_now IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
		RAISE EXCEPTION 'Invalid provider sync scheduling arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH due_connections AS MATERIALIZED (
		SELECT
			c."id",
			c."workspace_id",
			c."sync_interval_minutes",
			c."next_sync_at" AS "due_at"
		FROM "public"."provider_connections" AS c
		WHERE c."validation_status" = 'VALID'
			AND c."next_sync_at" IS NOT NULL
			AND c."next_sync_at" <= p_now
			AND NOT EXISTS (
				SELECT 1
				FROM "public"."provider_sync_runs" AS r
				WHERE r."connection_id" = c."id"
					AND r."status" IN ('QUEUED', 'RUNNING')
			)
		ORDER BY c."next_sync_at", c."id"
		FOR UPDATE OF c SKIP LOCKED
		LIMIT p_limit
	),
	inserted_runs AS (
		INSERT INTO "public"."provider_sync_runs" AS sr (
			"workspace_id",
			"connection_id",
			"trigger",
			"status",
			"available_at",
			"attempt_no",
			"idempotency_key"
		)
		SELECT
			dc."workspace_id",
			dc."id",
			'SCHEDULED',
			'QUEUED',
			p_now,
			1,
			encode(
				sha256(
					convert_to(
						dc."id"::text || ':' || extract(epoch from dc."due_at")::text,
						'UTF8'
					)
				),
				'hex'
			)
		FROM due_connections AS dc
		ON CONFLICT DO NOTHING
		RETURNING
			sr."id",
			sr."workspace_id",
			sr."connection_id"
	),
	advanced_connections AS (
		UPDATE "public"."provider_connections" AS c
		SET
			"next_sync_at" = p_now
				+ make_interval(mins => dc."sync_interval_minutes")
				+ make_interval(
					secs => (
						(
							hashtextextended(
								dc."id"::text || ':' || extract(epoch from dc."due_at")::text,
								0
							) % 301 + 301
						) % 301
					)::double precision
				),
			"updated_at" = p_now
		FROM due_connections AS dc
		WHERE c."id" = dc."id"
			AND c."workspace_id" = dc."workspace_id"
		RETURNING c."id"
	)
	SELECT
		ir."id",
		ir."workspace_id",
		ir."connection_id"
	FROM inserted_runs AS ir;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."schedule_due_provider_sync_runs"(timestamp with time zone, integer) FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."claim_provider_sync_runs"(
	"p_now" timestamp with time zone,
	"p_limit" integer,
	"p_lease_ms" integer
)
RETURNS TABLE (
	"run_id" uuid,
	"workspace_id" uuid,
	"connection_id" uuid,
	"attempt_no" integer,
	"idempotency_key" text,
	"lease_expires_at" timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_now IS NULL
		OR p_limit IS NULL
		OR p_limit < 1
		OR p_limit > 1000
		OR p_lease_ms IS NULL
		OR p_lease_ms < 30000
		OR p_lease_ms > 1800000
	THEN
		RAISE EXCEPTION 'Invalid provider sync claim arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH claimable AS MATERIALIZED (
		SELECT r."id"
		FROM "public"."provider_sync_runs" AS r
		WHERE r."status" = 'QUEUED'
			AND r."available_at" <= p_now
		ORDER BY r."available_at", r."created_at", r."id"
		FOR UPDATE OF r SKIP LOCKED
		LIMIT p_limit
	),
	claimed AS (
		UPDATE "public"."provider_sync_runs" AS r
		SET
			"status" = 'RUNNING',
			"claimed_at" = p_now,
			"started_at" = p_now,
			"lease_expires_at" = p_now + p_lease_ms * interval '1 millisecond'
		FROM claimable AS c
		WHERE r."id" = c."id"
			AND r."status" = 'QUEUED'
		RETURNING
			r."id",
			r."workspace_id",
			r."connection_id",
			r."attempt_no",
			r."idempotency_key",
			r."lease_expires_at"
	)
	SELECT
		c."id",
		c."workspace_id",
		c."connection_id",
		c."attempt_no",
		c."idempotency_key",
		c."lease_expires_at"
	FROM claimed AS c;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."claim_provider_sync_runs"(timestamp with time zone, integer, integer) FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."reclaim_expired_provider_sync_runs"(
	"p_now" timestamp with time zone,
	"p_limit" integer,
	"p_max_retries" integer
)
RETURNS TABLE (
	"run_id" uuid,
	"workspace_id" uuid,
	"retry_run_id" uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_now IS NULL
		OR p_limit IS NULL
		OR p_limit < 1
		OR p_limit > 1000
		OR p_max_retries IS NULL
		OR p_max_retries < 0
		OR p_max_retries > 3
	THEN
		RAISE EXCEPTION 'Invalid provider sync recovery arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH expired AS MATERIALIZED (
		SELECT r."id"
		FROM "public"."provider_sync_runs" AS r
		WHERE r."status" = 'RUNNING'
			AND r."lease_expires_at" <= p_now
		ORDER BY r."lease_expires_at", r."id"
		FOR UPDATE OF r SKIP LOCKED
		LIMIT p_limit
	),
	recovered AS (
		UPDATE "public"."provider_sync_runs" AS r
		SET
			"status" = 'FAILED',
			"finished_at" = p_now,
			"duration_ms" = least(
				2147483647,
				greatest(
					0,
					floor(extract(epoch from (p_now - r."started_at")) * 1000)
				)
			)::integer,
			"lease_expires_at" = NULL,
			"error_code" = 'WORKER_LEASE_EXPIRED',
			"error_detail" = 'Provider sync worker lease expired before the run finished'
		FROM expired AS e
		WHERE r."id" = e."id"
			AND r."status" = 'RUNNING'
		RETURNING
			r."id",
			r."workspace_id",
			r."connection_id",
			r."attempt_no",
			r."idempotency_key"
	),
	retry_rows AS (
		INSERT INTO "public"."provider_sync_runs" AS sr (
			"workspace_id",
			"connection_id",
			"trigger",
			"status",
			"available_at",
			"attempt_no",
			"idempotency_key",
			"summary_metadata"
		)
		SELECT
			r."workspace_id",
			r."connection_id",
			'RETRY',
			'QUEUED',
			p_now + CASE r."attempt_no"
				WHEN 1 THEN interval '5 minutes'
				WHEN 2 THEN interval '20 minutes'
				ELSE interval '60 minutes'
			END,
			r."attempt_no" + 1,
			encode(
				sha256(
					convert_to(
						r."idempotency_key" || ':retry:' || (r."attempt_no" + 1)::text,
						'UTF8'
					)
				),
				'hex'
			),
			jsonb_build_object('retryOfRunId', r."id")
		FROM recovered AS r
		WHERE r."attempt_no" <= p_max_retries
		ON CONFLICT DO NOTHING
		RETURNING
			sr."id",
			sr."workspace_id",
			sr."connection_id",
			sr."attempt_no"
	)
	SELECT
		r."id",
		r."workspace_id",
		rr."id"
	FROM recovered AS r
	LEFT JOIN retry_rows AS rr
		ON rr."workspace_id" = r."workspace_id"
		AND rr."connection_id" = r."connection_id"
		AND rr."attempt_no" = r."attempt_no" + 1;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."reclaim_expired_provider_sync_runs"(timestamp with time zone, integer, integer) FROM PUBLIC;
