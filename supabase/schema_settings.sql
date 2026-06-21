-- Folio — app settings (payment/UPI). Self-contained: only needs the
-- profiles table (from schema_paywall.sql). Run in Supabase SQL Editor.
create table if not exists app_settings (
  id         int primary key default 1,
  upi_id     text default '',
  payee      text default 'Folio',
  amount     numeric default 99,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists read_settings on app_settings;
create policy read_settings on app_settings for select using (true);

drop policy if exists owner_write_settings on app_settings;
create policy owner_write_settings on app_settings
  for all
  using  (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'owner'));
