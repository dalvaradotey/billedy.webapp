-- Auditoría de octubre 2026: seguridad, integridad y limpieza de lo que el código
-- ya no usa (PR #23). Respaldo previo: backups/2026-10-17T02-04-19-777Z.

-- ── Seguridad ────────────────────────────────────────────────────────────────
-- La app se conecta como postgres (dueño de las tablas) y no usa la Data API de
-- Supabase: los roles públicos de la API no deben poder leer ni escribir nada.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- RLS sin políticas: bloquea a cualquier rol que no sea el dueño (el dueño la omite)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'n1n4\_%' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- ── Integridad ───────────────────────────────────────────────────────────────
-- La contraparte de un traspaso: hoy sin FK (0 huérfanos verificados)
alter table n1n4_transactions
  add constraint n1n4_transactions_linked_transaction_id_fk
  foreign key (linked_transaction_id) references n1n4_transactions(id) on delete set null;

-- Drizzle ya las declara NOT NULL y no hay filas con null
alter table n1n4_categories alter column project_id set not null;
alter table n1n4_templates alter column project_id set not null;
alter table n1n4_template_items alter column user_id set not null;
alter table n1n4_template_items alter column project_id set not null;

-- ── Limpieza ─────────────────────────────────────────────────────────────────
-- Tablas vacías y sin uso: los traspasos viven en transactions.linked_transaction_id
drop table n1n4_transfers;
drop table n1n4_billing_cycle_budgets;

-- Columnas sin uso
alter table n1n4_projects drop column debit_available;
alter table n1n4_users drop column last_login_at;
-- Totales del cierre: se derivan de closing_snapshot
alter table n1n4_billing_cycles
  drop column snapshot_income,
  drop column snapshot_expenses,
  drop column snapshot_savings,
  drop column snapshot_balance;
-- Deuda externa = nature 'external'; la tienda se elige como entidad
alter table n1n4_card_purchases
  drop column is_external_debt,
  drop column store_name;
-- El formato de montos sale del locale, no de la BD
alter table n1n4_currencies
  drop column decimal_separator,
  drop column thousands_separator,
  drop column decimal_places;
