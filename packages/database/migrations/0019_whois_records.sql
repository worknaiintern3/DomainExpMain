CREATE TABLE IF NOT EXISTS "whois_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"domain_id" uuid,
	"domain_name" text NOT NULL,
	"normalized_domain_name" text NOT NULL,
	"is_registered" boolean DEFAULT true NOT NULL,
	"query_time" text,
	"registered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"updated_date" timestamp with time zone,
	"registrar_name" text,
	"registrar_iana_id" text,
	"registrar_website" text,
	"registrar_email" text,
	"registrar_phone" text,
	"registrant_contact" jsonb,
	"technical_contact" jsonb,
	"administrative_contact" jsonb,
	"nameservers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"statuses" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"raw_whois" text,
	"raw_response" jsonb,
	"retrieved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whois_records_workspace_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade,
	CONSTRAINT "whois_records_domain_fk" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whois_records_workspace_domain_idx" ON "whois_records" ("workspace_id", "normalized_domain_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whois_records_domain_id_idx" ON "whois_records" ("domain_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whois_records_retrieved_at_idx" ON "whois_records" ("retrieved_at");
