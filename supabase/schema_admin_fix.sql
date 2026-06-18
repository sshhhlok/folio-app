-- ============================================================
-- Folio — fix Admin so the owner manages members directly
-- (no Vercel service key needed). Run in Supabase SQL Editor.
-- ============================================================

-- Helper that checks if the current user is the owner.
-- SECURITY DEFINER avoids RLS recursion.
create or replace function is_owner()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- Read: a user can read their own row; the owner can read everyone.
drop policy if exists own_profile_read on profiles;
drop policy if exists profile_read on profiles;
create policy profile_read on profiles
  for select using (auth.uid() = id or is_owner());

-- Update: only the owner can change subscription status.
drop policy if exists owner_update on profiles;
create policy owner_update on profiles
  for update using (is_owner()) with check (is_owner());
