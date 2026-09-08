ALTER TABLE "users" ADD COLUMN "personal_workspace_id" uuid;--> statement-breakpoint
WITH "personal_workspace_ids" AS MATERIALIZED (
	SELECT
		"users"."id" AS "user_id",
		gen_random_uuid() AS "workspace_id"
	FROM "users"
),
"personal_workspace_plan" AS MATERIALIZED (
	SELECT
		"personal_workspace_ids"."user_id",
		"personal_workspace_ids"."workspace_id",
		'personal-' || replace("personal_workspace_ids"."workspace_id"::text, '-', '') AS "workspace_slug"
	FROM "personal_workspace_ids"
),
"created_personal_workspaces" AS (
	INSERT INTO "workspaces" (
		"id",
		"name",
		"slug",
		"created_at",
		"updated_at"
	)
	SELECT
		"personal_workspace_plan"."workspace_id",
		'Personal Workspace',
		"personal_workspace_plan"."workspace_slug",
		now(),
		now()
	FROM "personal_workspace_plan"
	RETURNING "id"
)
UPDATE "users"
SET
	"personal_workspace_id" = "personal_workspace_plan"."workspace_id",
	"updated_at" = now()
FROM "personal_workspace_plan"
INNER JOIN "created_personal_workspaces"
	ON "created_personal_workspaces"."id" = "personal_workspace_plan"."workspace_id"
WHERE "users"."id" = "personal_workspace_plan"."user_id";--> statement-breakpoint
INSERT INTO "workspace_members" (
	"id",
	"workspace_id",
	"user_id",
	"role",
	"created_at",
	"updated_at"
)
SELECT
	gen_random_uuid(),
	"users"."personal_workspace_id",
	"users"."id",
	'owner',
	now(),
	now()
FROM "users"
WHERE "users"."personal_workspace_id" IS NOT NULL
ON CONFLICT ("workspace_id", "user_id") DO UPDATE
SET "role" = 'owner', "updated_at" = now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "personal_workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_personal_workspace_id_workspaces_id_fk" FOREIGN KEY ("personal_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_personal_workspace_id_unique" ON "users" USING btree ("personal_workspace_id");
