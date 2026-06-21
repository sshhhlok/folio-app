-- Folio — app settings (payment/UPI). Lets the owner set UPI in-app so it
-- survives every code update. Requires is_owner() from schema_admin_fix.sql.
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
  for all using (is_owner()) with check (is_owner());
