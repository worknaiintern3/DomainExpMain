CREATE TYPE "public"."provider_connection_auth_type" AS ENUM('CLOUDFLARE_API_TOKEN');--> statement-breakpoint
CREATE TYPE "public"."provider_connection_sync_status" AS ENUM('IDLE', 'PENDING', 'SYNCING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."provider_connection_validation_status" AS ENUM('PENDING', 'VALID', 'INVALID');--> statement-breakpoint
CREATE TABLE "provider_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider_account_id" uuid NOT NULL,
	"auth_type" "provider_connection_auth_type" NOT NULL,
	"encrypted_ciphertext" text NOT NULL,
	"encryption_iv" text NOT NULL,
	"encryption_auth_tag" text NOT NULL,
	"key_version" integer NOT NULL,
	"credential_mask" text NOT NULL,
	"validation_status" "provider_connection_validation_status" DEFAULT 'PENDING' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"validation_error_code" text,
	"sync_status" "provider_connection_sync_status" DEFAULT 'IDLE' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"next_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_connections_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "provider_connections_ciphertext_envelope" CHECK (length("provider_connections"."encrypted_ciphertext") between 4 and 8192 and "provider_connections"."encrypted_ciphertext" ~ '^[A-Za-z0-9+/]+={0,2}$'),
	CONSTRAINT "provider_connections_iv_envelope" CHECK (length("provider_connections"."encryption_iv") = 16 and "provider_connections"."encryption_iv" ~ '^[A-Za-z0-9+/]{16}$'),
	CONSTRAINT "provider_connections_auth_tag_envelope" CHECK (length("provider_connections"."encryption_auth_tag") = 24 and "provider_connections"."encryption_auth_tag" ~ '^[A-Za-z0-9+/]{22}==$'),
	CONSTRAINT "provider_connections_key_version_positive" CHECK ("provider_connections"."key_version" >= 1),
	CONSTRAINT "provider_connections_credential_mask_display" CHECK (length(btrim("provider_connections"."credential_mask")) > 0 and char_length("provider_connections"."credential_mask") <= 255),
	CONSTRAINT "provider_connections_error_code_canonical" CHECK ("provider_connections"."validation_error_code" is null or "provider_connections"."validation_error_code" ~ '^[A-Z0-9_]{1,64}$'),
	CONSTRAINT "provider_connections_validation_consistent" CHECK (
        (
          "provider_connections"."validation_status" = 'PENDING'
          and "provider_connections"."last_validated_at" is null
          and "provider_connections"."validation_error_code" is null
        )
        or
        (
          "provider_connections"."validation_status" = 'VALID'
          and "provider_connections"."last_validated_at" is not null
          and "provider_connections"."validation_error_code" is null
        )
        or
        (
          "provider_connections"."validation_status" = 'INVALID'
          and "provider_connections"."last_validated_at" is not null
          and "provider_connections"."validation_error_code" is not null
        )
      )
);
--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_account_fk" FOREIGN KEY ("workspace_id","provider_account_id") REFERENCES "public"."provider_accounts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provider_connections_workspace_account_unique" ON "provider_connections" USING btree ("workspace_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "provider_connections_workspace_next_sync_idx" ON "provider_connections" USING btree ("workspace_id","next_sync_at") WHERE "provider_connections"."next_sync_at" is not null;--> statement-breakpoint
ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provider_connections_workspace_isolation" ON "provider_connections" FOR ALL USING ("workspace_id" = "domainpulse"."current_workspace_id"()) WITH CHECK ("workspace_id" = "domainpulse"."current_workspace_id"());