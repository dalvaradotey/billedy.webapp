-- Add credit_limit column to accounts table (for credit cards)
ALTER TABLE "n1n4_accounts" ADD COLUMN "credit_limit" decimal(15, 2);

-- Create transfers table for movements between accounts
CREATE TABLE IF NOT EXISTS "n1n4_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "from_account_id" uuid NOT NULL,
  "to_account_id" uuid NOT NULL,
  "amount" decimal(15, 2) NOT NULL,
  "date" timestamp NOT NULL,
  "description" varchar(500),
  "notes" varchar(1000),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "n1n4_transfers" ADD CONSTRAINT "n1n4_transfers_user_id_n1n4_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_transfers" ADD CONSTRAINT "n1n4_transfers_project_id_n1n4_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_transfers" ADD CONSTRAINT "n1n4_transfers_from_account_id_n1n4_accounts_id_fk"
  FOREIGN KEY ("from_account_id") REFERENCES "public"."n1n4_accounts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_transfers" ADD CONSTRAINT "n1n4_transfers_to_account_id_n1n4_accounts_id_fk"
  FOREIGN KEY ("to_account_id") REFERENCES "public"."n1n4_accounts"("id") ON DELETE cascade ON UPDATE no action;

-- Create index for common queries
CREATE INDEX "n1n4_transfers_user_id_idx" ON "n1n4_transfers" ("user_id");
CREATE INDEX "n1n4_transfers_project_id_idx" ON "n1n4_transfers" ("project_id");
CREATE INDEX "n1n4_transfers_from_account_id_idx" ON "n1n4_transfers" ("from_account_id");
CREATE INDEX "n1n4_transfers_to_account_id_idx" ON "n1n4_transfers" ("to_account_id");
CREATE INDEX "n1n4_transfers_date_idx" ON "n1n4_transfers" ("date");
