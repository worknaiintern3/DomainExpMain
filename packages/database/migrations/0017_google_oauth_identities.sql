CREATE TYPE "public"."oauth_transaction_flow" AS ENUM('login', 'link');--> statement-breakpoint
CREATE TABLE "oauth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"provider_email" text,
	"provider_email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_identities_provider_canonical" CHECK ("oauth_identities"."provider" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "oauth_identities_provider_subject_not_blank" CHECK (length(btrim("oauth_identities"."provider_subject")) > 0),
	CONSTRAINT "oauth_identities_provider_email_not_blank" CHECK ("oauth_identities"."provider_email" is null or length(btrim("oauth_identities"."provider_email")) > 0)
);
--> statement-breakpoint
CREATE TABLE "oauth_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"state" text NOT NULL,
	"code_verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"flow" "oauth_transaction_flow" NOT NULL,
	"linking_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_transactions_provider_canonical" CHECK ("oauth_transactions"."provider" ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
	CONSTRAINT "oauth_transactions_state_not_blank" CHECK (length(btrim("oauth_transactions"."state")) > 0),
	CONSTRAINT "oauth_transactions_code_verifier_not_blank" CHECK (length(btrim("oauth_transactions"."code_verifier")) > 0),
	CONSTRAINT "oauth_transactions_nonce_not_blank" CHECK (length(btrim("oauth_transactions"."nonce")) > 0),
	CONSTRAINT "oauth_transactions_flow_linking_user_invariant" CHECK (("oauth_transactions"."flow" = 'login' AND "oauth_transactions"."linking_user_id" IS NULL) OR ("oauth_transactions"."flow" = 'link' AND "oauth_transactions"."linking_user_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_linking_user_id_users_id_fk" FOREIGN KEY ("linking_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_identities_provider_subject_unique" ON "oauth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_identities_user_provider_unique" ON "oauth_identities" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_transactions_state_unique" ON "oauth_transactions" USING btree ("state");--> statement-breakpoint
CREATE INDEX "oauth_transactions_expires_at_idx" ON "oauth_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_transactions_linking_user_id_idx" ON "oauth_transactions" USING btree ("linking_user_id");