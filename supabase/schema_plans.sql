-- ============================================================
-- Folio — two plans: Basic (₹99) and Business (₹6000).
-- Tracks paid-through dates per plan. Run after the others.
-- ============================================================
alter table profiles add column if not exists basic_until    date;
alter table profiles add column if not exists business_until date;

-- Existing paid users keep access as Basic.
update profiles set basic_until = coalesce(basic_until, paid_until) where is_paid = true;

-- Business price lives alongside the Basic price/UPI.
alter table app_settings add column if not exists business_amount numeric default 6000;
update app_settings set business_amount = 6000 where business_amount is null;
