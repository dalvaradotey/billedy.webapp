-- Fases 2 y 3 del plan de saldos (docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §10).
-- Solo aditiva: columnas con default o nullable y tablas nuevas. No borra ni modifica datos.

-- Naturaleza de las transacciones
create type transaction_nature as enum ('own', 'external', 'reimbursable', 'fund', 'reimbursement');

alter table n1n4_transactions
  add column nature transaction_nature not null default 'own',
  add constraint n1n4_transactions_nature_type_check check (
    (type = 'income' and nature in ('own', 'reimbursement'))
    or (type = 'expense' and nature in ('own', 'external', 'reimbursable', 'fund'))
  );

alter table n1n4_card_purchases
  add column nature transaction_nature not null default 'own',
  add constraint n1n4_card_purchases_nature_check check (
    nature in ('own', 'external', 'reimbursable', 'fund')
  );

alter table n1n4_categories
  add column default_nature transaction_nature;

-- Cascada completa al cierre del ciclo
alter table n1n4_billing_cycles
  add column closing_snapshot jsonb;

-- Plan del proyecto: ahorro objetivo, techo de gasto propio en TC, cuenta del fondo
alter table n1n4_projects
  add column savings_target numeric(15, 2),
  add column card_spending_cap numeric(15, 2),
  add column contingency_account_id uuid references n1n4_accounts(id) on delete set null;

-- Compensaciones (parciales, de muchos a muchos)
create type settlement_kind as enum ('transaction', 'waived');

create table n1n4_settlements (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references n1n4_transactions(id) on delete cascade,
  settling_transaction_id uuid references n1n4_transactions(id) on delete cascade,
  amount numeric(15, 2) not null check (amount > 0),
  kind settlement_kind not null,
  created_at timestamp not null default now(),
  check ((kind = 'transaction') = (settling_transaction_id is not null))
);

create index n1n4_settlements_expense_id_idx on n1n4_settlements (expense_id);
create index n1n4_settlements_settling_transaction_id_idx on n1n4_settlements (settling_transaction_id);
