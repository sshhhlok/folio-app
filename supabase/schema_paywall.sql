-- ============================================================
-- Folio — paywall upgrade. Run this in Supabase:
-- Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text not null default 'member',   -- 'member' or 'owner'
  is_paid    boolean not null default false,
  paid_until date,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Each user may read ONLY their own profile. (Writes happen via the
-- owner-only server endpoint using the service role, which bypasses RLS.)
drop policy if exists own_profile_read on profiles;
create policy own_profile_read on profiles
  for select using (auth.uid() = id);

-- Auto-create a profile whenever someone signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for any users that already exist.
insert into public.profiles (id, email)
select id, email from auth.users on conflict (id) do nothing;

-- ====== IMPORTANT: make YOURSELF the owner (free + admin) ======
-- Replace the email below with the one you log in with, then run:
update profiles set role = 'owner', is_paid = true where email = 'YOUR_EMAIL_HERE';
