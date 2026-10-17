-- Inversiones: proyectos o negocios a los que se asocian movimientos para ver
-- cuánto se puso, cuánto retornó y el resultado. Solo aditiva.
create table n1n4_investments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  name varchar(255) not null,
  notes varchar(1000),
  started_at date,
  closed_at date,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- Rol del movimiento en la inversión:
--   aporte  (gasto): plata que se pone; en el ciclo no cuenta como gasto, va aparte
--   costo   (gasto): reduce el retorno (p. ej. pagar a quien ayudó); sigue siendo gasto
--   retorno (ingreso): lo que devuelve la inversión; sigue siendo ingreso
alter table n1n4_transactions
  add column investment_id uuid references n1n4_investments(id) on delete set null,
  add column investment_role varchar(10) check (investment_role in ('aporte', 'costo', 'retorno'));

create index n1n4_transactions_investment_id_idx on n1n4_transactions (investment_id) where investment_id is not null;
