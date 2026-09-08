CREATE SCHEMA "domainpulse";--> statement-breakpoint
CREATE FUNCTION "domainpulse"."current_workspace_id"()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
	SELECT CASE
		WHEN pg_catalog.current_setting('domainpulse.workspace_id', true)
			~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
		THEN pg_catalog.current_setting('domainpulse.workspace_id', true)::pg_catalog.uuid
		ELSE NULL::pg_catalog.uuid
	END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."current_workspace_id"() FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."current_user_id"()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
	SELECT CASE
		WHEN pg_catalog.current_setting('domainpulse.user_id', true)
			~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
		THEN pg_catalog.current_setting('domainpulse.user_id', true)::pg_catalog.uuid
		ELSE NULL::pg_catalog.uuid
	END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."current_user_id"() FROM PUBLIC;--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspaces_workspace_isolation"
ON "workspaces"
FOR ALL
USING ("id" = "domainpulse"."current_workspace_id"())
WITH CHECK ("id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "workspace_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspace_members_select_isolation"
ON "workspace_members"
FOR SELECT
USING (
	"workspace_id" = "domainpulse"."current_workspace_id"()
	OR (
		"domainpulse"."current_workspace_id"() IS NULL
		AND "user_id" = "domainpulse"."current_user_id"()
	)
);--> statement-breakpoint
CREATE POLICY "workspace_members_insert_isolation"
ON "workspace_members"
FOR INSERT
WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
CREATE POLICY "workspace_members_update_isolation"
ON "workspace_members"
FOR UPDATE
USING ("workspace_id" = "domainpulse"."current_workspace_id"())
WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
CREATE POLICY "workspace_members_delete_isolation"
ON "workspace_members"
FOR DELETE
USING ("workspace_id" = "domainpulse"."current_workspace_id"());
