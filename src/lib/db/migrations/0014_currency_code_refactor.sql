-- Refactor: Use currency code (varchar) instead of currency_id (FK) for simplicity
-- ISO 4217 currency codes are stable and don't require JOINs

-- ============================================================================
-- ACCOUNTS: Replace currency_id with currency code
-- ============================================================================

-- Step 1: Add currency varchar column
ALTER TABLE "n1n4_accounts" ADD COLUMN "currency" varchar(3);

-- Step 2: Populate currency from currencies table via currency_id
UPDATE "n1n4_accounts" a
SET "currency" = c."code"
FROM "n1n4_currencies" c
WHERE a."currency_id" = c."id";

-- Step 3: Set default for any NULL values (fallback to CLP)
UPDATE "n1n4_accounts"
SET "currency" = 'CLP'
WHERE "currency" IS NULL;

-- Step 4: Make currency NOT NULL with default
ALTER TABLE "n1n4_accounts" ALTER COLUMN "currency" SET NOT NULL;
ALTER TABLE "n1n4_accounts" ALTER COLUMN "currency" SET DEFAULT 'CLP';

-- Step 5: Drop the foreign key constraint
ALTER TABLE "n1n4_accounts" DROP CONSTRAINT "n1n4_accounts_currency_id_n1n4_currencies_id_fk";

-- Step 6: Drop the currency_id column
ALTER TABLE "n1n4_accounts" DROP COLUMN "currency_id";

-- ============================================================================
-- BUDGETS: Add currency code field
-- ============================================================================

-- Add currency varchar column with default CLP
ALTER TABLE "n1n4_budgets" ADD COLUMN "currency" varchar(3) NOT NULL DEFAULT 'CLP';
