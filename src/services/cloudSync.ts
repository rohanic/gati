/**
 * Cloud sync — bidirectional push/pull between the local Zustand stores and
 * Supabase.
 *
 * ── Entitlement boundary ─────────────────────────────────────────────────
 * This module NEVER writes `is_pro`, `pro_expires_at`, `pro_product_id` or
 * `trial_started_at`. Those columns are owned exclusively by the
 * `verify-purchase` edge function (service role) and are additionally
 * protected by a database trigger, so a crafted client request cannot grant
 * itself Pro. `pullUserData` reads them; nothing here pushes them.
 *
 * All writes are upserts (last-write-wins on updated_at). Reads return
 * null / {} when the user has no cloud data yet.
 */
import { supabase } from '@/services/supabase';
import type { UserProfile, StatUnlock } from '@/types';
import type { StoryAnnotation } from '@/store/storyStore';
import type { DateRange } from '@/store/userStore';

// ─── Shapes ───────────────────────────────────────────────────

/** The subset of user data the CLIENT is allowed to push. */
export interface CloudUserPush {
  profile:            UserProfile;
  categoryScores:     Record<string, number>;
  unlockedStats:      StatUnlock[];
  openHistoryRanges:  DateRange[];
  maxStreakEver:      number;
  streakFreezeCount:  number;
  frozenDates:        string[];
  milestoneSeenDates: Record<string, string>;
  seenMilestoneIds:   string[];
  savedStatIds:       string[];
}

/** Everything the client reads back, including server-owned entitlement. */
export interface CloudUserData extends CloudUserPush {
  /** Server-stamped. ISO timestamp the trial started. */
  trialStartedAt: string | null;
  /** Server-verified. True when a paid subscription is active. */
  isPro:          boolean;
  /** Server-verified. ISO expiry of the active receipt. */
  proExpiresAt:   string | null;
  /** Server-verified. Product the entitlement came from. */
  proProductId:   string | null;
}

// ─── user_data ────────────────────────────────────────────────

/**
 * Upsert the user's data snapshot.
 *
 * Note the deliberate absence of every entitlement column — see the module
 * header. The database trigger `protect_entitlement_columns` would silently
 * discard them anyway; omitting them keeps the intent explicit.
 */
export async function pushUserData(
  userId: string,
  data:   CloudUserPush,
): Promise<void> {
  const { error } = await supabase
    .from('user_data')
    .upsert(
      {
        user_id:              userId,
        profile:              data.profile,
        category_scores:      data.categoryScores,
        unlocked_stats:       data.unlockedStats,
        open_history_ranges:  data.openHistoryRanges,
        max_streak_ever:      data.maxStreakEver,
        streak_freeze_count:  data.streakFreezeCount,
        frozen_dates:         data.frozenDates,
        milestone_seen_dates: data.milestoneSeenDates,
        seen_milestone_ids:   data.seenMilestoneIds,
        saved_stat_ids:       data.savedStatIds,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`[cloudSync] pushUserData: ${error.message}`);
}

/**
 * Fetch the user's data snapshot.
 * Returns null when the user has no cloud row yet (first sign-in).
 */
export async function pullUserData(userId: string): Promise<CloudUserData | null> {
  const { data, error } = await supabase
    .from('user_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`[cloudSync] pullUserData: ${error.message}`);
  if (!data)  return null;

  return {
    profile:            data.profile,
    categoryScores:     data.category_scores      ?? {},
    unlockedStats:      data.unlocked_stats       ?? [],
    openHistoryRanges:  data.open_history_ranges  ?? [],
    maxStreakEver:      data.max_streak_ever      ?? 0,
    streakFreezeCount:  data.streak_freeze_count  ?? 0,
    frozenDates:        data.frozen_dates         ?? [],
    milestoneSeenDates: data.milestone_seen_dates ?? {},
    seenMilestoneIds:   data.seen_milestone_ids   ?? [],
    savedStatIds:       data.saved_stat_ids       ?? [],
    trialStartedAt:     data.trial_started_at     ?? null,
    isPro:              data.is_pro               ?? false,
    proExpiresAt:       data.pro_expires_at       ?? null,
    proProductId:       data.pro_product_id       ?? null,
  };
}

// ─── story_annotations ────────────────────────────────────────

/**
 * Upsert all annotations, keyed on (user_id, item_id) so individual notes can
 * be updated independently.
 */
export async function pushAnnotations(
  userId:      string,
  annotations: Record<string, StoryAnnotation>,
): Promise<void> {
  const rows = Object.values(annotations).map((a) => ({
    user_id:    userId,
    item_id:    a.itemId,
    text:       a.text,
    pinned:     a.pinned,
    created_at: a.createdAt,
    synced_at:  new Date().toISOString(),
  }));
  if (rows.length === 0) return;

  const { error } = await supabase
    .from('story_annotations')
    .upsert(rows, { onConflict: 'user_id,item_id' });
  if (error) throw new Error(`[cloudSync] pushAnnotations: ${error.message}`);
}

/** Fetch all annotations for this user. Empty record when none exist. */
export async function pullAnnotations(
  userId: string,
): Promise<Record<string, StoryAnnotation>> {
  const { data, error } = await supabase
    .from('story_annotations')
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(`[cloudSync] pullAnnotations: ${error.message}`);
  if (!data || data.length === 0) return {};

  const result: Record<string, StoryAnnotation> = {};
  for (const row of data) {
    result[row.item_id] = {
      itemId:    row.item_id,
      text:      row.text,
      pinned:    row.pinned,
      createdAt: row.created_at,
    };
  }
  return result;
}

// ─── place_ratings ────────────────────────────────────────────

/**
 * Upsert a single place rating. Fire-and-forget from RatingBottomSheet when
 * the user is signed in. Re-rating overwrites the previous value.
 */
export async function pushPlaceRating(
  userId:  string,
  placeId: string,
  rating:  string,
): Promise<void> {
  const { error } = await supabase
    .from('place_ratings')
    .upsert(
      {
        place_id:   placeId,
        user_id:    userId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'place_id,user_id' },
    );
  if (error) throw new Error(`[cloudSync] pushPlaceRating: ${error.message}`);
}

/**
 * Batch-fetch crowd-sourced Gati quality scores for a list of place ids.
 * Reads the nightly-refreshed `place_quality_scores` view.
 * Returns {} on any error — callers treat a missing score as null.
 */
export async function fetchGatiScores(
  placeIds: string[],
): Promise<Record<string, number>> {
  if (placeIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('place_quality_scores')
      .select('place_id,gati_score')
      .in('place_id', placeIds);
    if (error) return {};
    const result: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.gati_score !== null && row.gati_score !== undefined) {
        result[row.place_id] = row.gati_score as number;
      }
    }
    return result;
  } catch {
    // Supabase not configured or offline — degrade gracefully.
    return {};
  }
}

// ─── Account deletion ─────────────────────────────────────────

/**
 * Permanently delete the signed-in user's account and all server-side data.
 *
 * Required by Google Play's Data deletion policy and App Store guideline
 * 5.1.1(v): any app that lets a user create an account must let them delete
 * it from inside the app.
 *
 * Runs server-side (`delete-account` edge function) because deleting an
 * `auth.users` row needs the service role. Every dependent table cascades
 * from that delete.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', {
    body: { confirm: true },
  });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let detail = error.message;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text();
        const parsed = JSON.parse(body) as { error?: string };
        detail = parsed?.error ?? body ?? detail;
      } catch {
        // Keep the original message.
      }
    }
    throw new Error(detail);
  }
}
