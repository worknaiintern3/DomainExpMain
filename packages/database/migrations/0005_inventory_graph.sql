CREATE TYPE "public"."graph_entity_kind" AS ENUM('PROJECT', 'DOMAIN', 'SERVER', 'CLOUD_RESOURCE', 'WEBSITE_APPLICATION');--> statement-breakpoint
CREATE TYPE "public"."infrastructure_relationship_type" AS ENUM('GROUPS', 'HOSTED_ON', 'USES_DOMAIN', 'DEPENDS_ON', 'ROUTES_TO', 'CONNECTED_TO');--> statement-breakpoint
CREATE TABLE "inventory_nodes" (
	"node_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_kind" "graph_entity_kind" NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "inventory_nodes_workspace_node_kind_unique" UNIQUE("workspace_id","node_id","entity_kind")
);
--> statement-breakpoint
ALTER TABLE "inventory_nodes" ADD CONSTRAINT "inventory_nodes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_nodes_workspace_entity_unique" ON "inventory_nodes" USING btree ("workspace_id","entity_kind","entity_id");--> statement-breakpoint
INSERT INTO "public"."inventory_nodes" ("workspace_id", "entity_kind", "entity_id")
SELECT "workspace_id", 'PROJECT'::"public"."graph_entity_kind", "id" FROM "public"."projects"
UNION ALL
SELECT "workspace_id", 'DOMAIN'::"public"."graph_entity_kind", "id" FROM "public"."domains"
UNION ALL
SELECT "workspace_id", 'SERVER'::"public"."graph_entity_kind", "id" FROM "public"."servers"
UNION ALL
SELECT "workspace_id", 'CLOUD_RESOURCE'::"public"."graph_entity_kind", "id" FROM "public"."cloud_resources"
UNION ALL
SELECT "workspace_id", 'WEBSITE_APPLICATION'::"public"."graph_entity_kind", "id" FROM "public"."website_applications";--> statement-breakpoint
CREATE FUNCTION "domainpulse"."register_inventory_node"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	resolved_kind "public"."graph_entity_kind";
BEGIN
	IF TG_TABLE_SCHEMA <> 'public' THEN
		RAISE EXCEPTION 'Unsupported inventory entity trigger source'
			USING ERRCODE = '23514';
	END IF;

	resolved_kind := CASE TG_TABLE_NAME
		WHEN 'projects' THEN 'PROJECT'::"public"."graph_entity_kind"
		WHEN 'domains' THEN 'DOMAIN'::"public"."graph_entity_kind"
		WHEN 'servers' THEN 'SERVER'::"public"."graph_entity_kind"
		WHEN 'cloud_resources' THEN 'CLOUD_RESOURCE'::"public"."graph_entity_kind"
		WHEN 'website_applications' THEN 'WEBSITE_APPLICATION'::"public"."graph_entity_kind"
		ELSE NULL
	END;

	IF resolved_kind IS NULL THEN
		RAISE EXCEPTION 'Unsupported inventory entity trigger source'
			USING ERRCODE = '23514';
	END IF;

	INSERT INTO "public"."inventory_nodes" ("workspace_id", "entity_kind", "entity_id")
	VALUES (NEW."workspace_id", resolved_kind, NEW."id");
	RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."register_inventory_node"() FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."unregister_inventory_node"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	resolved_kind "public"."graph_entity_kind";
BEGIN
	IF TG_TABLE_SCHEMA <> 'public' THEN
		RAISE EXCEPTION 'Unsupported inventory entity trigger source'
			USING ERRCODE = '23514';
	END IF;

	resolved_kind := CASE TG_TABLE_NAME
		WHEN 'projects' THEN 'PROJECT'::"public"."graph_entity_kind"
		WHEN 'domains' THEN 'DOMAIN'::"public"."graph_entity_kind"
		WHEN 'servers' THEN 'SERVER'::"public"."graph_entity_kind"
		WHEN 'cloud_resources' THEN 'CLOUD_RESOURCE'::"public"."graph_entity_kind"
		WHEN 'website_applications' THEN 'WEBSITE_APPLICATION'::"public"."graph_entity_kind"
		ELSE NULL
	END;

	IF resolved_kind IS NULL THEN
		RAISE EXCEPTION 'Unsupported inventory entity trigger source'
			USING ERRCODE = '23514';
	END IF;

	DELETE FROM "public"."inventory_nodes"
	WHERE "workspace_id" = OLD."workspace_id"
		AND "entity_kind" = resolved_kind
		AND "entity_id" = OLD."id";

	IF NOT FOUND THEN
		RAISE EXCEPTION 'Inventory entity node is missing'
			USING ERRCODE = '23503';
	END IF;

	RETURN OLD;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."unregister_inventory_node"() FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."validate_inventory_node_insert"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	matching_entity_exists boolean;
BEGIN
	matching_entity_exists := CASE NEW."entity_kind"
		WHEN 'PROJECT' THEN EXISTS (
			SELECT 1 FROM "public"."projects"
			WHERE "id" = NEW."entity_id" AND "workspace_id" = NEW."workspace_id"
		)
		WHEN 'DOMAIN' THEN EXISTS (
			SELECT 1 FROM "public"."domains"
			WHERE "id" = NEW."entity_id" AND "workspace_id" = NEW."workspace_id"
		)
		WHEN 'SERVER' THEN EXISTS (
			SELECT 1 FROM "public"."servers"
			WHERE "id" = NEW."entity_id" AND "workspace_id" = NEW."workspace_id"
		)
		WHEN 'CLOUD_RESOURCE' THEN EXISTS (
			SELECT 1 FROM "public"."cloud_resources"
			WHERE "id" = NEW."entity_id" AND "workspace_id" = NEW."workspace_id"
		)
		WHEN 'WEBSITE_APPLICATION' THEN EXISTS (
			SELECT 1 FROM "public"."website_applications"
			WHERE "id" = NEW."entity_id" AND "workspace_id" = NEW."workspace_id"
		)
		ELSE false
	END;

	IF NOT matching_entity_exists THEN
		RAISE EXCEPTION 'Inventory node must reference a matching concrete entity'
			USING ERRCODE = '23503';
	END IF;

	RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."validate_inventory_node_insert"() FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."guard_inventory_node_mutation"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
	matching_entity_exists boolean;
BEGIN
	IF TG_OP = 'UPDATE' THEN
		RAISE EXCEPTION 'Inventory node identity is immutable'
			USING ERRCODE = '23514';
	END IF;

	matching_entity_exists := CASE OLD."entity_kind"
		WHEN 'PROJECT' THEN EXISTS (
			SELECT 1 FROM "public"."projects"
			WHERE "id" = OLD."entity_id" AND "workspace_id" = OLD."workspace_id"
		)
		WHEN 'DOMAIN' THEN EXISTS (
			SELECT 1 FROM "public"."domains"
			WHERE "id" = OLD."entity_id" AND "workspace_id" = OLD."workspace_id"
		)
		WHEN 'SERVER' THEN EXISTS (
			SELECT 1 FROM "public"."servers"
			WHERE "id" = OLD."entity_id" AND "workspace_id" = OLD."workspace_id"
		)
		WHEN 'CLOUD_RESOURCE' THEN EXISTS (
			SELECT 1 FROM "public"."cloud_resources"
			WHERE "id" = OLD."entity_id" AND "workspace_id" = OLD."workspace_id"
		)
		WHEN 'WEBSITE_APPLICATION' THEN EXISTS (
			SELECT 1 FROM "public"."website_applications"
			WHERE "id" = OLD."entity_id" AND "workspace_id" = OLD."workspace_id"
		)
		ELSE false
	END;

	IF matching_entity_exists THEN
		RAISE EXCEPTION 'Inventory node cannot be removed while its entity exists'
			USING ERRCODE = '23503';
	END IF;

	RETURN OLD;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."guard_inventory_node_mutation"() FROM PUBLIC;--> statement-breakpoint
CREATE FUNCTION "domainpulse"."guard_inventory_entity_identity"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
	IF NEW."id" IS DISTINCT FROM OLD."id"
		OR NEW."workspace_id" IS DISTINCT FROM OLD."workspace_id" THEN
		RAISE EXCEPTION 'Inventory entity identity is immutable'
			USING ERRCODE = '42501';
	END IF;

	RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "domainpulse"."guard_inventory_entity_identity"() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER "inventory_nodes_validate_insert"
BEFORE INSERT ON "public"."inventory_nodes"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."validate_inventory_node_insert"();--> statement-breakpoint
CREATE TRIGGER "inventory_nodes_guard_mutation"
BEFORE UPDATE OR DELETE ON "public"."inventory_nodes"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_node_mutation"();--> statement-breakpoint
CREATE TRIGGER "projects_inventory_node_insert"
AFTER INSERT ON "public"."projects"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."register_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "projects_inventory_node_delete"
AFTER DELETE ON "public"."projects"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."unregister_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "projects_inventory_identity_immutable"
BEFORE UPDATE OF "id", "workspace_id" ON "public"."projects"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_entity_identity"();--> statement-breakpoint
CREATE TRIGGER "domains_inventory_node_insert"
AFTER INSERT ON "public"."domains"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."register_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "domains_inventory_node_delete"
AFTER DELETE ON "public"."domains"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."unregister_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "domains_inventory_identity_immutable"
BEFORE UPDATE OF "id", "workspace_id" ON "public"."domains"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_entity_identity"();--> statement-breakpoint
CREATE TRIGGER "servers_inventory_node_insert"
AFTER INSERT ON "public"."servers"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."register_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "servers_inventory_node_delete"
AFTER DELETE ON "public"."servers"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."unregister_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "servers_inventory_identity_immutable"
BEFORE UPDATE OF "id", "workspace_id" ON "public"."servers"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_entity_identity"();--> statement-breakpoint
CREATE TRIGGER "cloud_resources_inventory_node_insert"
AFTER INSERT ON "public"."cloud_resources"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."register_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "cloud_resources_inventory_node_delete"
AFTER DELETE ON "public"."cloud_resources"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."unregister_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "cloud_resources_inventory_identity_immutable"
BEFORE UPDATE OF "id", "workspace_id" ON "public"."cloud_resources"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_entity_identity"();--> statement-breakpoint
CREATE TRIGGER "website_applications_inventory_node_insert"
AFTER INSERT ON "public"."website_applications"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."register_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "website_applications_inventory_node_delete"
AFTER DELETE ON "public"."website_applications"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."unregister_inventory_node"();--> statement-breakpoint
CREATE TRIGGER "website_applications_inventory_identity_immutable"
BEFORE UPDATE OF "id", "workspace_id" ON "public"."website_applications"
FOR EACH ROW EXECUTE FUNCTION "domainpulse"."guard_inventory_entity_identity"();--> statement-breakpoint
CREATE TABLE "inventory_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_kind" "graph_entity_kind" NOT NULL,
	"source_node_id" uuid NOT NULL,
	"relationship_type" "infrastructure_relationship_type" NOT NULL,
	"target_kind" "graph_entity_kind" NOT NULL,
	"target_node_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_relationships_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "inventory_relationships_workspace_canonical_edge_unique" UNIQUE("workspace_id","source_kind","source_node_id","relationship_type","target_kind","target_node_id"),
	CONSTRAINT "inventory_relationships_kind_matrix" CHECK (
		(
			"inventory_relationships"."relationship_type" = 'GROUPS'
			and "inventory_relationships"."source_kind" = 'PROJECT'
			and "inventory_relationships"."target_kind" in ('DOMAIN', 'SERVER', 'CLOUD_RESOURCE', 'WEBSITE_APPLICATION')
		)
		or (
			"inventory_relationships"."relationship_type" = 'HOSTED_ON'
			and "inventory_relationships"."source_kind" = 'WEBSITE_APPLICATION'
			and "inventory_relationships"."target_kind" in ('SERVER', 'CLOUD_RESOURCE')
		)
		or (
			"inventory_relationships"."relationship_type" = 'USES_DOMAIN'
			and "inventory_relationships"."source_kind" = 'WEBSITE_APPLICATION'
			and "inventory_relationships"."target_kind" = 'DOMAIN'
		)
		or (
			"inventory_relationships"."relationship_type" = 'DEPENDS_ON'
			and "inventory_relationships"."source_kind" in ('WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE')
			and "inventory_relationships"."target_kind" in ('DOMAIN', 'WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE')
		)
		or (
			"inventory_relationships"."relationship_type" = 'ROUTES_TO'
			and "inventory_relationships"."source_kind" = 'DOMAIN'
			and "inventory_relationships"."target_kind" in ('WEBSITE_APPLICATION', 'SERVER', 'CLOUD_RESOURCE')
		)
		or (
			"inventory_relationships"."relationship_type" = 'CONNECTED_TO'
			and "inventory_relationships"."source_kind" in ('SERVER', 'CLOUD_RESOURCE')
			and "inventory_relationships"."target_kind" in ('SERVER', 'CLOUD_RESOURCE')
		)
	),
	CONSTRAINT "inventory_relationships_no_self_edge" CHECK ("inventory_relationships"."source_node_id" <> "inventory_relationships"."target_node_id"),
	CONSTRAINT "inventory_relationships_connected_canonical_order" CHECK ("inventory_relationships"."relationship_type" <> 'CONNECTED_TO' or "inventory_relationships"."source_node_id" < "inventory_relationships"."target_node_id"),
	CONSTRAINT "inventory_relationships_allowed_provenance" CHECK ("inventory_relationships"."provenance" in ('USER_MAPPED', 'IMPORTED', 'PROVIDER_API', 'DNS_RETRIEVED', 'CALCULATED'))
);
--> statement-breakpoint
ALTER TABLE "inventory_relationships" ADD CONSTRAINT "inventory_relationships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_relationships" ADD CONSTRAINT "inventory_relationships_workspace_source_node_fk" FOREIGN KEY ("workspace_id","source_node_id","source_kind") REFERENCES "public"."inventory_nodes"("workspace_id","node_id","entity_kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_relationships" ADD CONSTRAINT "inventory_relationships_workspace_target_node_fk" FOREIGN KEY ("workspace_id","target_node_id","target_kind") REFERENCES "public"."inventory_nodes"("workspace_id","node_id","entity_kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_relationships_active_outbound_idx" ON "inventory_relationships" USING btree ("workspace_id","source_kind","source_node_id","relationship_type") WHERE "inventory_relationships"."inventory_state" = 'TRACKED';--> statement-breakpoint
CREATE INDEX "inventory_relationships_active_inbound_idx" ON "inventory_relationships" USING btree ("workspace_id","target_kind","target_node_id","relationship_type") WHERE "inventory_relationships"."inventory_state" = 'TRACKED';--> statement-breakpoint
ALTER TABLE "inventory_nodes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "inventory_nodes_workspace_select"
ON "inventory_nodes"
FOR SELECT
USING ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "inventory_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "inventory_relationships_workspace_isolation"
ON "inventory_relationships"
FOR ALL
USING ("workspace_id" = "domainpulse"."current_workspace_id"())
WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());
