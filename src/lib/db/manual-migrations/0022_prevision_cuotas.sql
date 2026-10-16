-- Previsión por cuotas: el saldo de AFP y seguro de cesantía es cuotas × valor cuota.
-- El valor cuota es público (Superintendencia de Pensiones) y se guarda a diario.
-- Solo aditiva.

alter table n1n4_accounts
  -- Institución: 'CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO' o 'AFC'
  add column pension_provider varchar(20),
  -- Fondo: 'A' a 'E' en AFP; 'CIC' (cuenta individual) en AFC
  add column pension_fund varchar(10),
  add column quota_count numeric(18, 4),
  add column quota_count_date date;

create table n1n4_quota_values (
  provider varchar(20) not null,
  fund varchar(10) not null,
  date date not null,
  value numeric(14, 2) not null,
  primary key (provider, fund, date)
);
