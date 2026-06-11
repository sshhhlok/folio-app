-- ============================================================
-- Folio — database schema. Run this once in Supabase:
-- Dashboard  ->  SQL Editor  ->  New query  ->  paste  ->  Run
-- ============================================================

create table if not exists holdings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  symbol     text not null,
  qty        numeric not null default 0,
  avg        numeric not null default 0,
  ltp        numeric not null default 0,
  sector     text default '',
  tier       text default 'Medium',
  created_at timestamptz default now()
);

create table if not exists snapshots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  value      numeric not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- Row Level Security: each user can only ever see/touch their own rows.
alter table holdings  enable row level security;
alter table snapshots enable row level security;

drop policy if exists own_holdings on holdings;
create policy own_holdings on holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists own_snapshots on snapshots;
create policy own_snapshots on snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
