CREATE INDEX "monitoring_runs_retention_idx" ON "monitoring_runs" USING btree ("status","finished_at") WHERE "monitoring_runs"."status" in ('SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE FUNCTION "domainpulse"."cleanup_old_terminal_monitoring_runs"(
	"p_cutoff" timestamp with time zone,
	"p_limit" integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	v_deleted_count integer;
BEGIN
	IF p_cutoff IS NULL OR p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
		RAISE EXCEPTION 'Invalid monitoring retention arguments'
			USING ERRCODE = '22023';
	END IF;

	WITH expired_runs AS MATERIALIZED (
		SELECT mr."id"
		FROM "public"."monitoring_runs" AS mr
		WHERE mr."status" IN ('SUCCESS', 'PARTIAL', 'FAILED')
			AND mr."finished_at" < p_cutoff
		ORDER BY mr."finished_at", mr."id"
		FOR UPDATE OF mr SKIP LOCKED
		LIMIT p_limit
	),
	deleted_runs AS (
		DELETE FROM "public"."monitoring_runs" AS mr
		USING expired_runs AS er
		WHERE mr."id" = er."id"
		RETURNING mr."id"
	)
	SELECT count(*)::integer
	INTO v_deleted_count
	FROM deleted_runs AS dr;

	RETURN v_deleted_count;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."cleanup_old_terminal_monitoring_runs"(timestamp with time zone, integer) FROM PUBLIC;
