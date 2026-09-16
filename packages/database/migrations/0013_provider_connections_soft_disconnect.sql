CREATE TYPE "public"."provider_connection_status" AS ENUM('CONNECTED', 'DISCONNECTED');--> statement-breakpoint
ALTER TABLE "provider_connections" ALTER COLUMN "encrypted_ciphertext" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ALTER COLUMN "encryption_iv" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ALTER COLUMN "encryption_auth_tag" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ALTER COLUMN "key_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "connection_status" "provider_connection_status" DEFAULT 'CONNECTED' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD COLUMN "disconnected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_status_credential_consistent" CHECK (
        (
          "provider_connections"."connection_status" = 'CONNECTED'
          and "provider_connections"."encrypted_ciphertext" is not null
          and "provider_connections"."encryption_iv" is not null
          and "provider_connections"."encryption_auth_tag" is not null
          and "provider_connections"."key_version" is not null
          and "provider_connections"."disconnected_at" is null
        )
        or
        (
          "provider_connections"."connection_status" = 'DISCONNECTED'
          and "provider_connections"."encrypted_ciphertext" is null
          and "provider_connections"."encryption_iv" is null
          and "provider_connections"."encryption_auth_tag" is null
          and "provider_connections"."key_version" is null
          and "provider_connections"."disconnected_at" is not null
        )
      );