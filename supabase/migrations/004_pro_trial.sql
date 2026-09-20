-- ─── Phase 4: Pro Trial + Subscription status ────────────────────────────────
--
-- Adds two columns to user_data so trial start + pro status survive reinstalls.
-- The verify-purchase edge function writes is_pro = true after a valid receipt.

alter table public.user_data
  add column if not exists trial_started_at timestamptz default null,
  add column if not exists is_pro           boolean     not null default false;

comment on column public.user_data.trial_started_at is
  'ISO timestamp when the user started their 7-day Pro trial. '
  'Null = trial not yet started (user has not signed in for the first time).';

comment on column public.user_data.is_pro is
  'True when the user has a paid Pro subscription. '
  'Set to true by the verify-purchase edge function after a valid Google Play receipt. '
  'Set to false when a subscription lapses (future webhook).';
