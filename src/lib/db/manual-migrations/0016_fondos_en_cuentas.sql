-- Fondos dentro de una cuenta ("sobres" que solo existen en la app).
-- Solo aditiva. Ver docs/PLAN_SALDOS_CICLOS_Y_TECHO_TC.md §13.

create table n1n4_account_funds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  account_id uuid not null references n1n4_accounts(id) on delete cascade,
  name varchar(255) not null,
  target_amount numeric(15, 2) check (target_amount is null or target_amount > 0),
  -- Plata de otra persona guardada en tu cuenta: no cuenta como tuya
  is_third_party boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index n1n4_account_funds_account_id_idx on n1n4_account_funds (account_id);

-- initial: saldo con que se crea el fondo (no cuenta como ahorro del ciclo)
-- allocate / release: apartar o liberar plata de "Libre"
create type fund_movement_kind as enum ('initial', 'allocate', 'release');

create table n1n4_fund_movements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references n1n4_account_funds(id) on delete cascade,
  kind fund_movement_kind not null,
  amount numeric(15, 2) not null check (amount > 0),
  date date not null,
  notes varchar(500),
  created_at timestamp not null default now()
);

create index n1n4_fund_movements_fund_id_idx on n1n4_fund_movements (fund_id);

-- Gasto pagado con un fondo: baja el saldo del fondo (el monto sale de la transacción,
-- así una edición del gasto mantiene el fondo cuadrado)
alter table n1n4_transactions
  add column account_fund_id uuid references n1n4_account_funds(id) on delete set null;

create index n1n4_transactions_account_fund_id_idx on n1n4_transactions (account_fund_id)
  where account_fund_id is not null;
