CREATE TYPE "public"."project_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "n1n4_project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "project_role" DEFAULT 'viewer' NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_user" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "n1n4_project_members" ADD CONSTRAINT "n1n4_project_members_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_project_members" ADD CONSTRAINT "n1n4_project_members_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_project_members" ADD CONSTRAINT "n1n4_project_members_invited_by_n1n4_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."n1n4_users"("id") ON DELETE set null ON UPDATE no action;