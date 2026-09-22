-- ============================================================
-- Gati Phase 5 — Entitlement hardening, server-owned trials,
--                place caching, rate limiting, account deletion
--
-- Run after 004_pro_trial.sql.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. New columns
-- ─────────────────────────────────────────────────────────────

alter table public.user_data
  add column if not exists pro_expires_at timestamptz default null,
  add column if not exists pro_product_id text        default null,
  add column if not exists saved_stat_ids jsonb       not null default '[]'::jsonb;

comment on column public.user_data.pro_expires_at is
  'Expiry of the last verified receipt. Written ONLY by verify-purchase. '
  'The client honours it locally so a lapsed subscription stops granting Pro '
  'even while the device is offline.';

comment on column public.user_data.pro_product_id is
  'Product id of the active entitlement. Written ONLY by verify-purchase.';

-- Time zone, so the daily push fires at the user's LOCAL chosen hour.
-- Previously notificationTime was compared against UTC, so every signed-in
-- user outside UTC got their notification at the wrong time of day.
alter table public.push_tokens
  add column if not exists time_zone text not null default 'UTC';

comment on column public.push_tokens.time_zone is
  'IANA time zone reported by the device, e.g. "Asia/Kolkata". Used by '
  'push-daily-stat to fire at the user''s local notification hour.';

-- ─────────────────────────────────────────────────────────────
-- 2. Entitlement columns are server-owned
--
--    The RLS policy on user_data is `for all ... with check (auth.uid() =
--    user_id)`, which let ANY signed-in client upsert `is_pro = true` with the
--    public anon key and simply grant itself Pro. verify-purchase was
--    completely bypassable.
--
--    A trigger is used rather than column grants because the client writes via
--    upsert (INSERT .. ON CONFLICT DO UPDATE), which would otherwise need both
--    INSERT and UPDATE privileges enumerated per column and is easy to get
--    subtly wrong. The trigger is unconditional and cannot be worked around.
-- ─────────────────────────────────────────────────────────────

create or replace function public.protect_entitlement_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Edge functions use the service role and are the only legitimate writers.
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A brand-new row can never arrive already entitled, and the trial clock
    -- is stamped by the SERVER. The client used to supply trial_started_at,
    -- so a crafted request could post-date it and extend the trial forever.
    new.is_pro           := false;
    new.pro_expires_at   := null;
    new.pro_product_id   := null;
    new.trial_started_at := now();
  else
    -- Any client update silently keeps the existing entitlement values.
    new.is_pro           := old.is_pro;
    new.pro_expires_at   := old.pro_expires_at;
    new.pro_product_id   := old.pro_product_id;
    new.trial_started_at := old.trial_started_at;
  end if;

  return new;
end;
$$;

comment on function public.protect_entitlement_columns() is
  'Forces entitlement columns to server-controlled values on any non-service-role write.';

drop trigger if exists protect_entitlement on public.user_data;
create trigger protect_entitlement
  before insert or update on public.user_data
  for each row execute function public.protect_entitlement_columns();

-- ─────────────────────────────────────────────────────────────
-- 3. Purchase ledger — stops one receipt entitling many accounts
--
--    verify-purchase previously accepted any purchase token with no record of
--    which account it belonged to, so a single valid token could be replayed
--    to grant Pro on unlimited accounts.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.purchases (
  purchase_token text        primary key,
  user_id        uuid        not null references auth.users (id) on delete cascade,
  platform       text        not null check (platform in ('android', 'ios')),
  product_id     text        not null,
  expires_at     timestamptz,
  is_active      boolean     not null default true,
  raw            jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists purchases_user_id_idx on public.purchases (user_id);
create index if not exists purchases_active_idx  on public.purchases (user_id) where is_active;

alter table public.purchases enable row level security;

-- Read-only to the owner; only the service role writes.
drop policy if exists "purchases_select_own" on public.purchases;
create policy "purchases_select_own"
  on public.purchases for select
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- 4. Nearby-places cache
--
--    Coordinates are rounded to 2dp (~1.1 km) so nearby users share a cache
--    entry. Cuts Google Places spend by roughly an order of magnitude in any
--    populated area and makes repeated pull-to-refresh nearly free.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.places_cache (
  cache_key  text        primary key,   -- 'lat,lon,radius'
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

create index if not exists places_cache_created_idx on public.places_cache (created_at);

alter table public.places_cache enable row level security;
-- No client policies: reachable only through the edge function's service role.

comment on table public.places_cache is
  'Google Places responses keyed by rounded coordinates. TTL enforced in the '
  'nearby-places edge function; sweep old rows with the cron job below.';

-- ─────────────────────────────────────────────────────────────
-- 5. Rate limiting
--
--    Both nearby-places (Google Places spend) and ai-place-pick (OpenAI spend)
--    were previously unmetered: any authenticated caller could loop them and
--    run up the bill.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.api_usage (
  subject    text        not null,   -- user id, or 'ip:<addr>' when signed out
  endpoint   text        not null,
  window_start timestamptz not null,
  count      integer     not null default 0,
  primary key (subject, endpoint, window_start)
);

create index if not exists api_usage_window_idx on public.api_usage (window_start);

alter table public.api_usage enable row level security;
-- No client policies: service role only.

/**
 * Atomically increment a caller's hourly counter and report whether they are
 * still inside their quota. Returns true when the call is allowed.
 */
create or replace function public.consume_rate_limit(
  p_subject  text,
  p_endpoint text,
  p_limit    integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count  integer;
begin
  insert into public.api_usage (subject, endpoint, window_start, count)
  values (p_subject, p_endpoint, v_window, 1)
  on conflict (subject, endpoint, window_start)
    do update set count = public.api_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

comment on function public.consume_rate_limit(text, text, integer) is
  'Increments an hourly counter and returns false once the limit is exceeded.';

-- ─────────────────────────────────────────────────────────────
-- 6. Timezone-aware notification targeting
--
--    Replaces get_users_for_notification_hour, which compared the user's
--    chosen local hour against the current UTC hour.
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_users_for_local_notification_hour()
returns table (
  user_id  uuid,
  token    text,
  platform text,
  profile  jsonb
)
language sql
security definer
set search_path = public
as $$
  select ud.user_id, pt.token, pt.platform, ud.profile
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id
  where  ud.profile ? 'notificationTime'
    and  ud.profile->>'notificationTime' ~ '^[0-9]{1,2}:[0-9]{2}$'
    -- Compare the user's chosen hour against the current hour IN THEIR OWN
    -- time zone. Postgres carries full tzdata, so this stays DST-correct.
    and  extract(
           hour from (now() at time zone coalesce(nullif(pt.time_zone, ''), 'UTC'))
         )::int = split_part(ud.profile->>'notificationTime', ':', 1)::int;
$$;

comment on function public.get_users_for_local_notification_hour() is
  'Users whose chosen notification hour matches the current hour in their own '
  'time zone. Safe against malformed notificationTime values.';

-- Keep the streak / digest helpers but return the time zone too, so those
-- functions can also respect local days rather than UTC days.
--
-- These must be DROPPED, not replaced. 002 defined both without the
-- time_zone column, and `create or replace function` cannot change a
-- return type — Postgres rejects it with 42P13, "Row type defined by OUT
-- parameters is different". Replacing in place works only while the
-- signature is untouched; adding a column to the returned table is exactly
-- the case it refuses.
--
-- Neither function carries an explicit grant, so dropping loses nothing,
-- and both are recreated in the same transaction: no window exists where a
-- caller could find them missing.
-- Superseded by get_users_for_local_notification_hour above, which respects
-- the user's own time zone. Nothing calls the UTC version any more, and
-- leaving a security-definer function that hands out push tokens on a UTC
-- schedule is a footgun for whoever wires up the next scheduled job.
drop function if exists public.get_users_for_notification_hour(integer);

drop function if exists public.get_users_for_streak_check();
create or replace function public.get_users_for_streak_check()
returns table (
  user_id             uuid,
  token               text,
  platform            text,
  time_zone           text,
  open_history_ranges jsonb,
  max_streak_ever     integer
)
language sql
security definer
set search_path = public
as $$
  select ud.user_id, pt.token, pt.platform,
         coalesce(nullif(pt.time_zone, ''), 'UTC'),
         ud.open_history_ranges, ud.max_streak_ever
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id;
$$;

drop function if exists public.get_users_for_weekly_digest();
create or replace function public.get_users_for_weekly_digest()
returns table (
  user_id             uuid,
  token               text,
  platform            text,
  time_zone           text,
  open_history_ranges jsonb,
  max_streak_ever     integer
)
language sql
security definer
set search_path = public
as $$
  select ud.user_id, pt.token, pt.platform,
         coalesce(nullif(pt.time_zone, ''), 'UTC'),
         ud.open_history_ranges, ud.max_streak_ever
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Account deletion
--
--    Google Play's User Data policy and App Store guideline 5.1.1(v) both
--    require an in-app route to delete the account. Everything cascades from
--    auth.users, so the edge function only has to delete that row.
-- ─────────────────────────────────────────────────────────────

create or replace function public.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.story_annotations where user_id = p_user_id;
  delete from public.place_ratings     where user_id = p_user_id;
  delete from public.push_tokens       where user_id = p_user_id;
  delete from public.scheduled_pushes  where user_id = p_user_id;
  delete from public.purchases         where user_id = p_user_id;
  delete from public.user_data         where user_id = p_user_id;
  delete from public.api_usage         where subject = p_user_id::text;
end;
$$;

comment on function public.purge_user_data(uuid) is
  'Removes every row belonging to a user. Called by the delete-account edge '
  'function before deleting the auth.users row.';

-- ─────────────────────────────────────────────────────────────
-- 8. Housekeeping
--
--    NOTE: unlike 003_place_ratings.sql, nothing below is executed at migrate
--    time. That file left a bare `select cron.schedule(...)` between comment
--    lines, which runs on migrate and fails outright if pg_cron is not yet
--    enabled. Enable pg_cron first, then run these by hand.
-- ─────────────────────────────────────────────────────────────

-- select cron.schedule(
--   'gati-sweep-places-cache', '17 * * * *',
--   $$ delete from public.places_cache where created_at < now() - interval '24 hours' $$
-- );
--
-- select cron.schedule(
--   'gati-sweep-api-usage', '23 * * * *',
--   $$ delete from public.api_usage where window_start < now() - interval '2 days' $$
-- );
--
-- select cron.schedule(
--   'gati-expire-entitlements', '9 * * * *',
--   $$ update public.user_data
--        set is_pro = false
--      where is_pro
--        and pro_expires_at is not null
--        and pro_expires_at < now() - interval '1 day' $$
-- );
