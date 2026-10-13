-- Conciliación de tarjeta de crédito con el estado de cuenta. Solo aditiva.

-- Estado de cuenta leído (no se guarda el PDF, solo lo extraído)
create table n1n4_card_statements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  account_id uuid not null references n1n4_accounts(id) on delete cascade,
  statement_date date not null,
  period_start date not null,
  period_end date not null,
  due_date date,
  total_billed numeric(15, 2) not null,
  minimum_payment numeric(15, 2),
  lines jsonb not null,
  reconciled_at timestamp,
  created_by uuid references n1n4_users(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (account_id, statement_date)
);

-- Nombre del comercio en el banco → cómo lo registras tú ("STARLINK" → Internet).
-- Se aprende al conciliar y sirve para crear lo que falta.
create table n1n4_merchant_aliases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  key varchar(120) not null,
  description varchar(500) not null,
  budget_id uuid references n1n4_budgets(id) on delete set null,
  category_id uuid references n1n4_categories(id) on delete set null,
  entity_id uuid references n1n4_entities(id) on delete set null,
  nature transaction_nature not null default 'own',
  times integer not null default 1,
  updated_at timestamp not null default now(),
  unique (project_id, key)
);
