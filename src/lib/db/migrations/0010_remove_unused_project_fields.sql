-- Remove unused fields from projects table
ALTER TABLE "n1n4_projects" DROP COLUMN IF EXISTS "default_income_amount";
ALTER TABLE "n1n4_projects" DROP COLUMN IF EXISTS "debit_available";
