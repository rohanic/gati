-- ============================================================
-- Gati — scheduled push setup
--
-- Run this in the Supabase SQL editor AFTER:
--   1. `supabase functions deploy` has succeeded
--   2. CRON_SECRET is set to a value YOU STILL HAVE (see note below)
--   3. pg_cron and pg_net are enabled
--      (Dashboard → Database → Extensions)
--
-- ⚠️  This file contains placeholders, not secrets. Fill them in, run it,
--     and do NOT commit the filled-in version — it carries your service-role
--     key, which bypasses every RLS policy in the project.
-- ============================================================

-- ─── Fill these in ──────────────────────────────────────────
--   :project_ref       your project ref, e.g. lsvrojepabrgtabiujfi
--   :service_role_key  Dashboard → Settings → API → service_role
--   :cron_secret       the exact value you passed to
--                      `supabase secrets set CRON_SECRET=...`
--
-- If you generated CRON_SECRET inline with $(openssl rand -hex 32), the
-- value was never printed and cannot be recovered — `supabase secrets list`
-- shows a digest, not the secret. Set it again to a value you keep:
--
--   supabase secrets set CRON_SECRET=paste-a-value-you-saved
-- ============================================================

do $$
declare
  base_url    text := 'https://<PROJECT_REF>.supabase.co/functions/v1/';
  service_key text := '<SERVICE_ROLE_KEY>';
  cron_secret text := '<CRON_SECRET>';
  headers     jsonb;
begin
  -- BOTH headers are required, and this is the part that is easy to get
  -- wrong. The gateway checks Authorization because verify_jwt is true for
  -- every push function; the function itself then checks x-cron-secret via
  -- validateCronSecret, which fails closed. Send only the first and every
  -- call returns 401 — silently, because a failing cron job does not
  -- announce itself anywhere you would look.
  headers := jsonb_build_object(
    'Authorization',  'Bearer ' || service_key,
    'x-cron-secret',  cron_secret,
    'Content-Type',   'application/json'
  );

  -- Hourly. The function itself works out who is due in their OWN time zone,
  -- via get_users_for_local_notification_hour, so this must run every hour
  -- rather than once a day at a fixed UTC time.
  perform cron.schedule(
    'gati-daily-stat', '0 * * * *',
    format($q$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb)$q$,
           base_url || 'push-daily-stat', headers)
  );

  perform cron.schedule(
    'gati-streak-saver', '0 20 * * *',
    format($q$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb)$q$,
           base_url || 'push-streak-saver', headers)
  );

  perform cron.schedule(
    'gati-weekly-digest', '0 9 * * 0',
    format($q$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb)$q$,
           base_url || 'push-weekly-digest', headers)
  );

  -- Drains the scheduled_pushes queue (milestone predictions).
  perform cron.schedule(
    'gati-push-scheduled', '0 * * * *',
    format($q$select net.http_post(url:=%L, headers:=%L::jsonb, body:='{}'::jsonb)$q$,
           base_url || 'push-scheduled', headers)
  );
end $$;

-- ─── Verify ─────────────────────────────────────────────────

-- 1. Four jobs exist and are active.
select jobname, schedule, active from cron.job order by jobname;

-- 2. After the next hour turns over, the runs succeeded.
--    `status` must be 'succeeded'. A row that is missing means the schedule
--    never fired; 'failed' means pg_net could not make the request.
select jobid, runid, status, return_message, start_time
from   cron.job_run_details
order  by start_time desc
limit  10;

-- 3. The FUNCTION accepted the call, which job_run_details cannot tell you —
--    pg_net reports a delivered 401 as a succeeded run. This is the check
--    that actually proves the headers are right.
select net.http_post(
  url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-daily-stat',
  headers := jsonb_build_object(
               'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
               'x-cron-secret', '<CRON_SECRET>',
               'Content-Type',  'application/json'),
  body    := '{}'::jsonb
) as request_id;

-- Then read the response — 200 is correct, 401 means the secret is wrong:
select status_code, content
from   net._http_response
order  by created desc
limit  1;

-- ─── Undo ───────────────────────────────────────────────────
-- select cron.unschedule('gati-daily-stat');
-- select cron.unschedule('gati-streak-saver');
-- select cron.unschedule('gati-weekly-digest');
-- select cron.unschedule('gati-push-scheduled');
