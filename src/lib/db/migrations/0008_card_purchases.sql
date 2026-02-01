-- Create card_purchases table for credit card installment purchases
CREATE TABLE IF NOT EXISTS "n1n4_card_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "category_id" uuid,

  -- Purchase details
  "description" varchar(500) NOT NULL,
  "store_name" varchar(255),
  "purchase_date" date NOT NULL,

  -- Amounts
  "original_amount" decimal(15, 2) NOT NULL,
  "total_amount" decimal(15, 2) NOT NULL,
  "interest_amount" decimal(15, 2) NOT NULL,
  "interest_rate" decimal(5, 2),

  -- Installments
  "installments" integer NOT NULL,
  "installment_amount" decimal(15, 2) NOT NULL,
  "first_charge_date" date NOT NULL,
  "charged_installments" integer DEFAULT 0 NOT NULL,

  -- Status
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for card_purchases
ALTER TABLE "n1n4_card_purchases" ADD CONSTRAINT "n1n4_card_purchases_user_id_n1n4_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_card_purchases" ADD CONSTRAINT "n1n4_card_purchases_project_id_n1n4_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_card_purchases" ADD CONSTRAINT "n1n4_card_purchases_account_id_n1n4_accounts_id_fk"
  FOREIGN KEY ("account_id") REFERENCES "public"."n1n4_accounts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "n1n4_card_purchases" ADD CONSTRAINT "n1n4_card_purchases_category_id_n1n4_categories_id_fk"
  FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE set null ON UPDATE no action;

-- Add card_purchase_id to transactions table
ALTER TABLE "n1n4_transactions" ADD COLUMN "card_purchase_id" uuid;

ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_card_purchase_id_n1n4_card_purchases_id_fk"
  FOREIGN KEY ("card_purchase_id") REFERENCES "public"."n1n4_card_purchases"("id") ON DELETE set null ON UPDATE no action;

-- Create indexes for common queries
CREATE INDEX "n1n4_card_purchases_user_id_idx" ON "n1n4_card_purchases" ("user_id");
CREATE INDEX "n1n4_card_purchases_project_id_idx" ON "n1n4_card_purchases" ("project_id");
CREATE INDEX "n1n4_card_purchases_account_id_idx" ON "n1n4_card_purchases" ("account_id");
CREATE INDEX "n1n4_card_purchases_is_active_idx" ON "n1n4_card_purchases" ("is_active");
CREATE INDEX "n1n4_transactions_card_purchase_id_idx" ON "n1n4_transactions" ("card_purchase_id");
