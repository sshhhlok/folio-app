-- Folio — invested-journey table (from tradebook import). Run in SQL Editor.
create table if not exists journey (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  invested   numeric not null,
  created_at timestamptz default now()
);
alter table journey enable row level security;
drop policy if exists own_journey on journey;
create policy own_journey on journey
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
