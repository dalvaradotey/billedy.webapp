CREATE TYPE "public"."billing_cycle_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "n1n4_billing_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "billing_cycle_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp,
	"snapshot_income" numeric(15, 2),
	"snapshot_expenses" numeric(15, 2),
	"snapshot_savings" numeric(15, 2),
	"snapshot_balance" numeric(15, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "n1n4_billing_cycles" ADD CONSTRAINT "n1n4_billing_cycles_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;