-- Historial de cotizaciones de AFP / AFC por cuenta (importado de cartolas y
-- certificados, o confirmado a mano). Solo aditiva.
create table n1n4_pension_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  account_id uuid not null references n1n4_accounts(id) on delete cascade,
  -- Mes cotizado (día 1)
  period date not null,
  -- Fecha de pago o de abono en la cuenta
  paid_date date,
  -- Renta imponible informada por el empleador
  taxable_income numeric(15, 2),
  -- Lo que suma a la cuenta (en AFC: parte del afiliado + del empleador)
  amount numeric(15, 2) not null,
  quotas numeric(18, 4),
  employer_rut varchar(20),
  -- 'manual', 'afc_cartola', 'afc_certificado', 'afp_movimientos'
  source varchar(30) not null,
  -- true si sumó cuotas y un movimiento a la cuenta (lo anterior a las cuotas
  -- configuradas queda solo como historial)
  applied boolean not null default false,
  transaction_id uuid references n1n4_transactions(id) on delete set null,
  created_at timestamp not null default now(),
  unique (account_id, period)
);
