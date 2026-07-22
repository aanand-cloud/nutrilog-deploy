-- ═══════════════════════════════════════════════════════════════════
-- NutriLog — RUN ALL MIGRATIONS (paste once in Supabase SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible
-- Project: https://supabase.com/dashboard → your nutrilog project
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Base setup (tables, RLS, signup, storage) ──

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  goals jsonb default '{"calories_kcal":2000,"protein_g":100,"carbs_g":250,"fat_g":65,"fibre_g":30,"sugar_g":50,"salt_mg":6000}',
  unit_prefs jsonb default '{"energy":"kcal","weight":"g"}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists display_name text;

create table if not exists public.meals (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  meal_summary text,
  total_calories_kcal numeric,
  total_nutrition jsonb,
  items jsonb,
  confidence_score numeric,
  clarifications jsonb,
  photo_path text,
  created_at timestamptz default now()
);

create index if not exists meals_user_date_idx on public.meals (user_id, date desc);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid references auth.users on delete set null,
  p256dh text,
  auth text,
  user_agent text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users read own meals" on public.meals;
drop policy if exists "Users insert own meals" on public.meals;
drop policy if exists "Users update own meals" on public.meals;
drop policy if exists "Users delete own meals" on public.meals;

create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users read own meals" on public.meals for select using (auth.uid() = user_id);
create policy "Users insert own meals" on public.meals for insert with check (auth.uid() = user_id);
create policy "Users update own meals" on public.meals for update using (auth.uid() = user_id);
create policy "Users delete own meals" on public.meals for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users upload own meal photos" on storage.objects;
drop policy if exists "Users read own meal photos" on storage.objects;
drop policy if exists "Users delete own meal photos" on storage.objects;

create policy "Users upload own meal photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own meal photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own meal photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── 2. Pricing plans + discount fields ──

alter table public.profiles drop constraint if exists profiles_plan_check;

alter table public.profiles
  add column if not exists discount_senior boolean not null default false,
  add column if not exists discount_work_email text,
  add column if not exists discount_public_sector boolean not null default false;

update public.profiles set plan = 'daily25' where plan = 'pro';

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'daily10', 'daily25'));

create or replace function public.sync_public_sector_discount()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and (
    new.email ilike '%@nhs.net'
    or new.email ilike '%@%.nhs.uk'
    or new.email ilike '%@nhs.uk'
    or new.email ilike '%@%.gov.uk'
    or new.email ilike '%@gov.uk'
    or new.email ilike '%@%.police.uk'
    or new.email ilike '%@mod.uk'
    or new.email ilike '%@%.ac.uk'
  ) then
    new.discount_public_sector := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_public_sector_discount on public.profiles;
create trigger profiles_public_sector_discount
  before insert or update of email, discount_work_email on public.profiles
  for each row execute function public.sync_public_sector_discount();

-- ── 3. Voucher column ──

alter table public.profiles
  add column if not exists discount_voucher_redeemed boolean not null default false;

alter table public.profiles
  add column if not exists trial_until timestamptz;

-- ── 4. Checkout redemptions + scan tracking columns ──

create table if not exists public.checkout_redemptions (
  session_id text primary key,
  user_id uuid references auth.users on delete set null,
  redemption_type text not null check (redemption_type in ('subscription', 'topup')),
  scans_added int,
  redeemed_at timestamptz default now()
);

alter table public.checkout_redemptions enable row level security;

drop policy if exists "No public access to checkout_redemptions" on public.checkout_redemptions;
create policy "No public access to checkout_redemptions"
  on public.checkout_redemptions for all using (false);

alter table public.profiles
  add column if not exists scan_month text,
  add column if not exists scan_used int not null default 0,
  add column if not exists topup_balance int not null default 0;

-- ── 5. Atomic meal scan RPC (required for photo AI limits) ──

create or replace function public.consume_meal_scan(p_user_id uuid, p_local_day text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_plan text;
  v_period text;
  v_used int;
  v_allowance int;
  v_topup int;
  v_limit int;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Account profile not found');
  end if;

  v_plan := case
    when v_profile.plan in ('pro', 'daily25') then 'daily25'
    when v_profile.plan = 'daily10' then 'daily10'
    else 'free'
  end;

  if v_plan = 'free' then
    if p_local_day is not null and p_local_day ~ '^\d{4}-\d{2}-\d{2}$' then
      v_period := p_local_day;
    else
      v_period := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
    end if;
    v_used := case when v_profile.scan_month = v_period then coalesce(v_profile.scan_used, 0) else 0 end;
    v_limit := 1;
    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'error', 'Daily meal log limit reached. Resets at midnight.');
    end if;
    update public.profiles
    set scan_month = v_period, scan_used = v_used + 1, updated_at = now()
    where id = p_user_id;
    return jsonb_build_object(
      'ok', true,
      'plan', v_plan,
      'used', v_used + 1,
      'limit', v_limit,
      'remaining', greatest(0, v_limit - (v_used + 1)),
      'isDaily', true
    );
  end if;

  v_period := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_used := case when v_profile.scan_month = v_period then coalesce(v_profile.scan_used, 0) else 0 end;
  v_allowance := case v_plan when 'daily10' then 300 when 'daily25' then 750 else 0 end;
  v_topup := coalesce(v_profile.topup_balance, 0);
  v_limit := v_allowance + v_topup;

  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'Monthly meal log limit reached.');
  end if;

  update public.profiles
  set scan_month = v_period, scan_used = v_used + 1, updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'used', v_used + 1,
    'limit', v_limit,
    'remaining', greatest(0, v_limit - (v_used + 1)),
    'allowance', v_allowance,
    'topup', v_topup,
    'isDaily', false
  );
end;
$$;

revoke all on function public.consume_meal_scan(uuid, text) from public;
grant execute on function public.consume_meal_scan(uuid, text) to service_role;

-- ── 6. Protect billing fields from client edits ──

create or replace function public.protect_billing_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() = old.id then
    if new.plan is distinct from old.plan
      or new.topup_balance is distinct from old.topup_balance
      or new.scan_used is distinct from old.scan_used
      or new.scan_month is distinct from old.scan_month
      or new.stripe_customer_id is distinct from old.stripe_customer_id
      or new.discount_voucher_redeemed is distinct from old.discount_voucher_redeemed
      or new.trial_until is distinct from old.trial_until then
      raise exception 'Billing fields are managed by NutriLog checkout only';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_billing_profile_fields on public.profiles;
create trigger protect_billing_profile_fields
  before update on public.profiles
  for each row execute function public.protect_billing_profile_fields();

-- ── 7. Meal extras ──

alter table public.meals
  add column if not exists meal_type text,
  add column if not exists meal_notes text;

-- ── 8. Display names for existing users ──

update public.profiles
set display_name = coalesce(display_name, split_part(email, '@', 1))
where display_name is null and email is not null;

-- ── 9. Push notification policies ──

drop policy if exists "Users manage own push subs" on public.push_subscriptions;
drop policy if exists "Anyone can register push endpoint" on public.push_subscriptions;
drop policy if exists "Anyone can delete own push endpoint" on public.push_subscriptions;
drop policy if exists "Users delete own push endpoint" on public.push_subscriptions;

create policy "Users manage own push subs"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Anyone can register push endpoint"
  on public.push_subscriptions for insert to anon, authenticated
  with check (true);

create policy "Users delete own push endpoint"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- Done! Next: Authentication → Providers → Email → ON
-- Optional: turn OFF "Confirm email" while testing
-- ═══════════════════════════════════════════════════════════════════
