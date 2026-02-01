-- Add foreign key constraint for budget_id in transactions table
ALTER TABLE "n1n4_transactions" ADD CONSTRAINT "n1n4_transactions_budget_id_n1n4_budgets_id_fk"
  FOREIGN KEY ("budget_id") REFERENCES "public"."n1n4_budgets"("id") ON DELETE set null ON UPDATE no action;
