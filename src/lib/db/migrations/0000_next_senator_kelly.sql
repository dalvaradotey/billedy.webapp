CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'cash', 'credit_card');--> statement-breakpoint
CREATE TYPE "public"."category_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."credit_frequency" AS ENUM('monthly', 'biweekly', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."savings_fund_type" AS ENUM('emergency', 'investment', 'goal', 'other');--> statement-breakpoint
CREATE TYPE "public"."savings_movement_type" AS ENUM('deposit', 'withdrawal');--> statement-breakpoint
CREATE TABLE "n1n4_oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "n1n4_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "n1n4_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "n1n4_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"image" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "n1n4_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "n1n4_verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "n1n4_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "n1n4_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "account_type" NOT NULL,
	"bank_name" varchar(255),
	"currency_id" uuid NOT NULL,
	"initial_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"group" varchar(100),
	"color" varchar(7) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_category_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"group" varchar(100),
	"color" varchar(7) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"decimal_separator" varchar(1) DEFAULT '.' NOT NULL,
	"thousands_separator" varchar(1) DEFAULT ',' NOT NULL,
	"decimal_places" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "n1n4_currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "n1n4_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"base_currency_id" uuid NOT NULL,
	"currency" varchar(3) NOT NULL,
	"default_income_amount" numeric(15, 2),
	"max_installment_amount" numeric(15, 2),
	"debit_available" numeric(15, 2),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_project_category_period" UNIQUE("project_id","category_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "n1n4_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"original_principal_amount" numeric(15, 2) NOT NULL,
	"original_total_amount" numeric(15, 2) NOT NULL,
	"original_currency" varchar(3) NOT NULL,
	"original_currency_id" uuid NOT NULL,
	"base_principal_amount" numeric(15, 2) NOT NULL,
	"base_total_amount" numeric(15, 2) NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"exchange_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"installments" integer NOT NULL,
	"installment_amount" numeric(15, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"frequency" "credit_frequency" DEFAULT 'monthly' NOT NULL,
	"description" varchar(500),
	"notes" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_recurring_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"type" "category_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency_id" uuid NOT NULL,
	"day_of_month" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"type" "category_type" NOT NULL,
	"original_amount" numeric(15, 2) NOT NULL,
	"original_currency" varchar(3) NOT NULL,
	"original_currency_id" uuid NOT NULL,
	"base_amount" numeric(15, 2) NOT NULL,
	"base_currency" varchar(3) NOT NULL,
	"base_currency_id" uuid NOT NULL,
	"exchange_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"date" date NOT NULL,
	"description" varchar(500) NOT NULL,
	"notes" text,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"credit_id" uuid,
	"recurring_item_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_savings_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" "savings_fund_type" NOT NULL,
	"account_type" varchar(100) NOT NULL,
	"currency_id" uuid NOT NULL,
	"target_amount" numeric(15, 2),
	"monthly_target" numeric(15, 2) NOT NULL,
	"current_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_savings_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"savings_fund_id" uuid NOT NULL,
	"type" "savings_movement_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"date" date NOT NULL,
	"description" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"type" "category_type" NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"currency_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "n1n4_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "n1n4_oauth_accounts" ADD CONSTRAINT "n1n4_oauth_accounts_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_sessions" ADD CONSTRAINT "n1n4_sessions_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_accounts" ADD CONSTRAINT "n1n4_accounts_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_accounts" ADD CONSTRAINT "n1n4_accounts_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_categories" ADD CONSTRAINT "n1n4_categories_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_projects" ADD CONSTRAINT "n1n4_projects_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_projects" ADD CONSTRAINT "n1n4_projects_base_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_budgets" ADD CONSTRAINT "n1n4_budgets_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_budgets" ADD CONSTRAINT "n1n4_budgets_category_id_n1n4_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_credits" ADD CONSTRAINT "n1n4_credits_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_credits" ADD CONSTRAINT "n1n4_credits_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_credits" ADD CONSTRAINT "n1n4_credits_category_id_n1n4_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_credits" ADD CONSTRAINT "n1n4_credits_original_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("original_currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_credits" ADD CONSTRAINT "n1n4_credits_base_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_recurring_items" ADD CONSTRAINT "n1n4_recurring_items_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_recurring_items" ADD CONSTRAINT "n1n4_recurring_items_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_recurring_items" ADD CONSTRAINT "n1n4_recurring_items_category_id_n1n4_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_recurring_items" ADD CONSTRAINT "n1n4_recurring_items_account_id_n1n4_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."n1n4_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_recurring_items" ADD CONSTRAINT "n1n4_recurring_items_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_category_id_n1n4_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_account_id_n1n4_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."n1n4_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_original_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("original_currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_base_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("base_currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_credit_id_n1n4_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."n1n4_credits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_recurring_item_id_n1n4_recurring_items_id_fk" FOREIGN KEY ("recurring_item_id") REFERENCES "public"."n1n4_recurring_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_savings_funds" ADD CONSTRAINT "n1n4_savings_funds_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_savings_funds" ADD CONSTRAINT "n1n4_savings_funds_project_id_n1n4_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."n1n4_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_savings_funds" ADD CONSTRAINT "n1n4_savings_funds_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_savings_movements" ADD CONSTRAINT "n1n4_savings_movements_savings_fund_id_n1n4_savings_funds_id_fk" FOREIGN KEY ("savings_fund_id") REFERENCES "public"."n1n4_savings_funds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_template_items" ADD CONSTRAINT "n1n4_template_items_template_id_n1n4_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."n1n4_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_template_items" ADD CONSTRAINT "n1n4_template_items_category_id_n1n4_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."n1n4_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_template_items" ADD CONSTRAINT "n1n4_template_items_currency_id_n1n4_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."n1n4_currencies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "n1n4_templates" ADD CONSTRAINT "n1n4_templates_user_id_n1n4_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."n1n4_users"("id") ON DELETE cascade ON UPDATE no action;