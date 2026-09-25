CREATE TYPE "public"."platform_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "platform_role" "platform_role" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
CREATE TABLE "mobile_app_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" text DEFAULT 'DomainPulse' NOT NULL,
	"logo_url" text,
	"primary_color" text DEFAULT '#2563EB' NOT NULL,
	"secondary_color" text DEFAULT '#1E293B' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"maintenance_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "mobile_feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"min_app_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mobile_feature_flags_key_not_blank" CHECK (length(btrim("mobile_feature_flags"."key")) > 0)
);--> statement-breakpoint
CREATE TABLE "mobile_navigation_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text NOT NULL,
	"route" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"badge" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "mobile_home_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_key" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "mobile_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"action_url" text,
	"action_label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "mobile_app_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"minimum_version" text DEFAULT '1.0.0' NOT NULL,
	"latest_version" text DEFAULT '1.0.0' NOT NULL,
	"force_update" boolean DEFAULT false NOT NULL,
	"update_url" text,
	"release_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "mobile_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"details" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "mobile_audit_logs" ADD CONSTRAINT "mobile_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_feature_flags_key_unique" ON "mobile_feature_flags" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_navigation_config_key_unique" ON "mobile_navigation_config" USING btree ("key");--> statement-breakpoint
CREATE INDEX "mobile_navigation_config_sort_order_idx" ON "mobile_navigation_config" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_home_config_section_key_unique" ON "mobile_home_config" USING btree ("section_key");--> statement-breakpoint
CREATE INDEX "mobile_home_config_sort_order_idx" ON "mobile_home_config" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "mobile_announcements_is_active_idx" ON "mobile_announcements" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "mobile_app_versions_platform_unique" ON "mobile_app_versions" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "mobile_audit_logs_user_id_idx" ON "mobile_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mobile_audit_logs_action_idx" ON "mobile_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "mobile_audit_logs_created_at_idx" ON "mobile_audit_logs" USING btree ("created_at");
