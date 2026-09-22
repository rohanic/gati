-- ============================================================
-- Gati Phase 2 — Server-Side Push Notifications
-- Run after 001_initial.sql.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- pg_net  : lets SQL make outbound HTTP calls (needed for pg_cron → edge fn)
-- pg_cron : schedules SQL jobs (enable in Supabase Dashboard → Extensions)
-- Both are pre-installed on Supabase; just enable them.

-- create extension if not exists pg_net  with schema extensions;
-- create extension if not exists pg_cron with schema cron;

-- ── push_tokens ───────────────────────────────────────────────
-- One row per user. Upserted each time the app registers a fresh token.
-- `platform` is 'ios' or 'android' — used for platform-specific content.

create table if not exists public.push_tokens (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  token      text        not null,           -- ExponentPushToken[xxxx]
  platform   text        not null,           -- 'ios' | 'android'
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_own" on public.push_tokens;
create policy "push_tokens_own"
  on public.push_tokens for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── scheduled_pushes ─────────────────────────────────────────
-- Queued one-shot notifications (e.g. milestone predictions).
-- The push-scheduled edge function polls this table every hour.

create table if not exists public.scheduled_pushes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  type       text        not null,    -- 'milestone_prediction' | future types
  payload    jsonb       not null default '{}'::jsonb,
  fire_at    timestamptz not null,
  sent       boolean     not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_pushes_fire_at_idx
  on public.scheduled_pushes (fire_at)
  where sent = false;

alter table public.scheduled_pushes enable row level security;

drop policy if exists "scheduled_pushes_own" on public.scheduled_pushes;
create policy "scheduled_pushes_own"
  on public.scheduled_pushes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── SQL helper functions for edge functions ───────────────────
-- These run with SECURITY DEFINER so edge functions using the
-- service-role key can call them without tripping RLS.

-- Returns all users with tokens + profile data for a given notification hour.
-- Called by the push-daily-stat edge function every hour.
create or replace function public.get_users_for_notification_hour(p_hour integer)
returns table (
  user_id  uuid,
  token    text,
  platform text,
  profile  jsonb
)
language sql security definer as $$
  select ud.user_id, pt.token, pt.platform, ud.profile
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id
  where  split_part(ud.profile->>'notificationTime', ':', 1)::integer = p_hour;
$$;

-- Returns all users with tokens + open history for streak-saver check.
create or replace function public.get_users_for_streak_check()
returns table (
  user_id            uuid,
  token              text,
  platform           text,
  open_history_ranges jsonb,
  max_streak_ever    integer
)
language sql security definer as $$
  select ud.user_id, pt.token, pt.platform,
         ud.open_history_ranges, ud.max_streak_ever
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id;
$$;

-- Returns all users for the weekly digest.
create or replace function public.get_users_for_weekly_digest()
returns table (
  user_id            uuid,
  token              text,
  platform           text,
  open_history_ranges jsonb,
  max_streak_ever    integer
)
language sql security definer as $$
  select ud.user_id, pt.token, pt.platform,
         ud.open_history_ranges, ud.max_streak_ever
  from   public.user_data   ud
  join   public.push_tokens pt on pt.user_id = ud.user_id;
$$;

-- Returns due scheduled pushes with their token.
-- Atomically marks them as sent so concurrent invocations don't double-fire.
create or replace function public.claim_due_scheduled_pushes()
returns table (
  id      uuid,
  user_id uuid,
  type    text,
  payload jsonb,
  token   text,
  platform text
)
language sql security definer as $$
  update public.scheduled_pushes sp
  set    sent = true
  from   public.push_tokens pt
  where  pt.user_id = sp.user_id
    and  sp.fire_at <= now()
    and  sp.sent    = false
  returning sp.id, sp.user_id, sp.type, sp.payload, pt.token, pt.platform;
$$;

-- ── pg_cron jobs ──────────────────────────────────────────────
-- Recommended: configure these via Supabase Dashboard → Edge Functions → Schedule.
-- The cron expressions and function names are listed here for reference.
--
-- Alternatively, enable pg_net + pg_cron and uncomment the block below,
-- replacing <PROJECT_REF> and <SERVICE_ROLE_KEY> with your project values.
--
--   push-daily-stat      : '0 * * * *'   (every hour on the hour)
--   push-streak-saver    : '0 20 * * *'  (daily at 20:00 UTC)
--   push-weekly-digest   : '0 9 * * 0'   (Sundays at 09:00 UTC)
--   push-scheduled       : '0 * * * *'   (every hour — processes scheduled_pushes)
--
-- The working version of this lives in supabase/cron-setup.sql, with the
-- headers it actually needs. The template that used to sit here sent only
-- `Authorization: Bearer <service key>`, which passes the gateway and is
-- then rejected by validateCronSecret — so every scheduled push would have
-- returned 401 while pg_cron recorded the run as succeeded.

