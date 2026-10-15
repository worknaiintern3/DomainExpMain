CREATE TABLE IF NOT EXISTS "google_play_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"google_account_id" text NOT NULL,
	"google_account_email" text NOT NULL,
	"developer_account_id" text,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "google_play_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"state" text NOT NULL,
	"code_verifier" text NOT NULL,
	"developer_account_id" text,
	"redirect_uri" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "google_play_connections" ADD CONSTRAINT "google_play_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "google_play_oauth_states" ADD CONSTRAINT "google_play_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "google_play_connections_user_id_unique" ON "google_play_connections" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_play_connections_developer_account_id_idx" ON "google_play_connections" USING btree ("developer_account_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "google_play_oauth_states_state_unique" ON "google_play_oauth_states" USING btree ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_play_oauth_states_user_id_idx" ON "google_play_oauth_states" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "google_play_oauth_states_expires_at_idx" ON "google_play_oauth_states" USING btree ("expires_at");
