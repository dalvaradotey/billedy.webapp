-- Budget redesign: templates with billing cycle allocations

-- Drop the unique constraint on budgets
ALTER TABLE "n1n4_budgets" DROP CONSTRAINT IF EXISTS "budgets_project_category_period";

-- Remove year and month columns (no longer needed)
ALTER TABLE "n1n4_budgets" DROP COLUMN IF EXISTS "year";
ALTER TABLE "n1n4_budgets" DROP COLUMN IF EXISTS "month";

-- Rename amount to default_amount
ALTER TABLE "n1n4_budgets" RENAME COLUMN "amount" TO "default_amount";

-- Add name column
ALTER TABLE "n1n4_budgets" ADD COLUMN "name" varchar(255) NOT NULL DEFAULT 'Budget';

-- Remove the default after adding (it was just for the migration)
ALTER TABLE "n1n4_budgets" ALTER COLUMN "name" DROP DEFAULT;

-- Add is_active column
ALTER TABLE "n1n4_budgets" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;

-- Make category_id optional (remove NOT NULL)
ALTER TABLE "n1n4_budgets" ALTER COLUMN "category_id" DROP NOT NULL;

-- Add budget_id to transactions
ALTER TABLE "n1n4_transactions" ADD COLUMN "budget_id" uuid;

-- Create billing_cycle_budgets table
CREATE TABLE IF NOT EXISTS "n1n4_billing_cycle_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_cycle_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_cycle_budgets_cycle_budget" UNIQUE("billing_cycle_id","budget_id")
);

-- Add foreign keys for billing_cycle_budgets
ALTER TABLE "n1n4_billing_cycle_budgets" ADD CONSTRAINT "n1n4_billing_cycle_budgets_billing_cycle_id_n1n4_billing_cycles_id_fk" FOREIGN KEY ("billing_cycle_id") REFERENCES "public"."n1n4_billing_cycles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "n1n4_billing_cycle_budgets" ADD CONSTRAINT "n1n4_billing_cycle_budgets_budget_id_n1n4_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."n1n4_budgets"("id") ON DELETE cascade ON UPDATE no action;
