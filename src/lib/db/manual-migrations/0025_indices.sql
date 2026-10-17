-- Auditoría de octubre 2026: índices para las consultas más frecuentes. Solo aditiva.

-- Casi todas las consultas filtran movimientos por proyecto y rango de fechas
create index if not exists n1n4_transactions_project_date_idx on n1n4_transactions (project_id, date);
create index if not exists n1n4_transactions_account_date_idx on n1n4_transactions (account_id, date);
create index if not exists n1n4_transactions_budget_id_idx on n1n4_transactions (budget_id) where budget_id is not null;
create index if not exists n1n4_transactions_credit_id_idx on n1n4_transactions (credit_id) where credit_id is not null;
create index if not exists n1n4_transactions_savings_goal_id_idx on n1n4_transactions (savings_goal_id) where savings_goal_id is not null;
create index if not exists n1n4_transactions_linked_id_idx on n1n4_transactions (linked_transaction_id) where linked_transaction_id is not null;
-- FK con "on delete set null": sin índice, borrar una categoría o entidad recorre todos los movimientos
create index if not exists n1n4_transactions_category_id_idx on n1n4_transactions (category_id) where category_id is not null;
create index if not exists n1n4_transactions_entity_id_idx on n1n4_transactions (entity_id) where entity_id is not null;

create index if not exists n1n4_fund_movements_fund_date_idx on n1n4_fund_movements (fund_id, date);
create index if not exists n1n4_account_funds_project_id_idx on n1n4_account_funds (project_id);
create index if not exists n1n4_categories_project_id_idx on n1n4_categories (project_id);
create index if not exists n1n4_billing_cycles_project_start_idx on n1n4_billing_cycles (project_id, start_date desc);
create index if not exists n1n4_budgets_project_id_idx on n1n4_budgets (project_id);
create index if not exists n1n4_credits_project_id_idx on n1n4_credits (project_id);
create index if not exists n1n4_templates_project_id_idx on n1n4_templates (project_id);
create index if not exists n1n4_template_items_template_id_idx on n1n4_template_items (template_id);
create index if not exists n1n4_project_members_user_id_idx on n1n4_project_members (user_id);
create index if not exists n1n4_savings_goals_project_id_idx on n1n4_savings_goals (project_id);
create index if not exists n1n4_investments_project_id_idx on n1n4_investments (project_id);
create index if not exists n1n4_sessions_user_id_idx on n1n4_sessions (user_id);
create index if not exists n1n4_oauth_accounts_user_id_idx on n1n4_oauth_accounts (user_id);
