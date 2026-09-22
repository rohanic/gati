-- ============================================================
-- Gati Phase 1 — Auth + Cloud Backup
-- Run this in the Supabase SQL editor (or via supabase db push).
-- ============================================================

-- ── user_data ─────────────────────────────────────────────────
-- One row per user. Stores the full profile blob plus all stats
-- data needed for a fresh-install restore.

create table if not exists public.user_data (
  user_id               uuid        primary key references auth.users (id) on delete cascade,

  -- Core profile (UserProfile shape, stored as JSONB)
  profile               jsonb       not null default '{}'::jsonb,

  -- Wander interest scores (Record<category, score 0.5–5.0>)
  category_scores       jsonb       not null default '{}'::jsonb,

  -- Stats history (arrays / objects stored as JSONB)
  unlocked_stats        jsonb       not null default '[]'::jsonb,
  open_history_ranges   jsonb       not null default '[]'::jsonb,   -- DateRange[]
  max_streak_ever       integer     not null default 0,
  streak_freeze_count   integer     not null default 0,
  frozen_dates          jsonb       not null default '[]'::jsonb,   -- string[]
  milestone_seen_dates  jsonb       not null default '{}'::jsonb,   -- Record<id, isoDate>
  seen_milestone_ids    jsonb       not null default '[]'::jsonb,   -- string[]

  updated_at            timestamptz not null default now()
);

-- ── story_annotations ─────────────────────────────────────────
-- One row per annotation. The composite PK (user_id, item_id)
-- lets us upsert individual annotations without scanning the full set.

create table if not exists public.story_annotations (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  item_id    text        not null,   -- "stat-heartbeats" | "place-gp_xxx" | "milestone-streak_7"
  text       text        not null,
  pinned     boolean     not null default false,
  created_at text        not null,  -- ISO "yyyy-MM-dd" (matches StoryAnnotation.createdAt)
  synced_at  timestamptz not null default now(),

  primary key (user_id, item_id)
);

-- ── Row Level Security ────────────────────────────────────────
-- Users can only read/write their own rows.

alter table public.user_data        enable row level security;
alter table public.story_annotations enable row level security;

drop policy if exists "user_data_own" on public.user_data;
create policy "user_data_own"
  on public.user_data for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "story_annotations_own" on public.story_annotations;
create policy "story_annotations_own"
  on public.story_annotations for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────
-- The primary keys already cover the main lookup patterns.
-- Add this only if you add server-side "list all annotations for user" queries.

create index if not exists story_annotations_user_id_idx
  on public.story_annotations (user_id);
