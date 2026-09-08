CREATE TYPE "public"."inventory_record_state" AS ENUM('TRACKED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."record_provenance" AS ENUM('USER_ADDED', 'USER_MAPPED', 'IMPORTED', 'PROVIDER_API', 'RDAP_RETRIEVED', 'DNS_RETRIEVED', 'SSL_RETRIEVED', 'CALCULATED');--> statement-breakpoint
CREATE TYPE "public"."application_kind" AS ENUM('WEBSITE', 'WEB_APPLICATION', 'API', 'BACKEND_SERVICE', 'MOBILE_APPLICATION', 'OTHER');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"description" text,
	CONSTRAINT "projects_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "projects_name_not_blank" CHECK (length(btrim("projects"."name")) > 0),
	CONSTRAINT "projects_normalized_name_matches_name" CHECK ("projects"."normalized_name" = lower(btrim("projects"."name")))
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"label" text,
	"notes" text,
	CONSTRAINT "email_accounts_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "email_accounts_email_not_blank" CHECK (length(btrim("email_accounts"."email")) > 0),
	CONSTRAINT "email_accounts_normalized_email_not_blank" CHECK (length(btrim("email_accounts"."normalized_email")) > 0),
	CONSTRAINT "email_accounts_normalized_email_matches_email" CHECK ("email_accounts"."normalized_email" = lower(btrim("email_accounts"."email")))
);
--> statement-breakpoint
CREATE TABLE "provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_key" text NOT NULL,
	"label" text NOT NULL,
	"external_account_id" text,
	"login_email_account_id" uuid,
	"notes" text,
	CONSTRAINT "provider_accounts_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "provider_accounts_provider_key_canonical" CHECK ("provider_accounts"."provider_key" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "provider_accounts_label_not_blank" CHECK (length(btrim("provider_accounts"."label")) > 0),
	CONSTRAINT "provider_accounts_external_id_not_blank" CHECK ("provider_accounts"."external_account_id" is null or length(btrim("provider_accounts"."external_account_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"domain_name" text NOT NULL,
	"normalized_domain_name" text NOT NULL,
	"registrar_provider_account_id" uuid,
	"dns_provider_account_id" uuid,
	"registered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"auto_renew" boolean,
	"notes" text,
	CONSTRAINT "domains_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "domains_domain_name_not_blank" CHECK (length(btrim("domains"."domain_name")) > 0),
	CONSTRAINT "domains_normalized_domain_not_blank" CHECK (length(btrim("domains"."normalized_domain_name")) > 0),
	CONSTRAINT "domains_normalized_domain_canonical" CHECK ("domains"."normalized_domain_name" = lower(btrim("domains"."normalized_domain_name")) and "domains"."normalized_domain_name" !~ '\s' and right("domains"."normalized_domain_name", 1) <> '.'),
	CONSTRAINT "domains_expiry_after_registration" CHECK ("domains"."expires_at" is null or "domains"."registered_at" is null or "domains"."expires_at" > "domains"."registered_at")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"primary_ip" "inet",
	"server_kind" text,
	"provider_account_id" uuid,
	"region" text,
	"operating_system" text,
	"notes" text,
	CONSTRAINT "servers_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "servers_name_not_blank" CHECK (length(btrim("servers"."name")) > 0),
	CONSTRAINT "servers_hostname_canonical" CHECK ("servers"."hostname" is null or ("servers"."hostname" = lower(btrim("servers"."hostname")) and length(btrim("servers"."hostname")) > 0 and "servers"."hostname" !~ '\s' and right("servers"."hostname", 1) <> '.')),
	CONSTRAINT "servers_server_kind_canonical" CHECK ("servers"."server_kind" is null or "servers"."server_kind" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "servers_region_not_blank" CHECK ("servers"."region" is null or length(btrim("servers"."region")) > 0),
	CONSTRAINT "servers_operating_system_not_blank" CHECK ("servers"."operating_system" is null or length(btrim("servers"."operating_system")) > 0)
);
--> statement-breakpoint
CREATE TABLE "cloud_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"external_resource_id" text,
	"name" text NOT NULL,
	"region" text,
	"notes" text,
	CONSTRAINT "cloud_resources_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "cloud_resources_resource_type_canonical" CHECK ("cloud_resources"."resource_type" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "cloud_resources_external_id_not_blank" CHECK ("cloud_resources"."external_resource_id" is null or length(btrim("cloud_resources"."external_resource_id")) > 0),
	CONSTRAINT "cloud_resources_name_not_blank" CHECK (length(btrim("cloud_resources"."name")) > 0),
	CONSTRAINT "cloud_resources_region_not_blank" CHECK ("cloud_resources"."region" is null or length(btrim("cloud_resources"."region")) > 0)
);
--> statement-breakpoint
CREATE TABLE "website_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"inventory_state" "inventory_record_state" DEFAULT 'TRACKED' NOT NULL,
	"provenance" "record_provenance" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"kind" "application_kind" NOT NULL,
	"primary_url" text,
	"primary_domain_id" uuid,
	"project_id" uuid,
	"notes" text,
	CONSTRAINT "website_applications_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "website_applications_name_not_blank" CHECK (length(btrim("website_applications"."name")) > 0),
	CONSTRAINT "website_applications_primary_url_not_blank" CHECK ("website_applications"."primary_url" is null or length(btrim("website_applications"."primary_url")) > 0)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_workspace_login_email_fk" FOREIGN KEY ("workspace_id","login_email_account_id") REFERENCES "public"."email_accounts"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_registrar_provider_fk" FOREIGN KEY ("workspace_id","registrar_provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_dns_provider_fk" FOREIGN KEY ("workspace_id","dns_provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_workspace_provider_account_fk" FOREIGN KEY ("workspace_id","provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_resources" ADD CONSTRAINT "cloud_resources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_resources" ADD CONSTRAINT "cloud_resources_workspace_provider_account_fk" FOREIGN KEY ("workspace_id","provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_applications" ADD CONSTRAINT "website_applications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_applications" ADD CONSTRAINT "website_applications_workspace_primary_domain_fk" FOREIGN KEY ("workspace_id","primary_domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_applications" ADD CONSTRAINT "website_applications_workspace_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_normalized_name_unique" ON "projects" USING btree ("workspace_id","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_workspace_normalized_email_unique" ON "email_accounts" USING btree ("workspace_id","normalized_email");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_accounts_workspace_provider_external_unique" ON "provider_accounts" USING btree ("workspace_id","provider_key","external_account_id") WHERE "provider_accounts"."external_account_id" is not null;--> statement-breakpoint
CREATE INDEX "provider_accounts_workspace_provider_key_idx" ON "provider_accounts" USING btree ("workspace_id","provider_key");--> statement-breakpoint
CREATE INDEX "provider_accounts_workspace_login_email_idx" ON "provider_accounts" USING btree ("workspace_id","login_email_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "domains_workspace_normalized_domain_unique" ON "domains" USING btree ("workspace_id","normalized_domain_name");--> statement-breakpoint
CREATE INDEX "domains_workspace_registrar_provider_idx" ON "domains" USING btree ("workspace_id","registrar_provider_account_id");--> statement-breakpoint
CREATE INDEX "domains_workspace_dns_provider_idx" ON "domains" USING btree ("workspace_id","dns_provider_account_id");--> statement-breakpoint
CREATE INDEX "domains_workspace_expires_at_idx" ON "domains" USING btree ("workspace_id","expires_at") WHERE "domains"."expires_at" is not null;--> statement-breakpoint
CREATE INDEX "servers_workspace_provider_account_idx" ON "servers" USING btree ("workspace_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "servers_workspace_hostname_idx" ON "servers" USING btree ("workspace_id","hostname") WHERE "servers"."hostname" is not null;--> statement-breakpoint
CREATE INDEX "servers_workspace_primary_ip_idx" ON "servers" USING btree ("workspace_id","primary_ip") WHERE "servers"."primary_ip" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cloud_resources_workspace_provider_external_unique" ON "cloud_resources" USING btree ("workspace_id","provider_account_id","resource_type","external_resource_id") WHERE "cloud_resources"."external_resource_id" is not null;--> statement-breakpoint
CREATE INDEX "cloud_resources_workspace_provider_account_idx" ON "cloud_resources" USING btree ("workspace_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "cloud_resources_workspace_resource_type_idx" ON "cloud_resources" USING btree ("workspace_id","resource_type");--> statement-breakpoint
CREATE INDEX "website_applications_workspace_kind_idx" ON "website_applications" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE INDEX "website_applications_workspace_primary_domain_idx" ON "website_applications" USING btree ("workspace_id","primary_domain_id");--> statement-breakpoint
CREATE INDEX "website_applications_workspace_project_idx" ON "website_applications" USING btree ("workspace_id","project_id");--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "projects_workspace_isolation" ON "projects" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "email_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "email_accounts_workspace_isolation" ON "email_accounts" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "provider_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provider_accounts_workspace_isolation" ON "provider_accounts" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "domains_workspace_isolation" ON "domains" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "servers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "servers_workspace_isolation" ON "servers" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "cloud_resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cloud_resources_workspace_isolation" ON "cloud_resources" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());--> statement-breakpoint
ALTER TABLE "website_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "website_applications_workspace_isolation" ON "website_applications" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());
