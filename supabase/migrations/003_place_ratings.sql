-- ─── Phase 3: Aggregate Place Ratings ───────────────────────────────────────
--
-- place_ratings  : one row per (place_id, user_id) — users' loved/good/not_for_me signals
-- place_quality_scores : materialized view — crowd-sourced quality scores used by the
--                        Gati recommendation engine to boost high-quality venues
--
-- Refresh cadence: nightly at 00:05 UTC via pg_cron (see bottom of file).

-- ─── 1. place_ratings table ──────────────────────────────────────────────────

create table if not exists place_ratings (
  place_id   text        not null,           -- e.g. gp_ChIJ...
  user_id    uuid        not null references auth.users on delete cascade,
  rating     text        not null check (rating in ('loved', 'good', 'not_for_me')),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);

comment on table place_ratings is
  'One row per (place, user). Upsert on re-rating — last write wins.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table place_ratings enable row level security;

-- Users can read any ratings (needed so the materialized view refresh works
-- and clients can query aggregate data without a service-role key)
drop policy if exists "place_ratings_select_authenticated" on place_ratings;
create policy "place_ratings_select_authenticated"
  on place_ratings for select
  to authenticated
  using (true);

-- Users can only write their own ratings
drop policy if exists "place_ratings_insert_own" on place_ratings;
create policy "place_ratings_insert_own"
  on place_ratings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "place_ratings_update_own" on place_ratings;
create policy "place_ratings_update_own"
  on place_ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "place_ratings_delete_own" on place_ratings;
create policy "place_ratings_delete_own"
  on place_ratings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─── 2. place_quality_scores materialized view ───────────────────────────────

create materialized view if not exists place_quality_scores as
select
  place_id,
  count(*) filter (where rating = 'loved')        as loved_count,
  count(*) filter (where rating = 'good')         as good_count,
  count(*) filter (where rating = 'not_for_me')   as skip_count,
  count(*)                                         as total_ratings,
  round(
    (
      count(*) filter (where rating = 'loved')      * 1.0 +
      count(*) filter (where rating = 'good')       * 0.5
    ) / nullif(count(*), 0),
    3
  )::double precision                              as gati_score   -- 0.000 – 1.000
from place_ratings
group by place_id;

comment on materialized view place_quality_scores is
  'Crowd-sourced quality score per place. Refreshed nightly at 00:05 UTC. '
  'gati_score = (loved + 0.5×good) / total, ranging 0–1.';

-- Allow any authenticated (or anon) user to read the materialized view
-- without needing the service-role key — used by fetchNearbyPlaces in the client.
grant select on place_quality_scores to authenticated;
grant select on place_quality_scores to anon;

-- Index so the client's .in('place_id', [...]) lookup is fast
create index if not exists idx_pqs_place_id
  on place_quality_scores (place_id);

-- ─── 3. Refresh function (SECURITY DEFINER) ───────────────────────────────────
--
-- Runs CONCURRENTLY so reads on the view are never blocked during refresh.
-- Requires a unique index on place_id for CONCURRENT refresh.

create unique index if not exists idx_pqs_place_id_unique
  on place_quality_scores (place_id);

create or replace function refresh_place_quality_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently place_quality_scores;
end;
$$;

comment on function refresh_place_quality_scores() is
  'Called by pg_cron nightly to refresh the place_quality_scores view. '
  'Uses CONCURRENTLY so reads are unblocked during the refresh.';

-- ─── 4. pg_cron schedule ─────────────────────────────────────────────────────
--
-- Run the following in the Supabase SQL editor AFTER enabling the pg_cron
-- extension (Dashboard → Database → Extensions → pg_cron):
--
  select cron.schedule(
    'nightly-place-score-refresh',
    '5 0 * * *',                          -- 00:05 UTC every night
    $$ select refresh_place_quality_scores(); $$
  );
--
-- Verify with:  select * from cron.job;
-- Unschedule:   select cron.unschedule('nightly-place-score-refresh');
