CREATE TYPE "public"."domain_metadata_attempt_status" AS ENUM('SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TABLE "domain_dns_metadata" (
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"last_attempt_status" "domain_metadata_attempt_status" NOT NULL,
	"retrieved_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provenance" "record_provenance" DEFAULT 'DNS_RETRIEVED' NOT NULL,
	"a_records" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"aaaa_records" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"cname_records" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"mx_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ns_records" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"ds_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"txt_record_count" integer DEFAULT 0 NOT NULL,
	"record_errors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "domain_dns_metadata_pk" PRIMARY KEY("workspace_id","domain_id"),
	CONSTRAINT "domain_dns_metadata_error_code_canonical" CHECK ("domain_dns_metadata"."last_error_code" is null or "domain_dns_metadata"."last_error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "domain_dns_metadata_attempt_error_consistent" CHECK (
        (
          "domain_dns_metadata"."last_attempt_status" = 'SUCCESS'
          and "domain_dns_metadata"."last_error_code" is null
        )
        or
        (
          "domain_dns_metadata"."last_attempt_status" in ('PARTIAL', 'FAILED')
          and "domain_dns_metadata"."last_error_code" is not null
        )
      ),
	CONSTRAINT "domain_dns_metadata_provenance_locked" CHECK ("domain_dns_metadata"."provenance" = 'DNS_RETRIEVED'),
	CONSTRAINT "domain_dns_metadata_txt_record_count_nonnegative" CHECK ("domain_dns_metadata"."txt_record_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "domain_rdap_metadata" (
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"last_attempt_status" "domain_metadata_attempt_status" NOT NULL,
	"retrieved_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provenance" "record_provenance" DEFAULT 'RDAP_RETRIEVED' NOT NULL,
	"registrar_name" text,
	"registrar_iana_id" text,
	"registered_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"changed_at" timestamp with time zone,
	"statuses" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"nameservers" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"secure_dns_delegation_signed" boolean,
	"source_url" text,
	CONSTRAINT "domain_rdap_metadata_pk" PRIMARY KEY("workspace_id","domain_id"),
	CONSTRAINT "domain_rdap_metadata_error_code_canonical" CHECK ("domain_rdap_metadata"."last_error_code" is null or "domain_rdap_metadata"."last_error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "domain_rdap_metadata_attempt_error_consistent" CHECK (
        (
          "domain_rdap_metadata"."last_attempt_status" = 'SUCCESS'
          and "domain_rdap_metadata"."last_error_code" is null
        )
        or
        (
          "domain_rdap_metadata"."last_attempt_status" in ('PARTIAL', 'FAILED')
          and "domain_rdap_metadata"."last_error_code" is not null
        )
      ),
	CONSTRAINT "domain_rdap_metadata_provenance_locked" CHECK ("domain_rdap_metadata"."provenance" = 'RDAP_RETRIEVED'),
	CONSTRAINT "domain_rdap_metadata_registrar_name_not_blank" CHECK ("domain_rdap_metadata"."registrar_name" is null or length(btrim("domain_rdap_metadata"."registrar_name")) > 0),
	CONSTRAINT "domain_rdap_metadata_registrar_iana_id_not_blank" CHECK ("domain_rdap_metadata"."registrar_iana_id" is null or length(btrim("domain_rdap_metadata"."registrar_iana_id")) > 0),
	CONSTRAINT "domain_rdap_metadata_source_url_not_blank" CHECK ("domain_rdap_metadata"."source_url" is null or length(btrim("domain_rdap_metadata"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "domain_tls_metadata" (
	"workspace_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"last_attempt_status" "domain_metadata_attempt_status" NOT NULL,
	"retrieved_at" timestamp with time zone,
	"last_attempted_at" timestamp with time zone NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provenance" "record_provenance" DEFAULT 'SSL_RETRIEVED' NOT NULL,
	"subject_common_name" text,
	"issuer_common_name" text,
	"issuer_organization" text,
	"subject_alt_names" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"serial_number" text,
	"fingerprint_256" text,
	CONSTRAINT "domain_tls_metadata_pk" PRIMARY KEY("workspace_id","domain_id"),
	CONSTRAINT "domain_tls_metadata_error_code_canonical" CHECK ("domain_tls_metadata"."last_error_code" is null or "domain_tls_metadata"."last_error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "domain_tls_metadata_attempt_error_consistent" CHECK (
        (
          "domain_tls_metadata"."last_attempt_status" = 'SUCCESS'
          and "domain_tls_metadata"."last_error_code" is null
        )
        or
        (
          "domain_tls_metadata"."last_attempt_status" in ('PARTIAL', 'FAILED')
          and "domain_tls_metadata"."last_error_code" is not null
        )
      ),
	CONSTRAINT "domain_tls_metadata_provenance_locked" CHECK ("domain_tls_metadata"."provenance" = 'SSL_RETRIEVED'),
	CONSTRAINT "domain_tls_metadata_validity_order" CHECK ("domain_tls_metadata"."valid_from" is null or "domain_tls_metadata"."valid_to" is null or "domain_tls_metadata"."valid_to" > "domain_tls_metadata"."valid_from"),
	CONSTRAINT "domain_tls_metadata_subject_cn_not_blank" CHECK ("domain_tls_metadata"."subject_common_name" is null or length(btrim("domain_tls_metadata"."subject_common_name")) > 0),
	CONSTRAINT "domain_tls_metadata_issuer_cn_not_blank" CHECK ("domain_tls_metadata"."issuer_common_name" is null or length(btrim("domain_tls_metadata"."issuer_common_name")) > 0),
	CONSTRAINT "domain_tls_metadata_issuer_org_not_blank" CHECK ("domain_tls_metadata"."issuer_organization" is null or length(btrim("domain_tls_metadata"."issuer_organization")) > 0),
	CONSTRAINT "domain_tls_metadata_serial_not_blank" CHECK ("domain_tls_metadata"."serial_number" is null or length(btrim("domain_tls_metadata"."serial_number")) > 0),
	CONSTRAINT "domain_tls_metadata_fingerprint_not_blank" CHECK ("domain_tls_metadata"."fingerprint_256" is null or length(btrim("domain_tls_metadata"."fingerprint_256")) > 0)
);
--> statement-breakpoint
ALTER TABLE "domain_dns_metadata" ADD CONSTRAINT "domain_dns_metadata_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_rdap_metadata" ADD CONSTRAINT "domain_rdap_metadata_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_tls_metadata" ADD CONSTRAINT "domain_tls_metadata_domain_fk" FOREIGN KEY ("workspace_id","domain_id") REFERENCES "public"."domains"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_dns_metadata_workspace_attempt_idx" ON "domain_dns_metadata" USING btree ("workspace_id","last_attempted_at");--> statement-breakpoint
CREATE INDEX "domain_rdap_metadata_workspace_attempt_idx" ON "domain_rdap_metadata" USING btree ("workspace_id","last_attempted_at");--> statement-breakpoint
CREATE INDEX "domain_tls_metadata_workspace_attempt_idx" ON "domain_tls_metadata" USING btree ("workspace_id","last_attempted_at");
--> statement-breakpoint
ALTER TABLE "domain_dns_metadata" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "domain_dns_metadata_workspace_isolation"
ON "domain_dns_metadata"
FOR ALL
USING (
  "workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
  "workspace_id" = "domainpulse"."current_workspace_id"()
);

--> statement-breakpoint
ALTER TABLE "domain_rdap_metadata" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "domain_rdap_metadata_workspace_isolation"
ON "domain_rdap_metadata"
FOR ALL
USING (
  "workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
  "workspace_id" = "domainpulse"."current_workspace_id"()
);

--> statement-breakpoint
ALTER TABLE "domain_tls_metadata" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "domain_tls_metadata_workspace_isolation"
ON "domain_tls_metadata"
FOR ALL
USING (
  "workspace_id" = "domainpulse"."current_workspace_id"()
)
WITH CHECK (
  "workspace_id" = "domainpulse"."current_workspace_id"()
);
