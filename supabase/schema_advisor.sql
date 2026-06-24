-- ============================================================
-- Folio — Advisor foundation (multi-client + CRM).
-- Run AFTER schema.sql / schema_paywall.sql / schema_journey.sql.
-- Safe to run once. Existing holdings are auto-moved to a
-- "My Portfolio" client so nothing is lost.
-- ============================================================

create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  advisor_id   uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  email        text default '',
  phone        text default '',
  pan          text default '',
  dob          date,
  family_group text default '',
  nominee      text default '',
  risk_profile text default '',
  notes        text default '',
  created_at   timestamptz default now()
);
alter table clients enable row level security;
drop policy if exists own_clients on clients;
create policy own_clients on clients for all
  using (auth.uid() = advisor_id) with check (auth.uid() = advisor_id);

-- Attach existing data to a client
alter table holdings  add column if not exists client_id uuid references clients(id) on delete cascade;
alter table snapshots add column if not exists client_id uuid references clients(id) on delete cascade;
alter table journey   add column if not exists client_id uuid references clients(id) on delete cascade;

-- Backfill: one "My Portfolio" client per advisor that already has holdings
do $$
declare u record; cid uuid;
begin
  for u in (select distinct user_id from holdings where client_id is null) loop
    insert into clients (advisor_id, name) values (u.user_id, 'My Portfolio') returning id into cid;
    update holdings  set client_id = cid where user_id = u.user_id and client_id is null;
    update snapshots set client_id = cid where user_id = u.user_id and client_id is null;
    update journey   set client_id = cid where user_id = u.user_id and client_id is null;
  end loop;
end $$;

-- CRM: notes
create table if not exists client_notes (
  id         uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);
alter table client_notes enable row level security;
drop policy if exists own_notes on client_notes;
create policy own_notes on client_notes for all
  using (auth.uid() = advisor_id) with check (auth.uid() = advisor_id);

-- CRM: tasks / reminders
create table if not exists client_tasks (
  id         uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  title      text not null,
  due_date   date,
  done       boolean default false,
  created_at timestamptz default now()
);
alter table client_tasks enable row level security;
drop policy if exists own_tasks on client_tasks;
create policy own_tasks on client_tasks for all
  using (auth.uid() = advisor_id) with check (auth.uid() = advisor_id);
