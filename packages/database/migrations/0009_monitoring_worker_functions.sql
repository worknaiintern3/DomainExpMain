CREATE FUNCTION "domainpulse"."schedule_due_monitoring_runs"(
	"p_now" timestamp with time zone,
	"p_limit" integer
)
RETURNS TABLE (
	"run_id" uuid,
	"workspace_id" uuid,
	"target_id" uuid,
	"domain_id" uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
	IF p_now IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
		RAISE EXCEPTION 'Invalid monitoring scheduling arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH due_targets AS MATERIALIZED (
		SELECT
			t."id",
			t."workspace_id",
			t."domain_id",
			t."check_interval_minutes",
			t."next_run_at" AS "due_at"
		FROM "public"."monitoring_targets" AS t
		INNER JOIN "public"."domains" AS d
			ON d."workspace_id" = t."workspace_id"
			AND d."id" = t."domain_id"
		WHERE t."enabled" = true
			AND d."inventory_state" = 'TRACKED'
			AND t."next_run_at" <= p_now
		ORDER BY t."next_run_at", t."id"
		FOR UPDATE OF t SKIP LOCKED
		LIMIT p_limit
	),
	inserted_runs AS (
		INSERT INTO "public"."monitoring_runs" AS mr (
			"workspace_id",
			"target_id",
			"domain_id",
			"trigger",
			"status",
			"available_at",
			"attempt_no",
			"idempotency_key"
		)
		SELECT
			dt."workspace_id",
			dt."id",
			dt."domain_id",
			'SCHEDULED',
			'QUEUED',
			p_now,
			1,
			'scheduled:' || extract(epoch from dt."due_at")::text
		FROM due_targets AS dt
		ON CONFLICT DO NOTHING
		RETURNING
			mr."id",
			mr."workspace_id",
			mr."target_id",
			mr."domain_id"
	),
	advanced_targets AS (
		UPDATE "public"."monitoring_targets" AS t
		SET
			"next_run_at" = p_now
				+ make_interval(mins => dt."check_interval_minutes")
				+ make_interval(
					secs => (
						(
							hashtextextended(
								dt."id"::text || ':' || extract(epoch from dt."due_at")::text,
								0
							) % 301 + 301
						) % 301
					)::double precision
				),
			"updated_at" = p_now
		FROM due_targets AS dt
		WHERE t."id" = dt."id"
			AND t."workspace_id" = dt."workspace_id"
		RETURNING t."id"
	)
	SELECT
		ir."id",
		ir."workspace_id",
		ir."target_id",
		ir."domain_id"
	FROM inserted_runs AS ir;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."schedule_due_monitoring_runs"(timestamp with time zone, integer) FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."claim_monitoring_runs"(
	"p_now" timestamp with time zone,
	"p_limit" integer,
	"p_lease_ms" integer
)
RETURNS TABLE (
	"run_id" uuid,
	"workspace_id" uuid,
	"target_id" uuid,
	"domain_id" uuid,
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
		RAISE EXCEPTION 'Invalid monitoring claim arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH claimable AS MATERIALIZED (
		SELECT r."id"
		FROM "public"."monitoring_runs" AS r
		WHERE r."status" = 'QUEUED'
			AND r."available_at" <= p_now
		ORDER BY r."available_at", r."created_at", r."id"
		FOR UPDATE OF r SKIP LOCKED
		LIMIT p_limit
	),
	claimed AS (
		UPDATE "public"."monitoring_runs" AS r
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
			r."target_id",
			r."domain_id",
			r."attempt_no",
			r."idempotency_key",
			r."lease_expires_at"
	)
	SELECT
		c."id",
		c."workspace_id",
		c."target_id",
		c."domain_id",
		c."attempt_no",
		c."idempotency_key",
		c."lease_expires_at"
	FROM claimed AS c;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."claim_monitoring_runs"(timestamp with time zone, integer, integer) FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."reclaim_expired_monitoring_runs"(
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
		RAISE EXCEPTION 'Invalid monitoring recovery arguments'
			USING ERRCODE = '22023';
	END IF;

	RETURN QUERY
	WITH expired AS MATERIALIZED (
		SELECT r."id"
		FROM "public"."monitoring_runs" AS r
		WHERE r."status" = 'RUNNING'
			AND r."lease_expires_at" <= p_now
		ORDER BY r."lease_expires_at", r."id"
		FOR UPDATE OF r SKIP LOCKED
		LIMIT p_limit
	),
	recovered AS (
		UPDATE "public"."monitoring_runs" AS r
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
			"error_code" = 'WORKER_LEASE_EXPIRED'
		FROM expired AS e
		WHERE r."id" = e."id"
			AND r."status" = 'RUNNING'
		RETURNING
			r."id",
			r."workspace_id",
			r."target_id",
			r."domain_id",
			r."attempt_no",
			r."idempotency_key"
	),
	updated_targets AS (
		UPDATE "public"."monitoring_targets" AS t
		SET
			"last_run_at" = p_now,
			"last_run_status" = 'FAILED',
			"consecutive_failures" = t."consecutive_failures" + 1,
			"updated_at" = p_now
		FROM recovered AS r
		WHERE t."workspace_id" = r."workspace_id"
			AND t."id" = r."target_id"
		RETURNING t."id"
	),
	retry_rows AS (
		INSERT INTO "public"."monitoring_runs" AS mr (
			"workspace_id",
			"target_id",
			"domain_id",
			"trigger",
			"status",
			"available_at",
			"attempt_no",
			"idempotency_key",
			"run_metadata"
		)
		SELECT
			r."workspace_id",
			r."target_id",
			r."domain_id",
			'RETRY',
			'QUEUED',
			p_now + CASE r."attempt_no"
				WHEN 1 THEN interval '5 minutes'
				WHEN 2 THEN interval '20 minutes'
				ELSE interval '60 minutes'
			END,
			r."attempt_no" + 1,
			regexp_replace(r."idempotency_key", ':retry:[0-9]+$', '')
				|| ':retry:' || (r."attempt_no" + 1)::text,
			jsonb_build_object('retryOfRunId', r."id")
		FROM recovered AS r
		WHERE r."attempt_no" <= p_max_retries
		ON CONFLICT DO NOTHING
		RETURNING
			mr."id",
			mr."workspace_id",
			mr."target_id",
			mr."attempt_no"
	)
	SELECT
		r."id",
		r."workspace_id",
		rr."id"
	FROM recovered AS r
	LEFT JOIN retry_rows AS rr
		ON rr."workspace_id" = r."workspace_id"
		AND rr."target_id" = r."target_id"
		AND rr."attempt_no" = r."attempt_no" + 1;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."reclaim_expired_monitoring_runs"(timestamp with time zone, integer, integer) FROM PUBLIC;
