-- NutriLog monetisation v2 — run in Supabase SQL Editor
-- Free: 1 AI scan/day · packs add credits · Pro: 33/day + 1000/month

alter table public.profiles
  add column if not exists daily_free_cap int not null default 1,
  add column if not exists pro_scans_month text,
  add column if not exists pro_scans_month_used int not null default 0;

alter table public.profiles drop constraint if exists profiles_plan_check;

update public.profiles
set plan = 'pro'
where plan in ('daily10', 'daily25');

alter table public.profiles
  add constraint profiles_plan_check
  check (plan in ('free', 'pro'));

create or replace function public.consume_meal_scan(p_user_id uuid, p_local_day text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_plan text;
  v_day text;
  v_month text;
  v_used_today int;
  v_daily_cap int;
  v_topup int;
  v_pro_month_used int;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Account profile not found');
  end if;

  v_plan := case
    when v_profile.plan in ('pro', 'daily25', 'daily10') then 'pro'
    else 'free'
  end;

  if p_local_day is not null and p_local_day ~ '^\d{4}-\d{2}-\d{2}$' then
    v_day := p_local_day;
  else
    v_day := to_char((now() at time zone 'utc')::date, 'YYYY-MM-DD');
  end if;

  v_month := left(v_day, 7);
  v_used_today := case when v_profile.scan_month = v_day then coalesce(v_profile.scan_used, 0) else 0 end;
  v_daily_cap := greatest(1, least(2, coalesce(v_profile.daily_free_cap, 1)));
  v_topup := greatest(0, coalesce(v_profile.topup_balance, 0));

  if v_plan = 'pro' then
    v_pro_month_used := case when v_profile.pro_scans_month = v_month then coalesce(v_profile.pro_scans_month_used, 0) else 0 end;

    if v_pro_month_used >= 1000 then
      return jsonb_build_object(
        'ok', false,
        'error', 'Monthly fair use limit reached (~1,000 photo logs). Try again next month or contact support.'
      );
    end if;

    if v_used_today >= 33 then
      return jsonb_build_object(
        'ok', false,
        'error', 'Fair use limit of 33 photo logs per day reached. Try again tomorrow.'
      );
    end if;

    update public.profiles
    set
      scan_month = v_day,
      scan_used = v_used_today + 1,
      pro_scans_month = v_month,
      pro_scans_month_used = v_pro_month_used + 1,
      updated_at = now()
    where id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'plan', 'pro',
      'used', v_used_today + 1,
      'limit', 33,
      'remaining', greatest(0, 33 - (v_used_today + 1)),
      'monthUsed', v_pro_month_used + 1,
      'monthLimit', 1000,
      'monthRemaining', greatest(0, 1000 - (v_pro_month_used + 1)),
      'isDaily', true,
      'unlimited', true
    );
  end if;

  -- Free + credit pack users (plan stays free; credits on balance)
  if v_used_today < v_daily_cap then
    update public.profiles
    set scan_month = v_day, scan_used = v_used_today + 1, updated_at = now()
    where id = p_user_id;

    return jsonb_build_object(
      'ok', true,
      'plan', 'free',
      'used', v_used_today + 1,
      'limit', v_daily_cap,
      'remaining', greatest(0, v_daily_cap - (v_used_today + 1)),
      'dailyFreeCap', v_daily_cap,
      'dailyFreeRemaining', greatest(0, v_daily_cap - (v_used_today + 1)),
      'topup', v_topup,
      'creditRemaining', v_topup,
      'source', 'daily_free',
      'isDaily', true
    );
  end if;

  if v_topup <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'No photo logs left today. Buy a scan pack or upgrade to Pro — free scans reset at midnight.'
    );
  end if;

  update public.profiles
  set
    scan_month = v_day,
    scan_used = v_used_today + 1,
    topup_balance = v_topup - 1,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'plan', 'free',
    'used', v_used_today + 1,
    'limit', v_daily_cap,
    'remaining', 0,
    'dailyFreeCap', v_daily_cap,
    'dailyFreeRemaining', 0,
    'topup', v_topup - 1,
    'creditRemaining', v_topup - 1,
    'source', 'credit',
    'isDaily', true
  );
end;
$$;

revoke all on function public.consume_meal_scan(uuid, text) from public;
grant execute on function public.consume_meal_scan(uuid, text) to service_role;
