-- Bot de Telegram para registrar gastos. Solo aditiva.

-- Vinculación de un usuario con su chat. El código es de un solo uso y vence;
-- mientras chat_id sea null, el vínculo no está activo.
create table n1n4_telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references n1n4_users(id) on delete cascade,
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  chat_id bigint unique,
  link_code varchar(16) unique,
  code_expires_at timestamp,
  linked_at timestamp,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- Mensaje interpretado esperando confirmación (botón Guardar), o ya guardado
-- (para poder deshacerlo).
create table n1n4_telegram_drafts (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references n1n4_telegram_links(id) on delete cascade,
  payload jsonb not null,
  status varchar(16) not null default 'pending' check (status in ('pending', 'saved', 'cancelled', 'undone')),
  transaction_id uuid references n1n4_transactions(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index n1n4_telegram_drafts_link_id_idx on n1n4_telegram_drafts (link_id, created_at desc);
