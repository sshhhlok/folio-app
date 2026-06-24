-- ============================================================
-- Folio — COMPLETE database setup. Run THIS ONE FILE only.
-- Safe to run repeatedly. Order-independent. Replaces the need
-- to run the individual schema_*.sql files.
-- (After running, set yourself as owner if not already:
--   update profiles set role='owner' where email='YOUR_EMAIL'; )
-- ============================================================

-- ---------- profiles (accounts / plans) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'member',
  is_paid boolean default false,
  paid_until date,
  created_at timestamptz default now()
);
alter table profiles add column if not exists email text;
alter table profiles add column if not exists role text default 'member';
alter table profiles add column if not exists is_paid boolean default false;
alter table profiles add column if not exists paid_until date;
alter table profiles add column if not exists basic_until date;
alter table profiles add column if not exists business_until date;

create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
insert into profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

create or replace function is_owner() returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

alter table profiles enable row level security;
drop policy if exists profile_read on profiles;
create policy profile_read on profiles for select using (auth.uid() = id or is_owner());
drop policy if exists owner_update on profiles;
create policy owner_update on profiles for update using (is_owner()) with check (is_owner());
drop policy if exists profile_self_insert on profiles;
create policy profile_self_insert on profiles for insert with check (auth.uid() = id);

-- ---------- clients ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text default '', phone text default '', pan text default '',
  dob date, family_group text default '', nominee text default '',
  risk_profile text default '', notes text default '',
  created_at timestamptz default now()
);
alter table clients enable row level security;
drop policy if exists own_clients on clients;
create policy own_clients on clients for all using (auth.uid()=advisor_id) with check (auth.uid()=advisor_id);

-- ---------- holdings ----------
create table if not exists holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null, qty numeric not null default 0, avg numeric not null default 0,
  ltp numeric not null default 0, sector text default '', tier text default 'Medium',
  created_at timestamptz default now()
);
alter table holdings add column if not exists client_id uuid references clients(id) on delete cascade;
alter table holdings enable row level security;
drop policy if exists own_holdings on holdings;
create policy own_holdings on holdings for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ---------- snapshots ----------
create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, value numeric not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);
alter table snapshots add column if not exists client_id uuid references clients(id) on delete cascade;
alter table snapshots enable row level security;
drop policy if exists own_snapshots on snapshots;
create policy own_snapshots on snapshots for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ---------- journey ----------
create table if not exists journey (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null, invested numeric not null,
  created_at timestamptz default now()
);
alter table journey add column if not exists client_id uuid references clients(id) on delete cascade;
alter table journey enable row level security;
drop policy if exists own_journey on journey;
create policy own_journey on journey for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- ---------- backfill existing rows to a default client ----------
do $$
declare u record; cid uuid;
begin
  for u in (select distinct user_id from holdings where client_id is null) loop
    insert into clients (advisor_id, name) values (u.user_id, 'My Portfolio') returning id into cid;
    update holdings  set client_id=cid where user_id=u.user_id and client_id is null;
    update snapshots set client_id=cid where user_id=u.user_id and client_id is null;
    update journey   set client_id=cid where user_id=u.user_id and client_id is null;
  end loop;
end $$;

-- ---------- CRM ----------
create table if not exists client_notes (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  body text not null, created_at timestamptz default now()
);
alter table client_notes enable row level security;
drop policy if exists own_notes on client_notes;
create policy own_notes on client_notes for all using (auth.uid()=advisor_id) with check (auth.uid()=advisor_id);

create table if not exists client_tasks (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  title text not null, due_date date, done boolean default false,
  created_at timestamptz default now()
);
alter table client_tasks enable row level security;
drop policy if exists own_tasks on client_tasks;
create policy own_tasks on client_tasks for all using (auth.uid()=advisor_id) with check (auth.uid()=advisor_id);

-- ---------- app settings (UPI / prices) ----------
create table if not exists app_settings (
  id int primary key default 1,
  upi_id text default '', payee text default 'Folio',
  amount numeric default 99, updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
alter table app_settings add column if not exists business_amount numeric default 6000;
insert into app_settings (id) values (1) on conflict (id) do nothing;
update app_settings set business_amount = 6000 where business_amount is null;
alter table app_settings enable row level security;
drop policy if exists read_settings on app_settings;
create policy read_settings on app_settings for select using (true);
drop policy if exists owner_write_settings on app_settings;
create policy owner_write_settings on app_settings for all
  using (exists (select 1 from profiles p where p.id=auth.uid() and p.role='owner'))
  with check (exists (select 1 from profiles p where p.id=auth.uid() and p.role='owner'));

-- legacy paid users keep Basic access
update profiles set basic_until = coalesce(basic_until, paid_until) where is_paid = true;
