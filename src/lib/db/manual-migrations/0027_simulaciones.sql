-- Simulaciones "¿Me alcanza?": cada escenario guardado con su plan. Las puede
-- crear la app o Claude (source = 'claude', con su explicación en note). Solo aditiva.
create table n1n4_simulations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references n1n4_projects(id) on delete cascade,
  user_id uuid references n1n4_users(id) on delete set null,
  name varchar(255) not null,
  target numeric(15, 2) not null check (target > 0),
  -- PlanInput (fuentes, préstamo, reposición) y la opción elegida
  plan jsonb not null,
  source varchar(10) not null default 'app' check (source in ('app', 'claude')),
  note text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index n1n4_simulations_project_id_idx on n1n4_simulations (project_id, created_at desc);

-- Igual que el resto de las tablas: sin acceso para los roles públicos de la API
alter table n1n4_simulations enable row level security;
revoke all on n1n4_simulations from anon, authenticated;
